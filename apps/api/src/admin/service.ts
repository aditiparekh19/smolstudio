import { randomUUID } from "node:crypto";
import { getDb } from "../db.js";
import { refundPayment } from "../orders/service.js";
import { sendOrderStatusEmail } from "../notifications/service.js";

export const ORDER_STATUSES = [
  "PENDING_PAYMENT",
  "PAYMENT_FAILED",
  "PAYMENT_EXPIRED",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
] as const;
function mapAddress(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

export async function listAdminOrders(search?: string, status?: string) {
  const pool = await getDb();
  const request = pool.request();
  const where = ["1=1"];

  if (search?.trim()) {
    request.input("search", `%${search.trim()}%`);
    where.push(
      "(o.order_number LIKE @search OR c.email LIKE @search OR c.first_name LIKE @search OR c.last_name LIKE @search)",
    );
  }

  if (status) {
    if (!ORDER_STATUSES.includes(status as any)) {
      throw new Error("Invalid order status.");
    }

    request.input("status", status);
    where.push("o.status=@status");
  }

  const r = await request.query<any>(
    `SELECT
      o.id,
      o.order_number orderNumber,
      o.status,
      o.payment_status paymentStatus,
      o.payment_provider paymentProvider,
      o.payment_reference paymentReference,
      o.payment_order_id paymentOrderId,
      CAST(o.subtotal_inr AS decimal(12,2)) subtotalInr,
      CAST(o.shipping_inr AS decimal(12,2)) shippingInr,
      CAST(o.discount_inr AS decimal(12,2)) discountInr,
      CAST(o.tax_inr AS decimal(12,2)) taxInr,
      CAST(o.total_inr AS decimal(12,2)) totalInr,
      o.currency,
      o.shipping_address_json shippingAddressJson,
      o.tracking_number trackingNumber,
      o.carrier,
      o.tracking_url trackingUrl,
      o.created_at createdAt,
      o.updated_at updatedAt,
      o.shipped_at shippedAt,
      o.delivered_at deliveredAt,
      o.cancelled_at cancelledAt,
      o.cancel_reason cancelReason,
      o.coupon_code couponCode,
      c.id customerId,
      c.email customerEmail,
      c.first_name firstName,
      c.last_name lastName,
      c.phone customerPhone
    FROM orders o
    LEFT JOIN customers c ON c.id=o.customer_id
    WHERE ${where.join(" AND ")}
    ORDER BY o.created_at DESC`,
  );

  const orders = await Promise.all(
    r.recordset.map(async (row: any) => {
      const items = await pool
        .request()
        .input("orderId", row.id)
        .query<any>(
          `SELECT
            id,
            product_name productName,
            sku,
            quantity,
            CAST(unit_price_inr AS decimal(12,2)) unitPriceInr,
            CAST(total_price_inr AS decimal(12,2)) totalPriceInr
          FROM order_items
          WHERE order_id=@orderId
          ORDER BY id`,
        );

      const history = await pool
        .request()
        .input("orderId", row.id)
        .query<any>(
          `SELECT
            status,
            note,
            created_at createdAt
          FROM order_status_history
          WHERE order_id=@orderId
          ORDER BY created_at ASC`,
        );

      const refunds = await pool
        .request()
        .input("orderId", row.id)
        .query<any>(
          `SELECT
            id,
            razorpay_refund_id refundId,
            CAST(amount_inr AS decimal(12,2)) amountInr,
            status,
            reason,
            created_at createdAt
          FROM payment_refunds
          WHERE order_id=@orderId
          ORDER BY created_at DESC`,
        );

      return {
        ...row,

        createdAt: new Date(row.createdAt).toISOString(),
        updatedAt: new Date(row.updatedAt).toISOString(),

        shippedAt: row.shippedAt ? new Date(row.shippedAt).toISOString() : null,

        deliveredAt: row.deliveredAt
          ? new Date(row.deliveredAt).toISOString()
          : null,

        cancelledAt: row.cancelledAt
          ? new Date(row.cancelledAt).toISOString()
          : null,

        shippingAddress: mapAddress(row.shippingAddressJson),

        items: items.recordset,

        history: history.recordset.map((x: any) => ({
          ...x,
          createdAt: new Date(x.createdAt).toISOString(),
        })),

        refunds: refunds.recordset.map((x: any) => ({
          ...x,
          createdAt: new Date(x.createdAt).toISOString(),
        })),
      };
    }),
  );

  return orders;
}

export async function getAdminOrder(id: string) {
  const pool = await getDb();
  const r = await pool
    .request()
    .input("id", id)
    .query<any>(
      `SELECT TOP 1 o.id,o.order_number orderNumber,o.status,o.payment_status paymentStatus,o.payment_provider paymentProvider,o.payment_reference paymentReference,o.payment_order_id paymentOrderId,CAST(o.subtotal_inr AS decimal(12,2)) subtotalInr, CAST(o.shipping_inr AS decimal(12,2)) shippingInr, CAST(o.discount_inr AS decimal(12,2)) discountInr, CAST(o.tax_inr AS decimal(12,2)) taxInr, CAST(o.total_inr AS decimal(12,2)) totalInr,o.currency,o.shipping_address_json shippingAddressJson,o.tracking_number trackingNumber,o.carrier,o.tracking_url trackingUrl,o.created_at createdAt,o.updated_at updatedAt,o.shipped_at shippedAt,o.delivered_at deliveredAt,o.cancelled_at cancelledAt,o.cancel_reason cancelReason,o.coupon_code couponCode,c.id customerId,c.email customerEmail,c.first_name firstName,c.last_name lastName,c.phone customerPhone FROM orders o LEFT JOIN customers c ON c.id=o.customer_id WHERE o.id=@id`,
    );
  const row = r.recordset[0];
  if (!row) return null;
  const items = await pool
    .request()
    .input("orderId", id)
    .query<any>(
      `SELECT id,product_name productName,sku,quantity,CAST(unit_price_inr AS int) unitPriceInr,CAST(total_price_inr AS int) totalPriceInr FROM order_items WHERE order_id=@orderId ORDER BY id`,
    );
  const history = await pool
    .request()
    .input("orderId", id)
    .query<any>(
      `SELECT status,note,created_at createdAt FROM order_status_history WHERE order_id=@orderId ORDER BY created_at ASC`,
    );
  const refunds = await pool
    .request()
    .input("orderId", id)
    .query<any>(
      `SELECT id,razorpay_refund_id refundId,CAST(amount_inr AS decimal(12,2)) amountInr,status,reason,created_at createdAt FROM payment_refunds WHERE order_id=@orderId ORDER BY created_at DESC`,
    );
  return {
    ...row,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
    shippedAt: row.shippedAt ? new Date(row.shippedAt).toISOString() : null,
    deliveredAt: row.deliveredAt
      ? new Date(row.deliveredAt).toISOString()
      : null,
    cancelledAt: row.cancelledAt
      ? new Date(row.cancelledAt).toISOString()
      : null,
    shippingAddress: mapAddress(row.shippingAddressJson),
    items: items.recordset,
    history: history.recordset.map((x: any) => ({
      ...x,
      createdAt: new Date(x.createdAt).toISOString(),
    })),
    refunds: refunds.recordset.map((x: any) => ({
      ...x,
      createdAt: new Date(x.createdAt).toISOString(),
    })),
  };
}

export async function updateAdminOrder(input: {
  id: string;
  status: string;
  trackingNumber?: string | null;
  carrier?: string | null;
  trackingUrl?: string | null;
  note?: string | null;
}) {
  if (!ORDER_STATUSES.includes(input.status as any))
    throw new Error("Invalid order status.");
  const pool = await getDb();
  const current = (
    await pool
      .request()
      .input("id", input.id)
      .query<any>(
        `SELECT TOP 1 status,payment_status paymentStatus FROM orders WHERE id=@id`,
      )
  ).recordset[0];
  if (!current) throw new Error("Order not found.");
  if (
    current.status === "DELIVERED" &&
    input.status !== "REFUNDED" &&
    input.status !== "PARTIALLY_REFUNDED"
  )
    throw new Error("Delivered orders cannot be moved backwards.");
  await pool
    .request()
    .input("id", input.id)
    .input("status", input.status)
    .input("trackingNumber", input.trackingNumber?.trim() || null)
    .input("carrier", input.carrier?.trim() || null)
    .input("trackingUrl", input.trackingUrl?.trim() || null)
    .input("note", input.note?.trim() || null)
    .query(
      `UPDATE orders SET status=@status,tracking_number=@trackingNumber,carrier=@carrier,tracking_url=@trackingUrl,shipped_at=CASE WHEN @status='SHIPPED' AND shipped_at IS NULL THEN SYSUTCDATETIME() ELSE shipped_at END,delivered_at=CASE WHEN @status='DELIVERED' AND delivered_at IS NULL THEN SYSUTCDATETIME() ELSE delivered_at END,updated_at=SYSUTCDATETIME() WHERE id=@id; INSERT INTO order_status_history(order_id,status,note) VALUES(@id,@status,@note)`,
    );
  void sendOrderStatusEmail(input.id, input.status);
  return getAdminOrder(input.id);
}

export async function adminRefundOrder(
  orderId: string,
  amountInr: number,
  reason: string,
) {
  return refundPayment(orderId, amountInr, reason || "Admin refund");
}

export async function listAdminCustomers(search?: string) {
  const pool = await getDb();
  const request = pool.request();
  const where = ["1=1"];

  if (search?.trim()) {
    request.input("search", `%${search.trim()}%`);

    where.push(
      "(c.email LIKE @search OR " +
        "c.first_name LIKE @search OR " +
        "c.last_name LIKE @search OR " +
        "c.phone LIKE @search)",
    );
  }

  const r = await request.query<any>(
    `
      SELECT
        c.id,
        c.email,
        c.phone,
        c.first_name firstName,
        c.last_name lastName,
        c.role,
        c.created_at createdAt,

        COUNT(o.id) orderCount,

        CAST(
          COALESCE(
            SUM(
              CASE
                WHEN o.payment_status IN ('CAPTURED', 'PARTIALLY_REFUNDED')
                THEN o.total_inr
                ELSE 0
              END
            ),
            0
          )
          AS int
        ) totalSpentInr

      FROM customers c

      LEFT JOIN orders o
        ON o.customer_id = c.id

      WHERE ${where.join(" AND ")}

      GROUP BY
        c.id,
        c.email,
        c.phone,
        c.first_name,
        c.last_name,
        c.role,
        c.created_at

      ORDER BY c.created_at DESC
    `,
  );

  const customers = await Promise.all(
    r.recordset.map(async (x: any) => {
      const ordersResult = await pool
        .request()
        .input("customerId", x.id)
        .query<any>(
          `
            SELECT
              id,
              order_number orderNumber,
              status,
              payment_status paymentStatus,
              CAST(total_inr AS int) totalInr,
              created_at createdAt
            FROM orders
            WHERE customer_id = @customerId
            ORDER BY created_at DESC
          `,
        );

      const addressesResult = await pool
        .request()
        .input("customerId", x.id)
        .query<any>(
          `
            SELECT
              id,
              label,
              recipient_name recipientName,
              line1,
              line2,
              city,
              state,
              postal_code postalCode,
              country_code countryCode,
              phone
            FROM addresses
            WHERE customer_id = @customerId
            ORDER BY created_at DESC
          `,
        );

      return {
        id: x.id,
        email: x.email,
        phone: x.phone,
        firstName: x.firstName,
        lastName: x.lastName,
        role: x.role,
        createdAt: new Date(x.createdAt).toISOString(),

        orderCount: Number(x.orderCount ?? 0),
        totalSpentInr: Number(x.totalSpentInr ?? 0),

        orders: ordersResult.recordset.map((order: any) => ({
          ...order,
          totalInr: Number(order.totalInr ?? 0),
          createdAt: new Date(order.createdAt).toISOString(),
        })),

        addresses: addressesResult.recordset.map((address: any) => ({
          ...address,
        })),
      };
    }),
  );

  return customers;
}

export async function getAdminCustomer(id: string) {
  const pool = await getDb();
  const c = (
    await pool
      .request()
      .input("id", id)
      .query<any>(
        `SELECT TOP 1 id,email,phone,first_name firstName,last_name lastName,role,created_at createdAt FROM customers WHERE id=@id`,
      )
  ).recordset[0];
  if (!c) return null;
  const orders = await pool
    .request()
    .input("customerId", id)
    .query<any>(
      `SELECT id,order_number orderNumber,status,payment_status paymentStatus,CAST(total_inr AS int) totalInr,created_at createdAt FROM orders WHERE customer_id=@customerId ORDER BY created_at DESC`,
    );
  const addresses = await pool
    .request()
    .input("customerId", id)
    .query<any>(
      `SELECT id,label,recipient_name recipientName,line1,line2,city,state,postal_code postalCode,country_code countryCode,phone FROM addresses WHERE customer_id=@customerId ORDER BY created_at DESC`,
    );
  return {
    ...c,
    createdAt: new Date(c.createdAt).toISOString(),
    orders: orders.recordset.map((x: any) => ({
      ...x,
      createdAt: new Date(x.createdAt).toISOString(),
    })),
    addresses: addresses.recordset,
  };
}
export async function adminDashboardStats() {
  const pool = await getDb();
  const r = await pool
    .request()
    .query<any>(
      `SELECT (SELECT COUNT(*) FROM products) productCount,(SELECT COUNT(*) FROM products WHERE is_active=1) activeProductCount,(SELECT COUNT(*) FROM customers WHERE role='CUSTOMER') customerCount,(SELECT COUNT(*) FROM orders) orderCount,(SELECT COUNT(*) FROM orders WHERE status IN ('PAID','PROCESSING')) pendingOrderCount,(SELECT CAST(COALESCE(SUM(CASE WHEN payment_status IN ('CAPTURED','PARTIALLY_REFUNDED') THEN total_inr ELSE 0 END),0) AS decimal(12,2)) FROM orders) revenueInr,(SELECT COUNT(*) FROM return_requests WHERE status='REQUESTED') returnRequestCount,(SELECT COUNT(*) FROM products p INNER JOIN product_variants v ON v.product_id=p.id INNER JOIN inventory i ON i.variant_id=v.id WHERE p.is_active=1 AND i.quantity_available-i.quantity_reserved<=0) outOfStockCount`,
    );
  return r.recordset[0];
}

export async function listCategoriesAdmin() {
  const pool = await getDb();
  return (
    await pool
      .request()
      .query<any>(
        `SELECT id,slug,name,sort_order sortOrder,is_active isActive FROM categories ORDER BY sort_order,name`,
      )
  ).recordset.map((x: any) => ({ ...x, isActive: Boolean(x.isActive) }));
}
function slugify(v: string) {
  return v
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}
export async function saveCategory(input: {
  id?: string;
  name: string;
  slug?: string;
  sortOrder?: number;
  isActive?: boolean;
}) {
  if (!input.name.trim()) throw new Error("Category name is required.");
  const id = input.id || randomUUID();
  const pool = await getDb();
  const slug = slugify(input.slug || input.name);
  if (!slug) throw new Error("A valid category slug is required.");
  if (input.id)
    await pool
      .request()
      .input("id", id)
      .input("name", input.name.trim())
      .input("slug", slug)
      .input("sortOrder", input.sortOrder ?? 0)
      .input("active", input.isActive === false ? 0 : 1)
      .query(
        `UPDATE categories SET name=@name,slug=@slug,sort_order=@sortOrder,is_active=@active WHERE id=@id`,
      );
  else
    await pool
      .request()
      .input("id", id)
      .input("name", input.name.trim())
      .input("slug", slug)
      .input("sortOrder", input.sortOrder ?? 0)
      .query(
        `INSERT INTO categories(id,name,slug,sort_order,is_active) VALUES(@id,@name,@slug,@sortOrder,1)`,
      );
  return listCategoriesAdmin();
}
export async function deleteCategory(id: string) {
  const pool = await getDb();
  const used =
    (
      await pool
        .request()
        .input("id", id)
        .query(`SELECT COUNT(*) count FROM products WHERE category_id=@id`)
    ).recordset[0]?.count ?? 0;
  if (Number(used) > 0) {
    await pool
      .request()
      .input("id", id)
      .query(`UPDATE categories SET is_active=0 WHERE id=@id`);
    return true;
  }
  await pool
    .request()
    .input("id", id)
    .query(`DELETE FROM categories WHERE id=@id`);
  return true;
}

export async function listCoupons() {
  const pool = await getDb();
  return (
    await pool
      .request()
      .query<any>(
        `SELECT id,code,discount_type discountType,discount_value discountValue,min_order_inr minOrderInr,max_discount_inr maxDiscountInr,max_redemptions maxRedemptions,redeemed_count redeemedCount,starts_at startsAt,ends_at endsAt,is_active isActive FROM coupons ORDER BY starts_at DESC`,
      )
  ).recordset.map((x: any) => ({
    ...x,
    isActive: Boolean(x.isActive),
    startsAt: new Date(x.startsAt).toISOString(),
    endsAt: x.endsAt ? new Date(x.endsAt).toISOString() : null,
  }));
}
export async function saveCoupon(input: any) {
  const code = String(input.code || "")
    .trim()
    .toUpperCase();
  if (
    !code ||
    !["PERCENT", "FIXED"].includes(input.discountType) ||
    Number(input.discountValue) <= 0
  )
    throw new Error("Valid coupon code, type and discount are required.");
  const pool = await getDb();
  const id = input.id || randomUUID();
  const startsAt = new Date(input.startsAt || Date.now());
  const endsAt = input.endsAt ? new Date(input.endsAt) : null;
  if (input.id)
    await pool
      .request()
      .input("id", id)
      .input("code", code)
      .input("type", input.discountType)
      .input("value", input.discountValue)
      .input("min", input.minOrderInr || 0)
      .input("maxDiscount", input.maxDiscountInr ?? null)
      .input("maxRedemptions", input.maxRedemptions ?? null)
      .input("startsAt", startsAt)
      .input("endsAt", endsAt)
      .input("active", input.isActive === false ? 0 : 1)
      .query(
        `UPDATE coupons SET code=@code,discount_type=@type,discount_value=@value,min_order_inr=@min,max_discount_inr=@maxDiscount,max_redemptions=@maxRedemptions,starts_at=@startsAt,ends_at=@endsAt,is_active=@active WHERE id=@id`,
      );
  else
    await pool
      .request()
      .input("id", id)
      .input("code", code)
      .input("type", input.discountType)
      .input("value", input.discountValue)
      .input("min", input.minOrderInr || 0)
      .input("maxDiscount", input.maxDiscountInr ?? null)
      .input("maxRedemptions", input.maxRedemptions ?? null)
      .input("startsAt", startsAt)
      .input("endsAt", endsAt)
      .query(
        `INSERT INTO coupons(id,code,discount_type,discount_value,min_order_inr,max_discount_inr,max_redemptions,starts_at,ends_at,is_active) VALUES(@id,@code,@type,@value,@min,@maxDiscount,@maxRedemptions,@startsAt,@endsAt,1)`,
      );
  return listCoupons();
}
export async function deleteCoupon(id: string) {
  const pool = await getDb();
  await pool
    .request()
    .input("id", id)
    .query(`UPDATE coupons SET is_active=0 WHERE id=@id`);
  return true;
}

export async function listReturnRequests(status?: string) {
  const pool = await getDb();
  const req = pool.request();
  let where = "1=1";
  if (status) {
    req.input("status", status);
    where = "r.status=@status";
  }
  const r = await req.query<any>(
    `SELECT r.id,r.order_id orderId,o.order_number orderNumber,r.customer_id customerId,c.email customerEmail,r.reason,r.status,CAST(r.refund_amount_inr AS int) refundAmountInr,r.admin_note adminNote,r.created_at createdAt,r.updated_at updatedAt FROM return_requests r INNER JOIN orders o ON o.id=r.order_id LEFT JOIN customers c ON c.id=r.customer_id WHERE ${where} ORDER BY r.created_at DESC`,
  );
  return r.recordset.map((x: any) => ({
    ...x,
    createdAt: new Date(x.createdAt).toISOString(),
    updatedAt: new Date(x.updatedAt).toISOString(),
  }));
}
export async function updateReturnRequest(
  id: string,
  status: string,
  adminNote?: string | null,
) {
  if (!["APPROVED", "REJECTED", "CANCELLED"].includes(status))
    throw new Error("Invalid return status.");
  const pool = await getDb();
  const r = (
    await pool
      .request()
      .input("id", id)
      .query<any>(
        `SELECT TOP 1 order_id orderId,refund_amount_inr amount,status currentStatus FROM return_requests WHERE id=@id`,
      )
  ).recordset[0];
  if (!r) throw new Error("Return request not found.");
  if (r.currentStatus !== "REQUESTED")
    throw new Error("Return request is already processed.");
  if (status === "APPROVED") {
    await refundPayment(
      r.orderId,
      Number(r.amount),
      adminNote || "Approved return",
    );
  }
  await pool
    .request()
    .input("id", id)
    .input("status", status)
    .input("note", adminNote?.trim() || null)
    .query(
      `UPDATE return_requests SET status=@status,admin_note=@note,updated_at=SYSUTCDATETIME() WHERE id=@id`,
    );
  return true;
}

export async function saveAddress(customerId: string, input: any) {
  if (
    !input.recipientName ||
    !input.line1 ||
    !input.city ||
    !input.state ||
    !input.postalCode
  )
    throw new Error("Complete address details are required.");
  const pool = await getDb();
  const id = input.id || randomUUID();
  if (input.id)
    await pool
      .request()
      .input("id", id)
      .input("customerId", customerId)
      .input("label", input.label || null)
      .input("recipientName", input.recipientName)
      .input("line1", input.line1)
      .input("line2", input.line2 || null)
      .input("city", input.city)
      .input("state", input.state)
      .input("postalCode", input.postalCode)
      .input("countryCode", input.countryCode || "IN")
      .input("phone", input.phone || null)
      .query(
        `UPDATE addresses SET label=@label,recipient_name=@recipientName,line1=@line1,line2=@line2,city=@city,state=@state,postal_code=@postalCode,country_code=@countryCode,phone=@phone WHERE id=@id AND customer_id=@customerId`,
      );
  else
    await pool
      .request()
      .input("id", id)
      .input("customerId", customerId)
      .input("label", input.label || null)
      .input("recipientName", input.recipientName)
      .input("line1", input.line1)
      .input("line2", input.line2 || null)
      .input("city", input.city)
      .input("state", input.state)
      .input("postalCode", input.postalCode)
      .input("countryCode", input.countryCode || "IN")
      .input("phone", input.phone || null)
      .query(
        `INSERT INTO addresses(id,customer_id,label,recipient_name,line1,line2,city,state,postal_code,country_code,phone) VALUES(@id,@customerId,@label,@recipientName,@line1,@line2,@city,@state,@postalCode,@countryCode,@phone)`,
      );
  return listAddresses(customerId);
}
export async function listAddresses(customerId: string) {
  const pool = await getDb();
  return (
    await pool
      .request()
      .input("customerId", customerId)
      .query<any>(
        `SELECT id,label,recipient_name recipientName,line1,line2,city,state,postal_code postalCode,country_code countryCode,phone FROM addresses WHERE customer_id=@customerId ORDER BY created_at DESC`,
      )
  ).recordset;
}
export async function deleteAddress(customerId: string, id: string) {
  const pool = await getDb();
  await pool
    .request()
    .input("id", id)
    .input("customerId", customerId)
    .query(`DELETE FROM addresses WHERE id=@id AND customer_id=@customerId`);
  return listAddresses(customerId);
}
