import { getDb } from '../db.js';
const pool = await getDb();
await pool.request().batch(`
IF DB_NAME() <> 'master'
BEGIN
  DELETE FROM inventory;
  DELETE FROM product_images;
  DELETE FROM product_variants;
  DELETE FROM products;
  DELETE FROM categories;
END
`);
console.log('Catalog data reset.');
process.exit(0);
