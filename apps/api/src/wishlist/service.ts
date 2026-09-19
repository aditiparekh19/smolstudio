import { randomUUID } from "node:crypto";
import { getDb } from "../db.js";

export async function listWishlist(customerId: string) {
  const pool = await getDb();

  const result = await pool
    .request()
    .input("customerId", customerId)
    .query<any>(
      `
      SELECT
        p.id,
        p.slug,
        p.name,
        p.description,
        p.price_inr priceInr,
        p.compare_at_price_inr compareAtPriceInr,
        p.sku,
        p.is_active isActive,

        c.slug categorySlug,

        (
          SELECT TOP 1 pi.url
          FROM product_images pi
          WHERE pi.product_id = p.id
          ORDER BY
            CASE WHEN pi.is_primary = 1 THEN 0 ELSE 1 END,
            pi.sort_order,
            pi.created_at
        ) imageUrl

      FROM wishlist_items w

      INNER JOIN products p
        ON p.id = w.product_id

      LEFT JOIN categories c
        ON c.id = p.category_id

      WHERE w.customer_id = @customerId

      ORDER BY w.created_at DESC
      `,
    );

  return result.recordset.map((product: any) => ({
    ...product,
    priceInr: Number(product.priceInr ?? 0),
    compareAtPriceInr:
      product.compareAtPriceInr == null
        ? null
        : Number(product.compareAtPriceInr),
  }));
}

export async function addToWishlist(
  customerId: string,
  productId: string,
) {
  const pool = await getDb();

  const product = (
    await pool
      .request()
      .input("productId", productId)
      .query<any>(
        `
        SELECT TOP 1
          id,
          is_active isActive
        FROM products
        WHERE id=@productId
        `,
      )
  ).recordset[0];

  if (!product) {
    throw new Error("Product not found.");
  }

  if (!product.isActive) {
    throw new Error("This product is no longer available.");
  }

  await pool
    .request()
    .input("id", randomUUID())
    .input("customerId", customerId)
    .input("productId", productId)
    .query(
      `
      IF NOT EXISTS (
        SELECT 1
        FROM wishlist_items
        WHERE customer_id=@customerId
          AND product_id=@productId
      )
      BEGIN
        INSERT INTO wishlist_items
        (
          id,
          customer_id,
          product_id
        )
        VALUES
        (
          @id,
          @customerId,
          @productId
        );
      END
      `,
    );

  return listWishlist(customerId);
}

export async function removeFromWishlist(
  customerId: string,
  productId: string,
) {
  const pool = await getDb();

  await pool
    .request()
    .input("customerId", customerId)
    .input("productId", productId)
    .query(
      `
      DELETE FROM wishlist_items
      WHERE customer_id=@customerId
        AND product_id=@productId
      `,
    );

  return listWishlist(customerId);
}

export async function isProductWishlisted(
  customerId: string,
  productId: string,
) {
  const pool = await getDb();

  const result = await pool
    .request()
    .input("customerId", customerId)
    .input("productId", productId)
    .query<any>(
      `
      SELECT TOP 1 id
      FROM wishlist_items
      WHERE customer_id=@customerId
        AND product_id=@productId
      `,
    );

  return result.recordset.length > 0;
}
