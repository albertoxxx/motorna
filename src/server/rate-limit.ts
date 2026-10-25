import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export type RateRule = { limit: number; windowSec: number };

export const RULES = {
  message: { limit: 30, windowSec: 60 * 10 },
  newConversation: { limit: 10, windowSec: 60 * 60 },
  listingCreate: { limit: 10, windowSec: 60 * 60 * 24 },
  imageUpload: { limit: 120, windowSec: 60 * 60 },
  report: { limit: 10, windowSec: 60 * 60 },
  phoneReveal: { limit: 30, windowSec: 60 * 60 },
  favorite: { limit: 120, windowSec: 60 * 10 },
  centerApply: { limit: 3, windowSec: 60 * 60 * 24 },
  centerEdit: { limit: 200, windowSec: 60 * 60 },
  credentialUpload: { limit: 30, windowSec: 60 * 60 },
  bookingCreate: { limit: 10, windowSec: 60 * 60 * 24 },
  bookingAction: { limit: 120, windowSec: 60 * 60 },
} satisfies Record<string, RateRule>;

/**
 * Fixed-window limiter in Postgres (atomic upsert), so it holds across
 * serverless instances. Returns true when the call is allowed.
 */
export async function rateLimit(scope: keyof typeof RULES, subject: string): Promise<boolean> {
  const rule = RULES[scope];
  const key = `${scope}:${subject}`;
  const res = await db.execute<{ count: number }>(sql`
    INSERT INTO rate_limit_buckets (key, window_start, count)
    VALUES (${key}, now(), 1)
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limit_buckets.window_start < now() - make_interval(secs => ${rule.windowSec})
                   THEN 1 ELSE rate_limit_buckets.count + 1 END,
      window_start = CASE WHEN rate_limit_buckets.window_start < now() - make_interval(secs => ${rule.windowSec})
                   THEN now() ELSE rate_limit_buckets.window_start END
    RETURNING count
  `);
  return Number(res.rows[0]?.count ?? 0) <= rule.limit;
}
