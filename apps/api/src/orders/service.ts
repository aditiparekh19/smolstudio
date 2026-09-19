import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import sql from "mssql";
import { getDb } from "../db.js";
import { env } from "../config.js";
import {
  sendOrderStatusEmail,
  sendStoreCreditRestoreEmail,
} from "../notifications/service.js";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";

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

  // Store credit
  storeCreditBalanceInr: number;
  storeCreditAppliedInr: number;
  payableInr: number;

  couponCode?: string | null;
};

export type AfterSalesRequestType = "PRODUCT_FAULT" | "SIZE_REPLACEMENT";

const RETURN_MEDIA_ROOT =
  process.env.RETURN_MEDIA_ROOT ?? join(process.cwd(), "uploads", "returns");

const RETURN_IMAGE_TYPES = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
]);

const MAX_RETURN_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_RETURN_IMAGES = 3;

function roundMoney(value: number) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function razorpayConfigured() {
  return Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
}

export async function razorpayRequest<T>(path: string, init: RequestInit = {}) {
  if (!razorpayConfigured()) {
    throw new Error(
      "Online payment is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to the API environment.",
    );
  }

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
    body = {
      error: {
        description: text,
      },
    };
  }

  if (!response.ok) {
    throw new Error(
      body?.error?.description ||
        `Payment provider error (${response.status}).`,
    );
  }

  return body as T;
}

function verifySignature(
  orderId: string,
  paymentId: string,
  signature: string,
) {
  if (!env.RAZORPAY_KEY_SECRET || !signature) {
    return false;
  }

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
  if (!env.RAZORPAY_WEBHOOK_SECRET || !signature) {
    return false;
  }

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

  for (const key of required) {
    if (!String(address[key] ?? "").trim()) {
      throw new Error(`Shipping ${key} is required.`);
    }
  }

  if (!/^\d{5,10}$/.test(String(address.postalCode).replace(/\s/g, ""))) {
    throw new Error("Enter a valid PIN/postal code.");
  }

  if (address.phone && !/^[+\d][\d\s-]{7,18}$/.test(address.phone)) {
    throw new Error("Enter a valid phone number.");
  }
}

/* ============================================================
   INVENTORY RESERVATIONS
   ============================================================ */

export async function releaseExpiredReservations() {
  const pool = await getDb();

  const tx = new sql.Transaction(pool);

  await tx.begin();

  try {
    const rows = await new sql.Request(tx).query<any>(
      `
      SELECT
        id,
        variant_id variantId,
        quantity
      FROM inventory_reservations
      WHERE expires_at <= SYSUTCDATETIME()
        AND released_at IS NULL
        AND consumed_at IS NULL
      `,
    );

    for (const row of rows.recordset) {
      await new sql.Request(tx)
        .input("id", row.id)
        .input("variantId", row.variantId)
        .input("quantity", row.quantity)
        .query(
          `
          UPDATE inventory
          SET
            quantity_reserved =
              CASE
                WHEN quantity_reserved >= @quantity
                  THEN quantity_reserved - @quantity
                ELSE 0
              END,
            updated_at = SYSUTCDATETIME()
          WHERE variant_id = @variantId;

          UPDATE inventory_reservations
          SET released_at = SYSUTCDATETIME()
          WHERE id = @id;

          UPDATE orders
          SET
            status = 'PAYMENT_EXPIRED',
            payment_status = 'EXPIRED',
            store_credit_released_at =
              CASE
                WHEN store_credit_applied_inr > 0
                  THEN SYSUTCDATETIME()
                ELSE store_credit_released_at
              END,
            updated_at = SYSUTCDATETIME()
          WHERE id = (
            SELECT order_id
            FROM inventory_reservations
            WHERE id = @id
          )
          AND status = 'PENDING_PAYMENT';
          `,
        );
    }

    await tx.commit();
  } catch (error) {
    await tx.rollback();
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
    const rows = await new sql.Request(tx).input("orderId", orderId).query<any>(
      `
        SELECT
          id,
          variant_id variantId,
          quantity
        FROM inventory_reservations
        WHERE order_id = @orderId
          AND released_at IS NULL
          AND consumed_at IS NULL
        `,
    );

    for (const row of rows.recordset) {
      await new sql.Request(tx)
        .input("id", row.id)
        .input("variantId", row.variantId)
        .input("quantity", row.quantity)
        .query(
          `
          UPDATE inventory
          SET
            quantity_reserved =
              CASE
                WHEN quantity_reserved >= @quantity
                  THEN quantity_reserved - @quantity
                ELSE 0
              END,
            updated_at = SYSUTCDATETIME()
          WHERE variant_id = @variantId;

          UPDATE inventory_reservations
          SET released_at = SYSUTCDATETIME()
          WHERE id = @id;
          `,
        );
    }

    if (status) {
      await new sql.Request(tx)
        .input("id", orderId)
        .input("status", status)
        .input("note", note || null)
        .query(
          `
          UPDATE orders
          SET
            status = @status,
            payment_status =
              CASE
                WHEN @status IN (
                  'PAYMENT_FAILED',
                  'PAYMENT_EXPIRED'
                )
                  THEN 'FAILED'
                ELSE payment_status
              END,
            payment_failed_at =
              CASE
                WHEN @status IN (
                  'PAYMENT_FAILED',
                  'PAYMENT_EXPIRED'
                )
                  THEN SYSUTCDATETIME()
                ELSE payment_failed_at
              END,
            store_credit_released_at =
              CASE
                WHEN store_credit_applied_inr > 0
                  THEN SYSUTCDATETIME()
                ELSE store_credit_released_at
              END,
            updated_at = SYSUTCDATETIME()
          WHERE id = @id;

          INSERT INTO order_status_history(
            order_id,
            status,
            note
          )
          VALUES(
            @id,
            @status,
            @note
          );
          `,
        );
    }

    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

async function consumeReservation(orderId: string) {
  const pool = await getDb();

  const tx = new sql.Transaction(pool);

  await tx.begin();

  try {
    const rows = await new sql.Request(tx).input("orderId", orderId).query<any>(
      `
        SELECT
          id,
          variant_id variantId,
          quantity
        FROM inventory_reservations
        WHERE order_id = @orderId
          AND released_at IS NULL
          AND consumed_at IS NULL
        `,
    );

    for (const row of rows.recordset) {
      const updated = await new sql.Request(tx)
        .input("variantId", row.variantId)
        .input("quantity", row.quantity)
        .query<any>(
          `
          UPDATE inventory
          SET
            quantity_available =
              quantity_available - @quantity,
            quantity_reserved =
              CASE
                WHEN quantity_reserved >= @quantity
                  THEN quantity_reserved - @quantity
                ELSE 0
              END,
            updated_at = SYSUTCDATETIME()
          OUTPUT
            INSERTED.quantity_available AS available
          WHERE variant_id = @variantId
            AND quantity_available >= @quantity
            AND quantity_reserved >= @quantity
          `,
        );

      if (!updated.recordset.length) {
        throw new Error(
          "Inventory could not be finalized for this paid order.",
        );
      }

      await new sql.Request(tx).input("id", row.id).query(
        `
          UPDATE inventory_reservations
          SET consumed_at = SYSUTCDATETIME()
          WHERE id = @id
          `,
      );
    }

    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

/* ============================================================
   DATABASE HELPERS
   ============================================================ */

async function getTableColumns(pool: sql.ConnectionPool, tableName: string) {
  const result = await pool
    .request()
    .input("tableName", sql.NVarChar(128), tableName)
    .query<{ columnName: string }>(
      `
      SELECT COLUMN_NAME AS columnName
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo'
        AND TABLE_NAME = @tableName
      `,
    );

  return new Set(
    result.recordset.map((row) => String(row.columnName).toLowerCase()),
  );
}

async function getTableExists(pool: sql.ConnectionPool, tableName: string) {
  const result = await pool
    .request()
    .input("tableName", sql.NVarChar(128), tableName)
    .query<{ exists: number }>(
      `
      SELECT
        CASE
          WHEN OBJECT_ID(
            N'dbo.' + @tableName,
            N'U'
          ) IS NULL
          THEN 0
          ELSE 1
        END AS [exists]
      `,
    );

  return Number(result.recordset[0]?.exists ?? 0) === 1;
}

/* ============================================================
   COUPON CATEGORY SUPPORT
   ============================================================ */

async function getCouponCategoryIds(
  pool: sql.ConnectionPool,
  couponId: string,
) {
  const ids = new Set<string>();

  for (const relationTable of ["coupon_categories", "coupon_category"]) {
    if (!(await getTableExists(pool, relationTable))) {
      continue;
    }

    const columns = await getTableColumns(pool, relationTable);

    if (!columns.has("coupon_id") || !columns.has("category_id")) {
      continue;
    }

    const result = await pool
      .request()
      .input("couponId", couponId)
      .query<any>(
        `
        SELECT DISTINCT
          CAST(category_id AS nvarchar(100))
            AS categoryId
        FROM dbo.${relationTable}
        WHERE coupon_id = @couponId
        `,
      );

    for (const row of result.recordset) {
      if (row.categoryId != null) {
        ids.add(String(row.categoryId));
      }
    }

    return ids;
  }

  const couponColumns = await getTableColumns(pool, "coupons");

  if (couponColumns.has("category_id")) {
    const result = await pool
      .request()
      .input("couponId", couponId)
      .query<any>(
        `
        SELECT TOP 1
          CAST(category_id AS nvarchar(100))
            AS categoryId
        FROM dbo.coupons
        WHERE id = @couponId
        `,
      );

    const categoryId = result.recordset[0]?.categoryId;

    if (categoryId != null) {
      ids.add(String(categoryId));
    }
  }

  return ids;
}

async function getEligibleSubtotal(
  pool: sql.ConnectionPool,
  customerId: string,
  couponCategoryIds: Set<string>,
  categoryRestrictionExists: boolean,
) {
  if (!categoryRestrictionExists) {
    const result = await pool
      .request()
      .input("customerId", customerId)
      .query<any>(
        `
        SELECT
          ci.quantity,
          p.price_inr priceInr
        FROM carts c
        INNER JOIN cart_items ci
          ON ci.cart_id = c.id
        INNER JOIN product_variants v
          ON v.id = ci.variant_id
        INNER JOIN products p
          ON p.id = v.product_id
        WHERE c.customer_id = @customerId
        `,
      );

    return result.recordset.reduce(
      (sum: number, item: any) =>
        sum + Number(item.priceInr) * Number(item.quantity),
      0,
    );
  }

  if (!couponCategoryIds.size) {
    return 0;
  }

  const productColumns = await getTableColumns(pool, "products");

  if (productColumns.has("category_id")) {
    const categoryValues = Array.from(couponCategoryIds);

    const request = pool.request().input("customerId", customerId);

    const placeholders = categoryValues.map((id, index) => {
      const name = `categoryId${index}`;

      request.input(name, id);

      return `@${name}`;
    });

    const result = await request.query<any>(
      `
      SELECT
        ci.quantity,
        p.price_inr priceInr
      FROM carts c
      INNER JOIN cart_items ci
        ON ci.cart_id = c.id
      INNER JOIN product_variants v
        ON v.id = ci.variant_id
      INNER JOIN products p
        ON p.id = v.product_id
      WHERE c.customer_id = @customerId
        AND CAST(
          p.category_id AS nvarchar(100)
        ) IN (${placeholders.join(",")})
      `,
    );

    return result.recordset.reduce(
      (sum: number, item: any) =>
        sum + Number(item.priceInr) * Number(item.quantity),
      0,
    );
  }

  if (await getTableExists(pool, "product_categories")) {
    const pcColumns = await getTableColumns(pool, "product_categories");

    if (pcColumns.has("product_id") && pcColumns.has("category_id")) {
      const categoryValues = Array.from(couponCategoryIds);

      const request = pool.request().input("customerId", customerId);

      const placeholders = categoryValues.map((id, index) => {
        const name = `categoryId${index}`;

        request.input(name, id);

        return `@${name}`;
      });

      const result = await request.query<any>(
        `
          SELECT
            ci.quantity,
            p.price_inr priceInr
          FROM carts c
          INNER JOIN cart_items ci
            ON ci.cart_id = c.id
          INNER JOIN product_variants v
            ON v.id = ci.variant_id
          INNER JOIN products p
            ON p.id = v.product_id
          WHERE c.customer_id = @customerId
            AND EXISTS (
              SELECT 1
              FROM product_categories pc
              WHERE pc.product_id = p.id
                AND CAST(
                  pc.category_id
                  AS nvarchar(100)
                ) IN (
                  ${placeholders.join(",")}
                )
            )
          `,
      );

      return result.recordset.reduce(
        (sum: number, item: any) =>
          sum + Number(item.priceInr) * Number(item.quantity),
        0,
      );
    }
  }

  return 0;
}

/* ============================================================
   COUPONS
   ============================================================ */

async function validateCoupon(
  couponCode: string | null | undefined,
  customerId: string | null | undefined,
  subtotal: number,
) {
  const code = couponCode?.trim().toUpperCase();

  if (!code) {
    return {
      code: null,
      discountInr: 0,
    };
  }

  if (!customerId) {
    throw new Error("Please sign in to apply a coupon.");
  }

  const pool = await getDb();

  if (code !== "WELCOME5") {
    try {
      const dbContext = await pool.request().query<any>(
        `
          SELECT
            DB_NAME() AS dbName,
            @@SERVERNAME AS serverName
          `,
      );

      const debugCoupon = await pool
        .request()
        .input("debugCode", sql.NVarChar(100), code)
        .query<any>(
          `
            SELECT TOP 1
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
            FROM dbo.coupons
            WHERE UPPER(
              LTRIM(RTRIM(code))
            ) = @debugCode
            `,
        );

      console.log("[COUPON DEBUG]", {
        requestedCode: code,
        database: dbContext.recordset[0]?.dbName,
        server: dbContext.recordset[0]?.serverName,
        matches: debugCoupon.recordset,
      });
    } catch (error) {
      console.warn("[COUPON DEBUG] diagnostic query failed", error);
    }
  }

  /* ---------------- WELCOME5 ---------------- */

  if (code === "WELCOME5") {
    const result = await pool
      .request()
      .input("customerId", customerId)
      .query<any>(
        `
        SELECT COUNT(*) AS orderCount
        FROM dbo.orders
        WHERE customer_id = @customerId
          AND status = 'PAID'
        `,
      );

    const orderCount = Number(result.recordset[0]?.orderCount ?? 0);

    if (orderCount > 0) {
      throw new Error("WELCOME5 is available only on your first order.");
    }

    return {
      code: "WELCOME5",
      discountInr: roundMoney(subtotal * 0.05),
    };
  }

  /* ---------------- DATABASE COUPON ---------------- */

  const couponColumns = await getTableColumns(pool, "coupons");

  const requiredColumns = [
    "code",
    "discount_type",
    "discount_value",
    "is_active",
  ];

  for (const column of requiredColumns) {
    if (!couponColumns.has(column)) {
      throw new Error(`Coupon configuration is missing the ${column} field.`);
    }
  }

  const minOrderColumn = couponColumns.has("min_order_inr")
    ? "min_order_inr"
    : couponColumns.has("min_order_value")
      ? "min_order_value"
      : null;

  const maxDiscountColumn = couponColumns.has("max_discount_inr")
    ? "max_discount_inr"
    : couponColumns.has("max_discount")
      ? "max_discount"
      : null;

  const minOrderSelect = minOrderColumn ? `[${minOrderColumn}]` : "NULL";

  const maxDiscountSelect = maxDiscountColumn
    ? `[${maxDiscountColumn}]`
    : "NULL";

  const result = await pool
    .request()
    .input("code", sql.NVarChar(50), code)
    .query<any>(
      `
      SELECT TOP 1
        id,
        code,
        discount_type discountType,
        discount_value discountValue,
        ${minOrderSelect} minOrderInr,
        ${maxDiscountSelect} maxDiscountInr,
        ${
          couponColumns.has("max_redemptions") ? "max_redemptions" : "NULL"
        } maxRedemptions,
        ${
          couponColumns.has("redeemed_count") ? "redeemed_count" : "0"
        } redeemedCount,
        ${couponColumns.has("starts_at") ? "starts_at" : "NULL"} startsAt,
        ${couponColumns.has("ends_at") ? "ends_at" : "NULL"} endsAt,
        is_active isActive
      FROM dbo.coupons
      WHERE UPPER(
        LTRIM(RTRIM(code))
      ) = @code
      `,
    );

  const coupon = result.recordset[0];

  if (!coupon) {
    throw new Error("Invalid coupon code.");
  }

  if (!Boolean(coupon.isActive)) {
    throw new Error("This coupon is inactive.");
  }

  const now = new Date();

  if (coupon.startsAt && now < new Date(coupon.startsAt)) {
    throw new Error("This coupon is not active yet.");
  }

  if (coupon.endsAt && now > new Date(coupon.endsAt)) {
    throw new Error("This coupon has expired.");
  }

  const maxRedemptions = coupon.maxRedemptions;

  const redeemedCount = Number(coupon.redeemedCount ?? 0);

  if (
    maxRedemptions !== null &&
    maxRedemptions !== undefined &&
    Number(maxRedemptions) > 0 &&
    redeemedCount >= Number(maxRedemptions)
  ) {
    throw new Error("This coupon has reached its usage limit.");
  }

  const couponCategoryIds = await getCouponCategoryIds(pool, String(coupon.id));

  const categoryRestrictionExists = couponCategoryIds.size > 0;

  const eligibleSubtotal = await getEligibleSubtotal(
    pool,
    customerId,
    couponCategoryIds,
    categoryRestrictionExists,
  );

  if (categoryRestrictionExists && eligibleSubtotal <= 0) {
    throw new Error("This coupon does not apply to the products in your bag.");
  }

  const minOrderValue = Number(coupon.minOrderInr ?? 0);

  const minimumBase = categoryRestrictionExists ? eligibleSubtotal : subtotal;

  if (minimumBase < minOrderValue) {
    throw new Error(
      `Minimum order value for this coupon is ₹${minOrderValue.toLocaleString(
        "en-IN",
      )}.`,
    );
  }

  let discountInr = 0;

  const discountType = String(coupon.discountType ?? "").toUpperCase();

  const discountValue = Number(coupon.discountValue ?? 0);

  if (!Number.isFinite(discountValue) || discountValue < 0) {
    throw new Error("This coupon has an invalid discount value.");
  }

  if (discountType === "PERCENT") {
    if (discountValue > 100) {
      throw new Error("Coupon percentage cannot exceed 100%.");
    }

    discountInr = roundMoney(eligibleSubtotal * (discountValue / 100));
  } else if (discountType === "FIXED") {
    discountInr = Math.min(discountValue, eligibleSubtotal);
  } else {
    throw new Error("This coupon has an invalid discount type.");
  }

  const maxDiscountInr =
    coupon.maxDiscountInr == null ? null : Number(coupon.maxDiscountInr);

  if (
    maxDiscountInr !== null &&
    Number.isFinite(maxDiscountInr) &&
    maxDiscountInr >= 0
  ) {
    discountInr = Math.min(discountInr, maxDiscountInr);
  }

  return {
    code: String(coupon.code).trim().toUpperCase(),
    discountInr: roundMoney(discountInr),
  };
}

/* ============================================================
   STORE CREDIT
   ============================================================ */

async function ensureStoreCreditAccount(
  pool: sql.ConnectionPool,
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

  return {
    id,
    customerId,
    balanceInr: 0,
  };
}

export async function getStoreCreditInfo(
  pool: sql.ConnectionPool,
  customerId: string,
) {
  const account = await ensureStoreCreditAccount(pool, customerId);

  /*
   * Pending-payment orders temporarily reserve
   * store credit without actually deducting it.
   *
   * Once the order is paid, the balance is deducted.
   */
  const reservedResult = await pool
    .request()
    .input("customerId", customerId)
    .query<any>(
      `
        SELECT
          COALESCE(
            SUM(
              store_credit_applied_inr
            ),
            0
          ) AS reservedInr
        FROM orders
        WHERE customer_id = @customerId
          AND status = 'PENDING_PAYMENT'
          AND store_credit_applied_inr > 0
          AND store_credit_released_at IS NULL
        `,
    );

  const balanceInr = roundMoney(Number(account.balanceInr ?? 0));

  const reservedInr = roundMoney(
    Number(reservedResult.recordset[0]?.reservedInr ?? 0),
  );

  const availableInr = Math.max(0, roundMoney(balanceInr - reservedInr));

  const transactionsResult = await pool
    .request()
    .input("customerId", customerId)
    .query<any>(
      `
        SELECT
          t.id,
          t.transaction_type AS type,
          t.amount_inr AS amountInr,
          t.balance_after_inr AS balanceAfterInr,
          t.order_id AS orderId,
          t.description,
          t.created_at AS createdAt
        FROM store_credit_transactions t
        INNER JOIN store_credit_accounts a
          ON a.id = t.account_id
        WHERE a.customer_id = @customerId
        ORDER BY t.created_at DESC
        `,
    );

  return {
    accountId: account.id,
    balanceInr,
    reservedInr,
    availableInr,
    transactions: transactionsResult.recordset.map((transaction) => ({
      id: transaction.id,
      type: transaction.type,
      amountInr: roundMoney(Number(transaction.amountInr ?? 0)),
      balanceAfterInr: roundMoney(Number(transaction.balanceAfterInr ?? 0)),
      orderId: transaction.orderId ?? null,
      description: transaction.description ?? null,
      createdAt: new Date(transaction.createdAt).toISOString(),
    })),
  };
}

function calculateTotals(
  subtotal: number,
  discount: number,
  storeCreditBalance = 0,
): CheckoutTotals {
  const taxable = Math.max(0, roundMoney(subtotal - discount));

  const shipping = taxable <= 499 ? 80 : 0;

  const tax = roundMoney((taxable * env.GST_RATE_PERCENT) / 100);

  const totalInr = Math.max(0, roundMoney(taxable + shipping + tax));

  const availableCredit = Math.max(0, roundMoney(storeCreditBalance));

  const storeCreditAppliedInr = Math.min(availableCredit, totalInr);

  const payableInr = Math.max(0, roundMoney(totalInr - storeCreditAppliedInr));

  return {
    subtotalInr: roundMoney(subtotal),
    shippingInr: roundMoney(shipping),
    discountInr: roundMoney(discount),
    taxInr: roundMoney(tax),
    totalInr,
    storeCreditBalanceInr: availableCredit,
    storeCreditAppliedInr: roundMoney(storeCreditAppliedInr),
    payableInr,
  };
}

/* ============================================================
   CHECKOUT PREVIEW
   ============================================================ */

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
      `
      SELECT
        ci.quantity,
        p.price_inr priceInr
      FROM carts c
      INNER JOIN cart_items ci
        ON ci.cart_id = c.id
      INNER JOIN product_variants v
        ON v.id = ci.variant_id
      INNER JOIN products p
        ON p.id = v.product_id
       AND p.is_active = 1
      WHERE c.customer_id =
        @customerId
      `,
    );

  if (!items.recordset.length) {
    throw new Error("Your bag is empty.");
  }

  const subtotal = items.recordset.reduce(
    (sum: number, item: any) =>
      sum + Number(item.priceInr) * Number(item.quantity),
    0,
  );

  const coupon = await validateCoupon(couponCode, customerId, subtotal);

  const credit = await getStoreCreditInfo(pool, customerId);

  return {
    ...calculateTotals(subtotal, coupon.discountInr, credit.availableInr),
    couponCode: coupon.code,
  };
}

/* ============================================================
   CREATE PAYMENT / CHECKOUT ORDER
   ============================================================ */

export async function createPaymentOrder(
  customerId: string,
  address: ShippingAddress & {
    couponCode?: string | null;
  },
) {
  validateAddress(address);

  await releaseExpiredReservations();

  const pool = await getDb();

  const items = await pool
    .request()
    .input("customerId", customerId)
    .query<any>(
      `
      SELECT
        ci.id cartItemId,
        ci.variant_id variantId,
        ci.quantity,
        p.id productId,
        p.name productName,
        p.price_inr priceInr,
        v.sku,
        CAST(
          i.quantity_available -
          i.quantity_reserved
          AS int
        ) available
      FROM carts c
      INNER JOIN cart_items ci
        ON ci.cart_id = c.id
      INNER JOIN product_variants v
        ON v.id = ci.variant_id
      INNER JOIN products p
        ON p.id = v.product_id
       AND p.is_active = 1
      INNER JOIN inventory i
        ON i.variant_id = v.id
      WHERE c.customer_id =
        @customerId
      `,
    );

  if (!items.recordset.length) {
    throw new Error("Your bag is empty.");
  }

  const subtotal = items.recordset.reduce(
    (sum: number, item: any) =>
      sum + Number(item.priceInr) * Number(item.quantity),
    0,
  );

  const coupon = await validateCoupon(address.couponCode, customerId, subtotal);

  const credit = await getStoreCreditInfo(pool, customerId);

  const totals = calculateTotals(
    subtotal,
    coupon.discountInr,
    credit.availableInr,
  );

  const orderId = randomUUID();

  const orderNumber = `SS-${new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "")}-${orderId.slice(0, 8).toUpperCase()}`;

  const expires = new Date(
    Date.now() + env.PAYMENT_RESERVATION_MINUTES * 60_000,
  );

  const tx = new sql.Transaction(pool);

  await tx.begin();

  try {
    /*
     * Lock the store-credit account before
     * reserving credit so two simultaneous
     * checkouts cannot reserve the same balance.
     */
    let lockedCreditBalance = credit.availableInr;

    if (totals.storeCreditAppliedInr > 0) {
      const account = await new sql.Request(tx)
        .input("customerId", customerId)
        .query<any>(
          `
            SELECT TOP 1
              id,
              balance_inr balanceInr
            FROM store_credit_accounts
              WITH (UPDLOCK,HOLDLOCK)
            WHERE customer_id =
              @customerId
            `,
        );

      if (!account.recordset[0]) {
        throw new Error("Store credit account could not be found.");
      }

      const reserved = await new sql.Request(tx)
        .input("customerId", customerId)
        .query<any>(
          `
            SELECT
              COALESCE(
                SUM(
                  store_credit_applied_inr
                ),
                0
              ) reservedInr
            FROM orders
            WHERE customer_id =
              @customerId
              AND status =
                'PENDING_PAYMENT'
              AND store_credit_applied_inr >
                0
              AND store_credit_released_at
                IS NULL
            `,
        );

      lockedCreditBalance = Math.max(
        0,
        roundMoney(
          Number(account.recordset[0].balanceInr ?? 0) -
            Number(reserved.recordset[0]?.reservedInr ?? 0),
        ),
      );
    }

    const finalTotals = calculateTotals(
      subtotal,
      coupon.discountInr,
      lockedCreditBalance,
    );

    for (const item of items.recordset) {
      const lock = await new sql.Request(tx)
        .input("variantId", item.variantId)
        .input("quantity", item.quantity)
        .query<any>(
          `
            UPDATE inventory
            SET
              quantity_reserved =
                quantity_reserved +
                @quantity,
              updated_at =
                SYSUTCDATETIME()
            OUTPUT
              INSERTED.quantity_available -
              INSERTED.quantity_reserved
              AS available
            WHERE variant_id =
              @variantId
              AND quantity_available -
                  quantity_reserved >=
                  @quantity
            `,
        );

      if (!lock.recordset.length) {
        throw new Error(
          `${item.productName} is no longer available in the requested quantity.`,
        );
      }
    }

    /*
     * If store credit completely covers the order,
     * there is no Razorpay payment required.
     *
     * Keep the order PENDING_PAYMENT until finalization
     * below, then immediately finalize it.
     */
    const paymentStatus = finalTotals.payableInr <= 0 ? "PENDING" : "PENDING";

    await new sql.Request(tx)
      .input("id", orderId)
      .input("orderNumber", orderNumber)
      .input("customerId", customerId)
      .input("subtotal", finalTotals.subtotalInr)
      .input("shipping", finalTotals.shippingInr)
      .input("discount", finalTotals.discountInr)
      .input("tax", finalTotals.taxInr)
      .input("total", finalTotals.totalInr)
      .input("storeCreditApplied", finalTotals.storeCreditAppliedInr)
      .input("address", JSON.stringify(address))
      .input("paymentStatus", paymentStatus)
      .input("coupon", address.couponCode?.trim().toUpperCase() || null)
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
          coupon_code
        )
        VALUES(
          @id,
          @orderNumber,
          @customerId,
          'PENDING_PAYMENT',
          'INR',
          @subtotal,
          @shipping,
          @discount,
          @tax,
          @total,
          @storeCreditApplied,
          NULL,
          @address,
          'RAZORPAY',
          @paymentStatus,
          @coupon
        )
        `,
      );

    await new sql.Request(tx)
      .input("id", orderId)
      .input("paymentStatus", paymentStatus)
      .query(
        `
        UPDATE orders
        SET
          payment_status =
            @paymentStatus,
          updated_at =
            SYSUTCDATETIME()
        WHERE id = @id
        `,
      );

    for (const item of items.recordset) {
      await new sql.Request(tx)
        .input("id", randomUUID())
        .input("orderId", orderId)
        .input("variantId", item.variantId)
        .input("productName", item.productName)
        .input("sku", item.sku)
        .input("quantity", item.quantity)
        .input("unitPrice", item.priceInr)
        .input(
          "totalPrice",
          roundMoney(Number(item.priceInr) * Number(item.quantity)),
        )
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
            @id,
            @orderId,
            @variantId,
            @productName,
            @sku,
            @quantity,
            @unitPrice,
            @totalPrice
          )
          `,
        );
    }

    for (const item of items.recordset) {
      await new sql.Request(tx)
        .input("id", randomUUID())
        .input("orderId", orderId)
        .input("variantId", item.variantId)
        .input("quantity", item.quantity)
        .input("expiresAt", expires)
        .query(
          `
          INSERT INTO inventory_reservations(
            id,
            order_id,
            variant_id,
            quantity,
            expires_at
          )
          VALUES(
            @id,
            @orderId,
            @variantId,
            @quantity,
            @expiresAt
          )
          `,
        );
    }

    await new sql.Request(tx)
      .input("orderId", orderId)
      .input("status", "PENDING_PAYMENT")
      .query(
        `
        INSERT INTO order_status_history(
          order_id,
          status,
          note
        )
        VALUES(
          @orderId,
          @status,
          'Payment order created and inventory reserved.'
        )
        `,
      );

    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  }

  /*
   * FULL STORE CREDIT CHECKOUT
   *
   * No Razorpay order is created.
   */
  if (totals.payableInr <= 0) {
    await finalizePaidOrder(orderId, "STORE_CREDIT");

    return {
      orderId,
      orderNumber,
      amount: 0,
      currency: "INR",
      razorpayOrderId: "",
      keyId: env.RAZORPAY_KEY_ID || "",
      ...totals,
    };
  }

  /*
   * NORMAL RAZORPAY CHECKOUT
   *
   * Razorpay receives only the amount after
   * store credit has been applied.
   */
  try {
    const razorOrder = await razorpayRequest<any>("/orders", {
      method: "POST",
      body: JSON.stringify({
        amount: Math.round(totals.payableInr * 100),
        currency: "INR",
        receipt: orderNumber,
        notes: {
          smolstudioOrderId: orderId,
        },
      }),
    });

    await pool
      .request()
      .input("id", orderId)
      .input("paymentOrderId", razorOrder.id)
      .query(
        `
        UPDATE orders
        SET
          payment_order_id =
            @paymentOrderId,
          updated_at =
            SYSUTCDATETIME()
        WHERE id = @id
        `,
      );

    return {
      orderId,
      orderNumber,
      amount: Math.round(totals.payableInr * 100),
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

/* ============================================================
   STORE CREDIT FINALIZATION
   ============================================================ */

async function consumeStoreCredit(
  tx: sql.Transaction,
  orderId: string,
  customerId: string,
  amountInr: number,
) {
  const amount = roundMoney(amountInr);

  if (amount <= 0) {
    return;
  }

  const account = await new sql.Request(tx)
    .input("customerId", customerId)
    .query<any>(
      `
        SELECT TOP 1
          id,
          balance_inr balanceInr
        FROM store_credit_accounts
          WITH (UPDLOCK,HOLDLOCK)
        WHERE customer_id =
          @customerId
        `,
    );

  const row = account.recordset[0];

  if (!row) {
    throw new Error("Store credit account not found.");
  }

  const currentBalance = roundMoney(Number(row.balanceInr ?? 0));

  if (currentBalance < amount) {
    throw new Error("Insufficient store credit balance.");
  }

  const newBalance = roundMoney(currentBalance - amount);

  const update = await new sql.Request(tx)
    .input("accountId", row.id)
    .input("amount", amount)
    .query(
      `
        UPDATE store_credit_accounts
        SET
          balance_inr =
            balance_inr -
            @amount,
          updated_at =
            SYSUTCDATETIME()
        WHERE id =
          @accountId
          AND balance_inr >=
              @amount
        `,
    );

  if (!update.rowsAffected[0]) {
    throw new Error("Store credit balance changed. Please retry checkout.");
  }

  await new sql.Request(tx)
    .input("id", randomUUID())
    .input("accountId", row.id)
    .input("transactionType", "ORDER_PAYMENT")
    .input("amount", -amount)
    .input("balanceAfter", newBalance)
    .input("orderId", orderId)
    .input("description", "Store credit applied to order.")
    .query(
      `
      INSERT INTO store_credit_transactions(
        id,
        account_id,
        transaction_type,
        amount_inr,
        balance_after_inr,
        order_id,
        description
      )
      VALUES(
        @id,
        @accountId,
        @transactionType,
        @amount,
        @balanceAfter,
        @orderId,
        @description
      )
      `,
    );
}

/*
 * Restores store credit used on a cancelled order.
 *
 * Returns the restored amount and new balance so the caller
 * can send a separate store-credit restoration email.
 *
 * Returns null when:
 * - the order does not use store credit, or
 * - the store credit was already restored.
 */
async function restoreStoreCreditForOrder(orderId: string) {
  const pool = await getDb();

  const tx = new sql.Transaction(pool);

  await tx.begin();

  try {
    const order = await new sql.Request(tx)
      .input("orderId", orderId)
      .query<any>(
        `
          SELECT TOP 1
            customer_id customerId,
            store_credit_applied_inr
              storeCreditApplied,
            payment_status paymentStatus
          FROM orders
          WHERE id = @orderId
          `,
      );

    const row = order.recordset[0];

    if (!row || Number(row.storeCreditApplied ?? 0) <= 0) {
      await tx.commit();
      return null;
    }

    /*
     * Idempotency:
     *
     * Never restore the same store credit twice.
     */
    const alreadyRestored = await new sql.Request(tx)
      .input("orderId", orderId)
      .query<any>(
        `
          SELECT COUNT(*) AS count
          FROM store_credit_transactions
          WHERE order_id = @orderId
            AND transaction_type =
              'ORDER_CREDIT_RESTORE'
          `,
      );

    if (Number(alreadyRestored.recordset[0]?.count ?? 0) > 0) {
      await tx.commit();
      return null;
    }

    const account = await new sql.Request(tx)
      .input("customerId", row.customerId)
      .query<any>(
        `
          SELECT TOP 1
            id,
            balance_inr balanceInr
          FROM store_credit_accounts
            WITH (UPDLOCK,HOLDLOCK)
          WHERE customer_id =
            @customerId
          `,
      );

    if (!account.recordset[0]) {
      throw new Error("Store credit account not found.");
    }

    const accountRow = account.recordset[0];

    const amount = roundMoney(Number(row.storeCreditApplied));

    const newBalance = roundMoney(Number(accountRow.balanceInr ?? 0) + amount);

    /*
     * Restore the balance.
     */
    await new sql.Request(tx)
      .input("accountId", accountRow.id)
      .input("amount", amount)
      .query(
        `
        UPDATE store_credit_accounts
        SET
          balance_inr =
            balance_inr +
            @amount,
          updated_at =
            SYSUTCDATETIME()
        WHERE id =
          @accountId
        `,
      );

    /*
     * Record the restoration.
     */
    await new sql.Request(tx)
      .input("id", randomUUID())
      .input("accountId", accountRow.id)
      .input("transactionType", "ORDER_CREDIT_RESTORE")
      .input("amount", amount)
      .input("balanceAfter", newBalance)
      .input("orderId", orderId)
      .input("description", "Store credit restored after order cancellation.")
      .query(
        `
        INSERT INTO store_credit_transactions(
          id,
          account_id,
          transaction_type,
          amount_inr,
          balance_after_inr,
          order_id,
          description
        )
        VALUES(
          @id,
          @accountId,
          @transactionType,
          @amount,
          @balanceAfter,
          @orderId,
          @description
        )
        `,
      );

    /*
     * Mark the credit as released for this order.
     */
    await new sql.Request(tx).input("orderId", orderId).query(
      `
        UPDATE orders
        SET
          store_credit_released_at =
            SYSUTCDATETIME(),
          updated_at =
            SYSUTCDATETIME()
        WHERE id = @orderId
        `,
    );

    await tx.commit();

    /*
     * Return the restoration details to the caller.
     */
    return {
      amount,
      balanceAfter: newBalance,
    };
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

/* ============================================================
   FINALIZE PAID ORDER
   ============================================================ */

async function finalizePaidOrder(orderId: string, paymentId: string) {
  const pool = await getDb();

  const existing = await pool
    .request()
    .input("id", orderId)
    .query<any>(
      `
        SELECT TOP 1
          payment_status paymentStatus,
          status,
          customer_id customerId,
          order_number orderNumber,
          coupon_code couponCode,
          store_credit_applied_inr
            storeCreditApplied
        FROM orders WITH (UPDLOCK,HOLDLOCK)
        WHERE id = @id
        `,
    );

  const row = existing.recordset[0];

  if (!row) {
    throw new Error("Order not found.");
  }

  if (row.paymentStatus === "CAPTURED") {
    return row;
  }

  const claimed = await pool
    .request()
    .input("id", orderId)
    .query(
      `
        UPDATE orders
        SET
          payment_status =
            'PROCESSING',
          updated_at =
            SYSUTCDATETIME()
        WHERE id = @id
          AND payment_status =
            'PENDING'
        `,
    );

  if (!claimed.rowsAffected[0]) {
    const latest = (
      await pool
        .request()
        .input("id", orderId)
        .query<any>(
          `
          SELECT TOP 1
            payment_status paymentStatus,
            status,
            customer_id customerId,
            order_number orderNumber,
            coupon_code couponCode,
            store_credit_applied_inr
              storeCreditApplied
          FROM orders
          WHERE id = @id
          `,
        )
    ).recordset[0];

    if (
      latest?.paymentStatus === "CAPTURED" ||
      latest?.paymentStatus === "PROCESSING"
    ) {
      return latest;
    }

    throw new Error(
      "Payment is already being finalized. Please retry shortly.",
    );
  }

  /*
   * Finalize inventory first.
   */
  await consumeReservation(orderId);

  const tx = new sql.Transaction(pool);

  await tx.begin();

  try {
    /*
     * Consume reserved store credit
     * only when payment/order succeeds.
     */
    if (Number(row.storeCreditApplied ?? 0) > 0) {
      await consumeStoreCredit(
        tx,
        orderId,
        row.customerId,
        Number(row.storeCreditApplied),
      );
    }

    /*
     * Coupon redemption.
     */
    if (row.couponCode && row.couponCode.toUpperCase() !== "WELCOME5") {
      const coupon = await new sql.Request(tx)
        .input("code", sql.NVarChar(100), row.couponCode.trim().toUpperCase())
        .query<any>(
          `
            SELECT TOP 1
              id,
              max_redemptions
                maxRedemptions,
              redeemed_count
                redeemedCount
            FROM dbo.coupons
              WITH (UPDLOCK,HOLDLOCK)
            WHERE UPPER(code) =
              @code
              AND is_active = 1
            `,
        );

      if (!coupon.recordset[0]) {
        throw new Error(
          "Coupon could not be found while completing the order.",
        );
      }

      const c = coupon.recordset[0];

      const update = await new sql.Request(tx)
        .input("id", c.id)
        .input("max", c.maxRedemptions)
        .query(
          `
            UPDATE dbo.coupons
            SET
              redeemed_count =
                redeemed_count + 1
            WHERE id = @id
              AND (
                @max IS NULL
                OR @max <= 0
                OR redeemed_count <
                   @max
              )
            `,
        );

      if (!update.rowsAffected[0]) {
        throw new Error(
          "Coupon redemption limit was reached while payment was completing.",
        );
      }

      const discount = await new sql.Request(tx)
        .input("orderId", orderId)
        .query<any>(
          `
            SELECT
              discount_inr discount
            FROM dbo.orders
            WHERE id = @orderId
            `,
        );

      await new sql.Request(tx)
        .input("id", randomUUID())
        .input("couponId", c.id)
        .input("customerId", row.customerId)
        .input("orderId", orderId)
        .input("discount", discount.recordset[0]?.discount ?? 0)
        .query(
          `
          INSERT INTO dbo.coupon_redemptions(
            id,
            coupon_id,
            customer_id,
            order_id,
            discount_inr
          )
          VALUES(
            @id,
            @couponId,
            @customerId,
            @orderId,
            @discount
          )
          `,
        );
    }

    await new sql.Request(tx)
      .input("id", orderId)
      .input("paymentId", paymentId)
      .query(
        `
        UPDATE orders
        SET
          status = 'PAID',
          payment_status =
            'CAPTURED',
          payment_reference =
            @paymentId,
          store_credit_released_at =
            NULL,
          updated_at =
            SYSUTCDATETIME()
        WHERE id = @id
          AND payment_status <>
              'CAPTURED';

        INSERT INTO order_status_history(
          order_id,
          status,
          note
        )
        VALUES(
          @id,
          'PAID',
          'Payment captured and inventory finalized.'
        )
        `,
      );

    await new sql.Request(tx).input("customerId", row.customerId).query(
      `
        DELETE ci
        FROM cart_items ci
        INNER JOIN carts c
          ON c.id = ci.cart_id
        WHERE c.customer_id =
          @customerId
        `,
    );

    await tx.commit();

    void sendOrderStatusEmail(orderId, "PAID");

    return {
      ...row,
      status: "PAID",
      paymentStatus: "CAPTURED",
    };
  } catch (error) {
    await tx.rollback();

    /*
     * If store credit was consumed but finalization
     * failed before commit, the SQL transaction rolls
     * the credit deduction back.
     *
     * Inventory consumption happens in a separate
     * transaction, so mark the order failed only if
     * necessary; the existing reservation flow remains
     * intact.
     */
    throw error;
  }
}

/* ============================================================
   PAYMENT VERIFICATION
   ============================================================ */

export async function verifyPayment(
  customerId: string,
  orderId: string,
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string,
) {
  if (!verifySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature)) {
    throw new Error("Payment verification failed.");
  }

  const pool = await getDb();

  const order = await pool
    .request()
    .input("id", orderId)
    .input("customerId", customerId)
    .query<any>(
      `
        SELECT TOP 1
          id,
          order_number orderNumber,
          total_inr totalInr,
          store_credit_applied_inr
            storeCreditApplied,
          payment_order_id
            paymentOrderId,
          payment_status
            paymentStatus,
          status
        FROM orders
        WHERE id = @id
          AND customer_id =
            @customerId
        `,
    );

  const row = order.recordset[0];

  if (!row) {
    throw new Error("Order not found.");
  }

  if (row.paymentOrderId !== razorpayOrderId) {
    throw new Error("Payment order does not match this order.");
  }

  if (row.paymentStatus === "CAPTURED") {
    return {
      orderId,
      orderNumber: row.orderNumber,
      status: "PAID",
    };
  }

  const payment = await razorpayRequest<any>(
    `/payments/${encodeURIComponent(razorpayPaymentId)}`,
  );

  if (payment.order_id !== razorpayOrderId) {
    throw new Error("Payment belongs to a different order.");
  }

  if (payment.status !== "captured") {
    throw new Error(
      `Payment is ${payment.status}; the order will remain pending until it is captured.`,
    );
  }

  await finalizePaidOrder(orderId, razorpayPaymentId);

  return {
    orderId,
    orderNumber: row.orderNumber,
    status: "PAID",
  };
}

/* ============================================================
   RAZORPAY WEBHOOK
   ============================================================ */

export async function handleRazorpayWebhook(
  rawBody: string | Buffer,
  signature: string,
  eventId: string | undefined,
  payload: any,
) {
  if (!verifyWebhookSignature(rawBody, signature)) {
    throw new Error("Invalid Razorpay webhook signature.");
  }

  const pool = await getDb();

  const id =
    eventId ||
    payload?.id ||
    createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");

  /*
   * ------------------------------------------------------------
   * IDEMPOTENCY
   * ------------------------------------------------------------
   */
  const exists = await pool
    .request()
    .input("eventId", id)
    .query(
      `
        SELECT TOP 1
          id,
          processed_at processedAt
        FROM payment_webhook_events
        WHERE event_id = @eventId
        `,
    );

  /*
   * If this exact event was already successfully processed,
   * ignore the duplicate.
   */
  if (exists.recordset[0]?.processedAt) {
    return true;
  }

  /*
   * Store the webhook event if this is the first time we have
   * seen it.
   */
  if (!exists.recordset.length) {
    await pool
      .request()
      .input("eventId", id)
      .input("eventType", payload?.event || "unknown")
      .input("payload", JSON.stringify(payload))
      .query(
        `
        INSERT INTO payment_webhook_events(
          event_id,
          event_type,
          payload_json
        )
        VALUES(
          @eventId,
          @eventType,
          @payload
        )
        `,
      );
  }

  /*
   * ============================================================
   * RAZORPAY REFUND WEBHOOKS
   * ============================================================
   */
  const refund = payload?.payload?.refund?.entity;

  if (
    refund &&
    ["refund.processed", "refund.failed"].includes(payload?.event)
  ) {
    const razorpayRefundId = refund.id;

    if (!razorpayRefundId) {
      throw new Error("Razorpay refund webhook is missing refund ID.");
    }

    /*
     * Find our local refund record using Razorpay's refund ID.
     */
    const refundRow = (
      await pool
        .request()
        .input("refundId", razorpayRefundId)
        .query<any>(
          `
          SELECT TOP 1
            id,
            order_id orderId,
            amount_inr amountInr,
            status
          FROM payment_refunds
          WHERE razorpay_refund_id =
            @refundId
          `,
        )
    ).recordset[0];

    /*
     * If the local refund record does not exist yet, leave
     * processed_at NULL.
     *
     * This allows the same webhook to be retried later rather
     * than permanently losing the refund synchronization.
     */
    if (!refundRow) {
      return true;
    }

    /*
     * ----------------------------------------------------------
     * REFUND PROCESSED / FAILED
     * ----------------------------------------------------------
     */
    const newRefundStatus =
      payload.event === "refund.processed" ? "PROCESSED" : "FAILED";

    await pool
      .request()
      .input("refundId", razorpayRefundId)
      .input("status", newRefundStatus)
      .query(
        `
        UPDATE payment_refunds
        SET
          status = @status,
          processed_at =
            CASE
              WHEN @status = 'PROCESSED'
                THEN SYSUTCDATETIME()
              ELSE processed_at
            END
        WHERE razorpay_refund_id =
          @refundId
        `,
      );

    /*
     * ----------------------------------------------------------
     * REFUND PROCESSED
     * ----------------------------------------------------------
     */
    if (payload.event === "refund.processed") {
      const orderRefunds = (
        await pool
          .request()
          .input("orderId", refundRow.orderId)
          .query<any>(
            `
            SELECT
              COALESCE(
                SUM(amount_inr),
                0
              ) refunded
            FROM payment_refunds
            WHERE order_id = @orderId
              AND status = 'PROCESSED'
            `,
          )
      ).recordset[0];

      const totalRefunded = Number(orderRefunds?.refunded || 0);

      const order = (
        await pool
          .request()
          .input("orderId", refundRow.orderId)
          .query<any>(
            `
            SELECT TOP 1
              total_inr totalInr,
              store_credit_applied_inr
                storeCreditApplied
            FROM orders
            WHERE id = @orderId
            `,
          )
      ).recordset[0];

      const refundableAmount = Math.max(
        0,
        Number(order?.totalInr || 0) - Number(order?.storeCreditApplied || 0),
      );

      const paymentStatus =
        totalRefunded >= refundableAmount ? "REFUNDED" : "PARTIALLY_REFUNDED";

      await pool
        .request()
        .input("orderId", refundRow.orderId)
        .input("paymentStatus", paymentStatus)
        .query(
          `
          UPDATE orders
          SET
            payment_status =
              @paymentStatus,
            updated_at =
              SYSUTCDATETIME()
          WHERE id = @orderId
          `,
        );

      void sendOrderStatusEmail(refundRow.orderId, paymentStatus);
    }

    /*
     * ----------------------------------------------------------
     * REFUND FAILED
     * ----------------------------------------------------------
     */
    if (payload.event === "refund.failed") {
      await pool
        .request()
        .input("orderId", refundRow.orderId)
        .query(
          `
          UPDATE orders
          SET
            payment_status =
              'REFUND_FAILED',
            updated_at =
              SYSUTCDATETIME()
          WHERE id = @orderId
          `,
        );

      void sendOrderStatusEmail(refundRow.orderId, "REFUND_FAILED");
    }

    /*
     * Mark the webhook successfully processed only AFTER
     * the refund synchronization has completed.
     */
    await pool
      .request()
      .input("eventId", id)
      .query(
        `
        UPDATE payment_webhook_events
        SET
          processed_at =
            SYSUTCDATETIME()
        WHERE event_id =
          @eventId
        `,
      );

    return true;
  }

  /*
   * ============================================================
   * NORMAL PAYMENT WEBHOOKS
   * ============================================================
   */
  const payment = payload?.payload?.payment?.entity;

  const razorOrderId = payment?.order_id;

  const paymentId = payment?.id;

  const order = razorOrderId
    ? await pool
        .request()
        .input("paymentOrderId", razorOrderId)
        .query<any>(
          `
            SELECT TOP 1
              id
            FROM orders
            WHERE payment_order_id =
              @paymentOrderId
            `,
        )
    : {
        recordset: [],
      };

  const orderId = order.recordset[0]?.id;

  /*
   * Payment successfully captured.
   */
  if (orderId && ["payment.captured", "order.paid"].includes(payload?.event)) {
    await finalizePaidOrder(orderId, paymentId || "");
  }

  /*
   * Payment failed.
   */
  if (orderId && payload?.event === "payment.failed") {
    await releaseOrderReservation(
      orderId,
      "PAYMENT_FAILED",
      "Payment failed at Razorpay.",
    );
  }

  /*
   * Mark the webhook processed only after all relevant
   * business processing has succeeded.
   */
  await pool
    .request()
    .input("eventId", id)
    .query(
      `
      UPDATE payment_webhook_events
      SET
        processed_at =
          SYSUTCDATETIME()
      WHERE event_id =
        @eventId
      `,
    );

  return true;
}

/* ============================================================
   ORDER MAPPING
   ============================================================ */

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

    storeCreditAppliedInr: Number(row.storeCreditAppliedInr ?? 0),

    createdAt: new Date(row.createdAt).toISOString(),

    shippedAt: row.shippedAt ? new Date(row.shippedAt).toISOString() : null,

    deliveredAt: row.deliveredAt
      ? new Date(row.deliveredAt).toISOString()
      : null,

    shippingAddress: address,

    items: row.items ?? [],
  };
}

const orderSelect = `
  id,
  order_number orderNumber,
  status,
  currency,
  CAST(
    subtotal_inr AS decimal(12,2)
  ) subtotalInr,
  CAST(
    shipping_inr AS decimal(12,2)
  ) shippingInr,
  CAST(
    discount_inr AS decimal(12,2)
  ) discountInr,
  CAST(
    tax_inr AS decimal(12,2)
  ) taxInr,
  CAST(
    total_inr AS decimal(12,2)
  ) totalInr,
  CAST(
    store_credit_applied_inr
    AS decimal(12,2)
  ) storeCreditAppliedInr,
  shipping_address_json
    shippingAddressJson,
  payment_status paymentStatus,
  tracking_number trackingNumber,
  carrier,
  tracking_url trackingUrl,
  created_at createdAt,
  shipped_at shippedAt,
  delivered_at deliveredAt
`;

/* ============================================================
   CUSTOMER ORDERS
   ============================================================ */

export async function listCustomerOrders(customerId: string) {
  const pool = await getDb();

  const r = await pool
    .request()
    .input("customerId", customerId)
    .query<any>(
      `
      SELECT
        ${orderSelect}
      FROM orders
      WHERE customer_id =
        @customerId
        AND status IN (
          'PAID',
          'PROCESSING',
          'SHIPPED',
          'DELIVERED',
          'CANCELLED',
          'REFUNDED',
          'PARTIALLY_REFUNDED'
        )
      ORDER BY
        created_at DESC
      `,
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
      `
      SELECT TOP 1
        ${orderSelect}
      FROM orders
      WHERE id = @id
        AND customer_id = @customerId
      `,
    );

  const row = r.recordset[0];

  if (!row) {
    return null;
  }

  const items = await pool
    .request()
    .input("orderId", id)
    .query<any>(
      `
      SELECT
        oi.id,
        oi.product_name productName,
        oi.sku,
        oi.quantity,
        oi.variant_id variantId,
        pv.product_id productId,
        pv.size,

        CAST(
          oi.unit_price_inr AS decimal(12,2)
        ) unitPriceInr,

        CAST(
          oi.total_price_inr AS decimal(12,2)
        ) totalPriceInr

      FROM order_items oi

      LEFT JOIN product_variants pv
        ON pv.id = oi.variant_id

      WHERE oi.order_id = @orderId

      ORDER BY oi.id
      `,
    );

  /*
   * Get all currently available sizes for products
   * contained in this order.
   *
   * Available means:
   * quantity_available - quantity_reserved > 0
   */
  const replacementSizesResult = await pool
    .request()
    .input("orderId", id)
    .query<any>(
      `
      SELECT DISTINCT
        pv.product_id productId,
        LTRIM(RTRIM(pv.size)) size

      FROM product_variants pv

      INNER JOIN inventory i
        ON i.variant_id = pv.id

      WHERE pv.product_id IN (
        SELECT DISTINCT
          pv2.product_id

        FROM order_items oi2

        INNER JOIN product_variants pv2
          ON pv2.id = oi2.variant_id

        WHERE oi2.order_id = @orderId
      )

      AND (
        i.quantity_available -
        i.quantity_reserved
      ) > 0

      ORDER BY
        pv.product_id,
        LTRIM(RTRIM(pv.size))
      `,
    );

  /*
   * Build:
   *
   * productId -> available sizes
   */
  const availableSizesByProduct = new Map<string, string[]>();

  for (const row of replacementSizesResult.recordset) {
    const productId = String(row.productId);
    const size = String(row.size ?? "").trim();

    if (!size) {
      continue;
    }

    const existing = availableSizesByProduct.get(productId) ?? [];

    if (!existing.includes(size)) {
      existing.push(size);
    }

    availableSizesByProduct.set(productId, existing);
  }

  return {
    ...mapOrder(row),

    items: items.recordset.map((item: any) => {
      const productId = item.productId ? String(item.productId) : null;

      const currentSize = item.size ? String(item.size).trim() : null;

      const availableSizes = productId
        ? (availableSizesByProduct.get(productId) ?? [])
        : [];

      /*
       * Don't offer the size the customer already has.
       */
      const replacementSizes = availableSizes.filter(
        (size) =>
          !currentSize || size.toUpperCase() !== currentSize.toUpperCase(),
      );

      return {
        ...item,

        productId,
        variantId: item.variantId ? String(item.variantId) : null,

        size: currentSize,

        replacementSizes,

        unitPriceInr: Number(item.unitPriceInr),

        totalPriceInr: Number(item.totalPriceInr),
      };
    }),
  };
}

/* ============================================================
   CUSTOMER CANCELLATION
   ============================================================ */

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
      `
      SELECT TOP 1
        id,
        status,
        payment_status paymentStatus,
        payment_reference paymentReference,
        total_inr totalInr,
        store_credit_applied_inr storeCreditApplied
      FROM orders
      WHERE id = @id
        AND customer_id = @customerId
      `,
    );

  const o = r.recordset[0];

  if (!o) {
    throw new Error("Order not found.");
  }

  if (!["PAID", "PROCESSING"].includes(o.status)) {
    throw new Error("This order can no longer be cancelled.");
  }

  const shipped = (
    await pool
      .request()
      .input("id", id)
      .query<any>(
        `
        SELECT shipped_at shippedAt
        FROM orders
        WHERE id = @id
        `,
      )
  ).recordset[0]?.shippedAt;

  if (shipped) {
    throw new Error("This order has already been shipped.");
  }

  /*
   * ------------------------------------------------------------
   * PAID ORDER:
   *
   * Refund the amount actually paid through Razorpay.
   * Store credit is restored separately below.
   * ------------------------------------------------------------
   */
  if (o.paymentStatus === "CAPTURED" && o.paymentReference) {
    const razorpayRefundAmount = Math.max(
      0,
      Number(o.totalInr) - Number(o.storeCreditApplied ?? 0),
    );

    if (razorpayRefundAmount > 0) {
      await refundPayment(
        id,
        razorpayRefundAmount,
        `Customer cancellation: ${reason || "No reason provided"}`,
      );
    }
  }

  /*
   * Restore store credit separately.
   *
   * The amount paid through Razorpay is refunded
   * through Razorpay.
   *
   * The amount paid through store credit is returned
   * directly to the customer's store-credit balance.
   *
   * A separate email is sent to explain the store-credit
   * restoration and show the customer's new balance.
   */
  if (Number(o.storeCreditApplied ?? 0) > 0) {
    const storeCreditRestore = await restoreStoreCreditForOrder(id);

    if (storeCreditRestore) {
      void sendStoreCreditRestoreEmail(
        id,
        storeCreditRestore.amount,
        storeCreditRestore.balanceAfter,
      );
    }
  }

  /*
   * Return the inventory to stock.
   */
  await restoreInventoryForOrder(id);

  /*
   * The ORDER itself is cancelled.
   *
   * refundPayment() handles payment_status.
   * We deliberately do NOT overwrite payment_status here.
   */
  await pool
    .request()
    .input("id", id)
    .input("reason", reason || null)
    .query(
      `
      UPDATE orders
      SET
        status = 'CANCELLED',
        cancelled_at =
          SYSUTCDATETIME(),
        cancel_reason = @reason,
        updated_at =
          SYSUTCDATETIME()
      WHERE id = @id;

      INSERT INTO order_status_history(
        order_id,
        status,
        note
      )
      VALUES(
        @id,
        'CANCELLED',
        @reason
      );
      `,
    );

  return getCustomerOrder(customerId, id);
}

async function restoreInventoryForOrder(orderId: string) {
  const pool = await getDb();

  const tx = new sql.Transaction(pool);

  await tx.begin();

  try {
    const rows = await new sql.Request(tx).input("orderId", orderId).query<any>(
      `
          SELECT
            variant_id variantId,
            quantity
          FROM order_items
          WHERE order_id =
            @orderId
          `,
    );

    for (const x of rows.recordset) {
      await new sql.Request(tx)
        .input("variantId", x.variantId)
        .input("quantity", x.quantity)
        .query(
          `
          UPDATE inventory
          SET
            quantity_available =
              quantity_available +
              @quantity,
            updated_at =
              SYSUTCDATETIME()
          WHERE variant_id =
            @variantId
          `,
        );
    }

    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

/* ============================================================
   RAZORPAY REFUND
   ============================================================ */

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
        `
        SELECT TOP 1
          payment_reference paymentReference,
          payment_status paymentStatus,
          total_inr totalInr,
          store_credit_applied_inr
            storeCreditApplied
        FROM orders
        WHERE id = @id
        `,
      )
  ).recordset[0];

  if (!order) {
    throw new Error("Order not found.");
  }

  if (
    !["CAPTURED", "PARTIALLY_REFUNDED"].includes(order.paymentStatus) ||
    !order.paymentReference
  ) {
    throw new Error("Only captured payments can be refunded.");
  }

  /*
   * Razorpay only received:
   *
   * total order amount
   * MINUS store credit used.
   *
   * Therefore the maximum Razorpay refund is NOT simply
   * order.totalInr.
   */
  const razorpayPaidAmount = Math.max(
    0,
    Number(order.totalInr) - Number(order.storeCreditApplied ?? 0),
  );

  /*
   * Calculate how much has already been refunded through
   * Razorpay for this order.
   */
  const prior = Number(
    (
      await pool
        .request()
        .input("orderId", orderId)
        .query<any>(
          `
          SELECT
            COALESCE(
              SUM(amount_inr),
              0
            ) refunded
          FROM payment_refunds
          WHERE order_id = @orderId
            AND status = 'PROCESSED'
          `,
        )
    ).recordset[0]?.refunded || 0,
  );

  const remaining = razorpayPaidAmount - prior;

  if (amountInr <= 0) {
    throw new Error("Refund amount must be greater than zero.");
  }

  if (amountInr > remaining) {
    throw new Error(
      `Refund amount exceeds the remaining refundable amount of ₹${remaining.toLocaleString(
        "en-IN",
      )}.`,
    );
  }

  /*
   * ------------------------------------------------------------
   * RAZORPAY REFUND
   *
   * amount is in paise.
   * Example:
   * ₹500 = 50000 paise
   * ------------------------------------------------------------
   */
  const refund = await razorpayRequest<any>(
    `/payments/${encodeURIComponent(order.paymentReference)}/refund`,
    {
      method: "POST",
      body: JSON.stringify({
        amount: Math.round(amountInr * 100),
        notes: {
          reason: reason.slice(0, 500),
          smolstudioOrderId: orderId,
        },
      }),
    },
  );

  /*
   * Razorpay has accepted/created the refund.
   *
   * Keep the Razorpay refund ID so that webhook updates can
   * later synchronize the final refund state.
   */
  const refundStatus = refund?.status === "processed" ? "PROCESSED" : "PENDING";

  await pool
    .request()
    .input("id", randomUUID())
    .input("orderId", orderId)
    .input("paymentReference", order.paymentReference)
    .input("refundId", refund.id)
    .input("amount", amountInr)
    .input("status", refundStatus)
    .input("reason", reason)
    .query(
      `
      INSERT INTO payment_refunds(
        id,
        order_id,
        payment_reference,
        razorpay_refund_id,
        amount_inr,
        status,
        reason,
        processed_at
      )
      VALUES(
        @id,
        @orderId,
        @paymentReference,
        @refundId,
        @amount,
        @status,
        @reason,
        CASE
          WHEN @status = 'PROCESSED'
            THEN SYSUTCDATETIME()
          ELSE NULL
        END
      )
      `,
    );

  /*
   * If Razorpay says the refund is already processed,
   * update payment_status immediately.
   *
   * Otherwise leave the payment in its existing state until
   * the Razorpay refund webhook confirms the result.
   */
  if (refundStatus === "PROCESSED") {
    const newPaymentStatus =
      amountInr >= remaining ? "REFUNDED" : "PARTIALLY_REFUNDED";

    await pool
      .request()
      .input("id", orderId)
      .input("status", newPaymentStatus)
      .query(
        `
        UPDATE orders
        SET
          payment_status =
            @status,
          updated_at =
            SYSUTCDATETIME()
        WHERE id = @id;

        INSERT INTO order_status_history(
          order_id,
          status,
          note
        )
        VALUES(
          @id,
          'CANCELLED',
          'Razorpay refund processed.'
        );
        `,
      );

    void sendOrderStatusEmail(
      orderId,
      amountInr >= remaining ? "REFUNDED" : "PARTIALLY_REFUNDED",
    );
  } else {
    /*
     * Razorpay accepted the refund but it is not yet
     * confirmed as processed.
     *
     * Do not pretend the money has already reached the
     * customer's account.
     */
    await pool
      .request()
      .input("id", orderId)
      .query(
        `
        UPDATE orders
        SET
          payment_status =
            'REFUND_PENDING',
          updated_at =
            SYSUTCDATETIME()
        WHERE id = @id;
        `,
      );

    void sendOrderStatusEmail(orderId, "REFUND_PENDING");
  }

  return refund;
}

/* ============================================================
   LEGACY RETURN
   ============================================================ */

export async function requestReturn(
  customerId: string,
  orderId: string,
  reason: string,
) {
  if (!reason.trim()) {
    throw new Error("Return reason is required.");
  }

  const pool = await getDb();

  const o = (
    await pool
      .request()
      .input("id", orderId)
      .input("customerId", customerId)
      .query<any>(
        `
        SELECT TOP 1
          id,
          status,
          payment_status
            paymentStatus,
          total_inr totalInr
        FROM orders
        WHERE id = @id
          AND customer_id =
            @customerId
        `,
      )
  ).recordset[0];

  if (!o) {
    throw new Error("Order not found.");
  }

  if (o.status !== "DELIVERED") {
    throw new Error("Returns can be requested after delivery.");
  }

  const existing = await pool
    .request()
    .input("orderId", orderId)
    .query(
      `
        SELECT TOP 1
          id
        FROM return_requests
        WHERE order_id =
          @orderId
          AND status NOT IN (
            'REJECTED',
            'CANCELLED'
          )
        `,
    );

  if (existing.recordset.length) {
    throw new Error("A return request already exists for this order.");
  }

  const id = randomUUID();

  await pool
    .request()
    .input("id", id)
    .input("orderId", orderId)
    .input("customerId", customerId)
    .input("reason", reason.trim())
    .input("amount", o.totalInr)
    .query(
      `
      INSERT INTO return_requests(
        id,
        order_id,
        customer_id,
        reason,
        refund_amount_inr
      )
      VALUES(
        @id,
        @orderId,
        @customerId,
        @reason,
        @amount
      )
      `,
    );

  return id;
}

/* ============================================================
   AFTER-SALES
   ============================================================ */

export async function calculateOrderItemPaidAmount(
  orderId: string,
  orderItemId: string,
) {
  const pool = await getDb();

  const result = await pool
    .request()
    .input("orderId", orderId)
    .input("orderItemId", orderItemId)
    .query<any>(
      `
        SELECT TOP 1
          oi.id orderItemId,
          oi.total_price_inr itemTotal,
          o.subtotal_inr subtotal,
          o.discount_inr discount
        FROM order_items oi
        INNER JOIN orders o
          ON o.id = oi.order_id
        WHERE oi.id =
          @orderItemId
          AND oi.order_id =
            @orderId
        `,
    );

  const row = result.recordset[0];

  if (!row) {
    throw new Error("Order item not found.");
  }

  const itemTotal = roundMoney(Number(row.itemTotal));

  const subtotal = roundMoney(Number(row.subtotal));

  const orderDiscount = Math.max(0, roundMoney(Number(row.discount)));

  let allocatedDiscount = 0;

  if (subtotal > 0 && orderDiscount > 0) {
    allocatedDiscount = roundMoney((itemTotal / subtotal) * orderDiscount);
  }

  allocatedDiscount = Math.min(itemTotal, allocatedDiscount);

  const paidAmount = roundMoney(itemTotal - allocatedDiscount);

  return Math.max(0, paidAmount);
}

async function getVariantSizeColumn(pool: sql.ConnectionPool) {
  const columns = await getTableColumns(pool, "product_variants");

  for (const candidate of ["size", "size_label", "variant_size"]) {
    if (columns.has(candidate)) {
      return candidate;
    }
  }

  return null;
}

async function validateReplacementVariant(
  pool: sql.ConnectionPool,
  orderItemId: string,
  requestedSize: string,
) {
  const sizeColumn = await getVariantSizeColumn(pool);

  if (!sizeColumn) {
    throw new Error("Product size information is not configured.");
  }

  const original = await pool
    .request()
    .input("orderItemId", orderItemId)
    .query<any>(
      `
        SELECT TOP 1
          oi.variant_id variantId,
          pv.product_id productId
        FROM order_items oi
        INNER JOIN product_variants pv
          ON pv.id = oi.variant_id
        WHERE oi.id =
          @orderItemId
        `,
    );

  const originalRow = original.recordset[0];

  if (!originalRow) {
    throw new Error("Original order item not found.");
  }

  const result = await pool
    .request()
    .input("productId", originalRow.productId)
    .input("requestedSize", requestedSize.trim())
    .query<any>(
      `
        SELECT TOP 1
          pv.id variantId,
          pv.product_id productId,
          pv.sku,
          pv.${sizeColumn} requestedSize,
          CAST(
            i.quantity_available -
            i.quantity_reserved
            AS int
          ) available
        FROM product_variants pv
        INNER JOIN inventory i
          ON i.variant_id =
             pv.id
        WHERE pv.product_id =
          @productId
          AND UPPER(
            LTRIM(
              RTRIM(
                CAST(
                  pv.${sizeColumn}
                  AS nvarchar(40)
                )
              )
            )
          ) =
          UPPER(
            LTRIM(
              RTRIM(@requestedSize)
            )
          )
        `,
    );

  const replacement = result.recordset[0];

  if (!replacement) {
    throw new Error(
      "The requested replacement size is not available for this product.",
    );
  }

  if (Number(replacement.available ?? 0) <= 0) {
    throw new Error(
      "The requested replacement size is currently out of stock.",
    );
  }

  return {
    variantId: replacement.variantId,
    productId: replacement.productId,
    sku: replacement.sku,
    requestedSize: replacement.requestedSize,
    available: Number(replacement.available),
  };
}

type AfterSalesImageInput = {
  filename: string;
  contentType: string;
  dataBase64: string;
};

async function saveReturnRequestImages(
  returnRequestId: string,
  images: AfterSalesImageInput[],
) {
  if (!images.length) {
    return [];
  }

  if (images.length > MAX_RETURN_IMAGES) {
    throw new Error("You can upload a maximum of 3 images.");
  }

  const targetDir = join(RETURN_MEDIA_ROOT, returnRequestId);

  await mkdir(targetDir, { recursive: true });

  const pool = await getDb();
  const savedImages: Array<{
    id: string;
    filename: string;
    contentType: string;
    url: string;
  }> = [];

  for (const image of images) {
    const contentType = String(image.contentType ?? "")
      .trim()
      .toLowerCase();

    const ext = RETURN_IMAGE_TYPES.get(contentType);

    if (!ext) {
      throw new Error("Fault images must be JPG, PNG, WEBP, or GIF.");
    }

    const data = Buffer.from(
      String(image.dataBase64 ?? "").replace(/^data:[^;]+;base64,/, ""),
      "base64",
    );

    if (!data.length) {
      throw new Error("One of the uploaded images is empty.");
    }

    if (data.length > MAX_RETURN_IMAGE_BYTES) {
      throw new Error("Each fault image must be smaller than 8 MB.");
    }

    const safeName =
      basename(image.filename, extname(image.filename))
        .replace(/[^a-zA-Z0-9-_]/g, "-")
        .slice(0, 60) || "fault-image";

    const storageKey = `${returnRequestId}/${randomUUID()}-${safeName}${ext}`;

    const filePath = join(RETURN_MEDIA_ROOT, storageKey);

    await writeFile(filePath, data, { flag: "wx" });

    const id = randomUUID();

    await pool
      .request()
      .input("id", id)
      .input("returnRequestId", returnRequestId)
      .input("filename", image.filename.slice(0, 255))
      .input("contentType", contentType)
      .input("storagePath", storageKey)
      .query(
        `
          INSERT INTO return_request_images
          (
            id,
            return_request_id,
            filename,
            content_type,
            storage_path
          )
          VALUES
          (
            @id,
            @returnRequestId,
            @filename,
            @contentType,
            @storagePath
          )
        `,
      );

    savedImages.push({
      id,
      filename: image.filename.slice(0, 255),
      contentType,
      url:
        `${env.PUBLIC_API_URL.replace(/\/$/, "")}` +
        `/media/returns/${storageKey}`,
    });
  }

  return savedImages;
}

export async function requestItemAfterSales(
  customerId: string,
  orderId: string,
  orderItemId: string,
  requestType: string,
  reason: string,
  requestedSize?: string | null,
  images: AfterSalesImageInput[] = [],
) {
  const normalizedType = String(requestType ?? "")
    .trim()
    .toUpperCase();

  if (normalizedType === "SIZE_REPLACEMENT" && images.length > 0) {
    throw new Error("Images are only required for product fault requests.");
  }

  if (
    normalizedType === "PRODUCT_FAULT" &&
    (images.length < 1 || images.length > MAX_RETURN_IMAGES)
  ) {
    throw new Error("Please upload 1 to 3 images showing the product fault.");
  }

  if (!["PRODUCT_FAULT", "SIZE_REPLACEMENT"].includes(normalizedType)) {
    throw new Error("Invalid after-sales request type.");
  }

  if (!reason.trim()) {
    throw new Error("Reason is required.");
  }

  if (
    normalizedType === "SIZE_REPLACEMENT" &&
    !String(requestedSize ?? "").trim()
  ) {
    throw new Error("Please enter the requested replacement size.");
  }

  const pool = await getDb();

  const order = await pool
    .request()
    .input("orderId", orderId)
    .input("customerId", customerId)
    .query<any>(
      `
        SELECT TOP 1
          id,
          status
        FROM orders
        WHERE id = @orderId
          AND customer_id =
            @customerId
        `,
    );

  const orderRow = order.recordset[0];

  if (!orderRow) {
    throw new Error("Order not found.");
  }

  if (orderRow.status !== "DELIVERED") {
    throw new Error("After-sales requests can be made after delivery.");
  }

  const orderItem = await pool
    .request()
    .input("orderItemId", orderItemId)
    .input("orderId", orderId)
    .query<any>(
      `
        SELECT TOP 1
          id
        FROM order_items
        WHERE id = @orderItemId
          AND order_id =
            @orderId
        `,
    );

  if (!orderItem.recordset.length) {
    throw new Error("Order item not found.");
  }

  const existing = await pool
    .request()
    .input("orderItemId", orderItemId)
    .query(
      `
        SELECT TOP 1
          id
        FROM return_requests
        WHERE order_item_id =
          @orderItemId
          AND status NOT IN (
            'REJECTED',
            'CANCELLED'
          )
        `,
    );

  if (existing.recordset.length) {
    throw new Error(
      "An active after-sales request already exists for this item.",
    );
  }

  let replacementVariantId: string | null = null;

  let normalizedRequestedSize: string | null = requestedSize?.trim() || null;

  if (normalizedType === "SIZE_REPLACEMENT") {
    const replacement = await validateReplacementVariant(
      pool,
      orderItemId,
      normalizedRequestedSize!,
    );

    replacementVariantId = replacement.variantId;

    normalizedRequestedSize = String(
      replacement.requestedSize ?? normalizedRequestedSize,
    );
  }

  const calculatedPaidAmount = await calculateOrderItemPaidAmount(
    orderId,
    orderItemId,
  );

  const id = randomUUID();

  await pool
    .request()
    .input("id", id)
    .input("orderId", orderId)
    .input("orderItemId", orderItemId)
    .input("customerId", customerId)
    .input("requestType", normalizedType)
    .input("requestedSize", normalizedRequestedSize)
    .input("reason", reason.trim())
    .input("replacementVariantId", replacementVariantId)
    .query(
      `
      INSERT INTO return_requests(
        id,
        order_id,
        order_item_id,
        customer_id,
        request_type,
        requested_size,
        reason,
        replacement_variant_id,
        status,
        approved_credit_inr
      )
      VALUES(
        @id,
        @orderId,
        @orderItemId,
        @customerId,
        @requestType,
        @requestedSize,
        @reason,
        @replacementVariantId,
        'REQUESTED',
        NULL
      )
      `,
    );

  const savedImages =
    normalizedType === "PRODUCT_FAULT"
      ? await saveReturnRequestImages(id, images)
      : [];

  return {
    id,
    orderId,
    orderItemId,
    requestType: normalizedType,
    requestedSize: normalizedRequestedSize,
    calculatedPaidAmountInr: calculatedPaidAmount,
    status: "REQUESTED",
    images: savedImages,
  };
}

/* ============================================================
   CUSTOMER RETURN / AFTER-SALES LIST
   ============================================================ */

export async function listCustomerReturns(customerId: string) {
  const pool = await getDb();

  const result = await pool
    .request()
    .input("customerId", customerId)
    .query<any>(
      `
        SELECT
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
          CAST(
            r.refund_amount_inr
            AS decimal(12,2)
          ) refundAmountInr,
          CAST(
            r.approved_credit_inr
            AS decimal(12,2)
          ) approvedCreditInr,
          r.replacement_variant_id
            replacementVariantId,
          r.replacement_order_id
            replacementOrderId,
          r.admin_note adminNote,
          r.admin_reviewed_at
            adminReviewedAt,
          r.admin_reviewed_by
            adminReviewedBy,
          r.replacement_fulfilled_at
            replacementFulfilledAt,
          r.created_at createdAt,
          r.updated_at updatedAt
        FROM return_requests r
        INNER JOIN orders o
          ON o.id = r.order_id
        LEFT JOIN customers c
          ON c.id = r.customer_id
        WHERE r.customer_id =
          @customerId
        ORDER BY
          r.created_at DESC
        `,
    );

  return result.recordset.map((x: any) => ({
    ...x,

    refundAmountInr:
      x.refundAmountInr == null ? null : Number(x.refundAmountInr),

    approvedCreditInr:
      x.approvedCreditInr == null ? null : Number(x.approvedCreditInr),

    adminReviewedAt: x.adminReviewedAt
      ? new Date(x.adminReviewedAt).toISOString()
      : null,

    replacementFulfilledAt: x.replacementFulfilledAt
      ? new Date(x.replacementFulfilledAt).toISOString()
      : null,

    createdAt: new Date(x.createdAt).toISOString(),

    updatedAt: new Date(x.updatedAt).toISOString(),
  }));
}
