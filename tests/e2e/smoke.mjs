/**
 * End-to-end smoke test through the real UI (headless Chrome).
 *   BASE_URL=http://localhost:3000 CHROME_PATH=/path/to/chrome node tests/e2e/smoke.mjs
 * Requires the demo seed (admin@example.com) and a running app.
 */
import puppeteer from "puppeteer-core";
import sharp from "sharp";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.env.SHOTS_DIR;
const tag = Math.random().toString(36).slice(2, 7);
const seller = { name: "E2E Seller", email: `seller-${tag}@e2e.test`, password: "password-e2e-1" };
const buyer = { name: "E2E Buyer", email: `buyer-${tag}@e2e.test`, password: "password-e2e-2" };
const trim = `E2E${tag}`;
let step = 0;
const ok = (m) => console.log(`  ✓ ${++step}. ${m}`);
const assert = (c, m) => { if (!c) throw new Error(`FAILED: ${m}`); ok(m); };

const dir = mkdtempSync(path.join(tmpdir(), "motorna-e2e-"));
const photos = [];
for (const [i, color] of ["#1e3a8a", "#b91c1c", "#15803d"].entries()) {
  const p = path.join(dir, `p${i}.jpg`);
  writeFileSync(p, await sharp({ create: { width: 1200, height: 800, channels: 3, background: color } }).jpeg().toBuffer());
  photos.push(p);
}

let executablePath = process.env.CHROME_PATH;
let args = [];
if (!executablePath) {
  const chromium = (await import("@sparticuz/chromium")).default;
  executablePath = await chromium.executablePath();
  args = chromium.args.filter((a) => a !== "--single-process");
}
const browser = await puppeteer.launch({ executablePath, args, headless: true });

async function newCtx() {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  page.setDefaultTimeout(30000);
  return { ctx, page };
}
const go = (page, p) => page.goto(BASE + p, { waitUntil: "networkidle0" });
const shot = async (page, name, full = true) => SHOTS && page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: full });
async function clickText(page, text, selector = "button, a") {
  const handle = await page.waitForFunction(
    (sel, t) => [...document.querySelectorAll(sel)].find((e) => e.textContent?.trim().includes(t) && !e.disabled && e.getClientRects().length > 0),
    {},
    selector,
    text,
  );
  await handle.asElement().click();
}
async function signUp(page, u) {
  await go(page, "/en/auth/sign-up");
  await page.type("#name", u.name);
  await page.type("#email", u.email);
  await page.type("#password", u.password);
  await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.click("button[type=submit]")]);
}
async function signIn(page, email, password) {
  await go(page, "/en/auth/sign-in");
  await page.type("#email", email);
  await page.type("#password", password);
  await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.click("button[type=submit]")]);
}
const selectByText = (page, sel, text) =>
  page.$eval(sel, (el, t) => {
    const o = [...el.options].find((x) => x.textContent.trim() === t);
    el.value = o.value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, text);

try {
  console.log(`MOTORNA e2e against ${BASE} (tag ${tag})`);

  // Seller creates a listing
  const S = await newCtx();
  await signUp(S.page, seller);
  ok("seller signed up");
  await go(S.page, "/en/sell");
  await selectByText(S.page, "#makeId", "Toyota");
  await S.page.waitForFunction(() => document.querySelector("#modelId").options.length > 1);
  await selectByText(S.page, "#modelId", "Corolla");
  await selectByText(S.page, "#year", "2019");
  await S.page.type("#trim", trim);
  await clickText(S.page, "Continue");
  await S.page.waitForSelector("#mileageKm");
  await S.page.type("#mileageKm", "61000");
  await S.page.type("#priceEgp", "880,000");
  await S.page.type("#description", "Agency maintained, original paint, two keys. Selling because I'm moving abroad.");
  await clickText(S.page, "Continue");
  await S.page.waitForSelector("input[type=file]");
  const editUrl = S.page.url();
  assert(/\/account\/listings\/[0-9a-f-]{36}\/edit$/.test(editUrl), "draft saved and URL is resumable");
  const listingId = editUrl.match(/listings\/([0-9a-f-]{36})/)[1];
  const input = await S.page.$("input[type=file]");
  await input.uploadFile(...photos);
  await S.page.waitForFunction(() => document.querySelectorAll("li img").length >= 3, { timeout: 60000 });
  ok("3 photos uploaded and processed");
  await shot(S.page, "e2e-photos");
  await clickText(S.page, "Continue");
  await Promise.all([S.page.waitForNavigation({ waitUntil: "networkidle0" }), clickText(S.page, "Submit for review")]);
  assert(S.page.url().endsWith("/en/account/listings"), "submitted for review");
  assert((await S.page.content()).includes("In review"), "listing shows In review");
  const slug = await S.page.$$eval("a[href*='/en/cars/']", (as, t) => as.find((a) => a.textContent.includes(t))?.getAttribute("href"), trim);
  assert(!!slug, "listing link present");

  // Anonymous can't see an unreviewed listing
  const A = await newCtx();
  const anon = await A.page.goto(BASE + slug, { waitUntil: "networkidle0" });
  assert(anon.status() === 404, "unreviewed listing is hidden from the public (404)");

  // Admin approves
  const AD = await newCtx();
  await signIn(AD.page, "admin@example.com", "motorna-demo-2026");
  await go(AD.page, "/en/admin/listings");
  await AD.page.waitForFunction((t) => document.body.innerText.includes(t), {}, trim);
  await shot(AD.page, "e2e-admin-queue");
  await AD.page.evaluate((t) => {
    const card = [...document.querySelectorAll("li")].find((li) => li.innerText.includes(t));
    [...card.querySelectorAll("button")].find((b) => b.textContent.includes("Approve")).click();
  }, trim);
  await AD.page.waitForFunction((t) => !document.body.innerText.includes(t), {}, trim);
  ok("admin approved the listing");

  // Buyer finds, saves, messages, reports
  const B = await newCtx();
  await signUp(B.page, buyer);
  await go(B.page, `/en/cars?q=${trim}`);
  assert((await B.page.$$eval("article", (a) => a.length)) === 1, "keyword search finds exactly the new listing");
  await go(B.page, slug);
  await shot(B.page, "e2e-detail-en");
  await clickText(B.page, "Save");
  await B.page.waitForFunction(() => [...document.querySelectorAll("button[aria-pressed=true]")].length > 0);
  ok("buyer saved the car");
  await B.page.$eval("#contact-body", (el) => (el.value = ""));
  await B.page.type("#contact-body", `Hello from buyer ${tag}`);
  await clickText(B.page, "Message seller");
  await B.page.waitForFunction(() => document.body.innerText.includes("Open conversation"));
  ok("buyer messaged the seller");
  await clickText(B.page, "Report listing");
  await B.page.waitForSelector("#report-reason");
  await B.page.select("#report-reason", "wrong_info");
  await clickText(B.page, "Send", "dialog button");
  await B.page.waitForFunction(() => document.body.innerText.includes("we'll review your report"));
  ok("buyer reported the listing");
  await go(B.page, "/en/account/favorites");
  assert((await B.page.content()).includes(trim), "saved car appears in favorites");

  // Authorization checks as buyer
  const editAttempt = await B.page.goto(`${BASE}/en/account/listings/${listingId}/edit`, { waitUntil: "networkidle0" });
  assert(editAttempt.status() === 404, "buyer can't open the seller's edit page");
  await go(B.page, "/en/admin");
  assert(!B.page.url().includes("/admin"), "non-admin is redirected away from /admin");
  const uploadStatus = await B.page.evaluate(async (id) => {
    const fd = new FormData();
    fd.append("file", new Blob([new Uint8Array(10)], { type: "image/jpeg" }), "x.jpg");
    return (await fetch(`/api/listings/${id}/images`, { method: "POST", body: fd })).status;
  }, listingId);
  assert(uploadStatus === 403, "buyer can't upload photos to someone else's listing (403)");
  const anonUpload = await A.page.evaluate(async (id) => (await fetch(`/api/listings/${id}/images`, { method: "POST", body: new FormData() })).status, listingId);
  assert(anonUpload === 401, "anonymous upload is rejected (401)");

  // Seller reads and replies
  await go(S.page, "/en/account/messages");
  assert((await S.page.content()).includes(buyer.name), "seller sees the conversation");
  await clickText(S.page, buyer.name, "a");
  await S.page.waitForSelector("#composer");
  await S.page.type("#composer", "Yes, still available.");
  await clickText(S.page, "Send");
  await S.page.waitForFunction(() => document.body.innerText.includes("Yes, still available."));
  ok("seller replied in the thread");
  await shot(S.page, "e2e-thread");

  // Report shows in admin queue
  await go(AD.page, "/en/admin/reports");
  assert((await AD.page.content()).includes(trim), "report reached the admin queue");

  // Arabic RTL + mobile
  await A.page.setViewport({ width: 390, height: 844, isMobile: true });
  await go(A.page, "/ar");
  assert((await A.page.$eval("html", (h) => h.dir)) === "rtl", "Arabic pages render RTL");
  const overflow = await A.page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  assert(!overflow, "no horizontal overflow at 390px (ar home)");
  await shot(A.page, "e2e-home-ar-mobile");
  await go(A.page, slug.replace("/en/", "/ar/"));
  const overflow2 = await A.page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  assert(!overflow2, "no horizontal overflow at 390px (ar listing)");
  await shot(A.page, "e2e-detail-ar-mobile");

  console.log(`\nAll ${step} checks passed.`);
} catch (e) {
  console.error(e.message ?? e);
  process.exitCode = 1;
} finally {
  await browser.close();
}
