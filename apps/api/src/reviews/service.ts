import { randomUUID } from "crypto";
import { getDb } from "../db.js";

function mapReview(row: any) {
  const rawCreatedAt = row.createdAt ?? row.created_at;

  return {
    id: row.id,
    productId: row.productId ?? row.product_id,
    customerId: row.customerId ?? row.customer_id ?? null,
    customerName: row.customerName ?? row.customer_name ?? null,
    customerEmail: row.customerEmail ?? row.customer_email ?? null,
    productName: row.productName ?? row.product_name ?? null,
    rating: Number(row.rating),
    title: row.title ?? null,
    body: row.body ?? null,
    isPublished: Boolean(row.isPublished ?? row.is_published),
    createdAt: rawCreatedAt
      ? new Date(rawCreatedAt).toISOString()
      : new Date(0).toISOString(),
    verifiedPurchase: true,
  };
}

/**
 * A customer can review a product only if they have an order
 * containing a variant belonging to that product.
 *
 * We require the order to have reached a paid/fulfillable state.
 */
export async function customerPurchasedProduct(customerId: string, productId: string) {
  const pool = await getDb();

  const r = await pool
    .request()
    .input("customerId", customerId)
    .input("productId", productId).query(`
      SELECT TOP 1
        oi.id
      FROM order_items oi
      INNER JOIN orders o
        ON o.id = oi.order_id
      INNER JOIN product_variants pv
        ON pv.id = oi.variant_id
      WHERE o.customer_id = @customerId
        AND pv.product_id = @productId
        AND o.status IN (
          'PAID',
          'PROCESSING',
          'SHIPPED',
          'DELIVERED',
          'REFUNDED',
          'PARTIALLY_REFUNDED'
        )
        AND o.payment_status = 'CAPTURED'
    `);

  return Boolean(r.recordset[0]);
}

export async function listProductReviews(productId: string) {
  const pool = await getDb();

  const r = await pool.request().input("productId", productId).query(`
      SELECT
        r.id,
        r.product_id productId,
        r.customer_id customerId,
        CONCAT(
          NULLIF(LTRIM(RTRIM(c.first_name)), ''),
          CASE
            WHEN NULLIF(LTRIM(RTRIM(c.first_name)), '') IS NOT NULL
             AND NULLIF(LTRIM(RTRIM(c.last_name)), '') IS NOT NULL
            THEN ' '
            ELSE ''
          END,
          NULLIF(LTRIM(RTRIM(c.last_name)), '')
        ) customerName,
        r.rating,
        r.title,
        r.body,
        r.is_published isPublished,
        r.created_at createdAt
      FROM product_reviews r
      INNER JOIN customers c
        ON c.id = r.customer_id
      WHERE r.product_id = @productId
        AND r.is_published = 1
      ORDER BY r.created_at DESC
    `);

  return r.recordset.map(mapReview);
}

export async function getMyProductReview(
  customerId: string,
  productId: string,
) {
  const pool = await getDb();

  const r = await pool
    .request()
    .input("customerId", customerId)
    .input("productId", productId).query(`
      SELECT TOP 1
        r.id,
        r.product_id productId,
        r.customer_id customerId,
        CONCAT(
          NULLIF(LTRIM(RTRIM(c.first_name)), ''),
          CASE
            WHEN NULLIF(LTRIM(RTRIM(c.first_name)), '') IS NOT NULL
             AND NULLIF(LTRIM(RTRIM(c.last_name)), '') IS NOT NULL
            THEN ' '
            ELSE ''
          END,
          NULLIF(LTRIM(RTRIM(c.last_name)), '')
        ) customerName,
        c.email customerEmail,
        r.rating,
        r.title,
        r.body,
        r.is_published isPublished,
        r.created_at createdAt
      FROM product_reviews r
      INNER JOIN customers c
        ON c.id = r.customer_id
      WHERE r.product_id = @productId
        AND r.customer_id = @customerId
    `);

  return r.recordset[0] ? mapReview(r.recordset[0]) : null;
}

export async function createProductReview(
  customerId: string,
  productId: string,
  rating: number,
  title: string | null,
  body: string,
) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error("Rating must be between 1 and 5.");
  }

  const cleanBody = body.trim();

  if (!cleanBody) {
    throw new Error("Review text is required.");
  }

  if (cleanBody.length > 4000) {
    throw new Error("Review text is too long.");
  }

  const cleanTitle = title?.trim() ? title.trim().slice(0, 320) : null;

  const pool = await getDb();

  const product = await pool.request().input("productId", productId).query(`
      SELECT TOP 1 id
      FROM products
      WHERE id = @productId
    `);

  if (!product.recordset[0]) {
    throw new Error("Product not found.");
  }

  const purchased = await customerPurchasedProduct(customerId, productId);

  if (!purchased) {
    throw new Error("You can review a product only after purchasing it.");
  }

  const existing = await pool
    .request()
    .input("customerId", customerId)
    .input("productId", productId).query(`
      SELECT TOP 1 id
      FROM product_reviews
      WHERE customer_id = @customerId
        AND product_id = @productId
    `);

  if (existing.recordset[0]) {
    throw new Error("You have already reviewed this product.");
  }

  const id = randomUUID();

  await pool
    .request()
    .input("id", id)
    .input("productId", productId)
    .input("customerId", customerId)
    .input("rating", rating)
    .input("title", cleanTitle)
    .input("body", cleanBody).query(`
      INSERT INTO product_reviews (
        id,
        product_id,
        customer_id,
        rating,
        title,
        body,
        is_published
      )
      VALUES (
        @id,
        @productId,
        @customerId,
        @rating,
        @title,
        @body,
        1
      )
    `);

  const review = await getMyProductReview(customerId, productId);

  if (!review) {
    throw new Error("Unable to load created review.");
  }

  return review;
}

export async function updateProductReview(
  customerId: string,
  id: string,
  rating: number,
  title: string | null,
  body: string,
) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error("Rating must be between 1 and 5.");
  }

  const cleanBody = body.trim();

  if (!cleanBody) {
    throw new Error("Review text is required.");
  }

  if (cleanBody.length > 4000) {
    throw new Error("Review text is too long.");
  }

  const cleanTitle = title?.trim() ? title.trim().slice(0, 320) : null;

  const pool = await getDb();

  const existing = await pool
    .request()
    .input("id", id)
    .input("customerId", customerId).query(`
      SELECT TOP 1
        id,
        product_id productId
      FROM product_reviews
      WHERE id = @id
        AND customer_id = @customerId
    `);

  const row = existing.recordset[0];

  if (!row) {
    throw new Error("Review not found.");
  }

  await pool
    .request()
    .input("id", id)
    .input("rating", rating)
    .input("title", cleanTitle)
    .input("body", cleanBody).query(`
      UPDATE product_reviews
      SET
        rating = @rating,
        title = @title,
        body = @body,
        is_published = 1
      WHERE id = @id
    `);

  return getMyProductReview(customerId, row.productId);
}

export async function deleteProductReview(customerId: string, id: string) {
  const pool = await getDb();

  const r = await pool.request().input("id", id).input("customerId", customerId)
    .query(`
      DELETE FROM product_reviews
      WHERE id = @id
        AND customer_id = @customerId
    `);

  return (r.rowsAffected[0] ?? 0) > 0;
}

export async function listAdminReviews(
  productId?: string | null,
  published?: boolean | null,
) {
  const pool = await getDb();

  const request = pool.request();

  let where = "1 = 1";

  if (productId) {
    request.input("productId", productId);
    where += " AND r.product_id = @productId";
  }

  if (published !== null && published !== undefined) {
    request.input("published", published ? 1 : 0);
    where += " AND r.is_published = @published";
  }

  const r = await request.query(`
    SELECT
      r.id,
      r.product_id productId,
      r.customer_id customerId,
      p.name productName,
      c.email customerEmail,
      CONCAT(
        NULLIF(LTRIM(RTRIM(c.first_name)), ''),
        CASE
          WHEN NULLIF(LTRIM(RTRIM(c.first_name)), '') IS NOT NULL
           AND NULLIF(LTRIM(RTRIM(c.last_name)), '') IS NOT NULL
          THEN ' '
          ELSE ''
        END,
        NULLIF(LTRIM(RTRIM(c.last_name)), '')
      ) customerName,
      r.rating,
      r.title,
      r.body,
      r.is_published isPublished,
      r.created_at createdAt
    FROM product_reviews r
    INNER JOIN products p
      ON p.id = r.product_id
    INNER JOIN customers c
      ON c.id = r.customer_id
    WHERE ${where}
    ORDER BY r.created_at DESC
  `);

  return r.recordset.map(mapReview);
}

export async function deleteAdminReview(id: string) {
  const pool = await getDb();

  const r = await pool.request().input("id", id).query(`
      DELETE FROM product_reviews
      WHERE id = @id
    `);

  return (r.rowsAffected[0] ?? 0) > 0;
}
