import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { getDb } from "../db.js";
import { env } from "../config.js";

const MEDIA_ROOT =
  process.env.MEDIA_ROOT ?? join(process.cwd(), "uploads", "products");
const ALLOWED_TYPES = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
]);

export type AdminImage = {
  id: string;
  url: string;
  storageKey: string | null;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
};
export type AdminVariant = {
  id: string;
  sku: string;
  size: string;
  color: string;
  stock: number;
};

export async function listAdminProducts(search?: string, active?: boolean) {
  const pool = await getDb();
  const request = pool.request();

  const where: string[] = ["1=1"];

  if (search?.trim()) {
    request.input("search", `%${search.trim()}%`);
    where.push(
      "(p.name LIKE @search OR p.sku LIKE @search OR p.slug LIKE @search)",
    );
  }

  if (active !== undefined) {
    request.input("active", active ? 1 : 0);
    where.push("p.is_active = @active");
  }

  const result = await request.query(`
    SELECT
      p.id,
      p.slug,
      p.name,
      p.description,
      CAST(p.price_inr AS int) AS priceInr,
      CAST(p.compare_at_price_inr AS int) AS compareAtPriceInr,
      p.sku,
      p.is_active AS isActive,
      c.id AS categoryId,
      c.slug AS categorySlug,
      c.name AS categoryName,

      (
        SELECT TOP 1 pi.url
        FROM product_images pi
        WHERE pi.product_id = p.id
        ORDER BY pi.is_primary DESC, pi.sort_order ASC
      ) AS imageUrl,

            COALESCE(
        (
          SELECT SUM(i.quantity_available - i.quantity_reserved)
          FROM inventory i
          INNER JOIN product_variants v ON v.id = i.variant_id
          WHERE v.product_id = p.id
        ),
        0
      ) AS stock,

      /* Published 4-5 star reviews */
      (
      SELECT COUNT(*)
      FROM product_reviews pr
      WHERE pr.product_id = p.id
        AND pr.is_published = 1
        AND pr.rating >= 4
      ) AS likedCount,

      (
        SELECT COUNT(DISTINCT wi.customer_id)
        FROM wishlist_items wi
        WHERE wi.product_id = p.id
      ) AS wishlistCount,

      (
        SELECT COUNT(*)
        FROM return_requests rr
        INNER JOIN order_items oi
          ON oi.id = rr.order_item_id
        INNER JOIN product_variants rv
          ON rv.id = oi.variant_id
        WHERE rv.product_id = p.id
          AND rr.request_type = 'SIZE_REPLACEMENT'
      ) AS sizeReplacementCount,

      (
        SELECT COUNT(*)
        FROM return_requests rr
        INNER JOIN order_items oi
          ON oi.id = rr.order_item_id
        INNER JOIN product_variants rv
          ON rv.id = oi.variant_id
        WHERE rv.product_id = p.id
          AND rr.request_type = 'PRODUCT_FAULT'
      ) AS complaintCount

    FROM products p
    INNER JOIN categories c ON c.id = p.category_id
    WHERE ${where.join(" AND ")}
    ORDER BY p.created_at DESC;
  `);

  const products = result.recordset;

  if (products.length === 0) {
    return [];
  }

  const productIds = products.map((p: { id: string }) => p.id);

  // Load all images for the returned products
  const imageRequest = pool.request();

  const imageParams = productIds
    .map((id, index) => {
      imageRequest.input(`productId${index}`, id);
      return `@productId${index}`;
    })
    .join(",");

  const imageResult = await imageRequest.query(`
    SELECT
      id,
      product_id AS productId,
      url,
      storage_key AS storageKey,
      alt_text AS altText,
      sort_order AS sortOrder,
      is_primary AS isPrimary
    FROM product_images
    WHERE product_id IN (${imageParams})
    ORDER BY is_primary DESC, sort_order ASC, id ASC;
  `);

  // Load all variants for the returned products
  const variantRequest = pool.request();

  const variantParams = productIds
    .map((id, index) => {
      variantRequest.input(`variantProductId${index}`, id);
      return `@variantProductId${index}`;
    })
    .join(",");

  const variantResult = await variantRequest.query(`
    SELECT
      v.id,
      v.product_id AS productId,
      v.sku,
      v.size,
      v.color,
      CAST(
        COALESCE(i.quantity_available, 0)
        - COALESCE(i.quantity_reserved, 0)
        AS int
      ) AS stock
    FROM product_variants v
    LEFT JOIN inventory i ON i.variant_id = v.id
    WHERE v.product_id IN (${variantParams})
    ORDER BY v.created_at ASC;
  `);

  const imagesByProduct = new Map<string, AdminImage[]>();
  const variantsByProduct = new Map<string, AdminVariant[]>();

  for (const image of imageResult.recordset) {
    const existing = imagesByProduct.get(image.productId) ?? [];
    existing.push({
      id: image.id,
      url: image.url,
      storageKey: image.storageKey,
      altText: image.altText,
      sortOrder: image.sortOrder,
      isPrimary: Boolean(image.isPrimary),
    });
    imagesByProduct.set(image.productId, existing);
  }

  for (const variant of variantResult.recordset) {
    const existing = variantsByProduct.get(variant.productId) ?? [];
    existing.push({
      id: variant.id,
      sku: variant.sku,
      size: variant.size,
      color: variant.color,
      stock: Number(variant.stock ?? 0),
    });
    variantsByProduct.set(variant.productId, existing);
  }

  return products.map((product: { id: string }) => ({
    ...product,

    // IMPORTANT: GraphQL AdminProduct.images is non-nullable.
    // Always return [] when there are no images.
    images: imagesByProduct.get(product.id) ?? [],

    // Same idea for variants if the GraphQL field is non-nullable.
    variants: variantsByProduct.get(product.id) ?? [],
  }));
}

export async function getAdminProduct(id: string) {
  if (!isUuid(id)) {
    return null;
  }
  const pool = await getDb();
  const product = await pool.request().input("id", id).query(`
    SELECT TOP 1
      p.id,
      p.slug,
      p.name,
      p.description,
      p.price_inr AS priceInr,
      p.compare_at_price_inr AS compareAtPriceInr,
      p.sku,
      p.is_active AS isActive,

      c.id AS categoryId,
      c.slug AS categorySlug,
      c.name AS categoryName,

      (
        SELECT TOP 1 pi.url
        FROM product_images pi
        WHERE pi.product_id = p.id
        ORDER BY pi.is_primary DESC, pi.sort_order ASC
      ) AS imageUrl,

      COALESCE(
        (
          SELECT SUM(i.quantity_available - i.quantity_reserved)
          FROM inventory i
          INNER JOIN product_variants v
            ON v.id = i.variant_id
          WHERE v.product_id = p.id
        ),
        0
      ) AS stock,

      (
        SELECT COUNT(*)
        FROM product_reviews pr
        WHERE pr.product_id = p.id
          AND pr.is_published = 1
          AND pr.rating >= 4
      ) AS likedCount,

      (
        SELECT COUNT(DISTINCT wi.customer_id)
        FROM wishlist_items wi
        WHERE wi.product_id = p.id
      ) AS wishlistCount,

      (
        SELECT COUNT(*)
        FROM return_requests rr
        INNER JOIN order_items oi
          ON oi.id = rr.order_item_id
        INNER JOIN product_variants rv
          ON rv.id = oi.variant_id
        WHERE rv.product_id = p.id
          AND rr.request_type = 'SIZE_REPLACEMENT'
      ) AS sizeReplacementCount,

      (
        SELECT COUNT(*)
        FROM return_requests rr
        INNER JOIN order_items oi
          ON oi.id = rr.order_item_id
        INNER JOIN product_variants rv
          ON rv.id = oi.variant_id
        WHERE rv.product_id = p.id
          AND rr.request_type = 'PRODUCT_FAULT'
      ) AS complaintCount

    FROM products p
    INNER JOIN categories c
      ON c.id = p.category_id
    WHERE p.id = @id;
  `);
  const row = product.recordset[0];
  if (!row) return null;
  const images = await pool
    .request()
    .input("productId", id)
    .query(
      `SELECT id,url,storage_key storageKey,alt_text altText,sort_order sortOrder,is_primary isPrimary FROM product_images WHERE product_id=@productId ORDER BY is_primary DESC,sort_order,id;`,
    );
  const variants = await pool.request().input("productId", id).query(`
    SELECT v.id,v.sku,v.size,v.color,CAST(COALESCE(i.quantity_available,0)-COALESCE(i.quantity_reserved,0) AS int) stock
    FROM product_variants v LEFT JOIN inventory i ON i.variant_id=v.id WHERE v.product_id=@productId ORDER BY v.created_at;`);
  return { ...row, images: images.recordset, variants: variants.recordset };
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 180);
}

export async function saveAdminProduct(input: {
  id?: string;
  name: string;
  slug: string;
  description?: string | null;
  priceInr: number;
  compareAtPriceInr?: number | null;
  sku: string;
  categoryId: string;
  isActive: boolean;
}) {
  if (!input.name.trim() || !input.sku.trim() || !input.categoryId)
    throw new Error("Name, SKU and category are required.");
  if (!Number.isFinite(input.priceInr) || input.priceInr < 0)
    throw new Error("Price must be a non-negative number.");
  if (
    input.compareAtPriceInr != null &&
    (!Number.isFinite(input.compareAtPriceInr) || input.compareAtPriceInr < 0)
  )
    throw new Error("Compare-at price must be non-negative.");
  const pool = await getDb();
  const slug = slugify(input.slug || input.name);
  if (!slug) throw new Error("A valid slug is required.");
  const id = input.id || randomUUID();
  if (input.id) {
    await pool
      .request()
      .input("id", id)
      .input("slug", slug)
      .input("name", input.name.trim())
      .input("description", input.description?.trim() || null)
      .input("price", input.priceInr)
      .input("compareAt", input.compareAtPriceInr ?? null)
      .input("sku", input.sku.trim())
      .input("categoryId", input.categoryId)
      .input("active", input.isActive ? 1 : 0).query(`
      UPDATE products SET slug=@slug,name=@name,description=@description,price_inr=@price,compare_at_price_inr=@compareAt,sku=@sku,category_id=@categoryId,is_active=@active,updated_at=SYSUTCDATETIME() WHERE id=@id;`);
  } else {
    await pool
      .request()
      .input("id", id)
      .input("slug", slug)
      .input("name", input.name.trim())
      .input("description", input.description?.trim() || null)
      .input("price", input.priceInr)
      .input("compareAt", input.compareAtPriceInr ?? null)
      .input("sku", input.sku.trim())
      .input("categoryId", input.categoryId)
      .input("active", input.isActive ? 1 : 0).query(`
      INSERT INTO products(id,category_id,slug,sku,name,description,price_inr,compare_at_price_inr,is_active) VALUES(@id,@categoryId,@slug,@sku,@name,@description,@price,@compareAt,@active);`);
  }
  return getAdminProduct(id);
}

export async function deleteAdminProduct(id: string) {
  const product = await getAdminProduct(id);
  if (!product) throw new Error("Product not found.");
  const pool = await getDb();
  const refs = await pool
    .request()
    .input("id", id)
    .query<{ count: number }>(
      `SELECT COUNT(*) count FROM order_items oi INNER JOIN product_variants v ON v.id=oi.variant_id WHERE v.product_id=@id`,
    );
  if (Number(refs.recordset[0]?.count ?? 0) > 0) {
    await pool
      .request()
      .input("id", id)
      .query(
        `UPDATE products SET is_active=0,updated_at=SYSUTCDATETIME() WHERE id=@id;`,
      );
    return true;
  }
  await pool.request().input("id", id).query(`
    BEGIN TRANSACTION;
    DELETE FROM inventory WHERE variant_id IN (SELECT id FROM product_variants WHERE product_id=@id);
    DELETE FROM cart_items WHERE variant_id IN (SELECT id FROM product_variants WHERE product_id=@id);
    DELETE FROM product_variants WHERE product_id=@id;
    DELETE FROM product_images WHERE product_id=@id;
    DELETE FROM wishlists WHERE product_id=@id;
    DELETE FROM product_reviews WHERE product_id=@id;
    DELETE FROM products WHERE id=@id;
    COMMIT TRANSACTION;`);
  for (const image of product.images as AdminImage[])
    await removeStoredImage(image.storageKey);
  return true;
}

export async function saveVariant(input: {
  id?: string;
  productId: string;
  sku: string;
  size: string;
  color: string;
  stock: number;
}) {
  if (!input.sku.trim() || !input.size.trim() || !input.color.trim())
    throw new Error("Variant SKU, size and color are required.");
  if (!Number.isInteger(input.stock) || input.stock < 0)
    throw new Error("Stock must be a non-negative integer.");
  const pool = await getDb();
  const id = input.id || randomUUID();
  if (input.id) {
    await pool
      .request()
      .input("id", id)
      .input("sku", input.sku.trim())
      .input("size", input.size.trim())
      .input("color", input.color.trim())
      .input("stock", input.stock)
      .query(
        `UPDATE product_variants SET sku=@sku,size=@size,color=@color WHERE id=@id; UPDATE inventory SET quantity_available=@stock,updated_at=SYSUTCDATETIME() WHERE variant_id=@id;`,
      );
  } else {
    await pool
      .request()
      .input("id", id)
      .input("productId", input.productId)
      .input("sku", input.sku.trim())
      .input("size", input.size.trim())
      .input("color", input.color.trim())
      .input("stock", input.stock)
      .query(
        `INSERT INTO product_variants(id,product_id,sku,size,color) VALUES(@id,@productId,@sku,@size,@color); INSERT INTO inventory(id,variant_id,quantity_available) VALUES(NEWID(),@id,@stock);`,
      );
  }
  return getAdminProduct(input.productId);
}

export async function deleteVariant(id: string) {
  const pool = await getDb();
  const result = await pool
    .request()
    .input("id", id)
    .query<{ productId: string }>(
      `SELECT product_id productId FROM product_variants WHERE id=@id`,
    );
  const productId = result.recordset[0]?.productId;
  if (!productId) throw new Error("Variant not found.");
  await pool
    .request()
    .input("id", id)
    .query(
      `DELETE FROM inventory WHERE variant_id=@id; DELETE FROM cart_items WHERE variant_id=@id; DELETE FROM product_variants WHERE id=@id;`,
    );
  return getAdminProduct(productId);
}

export async function uploadProductImage(input: {
  productId: string;
  filename: string;
  contentType: string;
  dataBase64: string;
  altText?: string | null;
}) {
  const product = await getAdminProduct(input.productId);
  if (!product) throw new Error("Product not found.");
  const ext = ALLOWED_TYPES.get(input.contentType.toLowerCase());
  if (!ext) throw new Error("Only JPG, PNG, WEBP and GIF images are allowed.");
  const data = Buffer.from(
    input.dataBase64.replace(/^data:[^;]+;base64,/, ""),
    "base64",
  );
  if (!data.length || data.length > 8 * 1024 * 1024)
    throw new Error("Image must be smaller than 8 MB.");
  await mkdir(MEDIA_ROOT, { recursive: true });
  const safeName =
    basename(input.filename, extname(input.filename))
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .slice(0, 60) || "product-image";
  const storageKey = `${input.productId}/${randomUUID()}-${safeName}${ext}`;
  const targetDir = join(MEDIA_ROOT, input.productId);
  await mkdir(targetDir, { recursive: true });
  await writeFile(join(targetDir, basename(storageKey)), data, { flag: "wx" });
  const pool = await getDb();
  const count = product.images.length;
  const id = randomUUID();
  await pool
    .request()
    .input("id", id)
    .input("productId", input.productId)
    .input(
      "url",
      `${env.PUBLIC_API_URL.replace(/\/$/, "")}/media/products/${storageKey}`,
    )
    .input("storageKey", storageKey)
    .input("altText", input.altText?.trim() || product.name)
    .input("sortOrder", count)
    .input("primary", count === 0 ? 1 : 0)
    .query(
      `INSERT INTO product_images(id,product_id,url,storage_key,alt_text,sort_order,is_primary) VALUES(@id,@productId,@url,@storageKey,@altText,@sortOrder,@primary);`,
    );
  return getAdminProduct(input.productId);
}

async function removeStoredImage(storageKey: string | null) {
  if (!storageKey) return;
  try {
    await unlink(join(MEDIA_ROOT, storageKey));
  } catch {
    /* DB row is authoritative if file is already missing. */
  }
}

export async function deleteProductImage(id: string) {
  const pool = await getDb();
  const result = await pool.request().input("id", id).query<{
    productId: string;
    storageKey: string | null;
    wasPrimary: boolean;
  }>(`SELECT product_id productId,storage_key storageKey,is_primary wasPrimary FROM product_images WHERE id=@id`);
  const row = result.recordset[0];
  if (!row) throw new Error("Image not found.");
  await pool
    .request()
    .input("id", id)
    .query(`DELETE FROM product_images WHERE id=@id;`);
  await removeStoredImage(row.storageKey);
  if (row.wasPrimary)
    await pool
      .request()
      .input("productId", row.productId)
      .query(
        `UPDATE product_images SET is_primary=1 WHERE id=(SELECT TOP 1 id FROM product_images WHERE product_id=@productId ORDER BY sort_order,id);`,
      );
  return getAdminProduct(row.productId);
}

export async function setPrimaryProductImage(id: string) {
  const pool = await getDb();
  const result = await pool
    .request()
    .input("id", id)
    .query<{ productId: string }>(
      `SELECT product_id productId FROM product_images WHERE id=@id`,
    );
  const productId = result.recordset[0]?.productId;
  if (!productId) throw new Error("Image not found.");
  await pool
    .request()
    .input("id", id)
    .input("productId", productId)
    .query(
      `UPDATE product_images SET is_primary=CASE WHEN id=@id THEN 1 ELSE 0 END WHERE product_id=@productId;`,
    );
  return getAdminProduct(productId);
}

export async function reorderProductImages(
  productId: string,
  imageIds: string[],
) {
  const pool = await getDb();
  for (let i = 0; i < imageIds.length; i++)
    await pool
      .request()
      .input("id", imageIds[i])
      .input("productId", productId)
      .input("sortOrder", i)
      .query(
        `UPDATE product_images SET sort_order=@sortOrder WHERE id=@id AND product_id=@productId;`,
      );
  return getAdminProduct(productId);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
