import { Pool } from "pg";

declare global {
  var pgPool: Pool | undefined;
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("WARNING: DATABASE_URL environment variable is not set.");
}

export const pool =
  globalThis.pgPool ||
  new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }, // Let's keep SSL enabled for Supabase
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.pgPool = pool;
}

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    return res;
  } catch (error) {
    console.error("Database query error:", error);
    throw error;
  }
}

export async function transaction<T>(
  callback: (client: any) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
