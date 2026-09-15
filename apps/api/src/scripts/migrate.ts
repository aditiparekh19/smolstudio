import fs from 'node:fs/promises';
import path from 'node:path';
import { getDb, closeDb } from '../db.js';

const sqlDir = path.resolve(process.cwd(), 'sql');
const files = (await fs.readdir(sqlDir))
  .filter((name) => /^\d+_.*\.sql$/i.test(name))
  .sort();

const pool = await getDb();

for (const fileName of files) {
  const sqlText = await fs.readFile(path.join(sqlDir, fileName), 'utf8');
  const batches = sqlText
    .split(/\n\s*GO\s*(?:\n|$)/gi)
    .map((x) => x.trim())
    .filter(Boolean);

  for (const batch of batches) {
    await pool.request().batch(batch);
  }
  console.log(`Applied ${fileName} (${batches.length} batch(es)).`);
}

await closeDb();
