/**
 * Route audit crawler: visits every page in Arabic and English at 360/390/430/768/1280 px, as the
 * right account, and records HTTP status, document direction, horizontal overflow, elements that
 * stick out of the viewport, broken images, console/page errors and unreplaced template tokens.
 *
 *   BASE_URL=http://localhost:3000 DATABASE_URL=postgres://…/motorna node tests/e2e/audit-crawl.mjs > audit.json
 *
 * Local only: it reads fixture ids (a listing, a conversation, a booking…) from the database.
 */
import puppeteer from "puppeteer-core";
import pg from "pg";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const DB = process.env.DATABASE_URL;
if (!DB || !/localhost|127\.0\.0\.1/.test(DB)) throw new Error("Local DATABASE_URL required");
const WIDTHS = (process.env.WIDTHS ?? "360,390,430,768,1280").split(",").map(Number);
const PW = { demo: "motorna-demo-2026", owner: "password-e2e-5", cust: "password-e2e-6" };

const db = new pg.Client({ connectionString: DB });
await db.connect();
const one = async (q, p = []) => (await db.query(q, p)).rows[0] ?? {};
const fx = {
  listing: (await one("select slug from listings where status='published' order by created_at desc limit 1")).slug,
  karimListing: (await one("select l.id from listings l join users u on u.id=l.seller_id where u.email='karim@example.com' limit 1")).id,
  karimId: (await one("select id from users where email='karim@example.com'")).id,
  conv: (await one("select c.id from conversations c join users u on u.id=c.buyer_id or u.id=c.seller_id where u.email='karim@example.com' limit 1")).id,
  approvedCenter: (await one("select slug from service_centers where status='approved' order by created_at limit 1")).slug,
  appliedCenter: (await one("select id from service_centers where status in ('applied','under_review') limit 1")).id,
  booking: await one(`select b.reference, c.slug, c.id center_id, cu.email cust, ow.email owner from bookings b join service_centers c on c.id=b.center_id join users cu on cu.id=b.customer_id
                      join center_staff s on s.center_id=c.id and s.role='owner' join users ow on ow.id=s.user_id order by b.created_at desc limit 1`),
};
await db.end();

const routes = [
  // [path, account]
  ["", null], ["/cars", null], ["/cars?make=toyota&sort=price_asc", null], [`/cars/${fx.listing}`, null], [`/sellers/${fx.karimId}`, null],
  ["/sell", null], ["/faq", null], ["/about", null], ["/contact", null], ["/verification", null], ["/terms", null], ["/privacy", null],
  ["/care", null], [`/care/centers/${fx.approvedCenter}`, null], ["/care/apply", null],
  ["/auth/sign-in", null], ["/auth/sign-up", null], ["/auth/forgot-password", null], ["/auth/reset-password", null], ["/this-page-does-not-exist", null],
  ["/account/profile", "karim"], ["/account/listings", "karim"], [`/account/listings/${fx.karimListing}/edit`, "karim"], ["/account/favorites", "karim"],
  ["/account/messages", "karim"], [`/account/messages/${fx.conv}`, "karim"], ["/account/notifications", "karim"], ["/sell", "karim"],
  ["/account/bookings", "cust"], [`/account/bookings/${fx.booking.reference}`, "cust"], ["/account/garage", "cust"], [`/care/centers/${fx.booking.slug}/book`, "cust"],
  ["/center", "owner"], [`/center/${fx.booking.slug}`, "owner"], [`/center/${fx.booking.slug}/bookings`, "owner"], [`/center/${fx.booking.slug}/bookings/${fx.booking.reference}`, "owner"],
  [`/center/${fx.booking.slug}/schedule`, "owner"], [`/center/${fx.booking.slug}/reports`, "owner"],
  ["/admin", "admin"], ["/admin/users", "admin"], ["/admin/users?suspended=1", "admin"], ["/admin/listings", "admin"], ["/admin/reports", "admin"], ["/admin/centers", "admin"], [`/admin/centers/${fx.appliedCenter}`, "admin"],
  ["/admin/bookings", "admin"], [`/admin/bookings/${fx.booking.reference}`, "admin"], ["/admin/commission", "admin"], [`/admin/commission/${fx.booking.center_id}`, "admin"], ["/admin/audit", "admin"],
];
const accounts = {
  karim: ["karim@example.com", PW.demo],
  admin: ["admin@example.com", PW.demo],
  owner: [fx.booking.owner, PW.owner],
  cust: [fx.booking.cust, PW.cust],
};

let executablePath = process.env.CHROME_PATH;
let args = [];
if (!executablePath) {
  const chromium = (await import("@sparticuz/chromium")).default;
  executablePath = await chromium.executablePath();
  args = chromium.args.filter((a) => a !== "--single-process");
}
const browser = await puppeteer.launch({ executablePath, args, headless: true });
const ctxs = {};
async function ctxFor(acc) {
  const key = acc ?? "anon";
  if (ctxs[key]) return ctxs[key];
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);
  if (acc) {
    const [email, password] = accounts[acc];
    await page.goto(`${BASE}/en/auth/sign-in`, { waitUntil: "networkidle0" });
    await page.type("#email", email);
    await page.type("#password", password);
    await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.click("button[type=submit]")]);
  }
  ctxs[key] = page;
  return page;
}

const results = [];
for (const [path, acc] of routes) {
  const page = await ctxFor(acc);
  for (const locale of ["ar", "en"]) {
    for (const width of WIDTHS) {
      const errors = [];
      const onConsole = (m) => m.type() === "error" && errors.push(m.text().slice(0, 200));
      const onPageError = (e) => errors.push(`pageerror: ${String(e).slice(0, 200)}`);
      page.on("console", onConsole);
      page.on("pageerror", onPageError);
      await page.setViewport({ width, height: 900 });
      let status = 0;
      try {
        const res = await page.goto(`${BASE}/${locale}${path}`, { waitUntil: "networkidle0" });
        status = res?.status() ?? 0;
      } catch (e) {
        errors.push(`goto: ${e.message}`);
      }
      await new Promise((r) => setTimeout(r, 150));
      const info = await page.evaluate(() => {
        const vw = window.innerWidth;
        const out = [];
        const scrollParent = (el) => {
          for (let p = el.parentElement; p; p = p.parentElement) {
            const s = getComputedStyle(p);
            if (/(auto|scroll|hidden)/.test(s.overflowX) && p !== document.body && p !== document.documentElement) return true;
          }
          return false;
        };
        for (const el of document.querySelectorAll("body *")) {
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height) continue;
          const s = getComputedStyle(el);
          if (s.position === "fixed" || s.visibility === "hidden") continue;
          if ((r.right > vw + 1 || r.left < -1) && !scrollParent(el)) {
            out.push(`${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}.${String(el.className).split(" ").slice(0, 3).join(".")} [${Math.round(r.left)}..${Math.round(r.right)}] "${(el.textContent || "").trim().slice(0, 40)}"`);
          }
        }
        const broken = [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.getClientRects().length).map((i) => i.src.slice(0, 120));
        const text = document.body.innerText;
        const tokens = [...new Set((text.match(/\{[a-zA-Z]+\}|undefined|\[object Object\]|NaN/g) || []))];
        const truncated = [...document.querySelectorAll("h1,h2,h3,button,a,label")].filter((e) => e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflow === "hidden" && !/truncate|line-clamp/.test(e.className)).length;
        return {
          dir: document.documentElement.dir,
          lang: document.documentElement.lang,
          overflow: document.documentElement.scrollWidth - vw,
          offenders: out.slice(0, 6),
          broken,
          tokens,
          truncated,
          h1: document.querySelector("h1")?.textContent?.trim().slice(0, 60) ?? null,
          title: document.title,
        };
      });
      page.off("console", onConsole);
      page.off("pageerror", onPageError);
      results.push({ path, locale, width, acc, status, expected: path === "/this-page-does-not-exist" ? 404 : 200, ...info, errors: [...new Set(errors)].slice(0, 5), finalUrl: page.url().replace(BASE, "") });
    }
  }
  process.stderr.write(`done ${path} (${acc ?? "anon"})\n`);
}
await browser.close();
console.log(JSON.stringify({ fixtures: fx, results }, null, 1));
