# MOTORNA — product audit and route inventory

Date: 2026-10-25. Branch: `product-audit` (not deployed). Production at the time: commit `a13faf2`, with migrations through 0008.

**How this was checked**
- The code was inspected route by route.
- An automated crawler (`tests/e2e/audit-crawl.mjs`) visited **50 route variants × Arabic and English × 360 / 390 / 430 / 768 / 1280 px = 500 page loads**, signed in as the right account for each page (anonymous, seller, customer, provider owner, admin). For every page load it recorded:
  - the HTTP status;
  - the `dir` and `lang` attributes;
  - horizontal overflow, and any element sticking out of the viewport;
  - broken images;
  - console errors and page errors;
  - leftover template tokens.
- Screenshots were reviewed for the key pages.
- All results below are **local** (production build against the local demo database), unless stated otherwise.

Status legend: **Implemented** · **Incomplete** (works, with gaps) · **Planned** (designed, not built) · **Unavailable** (not built, not planned yet).

## 1. Route inventory

### Public

| Route | Purpose | Access | Main parts / data | Status | Verified defects → fix | Tests |
|---|---|---|---|---|---|---|
| `/[lang]` | Home: search, latest cars, makes, budgets, how it works, safety, Care promo | Public | `search-panel`, `listing-card`; live counts | Implemented | None in crawl | smoke e2e, crawl |
| `/[lang]/cars` | Search and results, with 11 filters, 5 sorts, pagination of 24, chips, "back to results" memory | Public | `filters`, `filter-chips`, `pagination`; `searchListings` | Implemented | None | `search.test`, smoke, crawl |
| `/[lang]/cars/[slug]` | Car details: gallery, price, specs, seller, phone consent, contact, report, share, similar cars | Public (published only, otherwise 404) | `gallery`, `contact-panel`, `trust-panel`, `report-button` | Implemented | **English at 360/390 px overflowed by 40–70 px.** A no-wrap "I have an account — sign in" button forced the column wider. **Fixed.** | smoke, crawl |
| Make/model browsing | Uses `/cars?make=&model=` plus home make shortcuts | Public | — | Implemented (no separate pages) | — | `search.test` |
| `/[lang]/sellers/[id]` | Public seller page with live listings | Public | `getPublicSeller` | Implemented ("not verified" shown honestly) | None | crawl |
| `/[lang]/sell` | Entry to the listing form | Sign-in (redirects back after sign-in) | `listing-form` | Implemented | None | smoke |
| `/[lang]/faq`, `/about`, `/contact`, `/verification` | Trust and support content | Public | `content/pages.ts`, `static-page` | Implemented | FAQ had nothing on bookings → **added** | crawl |
| `/[lang]/terms`, `/privacy` | Legal drafts, with a visible "draft" notice | Public | `content/pages.ts` | Incomplete (needs legal review) | Didn't cover Care, bookings, provider data or notifications → **added sections** (still marked draft) | crawl |
| `/[lang]/care` | Care directory: 3 provider types, filters, counts | Public (approved centers only) | `approvedCenters`, `center-card` | Implemented | None | `care.test`, care e2e |
| `/[lang]/care/centers/[slug]` | Provider profile: verification scope and date, services with price type, makes, photos, hours, reviews, "Book" when pilot is on | Public (approved only) | `publicCenterBySlug`, `centerBookable` | Implemented | None | care / booking e2e |
| `/[lang]/care/apply` | Provider application | Sign-in | `center-profile-form` | Implemented | None | `care.test`, care e2e |
| `/[lang]/care/centers/[slug]/book` | Booking wizard | Sign-in, pilot on, provider accepting | `booking-wizard` | Implemented (pilot off in production) | None | booking e2e |
| `/[lang]/auth/*` | Sign in, sign up, forgot password, reset password | Public | Better Auth | Implemented (reset email needs a domain) | None | `email.test`, smoke |
| Unknown paths | 404 | Public | `[lang]/not-found` | Implemented | **Unbranded English Next.js page, with no `lang`/`dir`.** → **Fixed:** localized catch-all, real 404 status | crawl (expects 404) |

### Signed-in customer and seller

| Route | Purpose | Status | Verified defects → fix |
|---|---|---|---|
| `/account/profile` | Name, phone, governorate | Implemented | — |
| `/account/listings` | My listings with status (draft, in review, published, rejected/taken down with reason, sold, archived), fix-and-resubmit | Implemented | No views/analytics (no data collected) → Unavailable |
| `/account/listings/[id]/edit` | Edit listing (multi-step, preview card, colour list) | Implemented | — |
| `/account/favorites` | Saved cars | Implemented | — |
| `/account/messages`, `/account/messages/[id]` | Conversations (participants only) | Implemented | — |
| `/account/notifications` | In-app notifications | Implemented | — |
| `/account/bookings`, `/account/bookings/[ref]` | Booking history, status, timeline, actions, confirmation, review, problem report | Implemented | **Not reachable from the header menu** → **added "My bookings"** |
| `/account/garage` | Saved vehicles and service history | Implemented | — |
| Saved searches | — | Unavailable | — |
| Listing drafts | `draft` status, saved by the form | Implemented | — |
| A separate "suspended" listing state | Taken-down listings show as rejected with the reason; a suspended user's live listings are archived | Incomplete (no distinct label) | Recommend a "taken down" label (P3) |

### Service provider (`/center/...`; staff only, otherwise redirected)

| Route | Purpose | Status | Verified defects → fix |
|---|---|---|---|
| `/center` | Goes to the user's center | Implemented | — |
| `/center/[slug]` | Application checklist; profile, services (fixed/estimate/quote, bookable), makes, photos, equipment, technicians, hours, documents, team | Implemented | **Hours editor overflowed by 38 px at 360 and 8 px at 390, in both languages.** → **Fixed** |
| `/center/[slug]/bookings`, `/bookings/[ref]` | Requests, upcoming, history; accept, propose, ask, decline, check-in, complete, no-show, cancel | Implemented | — |
| `/center/[slug]/schedule` | Booking settings, closures | Implemented | — |
| `/center/[slug]/reports` | Monthly bookings, commission by status, settlements | Implemented | — |

### Admin (`role = admin`; enforced on the server)

| Route | Purpose | Status | Verified defects → fix |
|---|---|---|---|
| `/admin` | Dashboard tiles | Implemented | Showed only listings, reports and users → **added center applications, open disputes, bookings waiting** |
| `/admin/listings` | Moderation queue | Implemented | — |
| `/admin/reports` | Listing reports, take-down, suspend | Implemented | — |
| `/admin/users` | **New:** user directory, search, suspended filter, suspend/reinstate with a reason | Implemented (new) | Previously users could only be suspended from a report |
| `/admin/centers`, `/admin/centers/[id]` | Application review, documents, checklist, status, booking pilot switch | Implemented | — |
| `/admin/bookings`, `/admin/bookings/[ref]` | All bookings, disputes, resolution, review moderation | Implemented | — |
| `/admin/commission`, `/admin/commission/[centerId]` | Agreements, ledger, adjustments, settlements | Implemented | — |
| `/admin/audit` | Audit log (append-only) | Implemented | — |
| Admin notifications page | Uses the same bell and notifications page | Implemented | — |

### API and system

| Route | Purpose | Access |
|---|---|---|
| `/api/auth/[...all]` | Better Auth | Public, rate limited |
| `/api/listings/[id]/images` | Image upload (re-encoded, EXIF stripped) | Owner |
| `/api/care/centers/[id]/credentials`, `/api/care/credentials/[id]` | Private documents | Owner/manager, admin |
| `/api/care/centers/[id]/photos` | Center photos | Owner/manager |
| `/api/cron/care` | Daily job (reminders, expiry, auto-confirm) | `CRON_SECRET`. Verified 200 on production after the secret was set |
| `/media/[...key]` | Local media in dev | — |
| `/sitemap.xml`, `/robots.txt` | SEO | Public. Sitemap lacked provider pages → **added approved centers** |

## 2. Defects ranked by severity and business impact

| # | Severity | Defect | Status |
|---|---|---|---|
| 1 | High (correctness) | Some SQL subqueries referenced the outer table without a table name. Without a join, Postgres matched the inner table's `id`. **Admin user counts came out wrong** (caught by a new test), and **the expiry scan started a transaction for every open booking on each read.** That was harmless because it is re-checked under a lock, but wasteful. | **Fixed** in all 7 places, with tests |
| 2 | High (trust/SEO) | Unknown URLs showed an unbranded English page without `lang`/`dir` | **Fixed** (branded and localized, status 404) |
| 3 | High (mobile) | Car page in English overflowed at 360/390 px | **Fixed** |
| 4 | Medium (provider mobile) | Hours editor overflowed at 360/390 px | **Fixed** |
| 5 | Medium (legal disclosure) | Privacy and terms didn't describe booking data shared with providers, provider documents or notifications | **Updated** (draft, needs a lawyer) |
| 6 | Medium (admin ops) | No user directory; dashboard missed the Care and booking queues | **Fixed** |
| 7 | Medium (discoverability) | "My bookings" missing from the header menu | **Fixed** |
| 8 | Low (SEO) | Approved provider pages not in the sitemap | **Fixed** |
| 9 | Data (production) | BMW X6 colour is free text "ابيض" | Seller edits it to **أبيض** from the list (owner workflow, §5) |
| 10 | Low | No distinct "taken down" label for sellers (shown as rejected with the reason) | Open (P3) |
| 11 | Low | No listing view analytics | Unavailable (needs a privacy-safe counter) |
| 12 | Low | No saved searches | Unavailable |
| 13 | Note | A global loading skeleton was tried and **reverted**: with streaming it turned every 404 into status 200. Any future loading states must be per-route and avoid detail pages. | Recorded |

The crawl found no broken images, no console errors, no wrong direction and no leftover tokens on any page.

## 3. Database and integration changes

- **This branch:** none. There are no migrations and no data changes.
- **External integrations still needed:**
  - A domain and verified email sender (Resend). Until then, email is off and the UI never claims it.
  - A staging Supabase project and Vercel Preview variables (steps in `CARE-BOOKING.md` §11).
  - A payment provider, only if online payment is ever wanted. Not planned now.
  - A professional support email and phone once there is a domain. Contact uses `CONTACT_EMAIL`.
- **Legal:** terms, privacy, the provider agreement and the commission contract need review by Egyptian counsel and an accountant.

## 4. Implementation sequence (next)

1. Real provider onboarding and the first pilot booking with a cooperating approved center.
2. Domain + email, so password reset, listing decisions and booking updates also go by email.
3. Per-route loading states for list pages only (`/cars`, `/care`, `/account/*`), keeping 404 status intact. Add a crawler check for this.
4. "Taken down" label in My listings; optional privacy-safe view counts.
5. Saved searches with in-app alerts.

## 5. BMW X6 listing (production): authorized correction

- **Current state** (read from the public page): colour "ابيض" (hand-typed, not the standard key), trim "M Sport" (the earlier "3000cc" was already corrected by the seller).
- **Workflow:** no direct database edit.
  1. The seller opens My listings → Edit.
  2. Chooses **أبيض** from the colour list.
  3. Optionally improves the Arabic description in the description step.
  4. Saves. The listing returns to review.
  5. An admin approves it in Moderation.
- The description is the seller's text. A rewritten version is published only if the seller submits it.

## 6. Tests on this branch (local)

| Check | Result |
|---|---|
| Unit and integration (`vitest`, against `motorna_test`) | **168 / 168 passed**, including a new admin directory test |
| E2E smoke (listings, auth, moderation, messaging) | **53 / 53** |
| E2E Care (application → approval → directory) | **44 / 44** (made robust to leftover test centers) |
| E2E booking (pilot → wizard → proposal → confirmation → isolation) | **30 / 30** (slot selection made robust) |
| Audit crawl (500 page loads) | **0 issues** after fixes; 404 now asserted as a 404 |
| `tsc`, `eslint`, `next build` | Clean |

**Nothing on this branch has been tested on staging or production.** On production, only the public pages were checked by fetching them after the previous deploy, and the cron job returned 200.
