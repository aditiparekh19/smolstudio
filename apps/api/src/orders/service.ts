import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import sql from "mssql";
import { getDb } from "../db.js";
import { env } from "../config.js";
import { sendOrderStatusEmail } from "../notifications/service.js";

export type ShippingAddress = {
  recipientName: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  countryCode?: string;
  phone?: string;
};

export type CheckoutTotals = {
  subtotalInr: number;
  shippingInr: number;
  discountInr: number;
  taxInr: number;
  totalInr: number;
  couponCode?: string | null;
};

function razorpayConfigured() {
  return Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
}

export async function razorpayRequest<T>(path: string, init: RequestInit = {}) {
  if (!razorpayConfigured())
    throw new Error(
      "Online payment is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to the API environment.",
    );
  const auth = Buffer.from(
    `${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`,
  ).toString("base64");
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let body: any = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { error: { description: text } };
  }
  if (!response.ok)
    throw new Error(
      body?.error?.description ||
        `Payment provider error (${response.status}).`,
    );
  return body as T;
}

function verifySignature(
  orderId: string,
  paymentId: string,
  signature: string,
) {
  if (!env.RAZORPAY_KEY_SECRET || !signature) return false;
  const generated = createHmac("sha256", env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  const a = Buffer.from(generated);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyWebhookSignature(
  rawBody: string | Buffer,
  signature: string,
) {
  if (!env.RAZORPAY_WEBHOOK_SECRET || !signature) return false;
  const generated = createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  const a = Buffer.from(generated);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

function validateAddress(address: ShippingAddress) {
  const required = [
    "recipientName",
    "line1",
    "city",
    "state",
    "postalCode",
  ] as const;
  for (const key of required)
    if (!String(address[key] ?? "").trim())
      throw new Error(`Shipping ${key} is required.`);
  if (!/^\d{5,10}$/.test(String(address.postalCode).replace(/\s/g, "")))
    throw new Error("Enter a valid PIN/postal code.");
  if (address.phone && !/^[+\d][\d\s-]{7,18}$/.test(address.phone))
    throw new Error("Enter a valid phone number.");
}

export async function releaseExpiredReservations() {
  const pool = await getDb();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const rows = await new sql.Request(tx).query<any>(
      `SELECT id,variant_id variantId,quantity FROM inventory_reservations WHERE expires_at <= SYSUTCDATETIME() AND released_at IS NULL AND consumed_at IS NULL`,
    );
    for (const row of rows.recordset) {
      await new sql.Request(tx)
        .input("id", row.id)
        .input("variantId", row.variantId)
        .input("quantity", row.quantity)
        .query(
          `UPDATE inventory SET quantity_reserved=CASE WHEN quantity_reserved>=@quantity THEN quantity_reserved-@quantity ELSE 0 END,updated_at=SYSUTCDATETIME() WHERE variant_id=@variantId; UPDATE inventory_reservations SET released_at=SYSUTCDATETIME() WHERE id=@id; UPDATE orders SET status='PAYMENT_EXPIRED',payment_status='EXPIRED',updated_at=SYSUTCDATETIME() WHERE id=(SELECT order_id FROM inventory_reservations WHERE id=@id) AND status='PENDING_PAYMENT';`,
        );
    }
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}

async function validateCoupon(
  couponCode: string | null | undefined,
  customerId: string | null | undefined,
  subtotal: number,
) {
  const code = couponCode?.trim().toUpperCase();

  if (!code) {
    return { code: null, discountInr: 0 };
  }

  if (code !== "WELCOME5") {
    throw new Error("Invalid coupon code.");
  }

  if (!customerId) {
    throw new Error("WELCOME5 is available for registered customers only.");
  }

  const pool = await getDb();
  const result = await pool
    .request()
    .input("customerId", customerId)
    .query<any>(
      `SELECT COUNT(*) AS orderCount
     FROM dbo.orders
     WHERE customer_id = @customerId
       AND status = 'PAID'`,
    );

  const orderCount = Number(result.recordset[0]?.orderCount ?? 0);

  if (orderCount > 0) {
    throw new Error("WELCOME5 is available only on your first order.");
  }

  return {
    code: "WELCOME5",
    discountInr: Math.round(subtotal * 0.05 * 100) / 100,
  };
}

function calculateTotals(subtotal: number, discount: number): CheckoutTotals {
  const taxable = Math.max(0, subtotal - discount);
  const shipping =
    env.FREE_SHIPPING_THRESHOLD_INR > 0 &&
    taxable >= env.FREE_SHIPPING_THRESHOLD_INR
      ? 0
      : env.SHIPPING_FLAT_INR;
  const tax = Math.round((taxable * env.GST_RATE_PERCENT) / 100);
  return {
    subtotalInr: subtotal,
    shippingInr: shipping,
    discountInr: discount,
    taxInr: tax,
    totalInr: Math.max(0, taxable + shipping + tax),
  };
}

export async function previewCheckout(
  customerId: string,
  couponCode?: string | null,
) {
  await releaseExpiredReservations();

  const pool = await getDb();

  const items = await pool
    .request()
    .input("customerId", customerId)
    .query<any>(
      `SELECT
        ci.quantity,
        p.price_inr priceInr
       FROM carts c
       INNER JOIN cart_items ci ON ci.cart_id = c.id
       INNER JOIN product_variants v ON v.id = ci.variant_id
       INNER JOIN products p
         ON p.id = v.product_id
        AND p.is_active = 1
       WHERE c.customer_id = @customerId`,
    );

  if (!items.recordset.length) {
    throw new Error("Your bag is empty.");
  }

  const subtotal = items.recordset.reduce(
    (sum: number, x: any) => sum + Number(x.priceInr) * Number(x.quantity),
    0,
  );

  const coupon = await validateCoupon(couponCode, customerId, subtotal);

  return {
    ...calculateTotals(subtotal, coupon.discountInr),
    couponCode: coupon.code,
  };
}

export async function createPaymentOrder(
  customerId: string,
  address: ShippingAddress & { couponCode?: string | null },
) {
  validateAddress(address);
  await releaseExpiredReservations();
  const pool = await getDb();
  const items = await pool
    .request()
    .input("customerId", customerId)
    .query<any>(
      `SELECT ci.id cartItemId,ci.variant_id variantId,ci.quantity,p.id productId,p.name productName,p.price_inr priceInr,v.sku,CAST(i.quantity_available-i.quantity_reserved AS int) available FROM carts c INNER JOIN cart_items ci ON ci.cart_id=c.id INNER JOIN product_variants v ON v.id=ci.variant_id INNER JOIN products p ON p.id=v.product_id AND p.is_active=1 INNER JOIN inventory i ON i.variant_id=v.id WHERE c.customer_id=@customerId`,
    );
  if (!items.recordset.length) throw new Error("Your bag is empty.");
  const subtotal = items.recordset.reduce(
    (sum: number, item: any) =>
      sum + Number(item.priceInr) * Number(item.quantity),
    0,
  );
  const coupon = await validateCoupon(address.couponCode, customerId, subtotal);
  const totals = calculateTotals(subtotal, coupon.discountInr);
  if (totals.totalInr <= 0)
    throw new Error("Order total must be greater than zero.");
  const orderId = randomUUID();
  const orderNumber = `SS-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${orderId.slice(0, 8).toUpperCase()}`;
  const expires = new Date(
    Date.now() + env.PAYMENT_RESERVATION_MINUTES * 60_000,
  );
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    for (const item of items.recordset) {
      const lock = await new sql.Request(tx)
        .input("variantId", item.variantId)
        .input("quantity", item.quantity)
        .query<any>(
          `UPDATE inventory SET quantity_reserved=quantity_reserved+@quantity,updated_at=SYSUTCDATETIME() OUTPUT INSERTED.quantity_available-INSERTED.quantity_reserved AS available WHERE variant_id=@variantId AND quantity_available-quantity_reserved>=@quantity`,
        );
      if (!lock.recordset.length)
        throw new Error(
          `${item.productName} is no longer available in the requested quantity.`,
        );
    }
    await new sql.Request(tx)
      .input("id", orderId)
      .input("orderNumber", orderNumber)
      .input("customerId", customerId)
      .input("subtotal", totals.subtotalInr)
      .input("shipping", totals.shippingInr)
      .input("discount", totals.discountInr)
      .input("tax", totals.taxInr)
      .input("total", totals.totalInr)
      .input("address", JSON.stringify(address))
      .input("coupon", address.couponCode?.trim().toUpperCase() || null)
      .query(
        `INSERT INTO orders(id,order_number,customer_id,status,currency,subtotal_inr,shipping_inr,discount_inr,tax_inr,total_inr,shipping_address_json,payment_provider,payment_status,coupon_code) VALUES(@id,@orderNumber,@customerId,'PENDING_PAYMENT','INR',@subtotal,@shipping,@discount,@tax,@total,@address,'RAZORPAY','PENDING',@coupon)`,
      );
    for (const item of items.recordset)
      await new sql.Request(tx)
        .input("id", randomUUID())
        .input("orderId", orderId)
        .input("variantId", item.variantId)
        .input("productName", item.productName)
        .input("sku", item.sku)
        .input("quantity", item.quantity)
        .input("unitPrice", item.priceInr)
        .input("totalPrice", Number(item.priceInr) * Number(item.quantity))
        .query(
          `INSERT INTO order_items(id,order_id,variant_id,product_name,sku,quantity,unit_price_inr,total_price_inr) VALUES(@id,@orderId,@variantId,@productName,@sku,@quantity,@unitPrice,@totalPrice)`,
        );
    for (const item of items.recordset)
      await new sql.Request(tx)
        .input("id", randomUUID())
        .input("orderId", orderId)
        .input("variantId", item.variantId)
        .input("quantity", item.quantity)
        .input("expiresAt", expires)
        .query(
          `INSERT INTO inventory_reservations(id,order_id,variant_id,quantity,expires_at) VALUES(@id,@orderId,@variantId,@quantity,@expiresAt)`,
        );
    await new sql.Request(tx)
      .input("orderId", orderId)
      .input("status", "PENDING_PAYMENT")
      .query(
        `INSERT INTO order_status_history(order_id,status,note) VALUES(@orderId,@status,'Payment order created and inventory reserved.')`,
      );
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  }
  try {
    const razorOrder = await razorpayRequest<any>("/orders", {
      method: "POST",
      body: JSON.stringify({
        amount: Math.round(totals.totalInr * 100),
        currency: "INR",
        receipt: orderNumber,
        notes: { smolstudioOrderId: orderId },
      }),
    });
    await pool
      .request()
      .input("id", orderId)
      .input("paymentOrderId", razorOrder.id)
      .query(
        `UPDATE orders SET payment_order_id=@paymentOrderId,updated_at=SYSUTCDATETIME() WHERE id=@id`,
      );
    return {
      orderId,
      orderNumber,
      amount: Math.round(totals.totalInr * 100),
      currency: "INR",
      razorpayOrderId: razorOrder.id,
      keyId: env.RAZORPAY_KEY_ID!,
      ...totals,
    };
  } catch (error) {
    await releaseOrderReservation(
      orderId,
      "PAYMENT_FAILED",
      "Razorpay order creation failed.",
    );
    throw error;
  }
}

async function releaseOrderReservation(
  orderId: string,
  status?: string,
  note?: string,
) {
  const pool = await getDb();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const rows = await new sql.Request(tx)
      .input("orderId", orderId)
      .query<any>(
        `SELECT id,variant_id variantId,quantity FROM inventory_reservations WHERE order_id=@orderId AND released_at IS NULL AND consumed_at IS NULL`,
      );
    for (const row of rows.recordset)
      await new sql.Request(tx)
        .input("id", row.id)
        .input("variantId", row.variantId)
        .input("quantity", row.quantity)
        .query(
          `UPDATE inventory SET quantity_reserved=CASE WHEN quantity_reserved>=@quantity THEN quantity_reserved-@quantity ELSE 0 END,updated_at=SYSUTCDATETIME() WHERE variant_id=@variantId; UPDATE inventory_reservations SET released_at=SYSUTCDATETIME() WHERE id=@id`,
        );
    if (status)
      await new sql.Request(tx)
        .input("id", orderId)
        .input("status", status)
        .input("note", note || null)
        .query(
          `UPDATE orders SET status=@status,payment_status=CASE WHEN @status IN ('PAYMENT_FAILED','PAYMENT_EXPIRED') THEN 'FAILED' ELSE payment_status END,payment_failed_at=CASE WHEN @status IN ('PAYMENT_FAILED','PAYMENT_EXPIRED') THEN SYSUTCDATETIME() ELSE payment_failed_at END,updated_at=SYSUTCDATETIME() WHERE id=@id; INSERT INTO order_status_history(order_id,status,note) VALUES(@id,@status,@note)`,
        );
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}

async function consumeReservation(orderId: string) {
  const pool = await getDb();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const rows = await new sql.Request(tx)
      .input("orderId", orderId)
      .query<any>(
        `SELECT id,variant_id variantId,quantity FROM inventory_reservations WHERE order_id=@orderId AND released_at IS NULL AND consumed_at IS NULL`,
      );
    for (const row of rows.recordset) {
      const updated = await new sql.Request(tx)
        .input("variantId", row.variantId)
        .input("quantity", row.quantity)
        .query<any>(
          `UPDATE inventory SET quantity_available=quantity_available-@quantity,quantity_reserved=CASE WHEN quantity_reserved>=@quantity THEN quantity_reserved-@quantity ELSE 0 END,updated_at=SYSUTCDATETIME() OUTPUT INSERTED.quantity_available AS available WHERE variant_id=@variantId AND quantity_available>=@quantity AND quantity_reserved>=@quantity`,
        );
      if (!updated.recordset.length)
        throw new Error(
          "Inventory could not be finalized for this paid order.",
        );
      await new sql.Request(tx)
        .input("id", row.id)
        .query(
          `UPDATE inventory_reservations SET consumed_at=SYSUTCDATETIME() WHERE id=@id`,
        );
    }
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}

async function finalizePaidOrder(orderId: string, paymentId: string) {
  const pool = await getDb();
  const existing = await pool
    .request()
    .input("id", orderId)
    .query<any>(
      `SELECT TOP 1 payment_status paymentStatus,status,customer_id customerId,order_number orderNumber,coupon_code couponCode FROM orders WITH (UPDLOCK,HOLDLOCK) WHERE id=@id`,
    );
  const row = existing.recordset[0];
  if (!row) throw new Error("Order not found.");
  if (row.paymentStatus === "CAPTURED") return row;
  const claimed = await pool
    .request()
    .input("id", orderId)
    .query(
      `UPDATE orders SET payment_status='PROCESSING',updated_at=SYSUTCDATETIME() WHERE id=@id AND payment_status='PENDING'`,
    );
  if (!claimed.rowsAffected[0]) {
    const latest = (
      await pool
        .request()
        .input("id", orderId)
        .query<any>(
          `SELECT TOP 1 payment_status paymentStatus,status,customer_id customerId,order_number orderNumber,coupon_code couponCode FROM orders WHERE id=@id`,
        )
    ).recordset[0];
    if (
      latest?.paymentStatus === "CAPTURED" ||
      latest?.paymentStatus === "PROCESSING"
    )
      return latest;
    throw new Error(
      "Payment is already being finalized. Please retry shortly.",
    );
  }
  await consumeReservation(orderId);
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    if (row.couponCode && row.couponCode.toUpperCase() !== "WELCOME5") {
      const coupon = await new sql.Request(tx)
        .input("code", row.couponCode)
        .query<any>(
          `SELECT TOP 1 id,max_redemptions maxRedemptions,redeemed_count redeemedCount FROM coupons WHERE UPPER(code)=UPPER(@code) AND is_active=1`,
        );
      if (coupon.recordset[0]) {
        const c = coupon.recordset[0];
        const update = await new sql.Request(tx)
          .input("id", c.id)
          .input("max", c.maxRedemptions)
          .query(
            `UPDATE coupons SET redeemed_count=redeemed_count+1 WHERE id=@id AND (@max IS NULL OR redeemed_count<@max)`,
          );
        if (!update.rowsAffected[0])
          throw new Error(
            "Coupon redemption limit was reached while payment was completing.",
          );
        const discount = await new sql.Request(tx)
          .input("orderId", orderId)
          .query<any>(
            `SELECT discount_inr discount FROM orders WHERE id=@orderId`,
          );
        await new sql.Request(tx)
          .input("id", randomUUID())
          .input("couponId", c.id)
          .input("customerId", row.customerId)
          .input("orderId", orderId)
          .input("discount", discount.recordset[0]?.discount ?? 0)
          .query(
            `INSERT INTO coupon_redemptions(id,coupon_id,customer_id,order_id,discount_inr) VALUES(@id,@couponId,@customerId,@orderId,@discount)`,
          );
      }
    }
    await new sql.Request(tx)
      .input("id", orderId)
      .input("paymentId", paymentId)
      .query(
        `UPDATE orders SET status='PAID',payment_status='CAPTURED',payment_reference=@paymentId,updated_at=SYSUTCDATETIME() WHERE id=@id AND payment_status<>'CAPTURED'; INSERT INTO order_status_history(order_id,status,note) VALUES(@id,'PAID','Payment captured and inventory finalized.')`,
      );
    await new sql.Request(tx)
      .input("customerId", row.customerId)
      .query(
        `DELETE ci FROM cart_items ci INNER JOIN carts c ON c.id=ci.cart_id WHERE c.customer_id=@customerId`,
      );
    await tx.commit();
    void sendOrderStatusEmail(orderId, "PAID");
    return { ...row, status: "PAID", paymentStatus: "CAPTURED" };
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}

export async function verifyPayment(
  customerId: string,
  orderId: string,
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string,
) {
  if (!verifySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature))
    throw new Error("Payment verification failed.");
  const pool = await getDb();
  const order = await pool
    .request()
    .input("id", orderId)
    .input("customerId", customerId)
    .query<any>(
      `SELECT TOP 1 id,order_number orderNumber,total_inr totalInr,payment_order_id paymentOrderId,payment_status paymentStatus,status FROM orders WHERE id=@id AND customer_id=@customerId`,
    );
  const row = order.recordset[0];
  if (!row) throw new Error("Order not found.");
  if (row.paymentOrderId !== razorpayOrderId)
    throw new Error("Payment order does not match this order.");
  if (row.paymentStatus === "CAPTURED")
    return { orderId, orderNumber: row.orderNumber, status: "PAID" };
  const payment = await razorpayRequest<any>(
    `/payments/${encodeURIComponent(razorpayPaymentId)}`,
  );
  if (payment.order_id !== razorpayOrderId)
    throw new Error("Payment belongs to a different order.");
  if (payment.status !== "captured")
    throw new Error(
      `Payment is ${payment.status}; the order will remain pending until it is captured.`,
    );
  await finalizePaidOrder(orderId, razorpayPaymentId);
  return { orderId, orderNumber: row.orderNumber, status: "PAID" };
}

export async function handleRazorpayWebhook(
  rawBody: string | Buffer,
  signature: string,
  eventId: string | undefined,
  payload: any,
) {
  if (!verifyWebhookSignature(rawBody, signature))
    throw new Error("Invalid Razorpay webhook signature.");
  const pool = await getDb();
  const id =
    eventId ||
    payload?.id ||
    createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");
  const exists = await pool
    .request()
    .input("eventId", id)
    .query(
      `SELECT TOP 1 id FROM payment_webhook_events WHERE event_id=@eventId`,
    );
  if (exists.recordset.length) return true;
  await pool
    .request()
    .input("eventId", id)
    .input("eventType", payload?.event || "unknown")
    .input("payload", JSON.stringify(payload))
    .query(
      `INSERT INTO payment_webhook_events(event_id,event_type,payload_json) VALUES(@eventId,@eventType,@payload)`,
    );
  try {
    const payment = payload?.payload?.payment?.entity;
    const razorOrderId = payment?.order_id;
    const paymentId = payment?.id;
    const order = razorOrderId
      ? await pool
          .request()
          .input("paymentOrderId", razorOrderId)
          .query<any>(
            `SELECT TOP 1 id FROM orders WHERE payment_order_id=@paymentOrderId`,
          )
      : { recordset: [] };
    const orderId = order.recordset[0]?.id;
    if (orderId && ["payment.captured", "order.paid"].includes(payload?.event))
      await finalizePaidOrder(orderId, paymentId || "");
    if (orderId && payload?.event === "payment.failed")
      await releaseOrderReservation(
        orderId,
        "PAYMENT_FAILED",
        "Payment failed at Razorpay.",
      );
    await pool
      .request()
      .input("eventId", id)
      .query(
        `UPDATE payment_webhook_events SET processed_at=SYSUTCDATETIME() WHERE event_id=@eventId`,
      );
    return true;
  } catch (e) {
    throw e;
  }
}

function mapOrder(row: any) {
  let address: any = {};
  try {
    address = JSON.parse(row.shippingAddressJson);
  } catch {}
  return {
    ...row,
    totalInr: Number(row.totalInr),
    subtotalInr: Number(row.subtotalInr),
    shippingInr: Number(row.shippingInr),
    discountInr: Number(row.discountInr),
    taxInr: Number(row.taxInr ?? 0),
    createdAt: new Date(row.createdAt).toISOString(),
    shippedAt: row.shippedAt ? new Date(row.shippedAt).toISOString() : null,
    deliveredAt: row.deliveredAt
      ? new Date(row.deliveredAt).toISOString()
      : null,
    shippingAddress: address,
    items: row.items ?? [],
  };
}
const orderSelect = `id,order_number orderNumber,status,currency,CAST(subtotal_inr AS int) subtotalInr,CAST(shipping_inr AS int) shippingInr,CAST(discount_inr AS int) discountInr,CAST(tax_inr AS int) taxInr,CAST(total_inr AS int) totalInr,shipping_address_json shippingAddressJson,payment_status paymentStatus,tracking_number trackingNumber,carrier,tracking_url trackingUrl,created_at createdAt,shipped_at shippedAt,delivered_at deliveredAt`;

export async function listCustomerOrders(customerId: string) {
  const pool = await getDb();

  const r = await pool
    .request()
    .input("customerId", customerId)
    .query<any>(
      `SELECT ${orderSelect}
       FROM orders
       WHERE customer_id=@customerId
         AND status IN (
           'PAID',
           'PROCESSING',
           'SHIPPED',
           'DELIVERED',
           'CANCELLED',
           'REFUNDED',
           'PARTIALLY_REFUNDED'
         )
       ORDER BY created_at DESC`,
    );

  return r.recordset.map(mapOrder);
}

export async function getCustomerOrder(customerId: string, id: string) {
  const pool = await getDb();
  const r = await pool
    .request()
    .input("id", id)
    .input("customerId", customerId)
    .query<any>(
      `SELECT TOP 1 ${orderSelect} FROM orders WHERE id=@id AND customer_id=@customerId`,
    );
  const row = r.recordset[0];
  if (!row) return null;
  const items = await pool
    .request()
    .input("orderId", id)
    .query<any>(
      `SELECT id,product_name productName,sku,quantity,CAST(unit_price_inr AS int) unitPriceInr,CAST(total_price_inr AS int) totalPriceInr FROM order_items WHERE order_id=@orderId ORDER BY id`,
    );
  return { ...mapOrder(row), items: items.recordset };
}

export async function cancelCustomerOrder(
  customerId: string,
  id: string,
  reason: string,
) {
  const pool = await getDb();
  const r = await pool
    .request()
    .input("id", id)
    .input("customerId", customerId)
    .query<any>(
      `SELECT TOP 1 id,status,payment_status paymentStatus,payment_reference paymentReference,total_inr totalInr FROM orders WHERE id=@id AND customer_id=@customerId`,
    );
  const o = r.recordset[0];
  if (!o) throw new Error("Order not found.");
  if (!["PAID", "PROCESSING"].includes(o.status))
    throw new Error("This order can no longer be cancelled.");
  const shipped = (
    await pool
      .request()
      .input("id", id)
      .query(`SELECT shipped_at shippedAt FROM orders WHERE id=@id`)
  ).recordset[0]?.shippedAt;
  if (shipped) throw new Error("This order has already been shipped.");
  if (o.paymentStatus === "CAPTURED" && o.paymentReference)
    await refundPayment(
      id,
      Number(o.totalInr),
      `Customer cancellation: ${reason || "No reason provided"}`,
    );
  await restoreInventoryForOrder(id);
  await pool
    .request()
    .input("id", id)
    .input("reason", reason || null)
    .query(
      `UPDATE orders SET status='CANCELLED',cancelled_at=SYSUTCDATETIME(),cancel_reason=@reason,updated_at=SYSUTCDATETIME() WHERE id=@id; INSERT INTO order_status_history(order_id,status,note) VALUES(@id,'CANCELLED',@reason)`,
    );
  return getCustomerOrder(customerId, id);
}

async function restoreInventoryForOrder(orderId: string) {
  const pool = await getDb();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const rows = await new sql.Request(tx)
      .input("orderId", orderId)
      .query<any>(
        `SELECT variant_id variantId,quantity FROM order_items WHERE order_id=@orderId`,
      );
    for (const x of rows.recordset)
      await new sql.Request(tx)
        .input("variantId", x.variantId)
        .input("quantity", x.quantity)
        .query(
          `UPDATE inventory SET quantity_available=quantity_available+@quantity,updated_at=SYSUTCDATETIME() WHERE variant_id=@variantId`,
        );
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}

export async function refundPayment(
  orderId: string,
  amountInr: number,
  reason: string,
) {
  const pool = await getDb();
  const order = (
    await pool
      .request()
      .input("id", orderId)
      .query<any>(
        `SELECT TOP 1 payment_reference paymentReference,payment_status paymentStatus,total_inr totalInr FROM orders WHERE id=@id`,
      )
  ).recordset[0];
  if (!order) throw new Error("Order not found.");
  if (
    !["CAPTURED", "PARTIALLY_REFUNDED"].includes(order.paymentStatus) ||
    !order.paymentReference
  )
    throw new Error("Only captured payments can be refunded.");
  const max = Number(order.totalInr);
  const prior = Number(
    (
      await pool
        .request()
        .input("orderId", orderId)
        .query<any>(
          `SELECT COALESCE(SUM(amount_inr),0) refunded FROM payment_refunds WHERE order_id=@orderId AND status='PROCESSED'`,
        )
    ).recordset[0]?.refunded || 0,
  );
  const remaining = max - prior;
  if (amountInr <= 0 || amountInr > remaining)
    throw new Error(
      `Refund amount exceeds the remaining refundable amount of ₹${remaining.toLocaleString("en-IN")}.`,
    );
  const refund = await razorpayRequest<any>(
    `/payments/${encodeURIComponent(order.paymentReference)}/refund`,
    {
      method: "POST",
      body: JSON.stringify({
        amount: Math.round(amountInr * 100),
        notes: { reason: reason.slice(0, 500), smolstudioOrderId: orderId },
      }),
    },
  );
  await pool
    .request()
    .input("id", randomUUID())
    .input("orderId", orderId)
    .input("paymentReference", order.paymentReference)
    .input("refundId", refund.id)
    .input("amount", amountInr)
    .input("reason", reason)
    .query(
      `INSERT INTO payment_refunds(id,order_id,payment_reference,razorpay_refund_id,amount_inr,status,reason,processed_at) VALUES(@id,@orderId,@paymentReference,@refundId,@amount,'PROCESSED',@reason,SYSUTCDATETIME())`,
    );
  const status = amountInr >= remaining ? "REFUNDED" : "PARTIALLY_REFUNDED";
  await pool
    .request()
    .input("id", orderId)
    .input("status", status)
    .query(
      `UPDATE orders SET status=@status,payment_status=CASE WHEN @status='REFUNDED' THEN 'REFUNDED' ELSE 'PARTIALLY_REFUNDED' END,updated_at=SYSUTCDATETIME() WHERE id=@id; INSERT INTO order_status_history(order_id,status,note) VALUES(@id,@status,'Razorpay refund processed.')`,
    );
  void sendOrderStatusEmail(orderId, status);
  return refund;
}

export async function requestReturn(
  customerId: string,
  orderId: string,
  reason: string,
) {
  if (!reason.trim()) throw new Error("Return reason is required.");
  const pool = await getDb();
  const o = (
    await pool
      .request()
      .input("id", orderId)
      .input("customerId", customerId)
      .query<any>(
        `SELECT TOP 1 id,status,payment_status paymentStatus,total_inr totalInr FROM orders WHERE id=@id AND customer_id=@customerId`,
      )
  ).recordset[0];
  if (!o) throw new Error("Order not found.");
  if (o.status !== "DELIVERED")
    throw new Error("Returns can be requested after delivery.");
  const existing = await pool
    .request()
    .input("orderId", orderId)
    .query(
      `SELECT TOP 1 id FROM return_requests WHERE order_id=@orderId AND status NOT IN ('REJECTED','CANCELLED')`,
    );
  if (existing.recordset.length)
    throw new Error("A return request already exists for this order.");
  const id = randomUUID();
  await pool
    .request()
    .input("id", id)
    .input("orderId", orderId)
    .input("customerId", customerId)
    .input("reason", reason.trim())
    .input("amount", o.totalInr)
    .query(
      `INSERT INTO return_requests(id,order_id,customer_id,reason,refund_amount_inr) VALUES(@id,@orderId,@customerId,@reason,@amount)`,
    );
  return id;
}

export async function listCustomerReturns(customerId: string) {
  const pool = await getDb();
  return (
    await pool
      .request()
      .input("customerId", customerId)
      .query<any>(
        `SELECT r.id,r.order_id orderId,o.order_number orderNumber,r.reason,r.status,CAST(r.refund_amount_inr AS int) refundAmountInr,r.admin_note adminNote,r.created_at createdAt,r.updated_at updatedAt FROM return_requests r INNER JOIN orders o ON o.id=r.order_id WHERE r.customer_id=@customerId ORDER BY r.created_at DESC`,
      )
  ).recordset.map((x: any) => ({
    ...x,
    createdAt: new Date(x.createdAt).toISOString(),
    updatedAt: new Date(x.updatedAt).toISOString(),
  }));
}
