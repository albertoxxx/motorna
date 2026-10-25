import { runCareMaintenance } from "@/server/booking-engine";

export const dynamic = "force-dynamic";

/**
 * Daily MOTORNA Care job (Vercel cron): expire stale requests, tomorrow's reminders,
 * "confirm or report" reminders, and 7-day auto-confirmation of commission records.
 * Vercel sends `Authorization: Bearer $CRON_SECRET`; without the secret configured, it never runs.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return Response.json({ error: "not_configured" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "unauthorized" }, { status: 401 });
  const result = await runCareMaintenance();
  return Response.json(result, { headers: { "cache-control": "no-store" } });
}
