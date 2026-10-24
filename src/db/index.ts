import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pool?: Pool };

function createPool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return new Pool({ connectionString: url, max: Number(process.env.DB_POOL_MAX ?? 10) });
}

const pool = globalForDb.pool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

export const db = drizzle({ client: pool, schema, casing: "snake_case" });
export type DB = typeof db;
export { schema };
