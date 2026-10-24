import { execSync } from "node:child_process";

export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgres://motorna:motorna_dev@localhost:5432/motorna_test";
  if (!/localhost|127\.0\.0\.1/.test(url) || !url.includes("test")) throw new Error("Tests must run against a local *_test database");
  const env = { ...process.env, DATABASE_URL: url };
  execSync(`psql "${url}" -q -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS drizzle CASCADE;"`, { stdio: "inherit", env });
  execSync("npx drizzle-kit migrate", { stdio: "ignore", env });
  execSync("npx tsx scripts/seed-reference.ts", { stdio: "ignore", env });
}
