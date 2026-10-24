/**
 * Builds an update script for an existing Supabase database:
 * pending migrations (by journal index >= FROM) + idempotent reference data upsert.
 *   npx tsx scripts/gen-update-sql.ts <from-index> <out-file>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { CITIES, MAKES } from "../src/db/reference-data";

const from = Number(process.argv[2] ?? 0);
const outFile = process.argv[3] ?? "supabase/update.sql";
const migrationsOnly = process.argv.includes("--migrations-only");
const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8"));
const pending = journal.entries.filter((e: { idx: number }) => e.idx >= from);

let out = `-- MOTORNA database update (generated ${new Date().toISOString().slice(0, 10)})
-- Paste into Supabase → SQL Editor → Run. Safe to run more than once.
BEGIN;
`;
for (const e of pending) {
  const sql = readFileSync(`drizzle/${e.tag}.sql`, "utf8");
  const hash = createHash("sha256").update(sql).digest("hex");
  out += `\n-- migration ${e.tag}\nDO $mig$ BEGIN
IF NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = ${q(hash)}) THEN
${sql.replaceAll("--> statement-breakpoint", "").trim()}
INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${q(hash)}, ${e.when});
END IF;
END $mig$;\n`;
}
if (!migrationsOnly) {
out += `\n-- Reference data (insert new, refresh names)\n`;
for (const c of CITIES)
  out += `INSERT INTO cities (id, slug, name_en, name_ar, is_launch, sort_order) VALUES (${c.id}, ${q(c.slug)}, ${q(c.nameEn)}, ${q(c.nameAr)}, ${c.isLaunch ?? false}, ${c.sortOrder}) ON CONFLICT (id) DO UPDATE SET name_en = EXCLUDED.name_en, name_ar = EXCLUDED.name_ar;\n`;
for (const m of MAKES) {
  out += `INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES (${q(m.slug)}, ${q(m.nameEn)}, ${q(m.nameAr)}, ${m.popular ?? false}) ON CONFLICT (slug) DO UPDATE SET name_en = EXCLUDED.name_en, name_ar = EXCLUDED.name_ar, is_popular = EXCLUDED.is_popular;\n`;
  for (const [slug, en, arName, body] of m.models)
    out += `INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type, is_verified) SELECT id, ${q(slug)}, ${q(en)}, ${q(arName)}, ${q(body)}, true FROM vehicle_makes WHERE slug = ${q(m.slug)} ON CONFLICT (make_id, slug) DO UPDATE SET name_en = EXCLUDED.name_en, name_ar = EXCLUDED.name_ar, is_verified = true;\n`;
}
}
out += `
-- Keep new tables/columns closed to Supabase's public API.
DO $$ DECLARE t record; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t.tablename);
  END LOOP;
END $$;

COMMIT;

${migrationsOnly ? "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'listings' AND column_name = 'known_defects';" : "SELECT (SELECT count(*) FROM vehicle_makes) AS makes, (SELECT count(*) FROM vehicle_models) AS models;"}
`;
writeFileSync(outFile, out);
console.log(`${outFile} written`);
