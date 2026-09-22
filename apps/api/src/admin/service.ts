import { randomUUID } from "node:crypto";
import { getDb } from "../db.js";
import {
  refundPayment,
  calculateOrderItemPaidAmount,
} from "../orders/service.js";
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

/* =========================================================
   ADMIN ORDERS
========================================================= */

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

        subtotalInr: Number(row.subtotalInr ?? 0),
        shippingInr: Number(row.shippingInr ?? 0),
        discountInr: Number(row.discountInr ?? 0),
        taxInr: Number(row.taxInr ?? 0),
        totalInr: Number(row.totalInr ?? 0),

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

        items: items.recordset.map((item: any) => ({
          ...item,
          unitPriceInr: Number(item.unitPriceInr ?? 0),
          totalPriceInr: Number(item.totalPriceInr ?? 0),
        })),

        history: history.recordset.map((x: any) => ({
          ...x,
          createdAt: new Date(x.createdAt).toISOString(),
        })),

        refunds: refunds.recordset.map((x: any) => ({
          ...x,
          amountInr: Number(x.amountInr ?? 0),
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
      `SELECT TOP 1
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
      WHERE o.id=@id`,
    );

  const row = r.recordset[0];

  if (!row) return null;

  const items = await pool
    .request()
    .input("orderId", id)
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
    .input("orderId", id)
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
    .input("orderId", id)
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

    subtotalInr: Number(row.subtotalInr ?? 0),
    shippingInr: Number(row.shippingInr ?? 0),
    discountInr: Number(row.discountInr ?? 0),
    taxInr: Number(row.taxInr ?? 0),
    totalInr: Number(row.totalInr ?? 0),

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

    items: items.recordset.map((item: any) => ({
      ...item,
      unitPriceInr: Number(item.unitPriceInr ?? 0),
      totalPriceInr: Number(item.totalPriceInr ?? 0),
    })),

    history: history.recordset.map((x: any) => ({
      ...x,
      createdAt: new Date(x.createdAt).toISOString(),
    })),

    refunds: refunds.recordset.map((x: any) => ({
      ...x,
      amountInr: Number(x.amountInr ?? 0),
      createdAt: new Date(x.createdAt).toISOString(),
    })),
  };
}

/* =========================================================
   UPDATE ADMIN ORDER
========================================================= */

export async function updateAdminOrder(input: {
  id: string;
  status: string;
  trackingNumber?: string | null;
  carrier?: string | null;
  trackingUrl?: string | null;
  note?: string | null;
}) {
  if (!ORDER_STATUSES.includes(input.status as any)) {
    throw new Error("Invalid order status.");
  }

  const pool = await getDb();

  const current = (
    await pool
      .request()
      .input("id", input.id)
      .query<any>(
        `
      SELECT TOP 1
        status,
        payment_status paymentStatus,
        payment_provider paymentProvider
      FROM orders
      WHERE id=@id
      `,
      )
  ).recordset[0];

  if (!current) {
    throw new Error("Order not found.");
  }

  if (
    current.status === "DELIVERED" &&
    input.status !== "REFUNDED" &&
    input.status !== "PARTIALLY_REFUNDED"
  ) {
    throw new Error("Delivered orders cannot be moved backwards.");
  }

  await pool
    .request()
    .input("id", input.id)
    .input("status", input.status)
    .input("trackingNumber", input.trackingNumber?.trim() || null)
    .input("carrier", input.carrier?.trim() || null)
    .input("trackingUrl", input.trackingUrl?.trim() || null)
    .input("note", input.note?.trim() || null)
    .query(
      `UPDATE orders
       SET
         status=@status,
         tracking_number=@trackingNumber,
         carrier=@carrier,
         tracking_url=@trackingUrl,
         shipped_at=CASE
           WHEN @status='SHIPPED' AND shipped_at IS NULL
           THEN SYSUTCDATETIME()
           ELSE shipped_at
         END,
         delivered_at=CASE
           WHEN @status='DELIVERED' AND delivered_at IS NULL
           THEN SYSUTCDATETIME()
           ELSE delivered_at
         END,
         updated_at=SYSUTCDATETIME()
       WHERE id=@id;

       INSERT INTO order_status_history(order_id,status,note)
       VALUES(@id,@status,@note)`,
    );

  if (input.status === "DELIVERED") {
    await pool
      .request()
      .input("replacementOrderId", input.id)
      .query(
        `
      UPDATE return_requests
      SET
        status = 'COMPLETED',
        completed_at = COALESCE(completed_at, SYSUTCDATETIME()),
        replacement_fulfilled_at =
          COALESCE(replacement_fulfilled_at, SYSUTCDATETIME()),
        admin_note = 'Replacement order delivered',
        updated_at = SYSUTCDATETIME()
      WHERE replacement_order_id = @replacementOrderId
        AND request_type = 'SIZE_REPLACEMENT'
        AND status = 'PROCESSING'
        AND reviewed_at IS NOT NULL
      `,
      );
  }

  void sendOrderStatusEmail(input.id, input.status);

  return getAdminOrder(input.id);
}

/* =========================================================
   ADMIN RAZORPAY REFUND
========================================================= */

export async function adminRefundOrder(
  orderId: string,
  amountInr: number,
  reason: string,
) {
  const pool = await getDb();

  const order = (
    await pool
      .request()
      .input("orderId", orderId)
      .query<any>(
        `
        SELECT TOP 1
          id,
          status,
          payment_status paymentStatus,
          payment_provider paymentProvider,
          payment_reference paymentReference,
          CAST(total_inr AS decimal(12,2)) totalInr,
          CAST(
            COALESCE(store_credit_applied_inr, 0)
            AS decimal(12,2)
          ) storeCreditAppliedInr
        FROM orders
        WHERE id=@orderId
        `,
      )
  ).recordset[0];

  if (!order) {
    throw new Error("Order not found.");
  }

  const refundRequest = (
    await pool
      .request()
      .input("orderId", orderId)
      .query<any>(
        `
        SELECT TOP 1
          id,
          status,
          CAST(
            COALESCE(refund_amount_inr, 0)
            AS decimal(12,2)
          ) refundAmountInr
        FROM return_requests
        WHERE order_id=@orderId
          AND status='REQUESTED'
          AND request_type IS NULL
          AND refund_amount_inr IS NOT NULL
          AND refund_amount_inr > 0
        ORDER BY created_at DESC
        `,
      )
  ).recordset[0];

  if (!refundRequest) {
    throw new Error("No pending refund request exists for this order.");
  }

  if (
    order.paymentProvider !== "RAZORPAY" ||
    !["CAPTURED", "PARTIALLY_REFUNDED"].includes(order.paymentStatus) ||
    !order.paymentReference
  ) {
    throw new Error("This order does not have a refundable Razorpay payment.");
  }

  const refundTotals = (
    await pool
      .request()
      .input("orderId", orderId)
      .query<any>(
        `
        SELECT
          CAST(
            COALESCE(
              SUM(
                CASE
                  WHEN status IN ('PENDING', 'PROCESSED')
                  THEN amount_inr
                  ELSE 0
                END
              ),
              0
            )
            AS decimal(12,2)
          ) refundedInr
        FROM payment_refunds
        WHERE order_id=@orderId
        `,
      )
  ).recordset[0];

  const razorpayPaidAmount = Math.max(
    0,
    Number(order.totalInr ?? 0) - Number(order.storeCreditAppliedInr ?? 0),
  );

  const alreadyRefunded = Number(refundTotals?.refundedInr ?? 0);

  const razorpayRemaining = Math.max(0, razorpayPaidAmount - alreadyRefunded);

  const requestedRefundAmount = Number(refundRequest.refundAmountInr ?? 0);

  const requestRemaining = Math.max(0, requestedRefundAmount - alreadyRefunded);

  const remainingRefundable = Math.max(
    0,
    Math.round(Math.min(razorpayRemaining, requestRemaining) * 100) / 100,
  );

  if (remainingRefundable <= 0) {
    throw new Error("This refund request has already been fully refunded.");
  }

  const requestedAmount = Math.round(Number(amountInr) * 100) / 100;

  if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
    throw new Error("Refund amount must be greater than zero.");
  }

  if (requestedAmount > remainingRefundable) {
    throw new Error(
      `Refund amount cannot exceed the remaining refundable amount of ₹${remainingRefundable.toFixed(
        2,
      )}.`,
    );
  }

  return refundPayment(
    orderId,
    requestedAmount,
    reason?.trim() || "Admin refund",
  );
}

/* =========================================================
   ADMIN CUSTOMERS
========================================================= */

export async function listAdminCustomers(search?: string) {
  const pool = await getDb();
  const request = pool.request();

  const where = ["c.role = 'CUSTOMER'"];

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

        (
          SELECT COUNT(*)
          FROM return_requests rr
          WHERE rr.customer_id = c.id
            AND rr.status = 'COMPLETED'
            AND ISNULL(rr.request_type, '') <> 'SIZE_REPLACEMENT'
        ) AS returnCount,

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
          AS decimal(12,2)
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

  const customers = r.recordset;

  return Promise.all(
    customers.map(async (customer: any) => {
      const addressResult = await pool
        .request()
        .input("customerId", customer.id)
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
        ...customer,

        createdAt: new Date(customer.createdAt).toISOString(),

        orderCount: Number(customer.orderCount ?? 0),

        returnCount: Number(customer.returnCount ?? 0),

        totalSpentInr: Number(customer.totalSpentInr ?? 0),

        addresses: addressResult.recordset,
      };
    }),
  );
}

export async function getAdminCustomer(id: string) {
  const pool = await getDb();

  const c = (
    await pool
      .request()
      .input("id", id)
      .query<any>(
        `SELECT TOP 1
          id,
          email,
          phone,
          first_name firstName,
          last_name lastName,
          role,
          created_at createdAt
        FROM customers
        WHERE id=@id`,
      )
  ).recordset[0];

  if (!c) return null;

  const orders = await pool
    .request()
    .input("customerId", id)
    .query<any>(
      `SELECT
        id,
        order_number orderNumber,
        status,
        payment_status paymentStatus,
        CAST(total_inr AS decimal(12,2)) totalInr,
        created_at createdAt
      FROM orders
      WHERE customer_id=@customerId
      ORDER BY created_at DESC`,
    );

  const addresses = await pool
    .request()
    .input("customerId", id)
    .query<any>(
      `SELECT
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
      WHERE customer_id=@customerId
      ORDER BY created_at DESC`,
    );

  return {
    ...c,
    createdAt: new Date(c.createdAt).toISOString(),

    orders: orders.recordset.map((x: any) => ({
      ...x,
      totalInr: Number(x.totalInr ?? 0),
      createdAt: new Date(x.createdAt).toISOString(),
    })),

    addresses: addresses.recordset,
  };
}

/* =========================================================
   DASHBOARD
========================================================= */

export async function adminDashboardStats() {
  const pool = await getDb();

  const r = await pool.request().query<any>(
    `SELECT
        (SELECT COUNT(*) FROM products) productCount,

        (SELECT COUNT(*)
         FROM products
         WHERE is_active=1) activeProductCount,

        (SELECT COUNT(*)
         FROM customers
         WHERE role='CUSTOMER') customerCount,

        (SELECT COUNT(*) FROM orders) orderCount,

        (SELECT COUNT(*)
         FROM orders
         WHERE status IN ('PAID','PROCESSING')) pendingOrderCount,

        (SELECT
          CAST(
            COALESCE(
              SUM(
                CASE
                  WHEN payment_status IN ('CAPTURED','PARTIALLY_REFUNDED')
                  THEN total_inr
                  ELSE 0
                END
              ),
              0
            )
            AS decimal(12,2)
          )
         FROM orders) revenueInr,

        (SELECT COUNT(*)
         FROM return_requests
         WHERE status='REQUESTED') returnRequestCount,

        (SELECT COUNT(*)
         FROM products p
         INNER JOIN product_variants v
           ON v.product_id=p.id
         INNER JOIN inventory i
           ON i.variant_id=v.id
         WHERE p.is_active=1
           AND i.quantity_available-i.quantity_reserved<=0) outOfStockCount`,
  );

  return {
    ...r.recordset[0],
    productCount: Number(r.recordset[0]?.productCount ?? 0),
    activeProductCount: Number(r.recordset[0]?.activeProductCount ?? 0),
    customerCount: Number(r.recordset[0]?.customerCount ?? 0),
    orderCount: Number(r.recordset[0]?.orderCount ?? 0),
    pendingOrderCount: Number(r.recordset[0]?.pendingOrderCount ?? 0),
    revenueInr: Number(r.recordset[0]?.revenueInr ?? 0),
    returnRequestCount: Number(r.recordset[0]?.returnRequestCount ?? 0),
    outOfStockCount: Number(r.recordset[0]?.outOfStockCount ?? 0),
  };
}

/* =========================================================
   CATEGORIES
========================================================= */

export async function listCategoriesAdmin() {
  const pool = await getDb();

  return (
    await pool.request().query<any>(
      `SELECT
          id,
          slug,
          name,
          sort_order sortOrder,
          is_active isActive
        FROM categories
        ORDER BY sort_order,name`,
    )
  ).recordset.map((x: any) => ({
    ...x,
    isActive: Boolean(x.isActive),
  }));
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
  if (!input.name.trim()) {
    throw new Error("Category name is required.");
  }

  const id = input.id || randomUUID();
  const pool = await getDb();
  const slug = slugify(input.slug || input.name);

  if (!slug) {
    throw new Error("A valid category slug is required.");
  }

  if (input.id) {
    await pool
      .request()
      .input("id", id)
      .input("name", input.name.trim())
      .input("slug", slug)
      .input("sortOrder", input.sortOrder ?? 0)
      .input("active", input.isActive === false ? 0 : 1)
      .query(
        `UPDATE categories
         SET
           name=@name,
           slug=@slug,
           sort_order=@sortOrder,
           is_active=@active
         WHERE id=@id`,
      );
  } else {
    await pool
      .request()
      .input("id", id)
      .input("name", input.name.trim())
      .input("slug", slug)
      .input("sortOrder", input.sortOrder ?? 0)
      .query(
        `INSERT INTO categories(
          id,
          name,
          slug,
          sort_order,
          is_active
        )
        VALUES(
          @id,
          @name,
          @slug,
          @sortOrder,
          1
        )`,
      );
  }

  return listCategoriesAdmin();
}

export async function deleteCategory(id: string) {
  const pool = await getDb();

  const used =
    (
      await pool
        .request()
        .input("id", id)
        .query(
          `SELECT COUNT(*) count
           FROM products
           WHERE category_id=@id`,
        )
    ).recordset[0]?.count ?? 0;

  if (Number(used) > 0) {
    await pool
      .request()
      .input("id", id)
      .query(
        `UPDATE categories
         SET is_active=0
         WHERE id=@id`,
      );

    return true;
  }

  await pool
    .request()
    .input("id", id)
    .query(`DELETE FROM categories WHERE id=@id`);

  return true;
}

/* =========================================================
   COUPONS
========================================================= */

export async function listCoupons() {
  const pool = await getDb();

  return (
    await pool.request().query<any>(
      `SELECT
          id,
          code,
          discount_type discountType,
          discount_value discountValue,
          min_order_inr minOrderInr,
          max_discount_inr maxDiscountInr,
          max_redemptions maxRedemptions,
          redeemed_count redeemedCount,
          starts_at startsAt,
          ends_at endsAt,
          is_active isActive
        FROM coupons
        ORDER BY starts_at DESC`,
    )
  ).recordset.map((x: any) => ({
    ...x,
    discountValue: Number(x.discountValue ?? 0),
    minOrderInr: Number(x.minOrderInr ?? 0),
    maxDiscountInr: x.maxDiscountInr == null ? null : Number(x.maxDiscountInr),
    maxRedemptions: x.maxRedemptions == null ? null : Number(x.maxRedemptions),
    redeemedCount: Number(x.redeemedCount ?? 0),
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
  ) {
    throw new Error("Valid coupon code, type and discount are required.");
  }

  const pool = await getDb();
  const id = input.id || randomUUID();
  const startsAt = new Date(input.startsAt || Date.now());
  const endsAt = input.endsAt ? new Date(input.endsAt) : null;

  if (input.id) {
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
        `UPDATE coupons
         SET
           code=@code,
           discount_type=@type,
           discount_value=@value,
           min_order_inr=@min,
           max_discount_inr=@maxDiscount,
           max_redemptions=@maxRedemptions,
           starts_at=@startsAt,
           ends_at=@endsAt,
           is_active=@active
         WHERE id=@id`,
      );
  } else {
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
        `INSERT INTO coupons(
          id,
          code,
          discount_type,
          discount_value,
          min_order_inr,
          max_discount_inr,
          max_redemptions,
          starts_at,
          ends_at,
          is_active
        )
        VALUES(
          @id,
          @code,
          @type,
          @value,
          @min,
          @maxDiscount,
          @maxRedemptions,
          @startsAt,
          @endsAt,
          1
        )`,
      );
  }

  return listCoupons();
}

export async function deleteCoupon(id: string) {
  const pool = await getDb();

  await pool
    .request()
    .input("id", id)
    .query(
      `UPDATE coupons
       SET is_active=0
       WHERE id=@id`,
    );

  return true;
}

/* =========================================================
   AFTER-SALES / RETURN REQUESTS
========================================================= */

/**
 * Lists refund/return requests for the admin Returns screen:
 *
 * 1. New product-fault requests:
 *    PRODUCT_FAULT
 *
 * 2. Legacy return requests:
 *    requestType = NULL
 *
 * SIZE_REPLACEMENT requests are handled separately
 * in the admin After-Sales Requests screen.
 *
 * New fields are deliberately nullable so old rows continue
 * to work.
 */
export async function listReturnRequests(status?: string) {
  const pool = await getDb();
  const req = pool.request();

  let where =
    "(r.request_type IS NULL OR r.request_type IN ('PRODUCT_FAULT', 'SIZE_REPLACEMENT'))";

  if (status?.trim()) {
    req.input("status", status.trim());
    where += " AND r.status=@status";
  }

  const r = await req.query<any>(
    `SELECT
      r.id,

      r.order_id orderId,
      o.order_number orderNumber,

      r.customer_id customerId,
      c.email customerEmail,

      r.order_item_id orderItemId,

      r.request_type requestType,
      r.requested_size requestedSize,

      r.reason,
      r.status,

      CAST(r.refund_amount_inr AS decimal(12,2)) refundAmountInr,
      CAST(r.approved_credit_inr AS decimal(12,2)) approvedCreditInr,

      r.replacement_variant_id replacementVariantId,
      r.replacement_order_id replacementOrderId,
      r.admin_note adminNote,
      r.admin_reviewed_at adminReviewedAt,
      r.admin_reviewed_by adminReviewedBy,
      r.processing_at processingAt,
      r.picked_up_at pickedUpAt,
      r.received_at receivedAt,
      r.reviewed_at reviewedAt,
      r.completed_at completedAt,
      r.pickup_tracking_number pickupTrackingNumber,
      r.replacement_fulfilled_at replacementFulfilledAt,

      r.created_at createdAt,
      r.updated_at updatedAt,

      oi.product_name productName,
      oi.sku,
      oi.quantity,
      CAST(oi.unit_price_inr AS decimal(12,2)) unitPriceInr,
      CAST(oi.total_price_inr AS decimal(12,2)) totalPriceInr,

    pv.sku replacementSku,

      (
        SELECT
          rri.id,
          rri.filename,
          rri.content_type contentType,
          rri.storage_path storagePath
        FROM return_request_images rri
        WHERE rri.return_request_id = r.id
        FOR JSON PATH
      ) imagesJson

    FROM return_requests r

    INNER JOIN orders o
      ON o.id=r.order_id

    LEFT JOIN customers c
      ON c.id=r.customer_id

    LEFT JOIN order_items oi
      ON oi.id=r.order_item_id

    LEFT JOIN product_variants pv
      ON pv.id=r.replacement_variant_id

    WHERE ${where}

    ORDER BY r.created_at DESC`,
  );

  return r.recordset.map((x: any) => {
    const images = x.imagesJson ? JSON.parse(x.imagesJson) : [];

    return {
      ...x,

      refundAmountInr:
        x.refundAmountInr == null ? null : Number(x.refundAmountInr),

      approvedCreditInr:
        x.approvedCreditInr == null ? null : Number(x.approvedCreditInr),

      quantity: x.quantity == null ? null : Number(x.quantity),

      unitPriceInr: x.unitPriceInr == null ? null : Number(x.unitPriceInr),

      totalPriceInr: x.totalPriceInr == null ? null : Number(x.totalPriceInr),

      createdAt:
        x.createdAt == null ? null : new Date(x.createdAt).toISOString(),

      updatedAt:
        x.updatedAt == null ? null : new Date(x.updatedAt).toISOString(),

      adminReviewedAt:
        x.adminReviewedAt == null
          ? null
          : new Date(x.adminReviewedAt).toISOString(),

      processingAt:
        x.processingAt == null ? null : new Date(x.processingAt).toISOString(),

      pickedUpAt:
        x.pickedUpAt == null ? null : new Date(x.pickedUpAt).toISOString(),

      receivedAt:
        x.receivedAt == null ? null : new Date(x.receivedAt).toISOString(),

      reviewedAt:
        x.reviewedAt == null ? null : new Date(x.reviewedAt).toISOString(),

      completedAt:
        x.completedAt == null ? null : new Date(x.completedAt).toISOString(),

      pickupTrackingNumber:
        x.pickupTrackingNumber == null ? null : String(x.pickupTrackingNumber),

      replacementFulfilledAt:
        x.replacementFulfilledAt == null
          ? null
          : new Date(x.replacementFulfilledAt).toISOString(),

      images: images.map((image: any) => ({
        id: image.id,
        filename: image.filename,
        contentType: image.contentType,
        url:
          `${(process.env.PUBLIC_API_URL ?? "").replace(/\/$/, "")}` +
          `/media/returns/${image.storagePath}`,
      })),
    };
  });
}

/* =========================================================
   STORE CREDIT HELPERS
========================================================= */

async function ensureStoreCreditAccount(
  pool: Awaited<ReturnType<typeof getDb>>,
  customerId: string,
) {
  const existing = await pool
    .request()
    .input("customerId", customerId)
    .query<any>(
      `
      SELECT TOP 1
        id,
        customer_id customerId,
        balance_inr balanceInr
      FROM store_credit_accounts
      WHERE customer_id = @customerId
      `,
    );

  if (existing.recordset[0]) {
    return existing.recordset[0];
  }

  const id = randomUUID();

  try {
    await pool
      .request()
      .input("id", id)
      .input("customerId", customerId)
      .query(
        `
        INSERT INTO store_credit_accounts(
          id,
          customer_id,
          balance_inr
        )
        VALUES(
          @id,
          @customerId,
          0
        )
        `,
      );
  } catch (error: any) {
    // Another request may have created the account between
    // our SELECT and INSERT. If so, use the existing account.
    if (
      error?.number === 2627 ||
      error?.number === 2601 ||
      String(error?.message ?? "").includes("UQ_store_credit_accounts_customer")
    ) {
      const createdByOtherRequest = await pool
        .request()
        .input("customerId", customerId)
        .query<any>(
          `
          SELECT TOP 1
            id,
            customer_id customerId,
            balance_inr balanceInr
          FROM store_credit_accounts
          WHERE customer_id = @customerId
          `,
        );

      if (createdByOtherRequest.recordset[0]) {
        return createdByOtherRequest.recordset[0];
      }
    }

    throw error;
  }

  return {
    id,
    customerId,
    balanceInr: 0,
  };
}

/**
 * Adds store credit and records an immutable transaction.
 *
 * The caller is expected to ensure the return request is in
 * REQUESTED state before calling this.
 */
async function addStoreCredit(
  pool: any,
  customerId: string,
  amountInr: number,
  returnRequestId: string,
  orderId: string,
  description: string,
) {
  const amount = Math.round(Number(amountInr) * 100) / 100;

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Store credit amount must be greater than zero.");
  }

  const account = await ensureStoreCreditAccount(pool, customerId);

  const newBalance = Math.round((account.balanceInr + amount) * 100) / 100;

  await pool
    .request()
    .input("accountId", account.id)
    .input("balance", newBalance)
    .query(
      `UPDATE store_credit_accounts
       SET
         balance_inr=@balance,
         updated_at=SYSUTCDATETIME()
       WHERE id=@accountId`,
    );

  const transactionId = randomUUID();

  await pool
    .request()
    .input("id", transactionId)
    .input("accountId", account.id)
    .input("transactionType", "RETURN_CREDIT")
    .input("amount", amount)
    .input("balanceAfter", newBalance)
    .input("returnRequestId", returnRequestId)
    .input("orderId", orderId)
    .input("description", description)
    .query(
      `INSERT INTO store_credit_transactions(
        id,
        account_id,
        transaction_type,
        amount_inr,
        balance_after_inr,
        return_request_id,
        order_id,
        description
      )
      VALUES(
        @id,
        @accountId,
        @transactionType,
        @amount,
        @balanceAfter,
        @returnRequestId,
        @orderId,
        @description
      )`,
    );

  return {
    accountId: account.id,
    transactionId,
    amountInr: amount,
    balanceAfterInr: newBalance,
  };
}

async function createReplacementOrderForReturnRequest(returnRequestId: string) {
  const pool = await getDb();

  const transaction = pool.transaction();

  await transaction.begin();

  try {
    const request = transaction.request();

    const result = await request
      .input("returnRequestId", returnRequestId)
      .query<any>(
        `
        SELECT TOP 1
          rr.id returnRequestId,
          rr.status returnStatus,
          rr.request_type requestType,
          rr.order_id orderId,
          rr.order_item_id orderItemId,
          rr.customer_id customerId,
          rr.replacement_variant_id replacementVariantId,
          rr.replacement_order_id replacementOrderId,
          rr.picked_up_at pickedUpAt,
          rr.received_at receivedAt,
          rr.reviewed_at reviewedAt,

          o.shipping_address_json shippingAddressJson,

          oi.quantity quantity,

          pv.sku replacementSku,
          p.name replacementProductName,

          i.quantity_available quantityAvailable,
          i.quantity_reserved quantityReserved

        FROM return_requests rr

        INNER JOIN orders o
          ON o.id = rr.order_id

        INNER JOIN order_items oi
          ON oi.id = rr.order_item_id
         AND oi.order_id = rr.order_id

        INNER JOIN product_variants pv
          ON pv.id = rr.replacement_variant_id

        INNER JOIN products p
          ON p.id = pv.product_id

        INNER JOIN inventory i
          ON i.variant_id = pv.id

        WHERE rr.id = @returnRequestId
        `,
      );

    const row = result.recordset[0];

    if (!row) {
      throw new Error("Replacement request not found.");
    }

    if (row.requestType !== "SIZE_REPLACEMENT") {
      throw new Error(
        "Replacement order can only be created for a size replacement.",
      );
    }

    if (row.replacementOrderId) {
      await transaction.commit();

      return {
        replacementOrderId: row.replacementOrderId,
      };
    }

    if (row.returnStatus !== "PROCESSING") {
      throw new Error(
        "The size replacement must be in processing before the replacement order can be created.",
      );
    }

    if (!row.pickedUpAt || !row.receivedAt || !row.reviewedAt) {
      throw new Error(
        "The original item must be picked up, received, and reviewed before the replacement order can be created.",
      );
    }

    if (!row.replacementVariantId) {
      throw new Error(
        "The size replacement request is missing its replacement variant.",
      );
    }

    const quantity = Number(row.quantity);

    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error("Invalid replacement quantity.");
    }

    const availableQuantity =
      Number(row.quantityAvailable ?? 0) - Number(row.quantityReserved ?? 0);

    if (availableQuantity < quantity) {
      throw new Error("The requested replacement size is no longer available.");
    }

    if (!row.shippingAddressJson) {
      throw new Error("The original order is missing its shipping address.");
    }

    const replacementOrderId = randomUUID();

    const orderNumber = `SS-EX-${new Date()
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "")}-${replacementOrderId.slice(0, 8).toUpperCase()}`;

    /*
     * This is a zero-value exchange order.
     * No Razorpay payment is created and no store credit is used.
     */
    await transaction
      .request()
      .input("orderId", replacementOrderId)
      .input("orderNumber", orderNumber)
      .input("customerId", row.customerId)
      .input("shippingAddress", row.shippingAddressJson)
      .input("paymentReference", `EXCHANGE-${returnRequestId}`)
      .query(
        `
        INSERT INTO orders(
          id,
          order_number,
          customer_id,
          status,
          currency,
          subtotal_inr,
          shipping_inr,
          discount_inr,
          tax_inr,
          total_inr,
          store_credit_applied_inr,
          store_credit_released_at,
          shipping_address_json,
          payment_provider,
          payment_status,
          payment_reference,
          payment_order_id,
          coupon_code
        )
        VALUES(
          @orderId,
          @orderNumber,
          @customerId,
          'PROCESSING',
          'INR',
          0,
          0,
          0,
          0,
          0,
          0,
          NULL,
          @shippingAddress,
          'EXCHANGE',
          'CAPTURED',
          @paymentReference,
          NULL,
          NULL
        )
        `,
      );

    await transaction
      .request()
      .input("orderItemId", randomUUID())
      .input("orderId", replacementOrderId)
      .input("variantId", row.replacementVariantId)
      .input("productName", row.replacementProductName)
      .input("sku", row.replacementSku)
      .input("quantity", quantity)
      .query(
        `
        INSERT INTO order_items(
          id,
          order_id,
          variant_id,
          product_name,
          sku,
          quantity,
          unit_price_inr,
          total_price_inr
        )
        VALUES(
          @orderItemId,
          @orderId,
          @variantId,
          @productName,
          @sku,
          @quantity,
          0,
          0
        )
        `,
      );

    /*
     * The replacement is being allocated immediately.
     * Reduce physical available stock but leave existing
     * reservations untouched.
     */
    const inventoryUpdate = await transaction
      .request()
      .input("variantId", row.replacementVariantId)
      .input("quantity", quantity)
      .query(
        `
        UPDATE inventory
        SET
          quantity_available = quantity_available - @quantity,
          updated_at = SYSUTCDATETIME()
        WHERE variant_id = @variantId
          AND quantity_available - quantity_reserved >= @quantity
        `,
      );

    if (inventoryUpdate.rowsAffected[0] !== 1) {
      throw new Error("The requested replacement size is no longer available.");
    }

    await transaction
      .request()
      .input("orderId", replacementOrderId)
      .input(
        "note",
        `Replacement order created for return request ${returnRequestId}`,
      )
      .query(
        `
        INSERT INTO order_status_history(
          order_id,
          status,
          note
        )
        VALUES(
          @orderId,
          'PROCESSING',
          @note
        )
        `,
      );

    await transaction
      .request()
      .input("returnRequestId", returnRequestId)
      .input("replacementOrderId", replacementOrderId)
      .query(
        `
        UPDATE return_requests
        SET
          replacement_order_id = @replacementOrderId,
          admin_note = 'Replacement order created',
          updated_at = SYSUTCDATETIME()
        WHERE id = @returnRequestId
        `,
      );

    await transaction.commit();

    return {
      replacementOrderId,
      orderNumber,
    };
  } catch (error) {
    try {
      await transaction.rollback();
    } catch {
      // Ignore rollback errors and preserve the original error.
    }

    throw error;
  }
}

/* =========================================================
   UPDATE AFTER-SALES REQUEST
========================================================= */

/**
 * Handles:
 *
 * PRODUCT_FAULT
 *   -> APPROVED means store credit
 *
 * SIZE_REPLACEMENT
 *   -> APPROVED means replacement request approved
 *
 * Legacy request:
 *   -> APPROVED continues to use the existing Razorpay
 *      refund workflow.
 *
 * adminId is optional for backwards compatibility. The
 * GraphQL layer can pass the authenticated admin user's ID.
 */
export async function updateReturnRequest(
  id: string,
  status: string,
  adminNote?: string | null,
  adminId?: string | null,
  pickupTrackingNumber?: string | null,
) {
  const normalizedStatus = String(status || "")
    .trim()
    .toUpperCase();

  if (
    ![
      "APPROVED",
      "PICKED_UP",
      "RECEIVED",
      "REVIEWED",
      "COMPLETED",
      "REJECTED",
      "CANCELLED",
    ].includes(normalizedStatus)
  ) {
    throw new Error("Invalid return status.");
  }

  const pool = await getDb();

  const r = (
    await pool
      .request()
      .input("id", id)
      .query<any>(
        `SELECT TOP 1
          r.id,
          r.order_id orderId,
          r.customer_id customerId,
          r.order_item_id orderItemId,
          r.request_type requestType,
          r.requested_size requestedSize,
          r.replacement_variant_id replacementVariantId,
          r.refund_amount_inr refundAmountInr,
          r.approved_credit_inr approvedCreditInr,
          r.return_fee_inr returnFeeInr,
          r.return_fee_status returnFeeStatus,
          r.status currentStatus,
          r.processing_at processingAt,
          r.picked_up_at pickedUpAt,
          r.received_at receivedAt,
          r.reviewed_at reviewedAt,

          o.status orderStatus,
          o.payment_status paymentStatus,
          o.payment_provider paymentProvider,
          o.payment_reference paymentReference,

          oi.product_name productName,
          oi.sku,
          oi.quantity

        FROM return_requests r

        INNER JOIN orders o
          ON o.id=r.order_id

        LEFT JOIN order_items oi
          ON oi.id=r.order_item_id

        WHERE r.id=@id`,
      )
  ).recordset[0];

  if (!r) {
    throw new Error("Return request not found.");
  }

  if (r.currentStatus !== "REQUESTED" && r.currentStatus !== "PROCESSING") {
    throw new Error("Return request is already completed.");
  }

  const requestType = r.requestType
    ? String(r.requestType).trim().toUpperCase()
    : null;

  const note = adminNote?.trim() || null;

  /* -------------------------------------------------------
     REJECT / CANCEL
  ------------------------------------------------------- */

  if (normalizedStatus === "REJECTED" || normalizedStatus === "CANCELLED") {
    await pool
      .request()
      .input("id", id)
      .input("status", normalizedStatus)
      .input("note", note)
      .input("adminId", adminId || null)
      .query(
        `UPDATE return_requests
         SET
           status=@status,
           admin_note=@note,
           admin_reviewed_at=SYSUTCDATETIME(),
           admin_reviewed_by=@adminId,
           updated_at=SYSUTCDATETIME()
         WHERE id=@id`,
      );

    return true;
  }

  /* -------------------------------------------------------
   APPROVE REQUEST
   Approval only moves the request into PROCESSING.

   No refund or store credit is issued here.
   Money is handled only after the item has been
   picked up, received, and reviewed.
------------------------------------------------------- */

  if (normalizedStatus === "APPROVED") {
    if (r.currentStatus !== "REQUESTED") {
      throw new Error("Only a requested return can be approved.");
    }

    await pool
      .request()
      .input("id", id)
      .input("note", note)
      .input("adminId", adminId || null)
      .query(
        `UPDATE return_requests
       SET
         status='PROCESSING',
         processing_at=COALESCE(processing_at, SYSUTCDATETIME()),
         admin_note=@note,
         admin_reviewed_at=SYSUTCDATETIME(),
         admin_reviewed_by=@adminId,
         updated_at=SYSUTCDATETIME()
       WHERE id=@id`,
      );

    return true;
  }

  /* -------------------------------------------------------
   PICKED UP
   Admin confirms that Delhivery has collected the item.
------------------------------------------------------- */

  if (normalizedStatus === "PICKED_UP") {
    if (r.currentStatus !== "PROCESSING") {
      throw new Error("Only a processing return can be marked as picked up.");
    }

    if (!r.processingAt) {
      throw new Error(
        "The return must be approved and moved to processing first.",
      );
    }

    await pool
      .request()
      .input("id", id)
      .input("trackingNumber", pickupTrackingNumber?.trim() || null)
      .input("note", note)
      .query(
        `UPDATE return_requests
       SET
         status='PROCESSING',
         picked_up_at=COALESCE(picked_up_at, SYSUTCDATETIME()),
         pickup_tracking_number=
           COALESCE(@trackingNumber, pickup_tracking_number),
         admin_note=@note,
         updated_at=SYSUTCDATETIME()
       WHERE id=@id`,
      );

    return true;
  }

  /* -------------------------------------------------------
   RECEIVED
   Admin confirms that the returned item has physically
   arrived and is now in the shop/warehouse.
------------------------------------------------------- */

  if (normalizedStatus === "RECEIVED") {
    if (r.currentStatus !== "PROCESSING") {
      throw new Error("Only a processing return can be marked as received.");
    }

    if (!r.pickedUpAt) {
      throw new Error(
        "The item must be marked as picked up before it can be received.",
      );
    }

    await pool
      .request()
      .input("id", id)
      .input("note", note)
      .query(
        `UPDATE return_requests
       SET
         status='PROCESSING',
         received_at=COALESCE(received_at, SYSUTCDATETIME()),
         admin_note=@note,
         updated_at=SYSUTCDATETIME()
       WHERE id=@id`,
      );

    return true;
  }

  /* -------------------------------------------------------
   REVIEWED
   Admin confirms that the returned item has been
   physically inspected.
------------------------------------------------------- */

  if (normalizedStatus === "REVIEWED") {
    if (r.currentStatus !== "PROCESSING") {
      throw new Error("Only a processing return can be marked as reviewed.");
    }

    if (!r.receivedAt) {
      throw new Error("The item must be received before it can be reviewed.");
    }

    await pool
      .request()
      .input("id", id)
      .input("note", note)
      .query(
        `UPDATE return_requests
       SET
         status='PROCESSING',
         reviewed_at=COALESCE(reviewed_at, SYSUTCDATETIME()),
         admin_note=@note,
         updated_at=SYSUTCDATETIME()
       WHERE id=@id`,
      );

    if (requestType === "SIZE_REPLACEMENT") {
      await createReplacementOrderForReturnRequest(id);
    }

    return true;
  }

  /* -------------------------------------------------------
   COMPLETED

   Product fault:
     -> issue store credit for actual amount paid

   Size replacement:
     -> replacement-order logic will be added next

   Legacy return:
     -> existing Razorpay refund workflow
------------------------------------------------------- */

  if (normalizedStatus === "COMPLETED") {
    if (r.currentStatus !== "PROCESSING") {
      throw new Error("Only a processing return can be completed.");
    }

    if (!r.reviewedAt) {
      throw new Error(
        "The item must be reviewed before the return can be completed.",
      );
    }

    /* -----------------------------------------------------
     PRODUCT FAULT
     Issue store credit ONLY after review.
  ----------------------------------------------------- */

    if (requestType === "PRODUCT_FAULT") {
      if (!r.orderItemId) {
        throw new Error("Product-fault request is missing its order item.");
      }

      const paidAmount = await calculateOrderItemPaidAmount(
        r.orderId,
        r.orderItemId,
      );

      if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
        throw new Error("Unable to calculate the paid amount for this item.");
      }

      /*
       * The paid amount is the GROSS store-credit amount.
       *
       * Return fee rules:
       * - First 2 eligible returned items: ₹0
       * - 3rd eligible returned item onward: ₹100 per item
       * - SIZE_REPLACEMENT never reaches this block
       * - REJECTED/CANCELLED never reach this block
       *
       * The fee is deducted from the store credit.
       * No Razorpay payment is created.
       */
      const returnFeeInr = Math.max(0, Number(r.returnFeeInr ?? 0));

      const netCreditAmount = Math.max(0, paidAmount - returnFeeInr);

      if (returnFeeInr > 0 && netCreditAmount <= 0) {
        throw new Error(
          "Return fee cannot be greater than the store credit amount.",
        );
      }

      const credit = await addStoreCredit(
        pool,
        r.customerId,
        netCreditAmount,
        id,
        r.orderId,
        note ||
          (returnFeeInr > 0
            ? `Store credit for approved product fault after ₹${returnFeeInr} return fee`
            : "Store credit for approved product fault"),
      );

      await pool
        .request()
        .input("id", id)
        .input("approvedCredit", paidAmount)
        .input("returnFeeInr", returnFeeInr)
        .input(
          "returnFeeStatus",
          returnFeeInr > 0 ? "DEDUCTED" : "NOT_REQUIRED",
        )
        .input("note", note)
        .query(
          `
      UPDATE return_requests
      SET
        status='COMPLETED',
        approved_credit_inr=@approvedCredit,
        return_fee_inr=@returnFeeInr,
        return_fee_status=@returnFeeStatus,
        admin_note=@note,
        completed_at=SYSUTCDATETIME(),
        updated_at=SYSUTCDATETIME()
      WHERE id=@id
      `,
        );

      return true;
    }

    /* -----------------------------------------------------
     SIZE REPLACEMENT

     Replacement-order creation will be added separately.
     Do NOT complete the request yet.
  ----------------------------------------------------- */

    if (requestType === "SIZE_REPLACEMENT") {
      throw new Error(
        "Replacement order must be created before this request can be completed.",
      );
    }

    /* -----------------------------------------------------
     LEGACY RETURN

     Keep the existing Razorpay refund workflow for old
     requests, but only after the item has been reviewed.
  ----------------------------------------------------- */

    if (!requestType) {
      const requestedRefundAmount =
        r.refundAmountInr == null ? 0 : Number(r.refundAmountInr);

      if (
        !Number.isFinite(requestedRefundAmount) ||
        requestedRefundAmount <= 0
      ) {
        throw new Error("This legacy return has no valid refund amount.");
      }

      if (r.paymentProvider !== "RAZORPAY" || !r.paymentReference) {
        throw new Error(
          "This order does not have a refundable Razorpay payment.",
        );
      }

      if (
        !["CAPTURED", "PARTIALLY_REFUNDED"].includes(
          String(r.paymentStatus || "").toUpperCase(),
        )
      ) {
        throw new Error(
          "This order does not have a refundable Razorpay payment.",
        );
      }

      const refundTotals = (
        await pool
          .request()
          .input("orderId", r.orderId)
          .query<any>(
            `
          SELECT
            CAST(
              COALESCE(
                SUM(
                  CASE
                    WHEN status IN ('PENDING', 'PROCESSED')
                    THEN amount_inr
                    ELSE 0
                  END
                ),
                0
              )
              AS decimal(12,2)
            ) refundedInr
          FROM payment_refunds
          WHERE order_id=@orderId
          `,
          )
      ).recordset[0];

      const alreadyRefunded = Number(refundTotals?.refundedInr ?? 0);

      const remainingRefundAmount = Math.max(
        0,
        Math.round((requestedRefundAmount - alreadyRefunded) * 100) / 100,
      );

      if (remainingRefundAmount > 0) {
        await refundPayment(
          r.orderId,
          remainingRefundAmount,
          note || "Approved return",
        );
      }

      await pool
        .request()
        .input("id", id)
        .input("note", note)
        .query(
          `UPDATE return_requests
         SET
           status='COMPLETED',
           admin_note=@note,
           completed_at=SYSUTCDATETIME(),
           updated_at=SYSUTCDATETIME()
         WHERE id=@id`,
        );

      return true;
    }

    throw new Error(`Unsupported after-sales request type: ${requestType}`);
  }
}

/* =========================================================
   ADDRESSES
========================================================= */

export async function saveAddress(customerId: string, input: any) {
  if (
    !input.recipientName ||
    !input.line1 ||
    !input.city ||
    !input.state ||
    !input.postalCode
  ) {
    throw new Error("Complete address details are required.");
  }

  const pool = await getDb();
  const id = input.id || randomUUID();

  if (input.id) {
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
        `UPDATE addresses
         SET
           label=@label,
           recipient_name=@recipientName,
           line1=@line1,
           line2=@line2,
           city=@city,
           state=@state,
           postal_code=@postalCode,
           country_code=@countryCode,
           phone=@phone
         WHERE id=@id
           AND customer_id=@customerId`,
      );
  } else {
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
        `INSERT INTO addresses(
          id,
          customer_id,
          label,
          recipient_name,
          line1,
          line2,
          city,
          state,
          postal_code,
          country_code,
          phone
        )
        VALUES(
          @id,
          @customerId,
          @label,
          @recipientName,
          @line1,
          @line2,
          @city,
          @state,
          @postalCode,
          @countryCode,
          @phone
        )`,
      );
  }

  return listAddresses(customerId);
}

export async function listAddresses(customerId: string) {
  const pool = await getDb();

  return (
    await pool
      .request()
      .input("customerId", customerId)
      .query<any>(
        `SELECT
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
        WHERE customer_id=@customerId
        ORDER BY created_at DESC`,
      )
  ).recordset;
}

export async function deleteAddress(customerId: string, id: string) {
  const pool = await getDb();

  await pool
    .request()
    .input("id", id)
    .input("customerId", customerId)
    .query(
      `DELETE FROM addresses
       WHERE id=@id
         AND customer_id=@customerId`,
    );

  return listAddresses(customerId);
}

export async function getAdminCashFlow() {
  const pool = await getDb();

  const incomeResult = await pool.request().query<any>(`
    SELECT
      COALESCE(
        SUM(
          CASE
            WHEN payment_status = 'CAPTURED'
             AND payment_provider = 'RAZORPAY'
            THEN total_inr
            ELSE 0
          END
        ),
        0
      ) AS incomeInr
    FROM orders
  `);

  const refundResult = await pool.request().query<any>(`
    SELECT
      COALESCE(
        SUM(
          CASE
            WHEN status IN ('PROCESSED', 'SUCCESS', 'COMPLETED')
            THEN amount_inr
            ELSE 0
          END
        ),
        0
      ) AS refundInr
    FROM payment_refunds
  `);

  const storeCreditResult = await pool.request().query<any>(`
    SELECT
      COALESCE(
        SUM(approved_credit_inr),
        0
      ) AS storeCreditInr
    FROM return_requests
    WHERE request_type = 'PRODUCT_FAULT'
      AND status = 'COMPLETED'
      AND approved_credit_inr > 0
  `);

  const incomeInr = Number(incomeResult.recordset[0]?.incomeInr ?? 0);

  const refundInr = Number(refundResult.recordset[0]?.refundInr ?? 0);

  const storeCreditInr = Number(
    storeCreditResult.recordset[0]?.storeCreditInr ?? 0,
  );

  return {
    incomeInr,
    refundInr,
    storeCreditInr,
    netCashFlowInr: incomeInr - refundInr - storeCreditInr,
  };
}

export async function getAdminCashFlowHistory() {
  const pool = await getDb();

  const result = await pool.request().query<any>(`
    SELECT
      flow_date AS date,
      SUM(income_inr) AS incomeInr,
      SUM(refund_inr) AS refundInr,
      SUM(store_credit_inr) AS storeCreditInr,
      SUM(income_inr) -
        SUM(refund_inr) -
        SUM(store_credit_inr) AS netCashFlowInr
    FROM (
    SELECT
        CONVERT(varchar(10), o.created_at, 23) AS flow_date,
        SUM(o.total_inr) AS income_inr,
        CAST(0 AS DECIMAL(12,2)) AS refund_inr,
        CAST(0 AS DECIMAL(12,2)) AS store_credit_inr
      FROM orders o
      WHERE o.payment_status = 'CAPTURED'
        AND o.payment_provider = 'RAZORPAY'
      GROUP BY CONVERT(varchar(10), o.created_at, 23)

      UNION ALL
      
      SELECT
        CONVERT(varchar(10), pr.processed_at, 23) AS flow_date,
        CAST(0 AS DECIMAL(12,2)) AS income_inr,
        SUM(pr.amount_inr) AS refund_inr,
        CAST(0 AS DECIMAL(12,2)) AS store_credit_inr
      FROM payment_refunds pr
      WHERE pr.status IN ('PROCESSED', 'SUCCESS', 'COMPLETED')
        AND pr.processed_at IS NOT NULL
      GROUP BY CONVERT(varchar(10), pr.processed_at, 23)

      UNION ALL

      SELECT
        CONVERT(varchar(10), rr.completed_at, 23) AS flow_date,
        CAST(0 AS DECIMAL(12,2)) AS income_inr,
        CAST(0 AS DECIMAL(12,2)) AS refund_inr,
        SUM(rr.approved_credit_inr) AS store_credit_inr
      FROM return_requests rr
      WHERE rr.request_type = 'PRODUCT_FAULT'
        AND rr.status = 'COMPLETED'
        AND rr.approved_credit_inr > 0
        AND rr.completed_at IS NOT NULL
      GROUP BY CONVERT(varchar(10), rr.completed_at, 23)
    ) cash_flow
    GROUP BY flow_date
    ORDER BY flow_date DESC;
  `);

  return result.recordset.map((row) => ({
    date: row.date,
    incomeInr: Number(row.incomeInr ?? 0),
    refundInr: Number(row.refundInr ?? 0),
    storeCreditInr: Number(row.storeCreditInr ?? 0),
    netCashFlowInr: Number(row.netCashFlowInr ?? 0),
  }));
}
