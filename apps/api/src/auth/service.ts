import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { getDb } from '../db.js';
import { env } from '../config.js';

const scrypt = promisify(scryptCallback);
const SESSION_DAYS = 30;
const SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60;
const COOKIE_NAME = 'smolstudio_session';

type Role = 'CUSTOMER' | 'ADMIN' | 'STAFF';

export type AuthUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: Role;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, salt, hex] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hex) return false;
  const expected = Buffer.from(hex, 'hex');
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function getCookie(request: FastifyRequest, name: string) {
  const raw = request.headers.cookie ?? '';
  const pair = raw.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return pair ? decodeURIComponent(pair.slice(name.length + 1)) : undefined;
}

export function getAnonymousCartToken(request: FastifyRequest) {
  return request.headers['x-cart-token']?.toString().trim() || undefined;
}

export async function getAuthUser(request: FastifyRequest): Promise<AuthUser | null> {
  const token = getCookie(request, COOKIE_NAME);
  if (!token) return null;

  const pool = await getDb();
  const result = await pool.request()
    .input('tokenHash', hashToken(token))
    .query<AuthUser & { expiresAt: Date }>(`
      SELECT TOP 1
        c.id,
        c.email,
        c.first_name AS firstName,
        c.last_name AS lastName,
        c.role,
        s.expires_at AS expiresAt
      FROM customer_sessions s
      INNER JOIN customers c ON c.id = s.customer_id
      WHERE s.token_hash = @tokenHash AND s.expires_at > SYSUTCDATETIME();
    `);

  const user = result.recordset[0];
  if (!user) return null;

  await pool.request()
    .input('tokenHash', hashToken(token))
    .query(`UPDATE customer_sessions SET last_seen_at = SYSUTCDATETIME() WHERE token_hash = @tokenHash`);

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role
  };
}

function setSessionCookie(reply: FastifyReply, token: string) {
  const secure = env.NODE_ENV === 'production' ? '; Secure' : '';
  reply.header(
    'set-cookie',
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}${secure}`
  );
}

function clearSessionCookie(reply: FastifyReply) {
  reply.header(
    'set-cookie',
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
}

async function createSession(customerId: string, reply: FastifyReply) {
  const token = randomBytes(32).toString('base64url');
  const pool = await getDb();
  await pool.request()
    .input('id', randomUUID())
    .input('customerId', customerId)
    .input('tokenHash', hashToken(token))
    .input('expiresAt', new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000))
    .query(`
      INSERT INTO customer_sessions (id, customer_id, token_hash, expires_at)
      VALUES (@id, @customerId, @tokenHash, @expiresAt);
    `);
  setSessionCookie(reply, token);
}

export async function registerUser(
  input: { email: string; password: string; firstName?: string; lastName?: string },
  reply: FastifyReply
): Promise<AuthUser> {
  const email = normalizeEmail(input.email);
  if (input.password.length < 8) throw new Error('Password must be at least 8 characters.');

  const pool = await getDb();
  const passwordHash = await hashPassword(input.password);
  const id = randomUUID();

  try {
    await pool.request()
      .input('id', id)
      .input('email', email)
      .input('passwordHash', passwordHash)
      .input('firstName', input.firstName?.trim() || null)
      .input('lastName', input.lastName?.trim() || null)
      .query(`
        INSERT INTO customers (id, email, password_hash, first_name, last_name, role)
        VALUES (@id, @email, @passwordHash, @firstName, @lastName, 'CUSTOMER');
      `);
  } catch (error) {
    if (String(error).includes('UQ__') || String(error).toLowerCase().includes('duplicate')) {
      throw new Error('An account with this email already exists.');
    }
    throw error;
  }

  await createSession(id, reply);
  return { id, email, firstName: input.firstName?.trim() || null, lastName: input.lastName?.trim() || null, role: 'CUSTOMER' };
}

export async function loginUser(emailInput: string, password: string, reply: FastifyReply): Promise<AuthUser> {
  const email = normalizeEmail(emailInput);
  const pool = await getDb();
  const result = await pool.request().input('email', email).query<AuthUser & { passwordHash: string | null }>(`
    SELECT TOP 1 id, email, first_name AS firstName, last_name AS lastName, role, password_hash AS passwordHash
    FROM customers
    WHERE email = @email;
  `);
  const row = result.recordset[0];
  if (!row || !row.passwordHash || !(await verifyPassword(password, row.passwordHash))) {
    throw new Error('Invalid email or password.');
  }

  await createSession(row.id, reply);
  return { id: row.id, email: row.email, firstName: row.firstName, lastName: row.lastName, role: row.role };
}

export async function logoutUser(request: FastifyRequest, reply: FastifyReply) {
  const token = getCookie(request, COOKIE_NAME);
  if (token) {
    const pool = await getDb();
    await pool.request().input('tokenHash', hashToken(token)).query(`DELETE FROM customer_sessions WHERE token_hash = @tokenHash`);
  }
  clearSessionCookie(reply);
}

export function requireUser(user: AuthUser | null) {
  if (!user) throw new Error('Authentication required.');
  return user;
}

export function requireAdmin(user: AuthUser | null) {
  if (!user || (user.role !== 'ADMIN' && user.role !== 'STAFF')) throw new Error('Admin access required.');
  return user;
}
