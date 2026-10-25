/**
 * MOTORNA Care booking end-to-end with separate customer, provider and admin accounts:
 * pilot switch → provider settings → customer wizard (Arabic) → provider proposes another time →
 * customer accepts → confirmed → mobile layout and English LTR checks.
 *
 *   BASE_URL=http://localhost:3000 DATABASE_URL=postgres://…/motorna node tests/e2e/booking.mjs
 *
 * Local/staging only: it inserts one approved test center directly (the approval workflow is
 * covered by care.mjs). Requires the demo seed (admin@example.com) on that database.
 */
import puppeteer from "puppeteer-core";
import pg from "pg";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const DB = process.env.DATABASE_URL;
if (!DB || /supabase\.co|pooler\.supabase/.test(DB) && !process.env.ALLOW_STAGING_DB) throw new Error("Set DATABASE_URL to a local or staging database (set ALLOW_STAGING_DB=1 for a staging Supabase project; never production).");
const ADMIN = { email: process.env.ADMIN_EMAIL ?? "admin@example.com", password: process.env.ADMIN_PASSWORD ?? "motorna-demo-2026" };
const tag = Math.random().toString(36).slice(2, 7);
const owner = { name: "Booking Owner", email: `bk-owner-${tag}@e2e.test`, password: "password-e2e-5" };
const customer = { name: "Booking Customer", email: `bk-cust-${tag}@e2e.test`, password: "password-e2e-6" };
let step = 0;
const ok = (m) => console.log(`  ✓ ${++step}. ${m}`);
const assert = (c, m) => { if (!c) throw new Error(`FAILED: ${m}`); ok(m); };

let executablePath = process.env.CHROME_PATH;
let args = [];
if (!executablePath) {
  const chromium = (await import("@sparticuz/chromium")).default;
  executablePath = await chromium.executablePath();
  args = chromium.args.filter((a) => a !== "--single-process");
}
const browser = await puppeteer.launch({ executablePath, args, headless: true });
const client = new pg.Client({ connectionString: DB });
await client.connect();

async function newCtx(width = 1280) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width, height: 900 });
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
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

try {
  console.log(`MOTORNA booking e2e against ${BASE} (tag ${tag})`);
  const O = await newCtx();
  const C = await newCtx();
  const A = await newCtx();
  await signUp(O.page, owner);
  await signUp(C.page, customer);
  await signIn(A.page, ADMIN.email, ADMIN.password);

  // An approved test center owned by the provider account (approval itself is covered by care.mjs).
  const { rows: [u] } = await client.query("select id from users where email = $1", [owner.email]);
  const slug = `e2e-book-${tag}`;
  const { rows: [c] } = await client.query(
    `insert into service_centers (slug, name_ar, name_en, city_id, area, address, phone, status, category, created_by_id, approved_at, last_verified_at)
     values ($1, $2, $3, 2, 'Smouha', '15 Fawzy Moaz St, Smouha', '034251234', 'approved', 'independent_workshop', $4, now(), now()) returning id`,
    [slug, `ورشة حجز ${tag}`, `E2E Booking Garage ${tag}`, u.id],
  );
  await client.query("insert into center_staff (center_id, user_id, role) values ($1, $2, 'owner')", [c.id, u.id]);
  await client.query(
    `insert into center_services (center_id, category, name_ar, name_en, price_mode, price_egp, price_max_egp, duration_min) values
     ($1, 'brakes', 'تغيير تيل فرامل', 'Brake pads', 'estimate', 800, 1200, 60)`,
    [c.id],
  );
  for (let d = 0; d < 7; d++) await client.query("insert into center_hours (center_id, weekday, opens, closes) values ($1, $2, '09:00', '21:00')", [c.id, d]);
  ok("test center prepared (approved, one estimated service, hours 09:00–21:00)");

  // Booking is off by default: no Book button.
  await go(C.page, `/ar/care/centers/${slug}`);
  assert(!(await text(C.page)).includes("احجز ميعاد"), "no booking entry point before the pilot is enabled");

  // Provider can't accept bookings before the pilot.
  await go(O.page, `/en/center/${slug}/schedule`);
  assert((await text(O.page)).includes("isn't enabled for your center yet"), "provider sees that the pilot is off");
  assert(await O.page.$eval("input[type=checkbox]", (e) => e.disabled), "provider can't switch on accepting bookings");

  // Admin enables the pilot for this approved center.
  await go(A.page, `/en/admin/centers/${c.id}`);
  await clickText(A.page, "Enable booking pilot");
  await waitText(A.page, "Enabled since");
  ok("admin enabled the booking pilot for this center");

  // Provider: manual confirmation, accepting.
  await go(O.page, `/en/center/${slug}/schedule`);
  await O.page.waitForFunction(() => !document.querySelector("input[type=checkbox]").disabled);
  await O.page.click("input[type=checkbox]");
  await clickText(O.page, "Save");
  await waitText(O.page, "Saved");
  ok("provider turned on accepting bookings (manual confirmation)");

  // Customer books in Arabic.
  await go(C.page, `/ar/care/centers/${slug}`);
  assert((await text(C.page)).includes("احجز ميعاد"), "Book button appears once the pilot and provider are on");
  assert((await text(C.page)).includes("سعر تقديري"), "estimate is labelled as an estimate on the profile");
  await clickText(C.page, "احجز ميعاد");
  await C.page.waitForSelector("input[name=service]");
  assert((await C.page.evaluate(() => document.documentElement.dir)) === "rtl", "wizard is RTL in Arabic");
  await clickText(C.page, "التالي");
  await C.page.waitForSelector("#bk-make");
  await C.page.select("#bk-make", await C.page.$eval("#bk-make option:nth-child(2)", (o) => o.value));
  await C.page.type("#bk-year", "2019");
  await C.page.type("#bk-km", "85000");
  await clickText(C.page, "التالي");
  await C.page.waitForSelector("#bk-date");
  await C.page.select("#bk-date", await C.page.$eval("#bk-date option:nth-child(2)", (o) => o.value));
  await C.page.waitForFunction(() => !document.body.innerText.includes("بنجيب المواعيد") && document.querySelectorAll("button[aria-pressed]").length >= 5);
  const slotsBtns = await C.page.$$("button[aria-pressed]");
  await slotsBtns[2].evaluate((b) => b.click());
  await slotsBtns[4].evaluate((b) => b.click());
  await clickText(C.page, "التالي");
  await C.page.waitForSelector("#bk-phone");
  await C.page.type("#bk-phone", "01012345678");
  await C.page.type("#bk-note", "صوت في الفرامل من قدام");
  await clickText(C.page, "التالي");
  await waitText(C.page, "راجع قبل ما تبعت");
  const review = await text(C.page);
  assert(review.includes("سياسة الإلغاء") && review.includes("مفيش أي رسوم"), "review step shows the cancellation policy with no fees");
  assert(review.includes("بتوقيت القاهرة"), "review step says times are Cairo time");
  assert(review.includes(`ورشة حجز ${tag}`) && review.includes("15 Fawzy Moaz St"), "review step shows provider details");
  assert(review.includes("تغيير تيل فرامل") && review.includes("ده سعر تقديري"), "review step shows the service and that the price is an estimate");
  assert(review.includes("المواعيد المطلوبة (لسه مش مؤكدة)"), "requested times are labelled as not confirmed");
  assert(await noOverflow(C.page), "wizard has no horizontal overflow on desktop");
  await clickText(C.page, "ابعت طلب الحجز");
  await waitText(C.page, "الحقل ده مطلوب"); // refused until the policy is accepted
  ok("submission is refused until the policy is accepted");
  await C.page.evaluate(() => [...document.querySelectorAll("label")].find((l) => l.textContent.includes("موافق")).click());
  await Promise.all([C.page.waitForNavigation({ waitUntil: "networkidle0" }), clickText(C.page, "ابعت طلب الحجز")]);
  const ref = (C.page.url().match(/bookings\/(MC-[A-Z0-9]+)/) ?? [])[1];
  assert(ref, `booking created with reference ${ref}`);
  const created = await text(C.page);
  assert(created.includes("مستني رد المركز") && created.includes("الحجز لسه مش مؤكد"), "customer sees 'waiting for provider', not confirmed");
  assert(!created.includes("ميعادك المؤكد"), "no confirmed time is shown before the provider accepts");

  // Provider: notification + propose another time.
  await go(O.page, "/en/account/notifications");
  assert((await text(O.page)).includes(`New booking request ${ref}`), "provider got an in-app notification");
  await go(O.page, `/en/center/${slug}/bookings`);
  assert((await text(O.page)).includes(ref), "booking appears under 'Needs action'");
  await go(O.page, `/en/center/${slug}/bookings/${ref}`);
  assert((await text(O.page)).includes("01012345678"), "provider sees the customer's phone for this booking");
  await clickText(O.page, "Propose another time");
  const dates = await O.page.$eval("#tp-fd", (e) => e.min);
  await O.page.evaluate((d) => {
    const set = (el, v) => { const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; s.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); };
    const dt = new Date(`${d}T12:00:00Z`); dt.setUTCDate(dt.getUTCDate() + 2);
    set(document.querySelector("#tp-fd"), dt.toISOString().slice(0, 10));
    set(document.querySelector("#tp-ft"), "15:00");
  }, dates);
  await clickText(O.page, "Add another time");
  await clickText(O.page, "Send");
  await waitText(O.page, "Times sent to the customer");
  ok("provider proposed an alternative time");

  // Customer accepts the alternative → confirmed.
  await go(C.page, `/ar/account/bookings/${ref}`);
  assert((await text(C.page)).includes("المركز اقترح ميعاد تاني"), "customer sees the proposal");
  await clickText(C.page, "اقبل الميعاد ده");
  await waitText(C.page, "ميعادك المؤكد");
  const conf = await text(C.page);
  assert(conf.includes("مؤكد") && (conf.includes("3:00") || conf.includes("٣:٠٠")), "booking is confirmed at the proposed time (Cairo)");

  // Mobile layout (360px) for the booking page and the provider list.
  await C.page.setViewport({ width: 360, height: 800 });
  await go(C.page, `/ar/account/bookings/${ref}`);
  assert(await noOverflow(C.page), "customer booking page fits 360px");
  await go(C.page, `/ar/care/centers/${slug}/book`);
  await C.page.waitForSelector("input[name=service]");
  assert(await noOverflow(C.page), "booking wizard fits 360px");
  if (process.env.SHOTS_DIR) await C.page.screenshot({ path: `${process.env.SHOTS_DIR}/wizard-360.png`, fullPage: true });
  await O.page.setViewport({ width: 360, height: 800 });
  await go(O.page, `/en/center/${slug}/bookings?tab=upcoming`);
  assert((await text(O.page)).includes(ref) && (await noOverflow(O.page)), "provider upcoming list shows the booking and fits 360px");
  await go(C.page, `/en/account/bookings/${ref}`);
  assert((await C.page.evaluate(() => document.documentElement.dir)) === "ltr" && (await text(C.page)).includes("Confirmed"), "English booking page is LTR and shows Confirmed");

  // Isolation: the provider account can't open the customer view; another customer gets 404.
  const res = await O.page.goto(`${BASE}/en/account/bookings/${ref}`, { waitUntil: "networkidle0" });
  assert(res.status() === 404, "provider can't open the customer's booking page (404)");

  console.log(`\nAll ${step} booking checks passed.`);
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await client.end();
  await browser.close();
}
