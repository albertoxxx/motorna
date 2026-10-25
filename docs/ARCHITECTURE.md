# MOTORNA — Architecture & Phase 0 Assessment

_Last updated: 2026-10-24_

## A. Current architecture and project status

- The only repository connected to this account (`albertoxxx/New-Repository`) is **My Aqar**, a property-installments app (single HTML page + Supabase). It contains no automotive code and is left untouched.
- MOTORNA is therefore a **greenfield** project, built in its own repository (`motorna`).
- Nothing to migrate, no existing user data at risk.

## B. Proposed product architecture

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 16 (App Router) + TypeScript + React 19** | SSR for SEO on listing pages, server actions for forms, one codebase for web. Deploys to Vercel. |
| Styling | **Tailwind CSS 4** + own component library (`src/components/ui`) | Token-driven design system, logical properties for RTL/LTR. |
| Database | **PostgreSQL 16** | Relational marketplace data, full-text search later, PostGIS-ready. Production host: Supabase Postgres (or Neon) — no lock-in. |
| ORM / migrations | **Drizzle ORM + drizzle-kit** | Typed SQL, plain SQL migrations committed to git, zero native binaries. (Prisma was considered; its engine binaries are a deployment liability.) |
| Auth | **Better Auth** (email + password, DB sessions, built-in rate limiting) | Self-hosted, sessions stored in our Postgres, phone-OTP and Google sign-in can be added as plugins. |
| File storage | `src/lib/storage` abstraction. **Local disk** in dev; **Supabase Storage / S3-compatible** driver in production | All images re-encoded server-side with `sharp` (validates the file, strips EXIF/GPS, resizes to WebP). |
| Email | `src/lib/email` abstraction. Dev: logs to console. Prod: Resend/SMTP once configured | Password reset, notifications. Not claimed as working until a provider is tested. |
| AI (Phase 2) | `src/lib/ai` boundary calling the Claude API server-side with structured outputs; every vehicle ID validated against the DB | Assistant, listing creator. |
| i18n | `/ar/...` (default, RTL) and `/en/...` (LTR) route prefix; typed dictionaries | SEO-friendly per language URLs, no client bundle cost. |
| Authorization | Data-access layer (`src/server/*`) — every query/mutation checks session + role + ownership on the server | The app connects to Postgres with a server-only role; clients never talk to the DB directly, so RLS is a second line of defence, not the primary one. |
| Rate limiting | Better Auth limiter for auth endpoints + Postgres-backed fixed-window limiter for messages, listings, reports | Works across serverless instances without Redis. |

Decisions taken (reversible): Cache Components is disabled for Phase 1 (session-heavy pages; revisit in Phase 4). Prices displayed with Western digits in Arabic UI (`ar-EG-u-nu-latn`), matching Egyptian marketplace convention — one config flag to change.

## C. Database schema (full design; ✅ = built in Phase 1)

**Identity & roles**
- ✅ `users` (Better Auth core + `role` [user | dealer | admin], `phone`, `show_phone`, `city_id`, `locale`, `suspended_at`)
- ✅ `sessions`, `accounts`, `verifications` (Better Auth)
- `dealerships`, `dealership_members` (Phase 3)
- `identity_verifications` (Phase 2; private documents, admin-only)

**Vehicle taxonomy**
- ✅ `vehicle_makes` (slug, name_en, name_ar, is_popular)
- ✅ `vehicle_models` (make_id → makes, slug, names, body_type)
- `vehicle_trims`, `vehicle_specifications` (Phase 2; only sourced data)
- ✅ `cities` (Egyptian governorates, launch flag for Alexandria)

**Listings**
- ✅ `listings` — seller_id → users, make_id, model_id, trim, year, mileage_km, price_egp, condition, transmission, fuel, body_type, color, engine_cc, title, description, city_id, area, status, rejection_reason, slug, published_at, sold_at, deleted_at. CHECK constraints on price (1 – 1,000,000,000 EGP), mileage (0 – 2,000,000 km), year (1950 – next year).
- ✅ `listing_images` (listing_id, storage keys, size, position)
- ✅ `listing_price_history` (feeds Fair Price + price-drop alerts later)
- `listing_verifications`, `inspections`, `inspection_findings` (Phase 2)
- `price_estimates`, `price_comparables` (Phase 2; comparables reference real listings only)

**Engagement**
- ✅ `favorites` (user_id, listing_id)
- ✅ `conversations` (listing_id, buyer_id, seller_id; unique per listing+buyer) and `messages`
- `saved_searches`, `notifications` (Phase 2)
- `offers` (state machine: pending → countered/accepted/rejected/withdrawn/expired), `appointments` (Phase 3)
- `reviews` (Phase 3; only from users with a recorded interaction)

**Trust & operations**
- ✅ `reports` (listing or user, reason, status open → reviewing → resolved/dismissed)
- ✅ `audit_logs` (actor, action, entity, metadata) — every admin action
- ✅ `rate_limit_buckets`
- `subscription_plans`, `subscriptions`, `payments` (Phase 3; payment status separate from subscription status, idempotent webhooks)
- `ownership_records`, `maintenance_records`, `service_reminders` (Phase 4)

Listing lifecycle: `draft → pending_review → published | rejected`; `published → sold | archived`; editing a published listing's details sends it back to review (price-only edits stay live and are logged to price history).

## D. Page and component structure

```
src/app/[lang]/
  page.tsx                     Home
  cars/page.tsx                Browse + search + filters (URL-driven)
  cars/[slug]/page.tsx         Car details
  sellers/[id]/page.tsx        Seller profile
  sell/page.tsx                Create listing (multi-step)
  account/                     profile, listings, listings/[id]/edit, favorites, messages, messages/[id]
  auth/                        sign-in, sign-up, forgot-password, reset-password
  admin/                       dashboard, listings (moderation queue), reports, audit
  about, contact, faq, terms, privacy, verification
src/components/ui/             Button, Input, Select, Textarea, Badge, Card, Skeleton, EmptyState, Toast, Dialog, Drawer
src/components/                Header, Footer, ListingCard, SearchPanel, Filters, Gallery, PlateTag …
src/server/                    data-access + actions (listings, search, favorites, messages, reports, admin)
src/lib/                       db, auth, storage, email, i18n, format, rate-limit, validation
drizzle/                       SQL migrations
scripts/seed.ts                Dev-only seed (taxonomy + demo listings, never run in production)
```

## E. First milestone — Phase 1 marketplace MVP

A visitor can browse and filter real listings in Arabic or English, open a listing, save it, and message the seller; a seller can sign up, create a listing with photos, edit it, and submit it; an admin can approve or reject it and handle reports — with server-side permissions, rate limits, and tests.

## F. Main risks

**Technical**
- Image storage cost and abuse → server-side re-encoding, size/count caps, per-user rate limits.
- Search performance at scale → indexed filters now; Postgres full-text / trigram in Phase 2.
- AI hallucinating listings or specs → structured outputs, DB validation of every ID, no free-text specs.

**Business**
- Cold start: listings are the product. Dealer onboarding in Alexandria (bulk upload, Phase 3) matters more than features.
- Fair Price needs data; it must show “low confidence / unavailable” honestly until enough comparables exist.
- Fraud (fake listings, deposit scams) is the #1 trust killer on Egyptian classifieds → moderation queue, reporting, phone reveal only for signed-in users, scam warnings on contact.
- Legal: Egypt’s Personal Data Protection Law (151/2020) and consumer-protection/e-commerce rules — terms, privacy policy and any verification claims need review by Egyptian counsel before launch.
- Payments/escrow: none integrated; the product must never imply it holds money.

## G. Environment configuration

| Variable | Needed for | Status |
|---|---|---|
| `DATABASE_URL` | Postgres | Local dev configured; production DB to be created |
| `BETTER_AUTH_SECRET` | Session signing | Generate per environment |
| `BETTER_AUTH_URL` / `NEXT_PUBLIC_SITE_URL` | Auth callbacks, canonical URLs | Set at deploy |
| `STORAGE_DRIVER` (`local` \| `s3`) + `S3_*` | Image storage | Local works; S3/Supabase Storage needs a bucket |
| `EMAIL_PROVIDER` + key | Password reset, alerts | Not configured — reset links log to server console in dev |
| `ANTHROPIC_API_KEY` | Phase 2 AI features | Not needed yet |

## In-app notifications (migration `0007_notifications`)

The `notifications` table has one row per item: `user_id`, `kind`, `data` jsonb, a locale-less `href`, `read_at`, and an optional `dedupe_key`.

- **Text:** rendered at display time from `kind` + `data` in the reader's language. Message notifications never contain the message text.
- **Link safety:** `href` must be a local path, enforced in code and by a DB check, so a notification can't become an open redirect.
- **What creates them:**
  - Listing approved, rejected or taken down (with the moderator's reason).
  - A new message. The `conv:<id>` dedupe key keeps one unread item per conversation, and it's marked read when the thread is opened.
  - Service-center status changes, sent to active owners and managers.
- **Where they show:** the header bell links to `/[lang]/account/notifications`, with an unread badge. Opening an item marks it read (only if it belongs to the caller) and redirects to its page. "Mark all as read" is available too.
- **Relation to email:** independent. In-app notices work with no email provider configured.
