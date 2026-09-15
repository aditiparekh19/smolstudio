import type sql from 'mssql';
import { getDb } from '../db.js';

export type ProductCard = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  priceInr: number;
  compareAtPriceInr: number | null;
  imageUrl: string | null;
  categorySlug: string;
};

export type Product = ProductCard & {
  sku: string;
  images: { id: string; url: string; altText: string | null; sortOrder: number; isPrimary: boolean }[];
  sizes: string[];
  colors: string[];
  stock: number;
};

export async function listProducts(limit = 24, categorySlug?: string, search?: string): Promise<ProductCard[]> {
  const pool = await getDb();
  const request = pool.request().input('limit', limit);

  let where = 'p.is_active = 1';
  if (categorySlug) {
    request.input('categorySlug', categorySlug);
    where += ' AND c.slug = @categorySlug';
  }
  if (search?.trim()) {
    request.input('search', `%${search.trim()}%`);
    where += ' AND (p.name LIKE @search OR p.description LIKE @search OR p.sku LIKE @search)';
  }

  const result = await request.query<ProductCard>(`
    SELECT TOP (@limit)
      p.id,
      p.slug,
      p.name,
      p.description,
      CAST(p.price_inr AS int) AS priceInr,
      CAST(p.compare_at_price_inr AS int) AS compareAtPriceInr,
      (
        SELECT TOP 1 pi.url
        FROM product_images pi
        WHERE pi.product_id = p.id
        ORDER BY pi.sort_order ASC
      ) AS imageUrl,
      c.slug AS categorySlug
    FROM products p
    INNER JOIN categories c ON c.id = p.category_id
    WHERE ${where}
    ORDER BY p.created_at DESC;
  `);

  return result.recordset;
}

export async function getProduct(slug: string): Promise<Product | null> {
  const pool = await getDb();
  const result = await pool.request().input('slug', slug).query<ProductCard & {
    sku: string;
    sizesCsv: string | null;
    colorsCsv: string | null;
    stock: number;
  }>(`
    SELECT TOP 1
      p.id,
      p.slug,
      p.name,
      p.description,
      CAST(p.price_inr AS int) AS priceInr,
      CAST(p.compare_at_price_inr AS int) AS compareAtPriceInr,
      (
        SELECT TOP 1 pi.url
        FROM product_images pi
        WHERE pi.product_id = p.id
        ORDER BY pi.sort_order ASC
      ) AS imageUrl,
      c.slug AS categorySlug,
      p.sku,
      (
        SELECT STRING_AGG(v.size, ',')
        FROM product_variants v
        WHERE v.product_id = p.id
      ) AS sizesCsv,
      (
        SELECT STRING_AGG(v.color, ',')
        FROM product_variants v
        WHERE v.product_id = p.id
      ) AS colorsCsv,
      COALESCE((
        SELECT SUM(i.quantity_available)
        FROM inventory i
        INNER JOIN product_variants v ON v.id = i.variant_id
        WHERE v.product_id = p.id
      ), 0) AS stock
    FROM products p
    INNER JOIN categories c ON c.id = p.category_id
    WHERE p.slug = @slug AND p.is_active = 1;
  `);

  const row = result.recordset[0];
  if (!row) return null;

  const imageRows = await pool.request().input('productId', row.id).query<{ id: string; url: string; altText: string | null; sortOrder: number; isPrimary: boolean }>(`SELECT id,url,alt_text altText,sort_order sortOrder,is_primary isPrimary FROM product_images WHERE product_id=@productId ORDER BY is_primary DESC,sort_order,id;`);

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    priceInr: row.priceInr,
    compareAtPriceInr: row.compareAtPriceInr,
    imageUrl: row.imageUrl,
    categorySlug: row.categorySlug,
    images: imageRows.recordset,
    sku: row.sku,
    sizes: [...new Set((row.sizesCsv ?? '').split(',').filter(Boolean))],
    colors: [...new Set((row.colorsCsv ?? '').split(',').filter(Boolean))],
    stock: Number(row.stock)
  };
}

export async function listCategories() {
  const pool = await getDb();
  const result = await pool.request().query<{
    id: string;
    slug: string;
    name: string;
  }>(`
    SELECT id, slug, name
    FROM categories
    WHERE is_active = 1
    ORDER BY sort_order, name;
  `);
  return result.recordset;
}
