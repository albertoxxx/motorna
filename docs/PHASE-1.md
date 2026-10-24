# Phase 1 — Functional marketplace MVP

_Completed 2026-10-24_

## Objective

A buyer can browse and filter real listings in Arabic or English, open one, save it, and message the seller. A seller can sign up, list a car with photos, edit it, and submit it. An admin approves or rejects listings and handles reports. Permissions are enforced on the server.

## What was built

**Design system** — color/type/spacing tokens (`globals.css`), Button, Field/Input/Select/Textarea/Checkbox, Badge, Notice, EmptyState, Skeleton, Toast, Dialog/Drawer, Pagination. IBM Plex Sans Arabic + Inter, logical CSS properties for RTL/LTR, visible focus, reduced-motion support. Brand element: the Egyptian private-plate band, used for the logo and the price tag on listing pages.

**Pages** — home, browse/search, car details, seller profile, sell (4-step), edit listing, my listings, saved cars, messages + thread, profile (incl. password change), sign in/up, forgot/reset password, admin overview, moderation queue, reports, audit log, about, how we review listings, FAQ, contact, terms (draft), privacy (draft), 404, error. All in `/ar` and `/en`.

**Listings** — server-validated input (Arabic digits and commas accepted), make/model consistency check, DB CHECK constraints on price/mileage/year/engine, slug URLs, lifecycle `draft → pending_review → published | rejected → sold | archived`, price history, soft delete. Price-only edits stay live; other edits or a new cover photo send the listing back to review.

**Images** — uploaded one at a time to `/api/listings/[id]/images`; decoded with sharp (rejects non-images regardless of extension), auto-rotated, EXIF/GPS stripped, re-encoded to WebP (1600px + 640×480 thumb). 3–20 per listing, 10 MB max, 640 px min width. Reorder, set cover, delete.

**Search** — filters for keyword, make, model, price range, year range, max mileage, condition, transmission, fuel, body, governorate; five sort orders; pagination; URL-driven and shareable. Filtered permutations are `noindex`.

**Trust & safety** — every listing reviewed before publishing; report listing (one open report per user per listing); admin take-down and user suspension (revokes sessions, hides listings); every admin action audit-logged; scam warnings on listing and message pages; phone number shown only to signed-in users and only if the seller opts in.

**Security** — Better Auth sessions in Postgres; all mutations re-check session, role, ownership and listing state on the server; rate limits (sign-in 5/min, sign-up 5/10 min, reset 3/10 min, messages 30/10 min, new conversations 10/h, listings 10/day, uploads 120/h, reports 10/h, phone reveals 30/h) stored in Postgres so they work across instances; open-redirect protection on `?next=`; security headers; suspended users can't create sessions.

**SEO** — per-page metadata, hreflang alternates, canonical URLs, Open Graph images for listings, `Car` JSON-LD with only real fields, sitemap, robots.

## Verification

| Check | Result |
|---|---|
| `tsc --noEmit` | Clean |
| `eslint` | Clean |
| `next build` | Succeeds |
| Unit + integration tests (`npm test`) | 34 passing — validation, search parsing, state machine, slugs, open redirects, formatting; server actions against real Postgres for ownership, admin-only moderation, suspension, messaging permissions, favorites, phone opt-in, report de-duplication, DB constraints, rate limiting |
| End-to-end UI smoke (`tests/e2e/smoke.mjs`) | 23 checks passing — sign-up → create listing → upload 3 photos → submit → hidden from public (404) → admin approves → buyer searches, saves, messages, reports → buyer blocked from seller's edit page, admin area, and photo upload (403/401) → seller replies → report reaches admin → Arabic RTL with no horizontal overflow at 390 px |

## Needed before production

| Item | Why |
|---|---|
| Production Postgres (Supabase or Neon) | `DATABASE_URL`; run `db:migrate` + `db:seed:reference` |
| S3-compatible storage (Supabase Storage / R2) | `STORAGE_DRIVER=s3` — the driver is an integration boundary that currently refuses to run; local disk is dev-only |
| Email provider (Resend or SMTP) | Password reset. Currently logs to console; sending in production fails loudly by design |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_SITE_URL` | Per environment |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Shown on the contact page |
| Legal review | Terms and privacy are marked draft; Egyptian counsel should review against Law 151/2020 and consumer-protection rules |
| First admin account | Promote a user: `UPDATE users SET role = 'admin' WHERE email = '…';` |

## Known limitations

- No email verification at sign-up yet (planned with the email provider).
- No phone-number OTP; phone numbers are self-declared and labelled as such.
- Keyword search uses `ILIKE`; move to Postgres full-text/trigram as listings grow.
- Draft listing photos are served from unguessable URLs but are not access-controlled.
- Unsuspending a user doesn't automatically republish their archived listings.
- Pages read the session in the header, so nothing is statically cached yet (Phase 4 performance pass).
- Demo seed uses illustrated placeholder photos labelled "Demo image".

## Next: Phase 2 — trust and intelligence

Recommended order: (1) storage + email in a staging deploy so real sellers can try it in Alexandria, (2) seller identity verification and inspection workflow, (3) Fair Price estimates from comparable active listings with honest confidence levels, (4) comparison, (5) saved searches and alerts, (6) AI assistant and AI listing creator (needs `ANTHROPIC_API_KEY`).
