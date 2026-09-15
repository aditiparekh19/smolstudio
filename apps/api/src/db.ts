import sql from 'mssql';
import { env } from './config.js';

let poolPromise: Promise<sql.ConnectionPool> | undefined;

export function getDb(): Promise<sql.ConnectionPool> {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool({
      server: env.DATABASE_HOST,
      port: env.DATABASE_PORT,
      database: env.DATABASE_NAME,
      user: env.DATABASE_USER,
      password: env.DATABASE_PASSWORD,
      options: {
        encrypt: env.DATABASE_ENCRYPT,
        trustServerCertificate: env.DATABASE_TRUST_SERVER_CERT
      },
      pool: {
        max: env.DATABASE_POOL_MAX,
        min: 2,
        idleTimeoutMillis: 30000
      }
    }).connect();
  }

  return poolPromise!;
}

export async function closeDb() {
  if (poolPromise) {
    const pool = await poolPromise;
    await pool.close();
    poolPromise = undefined;
  }
}