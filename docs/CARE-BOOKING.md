# MOTORNA Care — booking and commission plan

Status: **Built on branch `care-booking` (2026-10-25), not deployed.** Migration `0008_care_booking` has not been run on production. The pilot is off for every center by default.

## 1. Audit — what exists vs. what's needed

| Need | Exists today | Gap |
|---|---|---|
| Provider types, verification, directory, profiles | ✓ `service_centers.category`, approval checklist, `last_verified_at`, filters (0006) | Show verification **scope + date** on the booking screens too |
| Services with price + duration | ✓ `center_services` (`fixed` / `quote`, `duration_min`) | Add **estimated** price (from–to) and a per-service "bookable" switch |
| Operating hours | ✓ `center_hours` (one window per weekday) | Add slot interval, capacity, notice, advance window, blackout periods |
| Staff roles | ✓ `center_staff` owner / manager / technician, server-checked | Booking permissions per role (§4) |
| In-app notifications | ✓ `notifications` + bell (0007), dedupe | New booking kinds; reminders need a scheduled job |
| Email | Code exists (Resend) but **not operational** (no verified domain) | Booking emails stay off; UI never claims email/SMS/push |
| Audit log | ✓ `audit_logs`, append-only trigger | Reuse for every booking and commercial change |
| Booking state machine | Pure function in `src/lib/booking.ts` (old 7-state draft, unused) | Replace with the 13-state machine below |
| Bookings, vehicles, completion, reviews, disputes, commission | ✗ none | All new tables (§3) |
| Staging environment | ✗ none (only local prod-like DB + production) | Required before production (§8) |
| Payments | ✗ none, by design | Not built. Customers pay the provider directly |

## 2. Booking states and transitions

Times are stored in UTC and shown in **Africa/Cairo**.

| State | Meaning | Holds capacity? |
|---|---|---|
| `pending_provider` | Customer submitted; waiting for the provider | Slot mode: yes. Manual mode: no |
| `alternative_proposed` | Provider proposed other time(s); customer must answer | Yes (the proposed time) |
| `awaiting_customer` | Provider asked the customer a question | No |
| `confirmed` | Provider accepted a specific time | Yes |
| `checked_in` | Customer arrived | Yes |
| `completed` | Provider recorded the service as done | — |
| `declined` | Provider declined before confirming (reason required) | — |
| `cancelled_customer` | Customer cancelled | — |
| `cancelled_provider` | Provider cancelled after confirming, or couldn't do the service (reason required) | — |
| `no_show` | Customer didn't come (only after start + 30 min) | — |
| `expired` | Nobody answered before the requested time passed | — |
| `disputed` | A problem report is open; admin resolves it | — |

"Confirmed" is shown **only** after the provider accepts. A requested time is always labelled "Requested time — not confirmed".

| Action | From | To | Who |
|---|---|---|---|
| submit | — | pending_provider | customer (signed in) |
| accept | pending_provider | confirmed | owner / manager |
| propose | pending_provider, awaiting_customer | alternative_proposed | owner / manager (1–3 times) |
| ask | pending_provider | awaiting_customer | owner / manager |
| decline | pending_provider, awaiting_customer | declined | owner / manager |
| reply | awaiting_customer | pending_provider | customer |
| acceptAlternative | alternative_proposed | confirmed | customer (slot re-checked) |
| declineAlternative | alternative_proposed | pending_provider (new times) | customer |
| reschedule | confirmed | pending_provider (new times, slot released) | customer, before the cutoff |
| cancel | pending_provider, alternative_proposed, awaiting_customer, confirmed | cancelled_customer | customer (after the cutoff it is recorded as a **late cancellation**) |
| providerCancel | confirmed, checked_in | cancelled_provider | owner / manager |
| checkIn | confirmed | checked_in | any staff, from 2 h before the start |
| complete | checked_in | completed | any staff (records attendance, completion, final amount) |
| noShow | confirmed | no_show | any staff, after start + 30 min |
| expire | pending_provider, alternative_proposed, awaiting_customer | expired | system, once the earliest open time has passed |
| openDispute | completed (≤ 14 days), no_show (≤ 7 days), cancelled_provider (≤ 7 days) | disputed | customer; provider can dispute a late cancellation |
| resolve | disputed | completed / no_show / cancelled_provider / cancelled_customer | admin, with a note |

All transitions go through one pure function, `transition()`, in `src/lib/booking.ts`. The server action re-checks the actor's role, locks the booking row (`SELECT … FOR UPDATE`), checks the expected current status (optimistic guard), writes an append-only `booking_events` row plus `audit_logs`, and sends notifications in the same transaction.

**Double booking.** Creating, accepting, accepting an alternative and rescheduling all lock the center row (`FOR UPDATE`). They then count the overlapping bookings that hold capacity against the center's capacity, so two customers can't take the same last seat. **Duplicate submissions** are blocked by a unique `request_key` (generated by the form) per customer. A customer can't hold two open bookings at the same center for overlapping times.

## 3. Migration `0008_care_booking` (additive only)

Nothing is dropped and no existing row changes. The only edit to an existing object is replacing the `center_services_price` check with a wider one that every current row already satisfies.

**Enum changes**
- `price_mode` gets `estimate`.
- New enums: `booking_status`, `booking_mode` (slots, manual), `time_option_kind` (requested, proposed), `time_option_state` (open, accepted, declined, withdrawn), `dispute_kind`, `dispute_status`, `commission_basis` (percent, fixed), `agreement_status` (draft, active, ended), `ledger_status` (pending_verification, confirmed, disputed, payable, settled, waived), `settlement_status` (open, issued, settled, void).

**Changes to existing tables**
- `center_services`: new columns `price_max_egp` (estimate upper bound) and `bookable` (default true).

**New tables**

| Table | Purpose / key rules |
|---|---|
| `center_booking_settings` | One row per center. `pilot_enabled` (admin only), `accepting` (provider), mode, slot interval, capacity, min notice (hours), max advance (days), cancel cutoff (hours), policy text ar/en |
| `center_closures` | Blackout periods: start, end, reason |
| `customer_vehicles` | user, make, model, year, mileage, nickname. Visible only to the owner, and to a provider through a booking snapshot |
| `bookings` | `reference` (MC-XXXXXX, unique), center, service, customer, vehicle, snapshots (service name, price mode/amounts, duration, vehicle make/model/year/mileage, cancel cutoff), `starts_at` / `ends_at` (only set once confirmed), status, contact name/phone, notes, cancel/decline reason, `late_cancel`, `request_key` (unique per customer), timestamps |
| `booking_time_options` | Requested and proposed times, with their state. Keeps "requested" separate from "confirmed" |
| `booking_events` | Append-only status history (DB trigger blocks UPDATE/DELETE) |
| `booking_messages` | Short questions and replies tied to the booking (for "ask" / "reply") |
| `service_completions` | One per booking: attended, completed, final amount, work summary, recorded by; customer confirmation time. This doubles as the customer's maintenance record |
| `center_reviews` | One per completed booking. Rating 1–5, comment, visible/hidden (admin, with a reason) |
| `booking_disputes` | Kind, description, status, prior status, outcome, resolution, who resolved it |
| `commission_agreements` | Per center: basis, percent (bps) or fixed EGP, service categories (null = all), effective from/to, exceptions, settlement schedule, contract reference, status. Active agreements are never edited: a change ends one and starts the next |
| `commission_ledger` | One row per completed booking (unique `booking_id`): agreement, reference, agreed price, completed amount, basis/rate snapshot, commission, provider and customer confirmation, status, settlement |
| `commission_adjustments` | Append-only (trigger): ledger row, ± amount, reason, admin |
| `commission_settlements` | Per center per period: totals, status, reference, settled date, received-payment note entered by an admin |

RLS stays on and `anon` / `authenticated` stay revoked on every table, as today. **Cancelled, declined, expired and no-show bookings never create a ledger row.** That rule lives in one function, and a DB trigger rejects a ledger row whose booking isn't `completed`.

## 4. Permissions

| | Customer | Technician | Manager / Owner | Admin |
|---|---|---|---|---|
| Create, cancel, reschedule, answer an alternative, confirm completion, review, dispute | own bookings | | | |
| See a booking (with customer phone + vehicle) | own | own center | own center | all |
| Accept, propose, ask, decline, provider-cancel | | | own center | |
| Check in, complete, no-show | | own center | own center | |
| Booking settings, closures, service bookability | | | own center (`accepting` only once the pilot is on) | pilot switch |
| Commission agreements, adjustments, settlements | | | read own | create / end / adjust / settle |
| Resolve a dispute, hide a review | | | | ✓ (not when the admin is that center's staff) |

Every check runs on the server. Lists are always filtered by `customer_id` or by center staff membership, and a booking that isn't yours returns 404.

## 5. Commission rules

1. A ledger row is created only when a booking reaches `completed` with a recorded final amount, **and** an agreement covering that service was active at completion time. Otherwise there's no row and no revenue.
2. The commission is the percent of the completed amount, or the fixed fee, capped at the completed amount. It is rounded to whole EGP and stored with a snapshot of the basis and rate.
3. The row starts as `pending_verification`. It becomes `confirmed` when the customer confirms completion, or 7 days after completion with no dispute (only the scheduled job does this).
4. `disputed` while a dispute is open. After resolution it goes back to `confirmed`, or to `waived` if the booking wasn't completed.
5. An admin closes a period into a settlement: confirmed rows become `payable`. When the admin records that the provider actually paid, they become `settled`. Nothing shows as collected before that.
6. Adjustments are append-only rows with a reason. The row's effective amount is the base plus its adjustments. Every commercial change is written to `audit_logs`.
7. Customers pay no booking fee. MOTORNA doesn't take the service payment. The `payments` table and an online-payment provider can be added later without changing the ledger.

## 6. Notifications and reminders

- In-app only. Recipients: the customer, and every active staff member of the center (owners and managers for actions they must take).
- New kinds: `booking_new`, `booking_confirmed`, `booking_declined`, `booking_alternative`, `booking_alternative_answered`, `booking_question`, `booking_reply`, `booking_cancelled`, `booking_completed`, `booking_reminder`, `booking_dispute`.
- Notifications are deduplicated per booking and recipient while unread.
- **Reminders and expiry** come from `/api/cron/care` (protected by `CRON_SECRET`) via a Vercel cron. On the Hobby plan that runs **once a day**, so the reminder is "your appointment is tomorrow", not "in 2 hours". The same job expires unanswered requests and auto-confirms ledger rows. Expiry is also applied when a booking is opened, so a stale request never looks active.

## 7. Screens

- **Customer:** "Book" on a provider profile (only when the pilot is on and the provider is accepting).
  - Wizard: service → vehicle → time → details → review. The review step shows the cancellation policy and what's shared with the provider.
  - Confirmation page with the reference.
  - `/account/bookings`, plus a detail page with timeline, actions, completion confirmation, review and problem report.
- **Provider:** `/center/[slug]/bookings`, with tabs for new, needs action, upcoming and history.
  - Booking detail with the customer, vehicle and actions.
  - `/center/[slug]/schedule` for settings and closures.
  - `/center/[slug]/reports` with monthly bookings, completion and commission.
- **Admin:**
  - `/admin/bookings`, covering all bookings and disputes.
  - `/admin/commission`, covering agreements, ledger, adjustments and settlements.
  - A booking pilot switch on the center review page.

## 8. Rollout

1. **Local:** unit tests (state machine, slots, commission), integration tests against `motorna_test` (races, isolation, ledger), and e2e with separate customer, provider and admin accounts in Arabic and English at 360 px and desktop.
2. **Staging (needed, not set up yet):** a second free Supabase project, plus Vercel **Preview** environment variables pointing at it. Preview deployments of `care-booking` then run against staging data. You create the project and paste its keys into Vercel. I never see them.
3. **Production:** SQL 0008 is run by you, verified, then "انشر". The pilot switch stays off for every center until you turn it on for a real, approved provider with a signed commission agreement.

## 9. Not included and needing outside work

- **Online payments, refunds, warranties:** not offered and never promised.
- **Email / SMS / push notifications:** not operational until a domain and providers exist.
- **Legal review:** the commission contract, provider terms, booking terms and privacy notice need review by an Egyptian lawyer and accountant (VAT / e-invoicing on commission).
- **Reminders:** daily only, because of the Vercel Hobby cron limit.

## 10. As built (branch `care-booking`)

**Migration:** `drizzle/0008_care_booking.sql`, with its update script `supabase/update-2026-10-25-care-booking.sql`.
- Additive only: the `estimate` price mode, two new `center_services` columns (`price_max_egp`, `bookable`), and 14 new tables.
- 4 integrity triggers:
  - `booking_events` is append-only.
  - `commission_adjustments` is append-only.
  - `commission_ledger`: rows are created only for completed bookings and start as `pending_verification`. Amounts are frozen, rows are never deleted, `settled` only from `payable`, and settled/waived rows are final.
  - Active or ended agreements are immutable.
- `supabase/setup.sql` was regenerated for fresh projects such as staging.
- On a prod-like copy, the update ran twice cleanly. Result: `9 | 14 | 4 | 0 | 1 | 0` (migrations | booking tables | guards | pilots enabled | listings kept | centers kept).

**Code**

| Area | Files |
|---|---|
| Rules (pure) | `src/lib/booking.ts`: state machine, Cairo time, slots and capacity, commission, schemas |
| Engine | `src/server/booking-engine.ts`: row locks, capacity checks, transitions with event and audit, notifications, ledger, daily job |
| Reads | `src/server/bookings.ts` |
| Actions | `src/server/actions/bookings.ts` (customer and provider), `src/server/actions/booking-admin.ts` (pilot, disputes, reviews, agreements, ledger, settlements) |
| Daily job | `GET /api/cron/care`. It needs `CRON_SECRET` and runs daily at 15:00 UTC via `vercel.json` |
| Customer UI | `/care/centers/[slug]/book` (wizard), `/account/bookings`, `/account/bookings/[ref]`, `/account/garage` |
| Provider UI | `/center/[slug]/bookings`, `/center/[slug]/bookings/[ref]`, `/center/[slug]/schedule`, `/center/[slug]/reports` |
| Admin UI | `/admin/bookings`, `/admin/bookings/[ref]`, `/admin/commission`, `/admin/commission/[centerId]`, plus the pilot switch on `/admin/centers/[id]` |

**Decisions in code**
- The completion confirmation and dispute window is 7 days.
  - A "confirm or report" reminder goes out on day 5.
  - Unanswered records auto-confirm after day 7.
- A late cancellation is a flag only (`late_cancel`). There is no fee, and none is shown.
- A provider can accept a requested time at short notice, but never over capacity.
- Proposals and slot-mode requests hold capacity until they are answered.
- A provider's "not completed" becomes `cancelled_provider` with the reason. Only owners and managers can do this.
- The customer's phone is visible to that center's staff while the booking is active, and for 30 days after it ends.

## 11. Testing in staging (before any production step)

1. **Create the staging database.** In Supabase, create a new free project (for example `motorna-staging`) in the same region as production.
   - In its SQL editor, run `supabase/setup.sql` (all migrations, reference data, RLS lock-down).
   - Create storage buckets `media` (public) and `care-private` (private).
   - Create S3 access keys under Storage → S3 connection.
2. **Point Vercel previews at staging.** In Vercel → Project → Settings → Environment Variables, add these with **Preview** scope only:
   - `DATABASE_URL`: the staging pooler URL.
   - `BETTER_AUTH_SECRET`: a new random value.
   - The `S3_*` variables for the staging project, plus `S3_PRIVATE_BUCKET=care-private`.
   - `CRON_SECRET`.
   - Leave `EMAIL_PROVIDER` unset.
   - Do not change the Production values.
3. **Deploy the preview.** Push branch `care-booking`. Vercel builds a Preview URL that uses staging data only.
4. **Create an admin.** Sign up on the preview with your admin email. In the staging SQL editor, run `update users set role = 'admin' where email = '<you>';`.
5. **Prepare a test center.** Sign up a second account as the provider and apply at `/care/apply`.
   - As admin, review and approve it. Use clearly fake test documents, on staging only.
   - Add hours and a bookable service.
6. **Enable the pilot.** As admin, open `/admin/centers/<id>` → "Enable booking pilot".
   - As the provider, open `/center/<slug>/schedule` → "Accept online bookings" → Save.
7. **Book as a customer.** With a third account, open the center page → "Book an appointment". Complete the wizard in Arabic, then in English. Check:
   - The review step shows the provider, service, price type, Cairo times, cancellation policy and data sharing.
   - After submitting, the booking shows "Waiting for the provider" and **no confirmed time**.
8. **Provider responses.** As the provider, open Bookings → the request:
   - Accept one request.
   - Propose another time on a second request.
   - Ask a question on a third.
   - Decline a fourth.
   - As the customer, accept or decline the proposal and reply to the question. Check the bell notifications on both sides.
9. **Cancellation.** Cancel one booking more than 12 h ahead (no flag). Cancel one inside 12 h: it shows "Late cancellation (no fee)".
10. **Completion and commission.**
    - As admin, open `/admin/commission/<id>` → create a draft agreement (for example 10%) → Activate.
    - As the provider, check in a confirmed booking and record completion with an amount. Check that the ledger row is "Awaiting verification", not paid.
    - As the customer, confirm completion: the ledger becomes "Confirmed". Leave a review.
11. **Dispute.** On another completed booking, report a problem as the customer. The booking becomes "Under review" and the ledger "Disputed". As admin, resolve it at `/admin/bookings/<ref>`.
12. **Settlement.** As admin, issue a settlement for the period: rows become "In a settlement". Record the payment with a reference: rows become "Settled". Confirm the provider sees this under Reports and can't record payments.
13. **Daily job.** Trigger it once:
    ```
    curl -H "Authorization: Bearer $CRON_SECRET" https://<preview-url>/api/cron/care
    ```
    It returns counts. A second call must not send duplicate reminders.
14. **Isolation.** A different provider and a different customer must get 404 on each other's booking URLs.
15. **Automated e2e.** Run `tests/e2e/booking.mjs` against the preview:
    - Set `BASE_URL`, plus `DATABASE_URL` set to the **staging** URL with `ALLOW_STAGING_DB=1`.
    - Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` for the staging admin.
    - The script refuses to run without `ALLOW_STAGING_DB=1` when the database is on Supabase.

Only after staging passes, and with your approval:
1. You run `supabase/update-2026-10-25-care-booking.sql` on production. Expected result: `9 | 14 | 4 | 0 | 1 | 0`.
2. Add `CRON_SECRET` to the Production environment variables.
3. Merge to main.

The pilot stays off until you enable it for a real, approved provider with a signed agreement.
