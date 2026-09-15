import { getDb } from '../db.js';
import { hashPassword } from '../auth/service.js';
import { randomUUID } from 'node:crypto';

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;

if (!email || !password) {
  throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD before running create-admin.');
}
if (password.length < 8) throw new Error('ADMIN_PASSWORD must be at least 8 characters.');

const pool = await getDb();
const passwordHash = await hashPassword(password);
const existing = await pool.request().input('email', email).query<{ id: string }>('SELECT id FROM customers WHERE email = @email');

if (existing.recordset[0]) {
  await pool.request().input('id', existing.recordset[0].id).input('passwordHash', passwordHash).query(`UPDATE customers SET password_hash = @passwordHash, role = 'ADMIN', updated_at = SYSUTCDATETIME() WHERE id = @id`);
} else {
  await pool.request().input('id', randomUUID()).input('email', email).input('passwordHash', passwordHash).query(`INSERT INTO customers (id, email, password_hash, role) VALUES (@id, @email, @passwordHash, 'ADMIN')`);
}

console.log(`Admin ready: ${email}`);
process.exit(0);
