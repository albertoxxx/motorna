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
  globalThis.__pages = { seller: S.page };
  await signUp(S.page, seller);
  ok("seller signed up");
  await go(S.page, "/en/sell");
  await selectByText(S.page, "#makeId", "Toyota");
  await S.page.waitForFunction(() => document.querySelector("#modelId").options.length > 1);
  await selectByText(S.page, "#modelId", "Corolla");
  await selectByText(S.page, "#year", "2019");
  // An engine size typed as the trim is caught before moving on
  await S.page.type("#trim", "3000cc");
  await clickText(S.page, "Continue");
  await S.page.waitForFunction(() => document.body.innerText.includes("looks like an engine size"));
  assert(!!(await S.page.$("#makeId")), "engine size in the trim field blocks the step with a clear message");
  await S.page.$eval("#trim", (e) => { e.select(); });
  await S.page.keyboard.press("Backspace");
  await S.page.type("#trim", trim);
  await clickText(S.page, "Continue");
  // Step 2: specifications
  await S.page.waitForSelector("#engineCc");
  await S.page.type("#engineCc", "1600");
  await clickText(S.page, "Continue");
  // Step 3: mileage & condition
  await S.page.waitForSelector("#mileageKm");
  assert(!!(await S.page.$("#condition")), "condition sits with mileage in its own step");
  await S.page.type("#mileageKm", "61000");
  await clickText(S.page, "Continue");
  // Step 4: price & location (saves the draft)
  await S.page.waitForSelector("#priceEgp");
  await S.page.type("#priceEgp", "880,000");
  const consent = await S.page.evaluate(() => {
    const label = [...document.querySelectorAll("label")].find((l) => l.textContent.includes("Allow buyers to see my phone number"));
    return { exists: !!label, checked: !!label?.querySelector("input")?.checked, phoneField: !!document.querySelector("#sellerPhone") };
  });
  assert(consent.exists && !consent.checked && !consent.phoneField, "phone consent is offered and off by default (no number field until opted in)");
  await clickText(S.page, "Continue");
  // Step 5: photos
  await S.page.waitForSelector("input[type=file]");
  const editUrl = S.page.url();
  assert(/\/sell\?draft=[0-9a-f-]{36}$/.test(editUrl), "draft saved and URL is resumable");
  const listingId = editUrl.match(/draft=([0-9a-f-]{36})/)[1];
  const input = await S.page.$("input[type=file]");
  await input.uploadFile(...photos);
  await S.page.waitForFunction(() => document.querySelectorAll("li img").length >= 3, { timeout: 60000 });
  ok("3 photos uploaded and processed");
  await shot(S.page, "e2e-photos");
  // Back to step 1 and forward again: entered data must be preserved
  await clickText(S.page, "Back");
  await clickText(S.page, "Back");
  await S.page.waitForSelector("#mileageKm");
  assert((await S.page.$eval("#mileageKm", (e) => e.value)) === "61000", "data preserved when moving between steps");
  await clickText(S.page, "Continue");
  await S.page.waitForSelector("#priceEgp");
  await clickText(S.page, "Continue");
  await S.page.waitForSelector("input[type=file]");
  await clickText(S.page, "Continue");
  // Step 6: description & known defects
  await S.page.waitForSelector("#description");
  await S.page.type("#description", "Agency maintained, original paint, two keys. Selling because I'm moving abroad.");
  await S.page.type("#knownDefects", "Small scratch on rear bumper");
  await clickText(S.page, "Continue");
  await S.page.waitForFunction(() => document.body.innerText.includes("Small scratch on rear bumper"));
  ok("review step shows known defects");
  await clickText(S.page, "Submit for review");
  await S.page.waitForFunction(() => location.pathname.endsWith("/en/account/listings") && document.body.innerText.includes("In review"), { timeout: 60000 });
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
  const detailText = await B.page.evaluate(() => document.body.innerText);
  assert(detailText.includes("Small scratch on rear bumper"), "known defects shown on the listing page");
  assert(detailText.includes("Listing review") && detailText.includes("Reviewed") && detailText.includes("Not verified") && detailText.includes("Not inspected"), "trust panel shows separate statuses, only review marked done");
  assert(!!(await B.page.$$eval("button", (bs) => bs.some((b) => b.textContent.trim() === "Share"))), "share action present");
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

  // Regression checks from the UI audit
  await A.page.setViewport({ width: 1280, height: 900 });
  await go(A.page, "/en");
  await go(A.page, slug);
  const anonText = await A.page.evaluate(() => document.body.innerText);
  assert(anonText.includes("Create an account to message the seller") && anonText.includes("protect sellers from spam"), "signed-out buyers see why an account is needed");
  assert(!anonText.includes("Show phone number"), "no phone reveal for a listing without consent");
  await go(A.page, "/en/auth/sign-up?next=" + encodeURIComponent(slug));
  assert((await A.page.evaluate(() => document.body.innerText)).includes("Sign in to message the seller"), "sign-up page explains the account when coming from a listing");
  const back = await A.page.$eval("form a[href*='/en/auth/sign-in']", (a) => a.getAttribute("href"));
  assert(back.includes("next="), "sign-up → sign-in link keeps the return path");
  const logoText = await A.page.$eval("header a[href='/en']", (a) => a.textContent.trim());
  assert(logoText === "MOTORNA", `logo text reads "MOTORNA" (got "${logoText}")`);
  await go(A.page, "/en/cars?mileageMin=1000000");
  const minKm = await A.page.evaluate(() => document.body.innerText);
  assert(minKm.includes("0 results") && minKm.includes("No cars match these filters"), "min-mileage filter narrows server results (empty state + fallback)");
  // Make picker lists makes with live cars first; an empty make says so plainly
  await go(A.page, "/en");
  const groups = await A.page.$$eval("form[role=search] optgroup", (gs) => gs.map((g) => g.label));
  assert(groups[0] === "Available now", "home make picker shows makes with live cars first");
  const budgets = await A.page.$$eval("form[role=search] select", (ss) => ss.flatMap((s) => [...s.options].map((o) => o.value)));
  assert(budgets.includes("10000000"), "budget list reaches above EGP 5M");
  await go(A.page, "/en/cars?make=ferrari");
  assert((await A.page.evaluate(() => document.body.innerText)).includes("No Ferrari cars listed yet"), "empty make search explains there are no cars of that make yet");
  await go(A.page, "/en/cars?make=toyota");
  const forms = await A.page.$$eval("input[placeholder*='Corolla']", (els) => els.length);
  assert(forms === 1, "exactly one filter form on the cars page (desktop)");
  const chip = await A.page.$("a[aria-label^='Remove filter']");
  assert(!!chip, "active filter shows a removable chip");
  await Promise.all([A.page.waitForNavigation({ waitUntil: "networkidle0" }), chip.click()]);
  assert(!A.page.url().includes("make="), "removing a chip clears that filter");

  // Arabic RTL + mobile
  await A.page.setViewport({ width: 390, height: 844, isMobile: true });
  await go(A.page, "/ar");
  assert((await A.page.$eval("html", (h) => h.dir)) === "rtl", "Arabic pages render RTL");
  const overflow = await A.page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  assert(!overflow, "no horizontal overflow at 390px (ar home)");
  await shot(A.page, "e2e-home-ar-mobile");
  const h1Visible = await A.page.$eval("h1", (h) => {
    const r = h.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return r.height > 0 && (top === h || h.contains(top));
  });
  assert(h1Visible, "home headline is visible on phones (not covered by the search box)");
  await go(A.page, "/ar/cars");
  const mobileForms = await A.page.$$eval("input[placeholder*='كورولا']", (els) => els.filter((e) => e.getClientRects().length).length);
  assert(mobileForms === 0, "filter form is hidden until the drawer opens (phone)");
  await go(A.page, slug.replace("/en/", "/ar/"));
  const overflow2 = await A.page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  assert(!overflow2, "no horizontal overflow at 390px (ar listing)");
  await shot(A.page, "e2e-detail-ar-mobile");

  console.log(`\nAll ${step} checks passed.`);
} catch (e) {
  console.error(e.message ?? e);
  if (SHOTS) for (const [n, p] of Object.entries(globalThis.__pages ?? {})) await p.screenshot({ path: path.join(SHOTS, `fail-${n}.png`) }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
