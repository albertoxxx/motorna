// Standalone DB connection for CLI scripts (src/db/index.ts is server-only).
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/db/schema";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema, casing: "snake_case" });
export { schema };
