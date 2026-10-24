/** Builds a single SQL file to paste into the Supabase SQL editor: schema + reference data + RLS lock-down. */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { CITIES, MAKES } from "../src/db/reference-data";

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const migrations = readdirSync("drizzle").filter((f) => f.endsWith(".sql")).sort();
let out = `-- MOTORNA database setup (generated ${new Date().toISOString().slice(0, 10)})
-- Paste into Supabase → SQL Editor → Run. Safe to run once on an empty project.
BEGIN;
`;
for (const m of migrations) out += `\n-- ${m}\n` + readFileSync(`drizzle/${m}`, "utf8").replaceAll("--> statement-breakpoint", "") + "\n";

out += `\n-- Reference data: governorates\n`;
for (const c of CITIES)
  out += `INSERT INTO cities (id, slug, name_en, name_ar, is_launch, sort_order) VALUES (${c.id}, ${q(c.slug)}, ${q(c.nameEn)}, ${q(c.nameAr)}, ${c.isLaunch ?? false}, ${c.sortOrder}) ON CONFLICT (id) DO NOTHING;\n`;
out += `\n-- Reference data: makes and models\n`;
for (const m of MAKES) {
  out += `INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES (${q(m.slug)}, ${q(m.nameEn)}, ${q(m.nameAr)}, ${m.popular ?? false}) ON CONFLICT (slug) DO NOTHING;\n`;
  for (const [slug, en, arName, body] of m.models)
    out += `INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, ${q(slug)}, ${q(en)}, ${q(arName)}, ${q(body)} FROM vehicle_makes WHERE slug = ${q(m.slug)} ON CONFLICT (make_id, slug) DO NOTHING;\n`;
}

out += `
-- Lock down the public API: the app talks to Postgres directly from the server,
-- so Supabase's anon/authenticated API roles get no access to any table.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t.tablename);
  END LOOP;
END $$;

-- Record the migration so future migrations continue from here.
CREATE SCHEMA IF NOT EXISTS drizzle;
CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint);
`;
const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8"));

for (const e of journal.entries) {
  const sql = readFileSync(`drizzle/${e.tag}.sql`, "utf8");
  out += `INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${q(createHash("sha256").update(sql).digest("hex"))}, ${e.when});\n`;
}
out += `\nCOMMIT;\n\nSELECT (SELECT count(*) FROM cities) AS governorates, (SELECT count(*) FROM vehicle_makes) AS makes, (SELECT count(*) FROM vehicle_models) AS models;\n`;
writeFileSync("supabase/setup.sql", out);
console.log(`supabase/setup.sql written (${out.length} chars)`);
