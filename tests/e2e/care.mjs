/**
 * MOTORNA Care Stage 1 end-to-end: apply → upload documents → admin review → approval → public directory.
 *   BASE_URL=http://localhost:3000 node tests/e2e/care.mjs
 * Requires the demo seed (admin@example.com) and a running app.
 */
import puppeteer from "puppeteer-core";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.env.SHOTS_DIR;
const tag = Math.random().toString(36).slice(2, 7);
const owner = { name: "Care Owner", email: `care-owner-${tag}@e2e.test`, password: "password-e2e-3" };
const outsider = { name: "Care Outsider", email: `care-out-${tag}@e2e.test`, password: "password-e2e-4" };
const nameEn = `E2E Garage ${tag}`;
const nameAr = `ورشة تجربة ${tag}`;
let step = 0;
const ok = (m) => console.log(`  ✓ ${++step}. ${m}`);
const assert = (c, m) => { if (!c) throw new Error(`FAILED: ${m}`); ok(m); };

const dir = mkdtempSync(path.join(tmpdir(), "motorna-care-"));
const pdf = path.join(dir, "doc.pdf");
writeFileSync(pdf, "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

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
const text = (page) => page.evaluate(() => document.body.innerText);
const waitText = (page, t, timeout = 30000) => page.waitForFunction((x) => document.body.innerText.includes(x), { timeout }, t);
async function clickText(page, t, selector = "button, a") {
  const h = await page.waitForFunction(
    (sel, x) => [...document.querySelectorAll(sel)].find((e) => e.textContent?.trim() === x && !e.disabled && e.getClientRects().length > 0),
    {}, selector, t,
  );
  // DOM click: toasts can overlap the viewport edge where puppeteer would click.
  await h.asElement().evaluate((el) => { el.scrollIntoView({ block: "center" }); el.click(); });
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

try {
  console.log(`MOTORNA Care e2e against ${BASE} (tag ${tag})`);
  const O = await newCtx();
  globalThis.__pages = { owner: O.page };
  await signUp(O.page, owner);

  // Apply
  await go(O.page, "/en/care/apply");
  await O.page.type("#nameAr", nameAr);
  await O.page.type("#nameEn", nameEn);
  await O.page.type("#area", "Smouha");
  await O.page.type("#address", "15 Fawzy Moaz St, Smouha");
  await O.page.type("#phone", "03 4251234");
  await O.page.click("input[name=vehicleTypes][value=passenger]");
  // Submitting without accepting the terms is refused with a message
  await clickText(O.page, "Create application draft");
  await waitText(O.page, "You need to agree before submitting");
  ok("application requires accepting the terms");
  await O.page.click("input[name=acceptTerms]");
  await clickText(O.page, "Create application draft");
  await O.page.waitForFunction(() => /\/en\/center\/[a-z0-9-]+$/.test(location.pathname), { timeout: 30000 });
  await waitText(O.page, "Application checklist");
  const dashUrl = O.page.url();
  ok("draft created; owner lands on the dashboard with the application checklist");
  const submitDisabled = await O.page.$$eval("button", (bs) => bs.find((b) => b.textContent.trim() === "Submit for review")?.disabled);
  assert(submitDisabled === true, "submit is disabled while the checklist is incomplete");

  // Not public yet
  const P = await newCtx();
  await go(P.page, "/en/care");
  assert(!(await text(P.page)).includes(nameEn), "unapproved center is not in the public directory");

  // Service
  await clickText(O.page, "Add service");
  await O.page.waitForSelector("#cat-new");
  await O.page.select("#cat-new", "pre_purchase_inspection");
  await O.page.type("#nar-new", "فحص شامل قبل الشراء");
  await O.page.type("#nen-new", "Full pre-purchase inspection");
  await O.page.type("#pr-new", "1500");
  await O.page.$eval("#cat-new", (el) => el.closest("form").querySelector("button[type=submit]").click());
  await waitText(O.page, "Full pre-purchase inspection");
  ok("owner added a fixed-price inspection service");

  // Hours (Saturday)
  await O.page.evaluate(() => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    for (const [label, v] of [["Saturday From", "09:00"], ["Saturday To", "17:00"]]) {
      const el = document.querySelector(`input[aria-label="${label}"]`);
      set.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
  await clickText(O.page, "Save hours");
  await waitText(O.page, "Saved");
  ok("owner saved opening hours");

  // Equipment (required for inspection centers)
  for (const kind of ["obd_scanner", "paint_thickness_gauge", "lift"]) {
    await O.page.select("#eq-kind", kind);
    await O.page.$eval("#eq-kind", (el) => el.closest("form").querySelector("button[type=submit]").click());
    await new Promise((r) => setTimeout(r, 900));
  }
  await waitText(O.page, "Paint-thickness gauge");
  ok("owner declared the core inspection equipment");
  // Technician
  await O.page.type("#t-name", "Mahmoud Adel");
  await O.page.type("#t-spec", "Diagnostics");
  await O.page.type("#t-years", "8");
  await O.page.$eval("#t-name", (el) => el.closest("form").querySelector("button[type=submit]").click());
  await waitText(O.page, "Mahmoud Adel");
  ok("owner added a responsible technician");

  // Documents
  for (const kind of ["commercial_register", "tax_card"]) {
    await O.page.select("#doc-kind", kind);
    const input = await O.page.$("#doc-file");
    await input.uploadFile(pdf);
    await clickText(O.page, "Upload");
    await waitText(O.page, "Document uploaded");
    await new Promise((r) => setTimeout(r, 800));
  }
  await O.page.waitForFunction(() => document.querySelectorAll("a[href^='/api/care/credentials/']").length >= 2);
  const docHref = await O.page.$eval("a[href^='/api/care/credentials/']", (a) => a.getAttribute("href"));
  ok("owner uploaded commercial register and tax card (private)");
  const own = await O.page.evaluate(async (h) => (await fetch(h)).status, docHref);
  assert(own === 200, "owner can open their own document");

  // Submit
  await O.page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "Submit for review" && !b.disabled));
  await clickText(O.page, "Submit for review");
  await waitText(O.page, "waiting for review");
  ok("complete application submitted for review");

  // Outsider can't read documents or reach admin
  const X = await newCtx();
  await signUp(X.page, outsider);
  const status = await X.page.evaluate(async (h) => (await fetch(h)).status, docHref);
  assert(status === 403, "another user gets 403 on a center's document");
  await go(X.page, "/en/admin/centers");
  assert(!X.page.url().includes("/admin"), "non-admin is redirected away from /admin/centers");
  await go(X.page, dashUrl.replace(BASE, ""));
  assert(!X.page.url().includes("/center/"), "non-staff can't open the center dashboard");

  // Admin review
  const A = await newCtx();
  globalThis.__pages.admin = A.page;
  await signIn(A.page, "admin@example.com", "motorna-demo-2026");
  await go(A.page, "/en/admin/centers");
  await waitText(A.page, nameEn);
  await Promise.all([A.page.waitForNavigation({ waitUntil: "networkidle0" }), clickText(A.page, nameEn, "a p, a")]).catch(async () => {
    const href = await A.page.$$eval("a", (as, n) => as.find((a) => a.textContent.includes(n))?.getAttribute("href"), nameEn);
    await go(A.page, href);
  });
  await waitText(A.page, "Approval criteria");
  const approveDisabled = await A.page.$$eval("button", (bs) => bs.find((b) => b.textContent.trim() === "Approve center")?.disabled ?? true);
  assert(approveDisabled, "approve is unavailable before review starts / blockers cleared");
  await A.page.waitForSelector("textarea#center-reason");
  await A.page.type("textarea#center-reason", "Please add your landline number to the profile.");
  await clickText(A.page, "Request changes");
  await waitText(A.page, "Changes requested");
  ok("admin requested changes with a message");
  await O.page.reload({ waitUntil: "networkidle0" });
  assert((await text(O.page)).includes("Please add your landline number"), "owner sees the moderator's message");
  await clickText(O.page, "Submit for review");
  await waitText(O.page, "waiting for review");
  ok("owner resubmitted after changes");
  await A.page.reload({ waitUntil: "networkidle0" });
  await clickText(A.page, "Start review");
  await waitText(A.page, "Under review");
  for (let i = 0; i < 2; i++) {
    await clickText(A.page, "Accept");
    await new Promise((r) => setTimeout(r, 1200));
  }
  await A.page.waitForFunction(() => document.body.innerText.split("Accepted").length - 1 >= 2);
  ok("admin accepted both documents");
  const n = await A.page.$$eval("button", (bs) => bs.filter((b) => b.textContent.trim() === "Met").length);
  assert(n === 5, "inspection center shows all 5 criteria (equipment applies)");
  for (let i = 0; i < n; i++) {
    const btns = await A.page.$$("button");
    const met = [];
    for (const b of btns) if ((await b.evaluate((e) => e.textContent.trim())) === "Met" && !(await b.evaluate((e) => e.getAttribute("aria-pressed") === "true"))) met.push(b);
    await met[0].click();
    await new Promise((r) => setTimeout(r, 1000));
  }
  await A.page.waitForFunction(() => [...document.querySelectorAll("button[aria-pressed=true]")].filter((b) => b.textContent.trim() === "Met").length === 5);
  await A.page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "Approve center" && !b.disabled));
  await clickText(A.page, "Approve center");
  await A.page.waitForFunction(() => !document.body.innerText.includes("Approve center"));
  assert((await text(A.page)).includes("Approved"), "admin approved the center after all checks");
  assert((await text(A.page)).includes("center.approve"), "approval is recorded in the center history");
  await A.page.type("textarea[aria-label='Add note']", "Visited on Sunday; equipment present.");
  await clickText(A.page, "Add note");
  await waitText(A.page, "Visited on Sunday");
  ok("admin added an internal note");
  await O.page.reload({ waitUntil: "networkidle0" });
  assert(!(await text(O.page)).includes("Visited on Sunday"), "internal note is not visible to the center");

  // Public
  await go(P.page, "/en/care");
  assert((await text(P.page)).includes(nameEn), "approved center appears in the English directory");
  await go(P.page, "/en/care?category=oil_change");
  assert(!(await text(P.page)).includes(nameEn), "category filter excludes centers without that service");
  await go(P.page, "/en/care?city=alexandria&area=Smouha&category=pre_purchase_inspection");
  assert((await text(P.page)).includes(nameEn), "governorate + area + service filters find the center");
  await go(P.page, "/en/care?city=alexandria&area=Sporting");
  assert(!(await text(P.page)).includes(nameEn), "area filter excludes other areas");
  await P.page.setViewport({ width: 390, height: 844, isMobile: true });
  await go(P.page, "/ar/care");
  assert((await text(P.page)).includes(nameAr), "Arabic directory shows the Arabic name");
  assert((await P.page.$eval("html", (h) => h.dir)) === "rtl", "Care pages render RTL in Arabic");
  const href = await P.page.$$eval("a", (as, n) => as.find((a) => a.textContent.includes(n))?.getAttribute("href"), nameAr);
  await go(P.page, href);
  const detail = await text(P.page);
  assert(detail.includes("فحص شامل قبل الشراء") && detail.includes("1,500"), "center page lists the service and its price");
  assert(detail.includes("آخر مراجعة"), "center page shows the latest review date");
  assert(detail.includes("مش ترخيص حكومي"), "center page distinguishes MOTORNA review from government licensing");
  assert(!detail.includes("Mahmoud Adel"), "technician names are not public");
  assert(!(await P.page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), "no horizontal overflow at 390px (ar center page)");
  if (SHOTS) await P.page.screenshot({ path: path.join(SHOTS, "care-center-ar-mobile.png"), fullPage: true });

  console.log(`\nAll ${step} Care checks passed.`);
} catch (e) {
  console.error(e.message ?? e);
  if (SHOTS) for (const [n, p] of Object.entries(globalThis.__pages ?? {})) await p.screenshot({ path: path.join(SHOTS, `care-fail-${n}.png`), fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
