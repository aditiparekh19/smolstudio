import { getDb } from '../db.js';

const pool = await getDb();

await pool.request().batch(`
IF NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'newborn')
BEGIN
  INSERT INTO categories (id, slug, name, sort_order)
  VALUES (NEWID(), 'newborn', 'Newborn', 1);
END;

IF NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'vests')
BEGIN
  INSERT INTO categories (id, slug, name, sort_order)
  VALUES (NEWID(), 'vests', 'Vests', 2);
END;

IF NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'sets')
BEGIN
  INSERT INTO categories (id, slug, name, sort_order)
  VALUES (NEWID(), 'sets', 'Sets', 3);
END;
`);

const category = await pool.request()
  .input('slug', 'vests')
  .query<{ id: string }>('SELECT id FROM categories WHERE slug = @slug');

const categoryId = category.recordset[0]?.id;
if (!categoryId) throw new Error('Vests category missing');

const products = [
  ['cloud-rainbow-vest', 'Cloud Rainbow Knit Vest', 'Soft cotton vest with tiny rainbows and a relaxed fit.', 1299, 1499, 'SS-VST-001'],
  ['tiny-dino-vest', 'Tiny Dino Knit Vest', 'A playful everyday layer for little explorers.', 1199, null, 'SS-VST-002'],
  ['blue-sky-vest', 'Blue Sky Knit Vest', 'Breathable textured knit with hand-drawn sky motifs.', 1399, 1599, 'SS-VST-003'],
  ['sunny-fruit-vest', 'Sunny Fruit Knit Vest', 'Fresh little fruit illustrations on a creamy base.', 1299, null, 'SS-VST-004']
] as const;

for (const [slug, name, description, price, compareAt, sku] of products) {
  await pool.request()
    .input('slug', slug)
    .input('name', name)
    .input('description', description)
    .input('price', price)
    .input('compareAt', compareAt)
    .input('sku', sku)
    .input('categoryId', categoryId)
    .query(`
      IF NOT EXISTS (SELECT 1 FROM products WHERE slug = @slug)
      BEGIN
        DECLARE @productId UNIQUEIDENTIFIER = NEWID();
        INSERT INTO products (id, category_id, slug, sku, name, description, price_inr, compare_at_price_inr)
        VALUES (@productId, @categoryId, @slug, @sku, @name, @description, @price, @compareAt);

        INSERT INTO product_variants (id, product_id, sku, size, color)
        VALUES
          (NEWID(), @productId, CONCAT(@sku, '-NB'), '0-3M', 'Cream'),
          (NEWID(), @productId, CONCAT(@sku, '-36'), '3-6M', 'Cream'),
          (NEWID(), @productId, CONCAT(@sku, '-69'), '6-9M', 'Cream');

        INSERT INTO product_images (id, product_id, url, alt_text, sort_order)
        VALUES
          (NEWID(), @productId, CONCAT('https://placehold.co/900x1100/F3E7D7/5E473C?text=', REPLACE(@name, ' ', '+')), @name, 1);

        INSERT INTO inventory (id, variant_id, quantity_available)
        SELECT NEWID(), v.id, 20
        FROM product_variants v
        WHERE v.product_id = @productId;
      END;
    `);
}

console.log('Seed complete.');
process.exit(0);
