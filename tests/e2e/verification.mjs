/**
 * Seller verification e2e: seller uploads a vehicle licence → admin accepts it in /admin/licences →
 * the public car page and result card show the badge; the licence file stays private.
 * Profile shows phone verification as "coming soon" when no SMS provider is configured.
 *
 *   BASE_URL=http://localhost:3000 LICENCE_FILE=/path/to.png node tests/e2e/verification.mjs
 * Requires the demo seed (karim@example.com with a published listing, admin@example.com).
 */
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const FILE = process.env.LICENCE_FILE;
const PW = process.env.DEMO_PASSWORD ?? "motorna-demo-2026";
let step = 0;
const ok = (m) => console.log(`  ✓ ${++step}. ${m}`);
const assert = (c, m) => { if (!c) throw new Error(`FAILED: ${m}`); ok(m); };

const chromium = (await import("@sparticuz/chromium")).default;
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? (await chromium.executablePath()), args: chromium.args.filter((a) => a !== "--single-process"), headless: true });
async function ctx() {
  const c = await browser.createBrowserContext();
  const p = await c.newPage();
  await p.setViewport({ width: 390, height: 900 });
  p.setDefaultTimeout(30000);
  return p;
}
const go = (p, path) => p.goto(BASE + path, { waitUntil: "networkidle0" });
const text = (p) => p.evaluate(() => document.body.innerText);
const waitText = (p, t) => p.waitForFunction((x) => document.body.innerText.includes(x), {}, t);
async function signIn(p, email) {
  await go(p, "/en/auth/sign-in");
  await p.type("#email", email);
  await p.type("#password", PW);
  await Promise.all([p.waitForNavigation({ waitUntil: "networkidle0" }), p.click("button[type=submit]")]);
}
async function clickText(p, t) {
  const h = await p.waitForFunction((x) => [...document.querySelectorAll("button, a")].find((e) => e.textContent?.trim() === x && !e.disabled), {}, t);
  await h.asElement().evaluate((el) => el.click());
}

try {
  const S = await ctx();
  const A = await ctx();
  const P = await ctx();
  await signIn(S, "karim@example.com");
  await signIn(A, "admin@example.com");

  await go(S, "/en/account/profile");
  assert((await text(S)).includes("SMS verification is coming soon"), "profile says phone verification isn't available yet (no SMS provider)");

  await go(S, "/en/account/listings");
  const link = await S.$$eval("a[href*='/licence']", (as) => as.map((a) => a.getAttribute("href")).find((h) => h));
  assert(!!link, "My listings links to the vehicle licence page");
  const listingId = link.split("/")[4];
  await go(S, link);
  let t = await text(S);
  if (t.includes("Withdraw licence")) { await clickText(S, "Withdraw licence"); await waitText(S, "Licence withdrawn"); await go(S, link); t = await text(S); }
  assert(t.includes("never shown publicly") && t.includes("deleted 30 days"), "privacy note shown before upload");
  const input = await S.$("#lc-front");
  await input.uploadFile(FILE);
  await S.evaluate(() => document.querySelector("#lc-front").dispatchEvent(new Event("change", { bubbles: true })));
  await clickText(S, "Send for review");
  await waitText(S, "In review");
  ok("seller uploaded the licence; status is In review");
  const fileUrl = await S.$eval("a[href*='/api/licence/']", (a) => a.href);
  const anon = await P.goto(fileUrl);
  assert(anon.status() === 401, "the licence file isn't reachable without signing in");

  await go(A, "/en/admin/licences");
  assert((await text(A)).includes("Vehicle licence review"), "admin sees the licence queue");
  const cards = await A.$$("li");
  await A.evaluate(() => [...document.querySelectorAll("li")].find((li) => li.querySelector("img[src*='/api/licence/']")) && true);
  await clickText(A, "Accept");
  await waitText(A, "Licence accepted");
  ok(`admin accepted the licence (${cards.length} queue items before)`);

  await go(S, link);
  assert((await text(S)).includes("Reviewed on"), "seller sees the licence as reviewed");
  const slug = await (async () => { await go(S, "/en/account/listings"); return S.$$eval("li", (lis, id) => lis.find((li) => li.innerHTML.includes(id))?.querySelector("a[href*='/en/cars/']")?.getAttribute("href"), listingId); })();
  await go(P, slug);
  const pub = await text(P);
  assert(pub.includes("Vehicle licence reviewed"), "public car page shows the licence badge");
  assert(pub.includes("Seller's phone") && pub.includes("Not verified"), "phone row stays 'Not verified'");
  assert(!(await P.$("a[href*='/api/licence/']")), "no link to the licence file on the public page");
  await go(P, `/ar${slug.slice(3)}`);
  assert((await text(P)).includes("رخصة العربية اتراجعت"), "Arabic page shows the badge");
  assert(await P.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "car page fits 390px");
  console.log(`\nAll ${step} verification checks passed.`);
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await browser.close();
}
