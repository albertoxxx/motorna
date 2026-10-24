# MOTORNA Care — design proposal

Status: **Stage 1 built and extended** (directory, center pages, partner application workflow, admin review). Booking and payments are designed (§5, §13) but **not built or enabled**. Decisions in §10 were settled on 2026-10-25.
Prerequisite met: the website enhancement sprint is deployed (commit `03d74a5`). It passed tsc, eslint, 74 unit/integration tests and 37 e2e checks.

## 1. What exists today (relevant to Care)

| Area | Current state | What Care reuses |
|---|---|---|
| Auth | Better Auth, DB sessions. `users.role` = user, dealer or admin. `users.suspendedAt` | Same accounts. Center permissions come from a **separate staff table**, not a new global role |
| Authorization | Every server action re-checks the session, ownership and role. Admin-only moderation | Same pattern, plus a `requireCenterStaff(centerId, roles)` guard |
| Audit | `audit_logs`, written by admin actions (append-only by convention) | Reused for all Care events. A DB trigger blocks UPDATE/DELETE so nobody can alter it |
| Listings | State machine, moderation, no chassis number (VIN) column | Listing integration needs a private VIN (§10, Q2) |
| Storage | S3 driver to the Supabase **public** bucket `media`, sharp → WebP, EXIF stripped | Evidence photos use the same pipeline. Credentials go to a **new private bucket** (`S3_PRIVATE_BUCKET`) and are streamed only through an auth-checked route |
| Rate limits / validation | Postgres fixed-window limiter, zod v4 schemas | Same |
| Email / notifications | **Not operational.** Console only; the deployed site says so | Care notifications stay in-app (booking timeline) until a provider is connected |
| Payments | None | Booking state and payment state are tracked separately. No online payment until a provider is configured |

## 2. Principles

- Only admins approve, suspend or revoke a center. A subscription never changes approval. Centers can't edit their own status or credentials review.
- No fabricated centers, ratings, bookings, payments or reports. The directory is empty until real centers are approved.
- An inspection report describes what was checked on that day, and lists what was **not** inspected. It never implies a guarantee of future condition.
- Submitted findings are immutable. Corrections create a new version linked to the old one, with an audit entry. Sellers can never edit reports.
- Everything is an additive migration: new tables and enums, plus nullable columns on `listings`. Existing listing data is untouched.

## 3. Data model (new tables)

**Enums**

| Enum | Values |
|---|---|
| `center_status` | applied, under_review, approved, suspended, revoked, rejected |
| `center_staff_role` | owner, manager, technician |
| `care_category` | pre_purchase_inspection, oil_change, routine_maintenance, diagnostics, brakes, tires, air_conditioning, electrical, bodywork, other |
| `price_mode` | fixed, quote |
| `booking_kind` | inspection, maintenance |
| `booking_status` | requested, confirmed, in_progress, report_ready, completed, cancelled, no_show |
| `payment_status` | unpaid, pending, paid, failed, refunded, waived |
| `report_status` | draft, submitted, superseded, withdrawn |
| `inspection_result` | ok, attention, fail, not_inspected, unavailable |
| `severity` | none, low, medium, high, critical |
| `credential_kind` | commercial_register, tax_card, brand_authorization, other |
| `review_state` | pending, accepted, rejected |
| `complaint_kind` | service, report_dispute, billing, conduct |
| `complaint_status` | open, reviewing, resolved, dismissed |

**Centers**
- `service_centers`: id, slug, name_ar, name_en, city_id, area, address, lat/lng (nullable), phone, email, website, description, vehicle_types (text[]), quotation_policy, **status**, status_reason, approved_at, approved_by, created_by, timestamps.
- `center_staff`: center_id, user_id, role, active, added_by. Unique (center_id, user_id).
- `center_credentials`: center_id, kind, number, private_file_key, expires_at, review_state, reviewed_by, reviewed_at, note.
- `center_approval_checks`: center_id, criterion, passed, checked_by, checked_at, note. This is the admin checklist (§8).
- `center_services`: center_id, category, name_ar/en, price_mode, price_egp (null when quote), duration_min, vehicle_types, active.
- `center_hours`: center_id, weekday, opens, closes, slot_minutes, capacity_per_slot.
- `center_closures`: center_id, date, reason.

**Bookings**
- `bookings`:
  - Who and where: id, code (human-readable), kind, center_id, service_id, customer_id, listing_id (nullable).
  - Vehicle snapshot: make_id, model_id, year, vin, plate_last3, odometer_km.
  - Scheduling and price: scheduled_at, status, price_mode, quoted_price_egp, final_price_egp.
  - Payment and cancellation: payment_status, cancel_reason, cancelled_by.
  - timestamps.
- `booking_events`: booking_id, from_status, to_status, actor_id, actor_kind (customer, center, admin, system), note, at. **Append-only.**
- Slot safety: booking creation counts active bookings in that slot inside a transaction with `SELECT … FOR UPDATE` on the center row. There's also a unique partial index per (center, slot, seat).

**Reports**
- `inspection_reports`:
  - Links: id, booking_id, center_id, technician_user_id, listing_id (nullable).
  - Vehicle: vin, odometer_km, inspected_at.
  - Versioning: version, supersedes_id, status.
  - Content: summary, limitations, road_test_performed, diagnostic_tool.
  - Lifecycle: valid_until, submitted_by, submitted_at, content_hash (SHA-256 of the items and evidence keys, stored at submission).
- `inspection_items`: report_id, section (engine, transmission, bodywork, paint, brakes, suspension, tires, electronics, diagnostics, road_test), item_key, result, severity, notes.
- `inspection_evidence`: item_id, storage_key, kind (photo, document), uploaded_by.
- `report_disclosures`: report_id, listing_id, consented_by (the listing's seller), consented_at, revoked_at. See §10, Q1.

**Maintenance**
- `owner_vehicles`: user_id, make_id, model_id, year, vin (private), plate_last3, nickname.
- `service_records`: booking_id, work_done, parts, odometer_km, completed_by.
- `center_reviews`: booking_id (unique; completed bookings only), customer_id, center_id, rating 1–5, comment, visible.

**Money (prepared, not live)**
- `invoices`: booking_id, center_id, number (per center, sequential), lines jsonb, subtotal, vat, total, status (draft, issued, void), issued_at.
- `payments`: booking_id, provider, amount, status, provider_ref, raw jsonb. Rows are written only by a real provider webhook, or by a center confirming cash at the counter, which is marked as such.
- `commission_rules`: kind, category (nullable), percent_bps, fixed_egp, active_from, active_to. Configured by admins.
- `commissions`: booking_id, rule_id, base_amount, amount, status (accrued, invoiced, settled, void). Accrued **only** when a booking reaches `completed`.
- `subscription_plans` and `center_subscriptions`: price and features only. No column or code path touches `service_centers.status`.

**Quality**
- `care_complaints`: booking_id, report_id (nullable), raised_by, kind, status, resolution, handled_by.

**Changes to existing tables (additive, nullable)**
- `listings.vin_private text`: the chassis number. Never rendered publicly, at most the last 4 characters (§10, Q2).

## 4. Permissions

| Action | Customer | Listing seller | Center technician | Center manager/owner | Admin |
|---|---|---|---|---|---|
| Apply to register a center | ✓ (becomes owner of an `applied` center) | | | | |
| Approve / suspend / revoke center, review credentials | | | | | ✓ |
| Edit center profile, services, hours | | | | ✓ own center | ✓ |
| Book a service | ✓ | ✓ | | | |
| Confirm / start / no-show a booking | | | ✓ own center | ✓ own center | |
| Cancel a booking | ✓ own (policy cutoff) | | | ✓ own (with reason) | ✓ |
| Write / submit a report | | | ✓ own center's booking | ✓ | |
| Amend a report (new version) | | | | ✓ own center | |
| Withdraw a report | | | | | ✓ |
| View the full report | ✓ who booked it | ✓ if linked to their listing | ✓ own center | ✓ own center | ✓ |
| Show a report on a listing | | ✓ consent (Q1) | | | |
| Issue an invoice | | | | ✓ own center | |
| Review a center | ✓ after a completed booking | | | | hide/unhide |
| Read or alter the audit log | | | | | read only (nobody alters it) |

A suspended or revoked center keeps read access to its history but can't accept new bookings or submit reports. Every check runs on the server.

## 5. Booking lifecycle

```
requested ──center confirms──▶ confirmed ──center starts──▶ in_progress
    │                              │                           │
    │ customer/center cancels      │ cancel (policy) / no_show │ inspection: report submitted ─▶ report_ready ─▶ completed
    ▼                              ▼                           │ maintenance: work + invoice ───────────────▶ completed
 cancelled                    cancelled / no_show
```

- Reschedule is only possible while `requested` or `confirmed`. It changes scheduled_at, sends the booking back to `requested`, and logs an event.
- `report_ready → completed` happens when the customer opens the report, or automatically after 72 hours.
- Transitions live in one pure function, `nextBookingStatus(from, action, actor)`, the same approach as `listing-state.ts`. Each one writes `booking_events` and `audit_logs`.

## 6. Report model and listing integration

- **Sections and items:** a fixed checklist per section (versioned in code as `REPORT_TEMPLATE_V1`).
- **Each item:** result, severity, notes, and evidence photos. `not_inspected` and `unavailable` are first-class results, and the public summary lists them separately.
- **Submitting:** freezes the report (content_hash). An amendment means a new row with version+1 and supersedes_id; the old row becomes `superseded`.
- **When a listing shows "Inspected"** — all of these must be true:
  1. The report is the latest version and has status `submitted`.
  2. The center was approved on `inspected_at`, and isn't revoked now. If it was revoked later, the card shows a note instead.
  3. `report.vin` equals `listings.vin_private` (normalized).
  4. `now ≤ valid_until`. Once expired, the listing shows "Inspection from {date}, may be out of date".
  5. The seller has consented (Q1).
  6. The listing's mileage is ≥ the odometer reading at inspection.
- **What the listing shows:** date, center name with a link to its page, scope (sections inspected and not inspected), the summary, findings of severity high or above, and a link to the permitted report view.
- **What it never shows:** the full VIN, customer identity, plate, or credential documents.

## 7. Routes

| Area | Path | Purpose |
|---|---|---|
| Public | `/[lang]/care` | Landing page with honest copy about what an inspection covers |
| Public | `/[lang]/care/centers`, `/[lang]/care/centers/[slug]` | Directory, showing only approved centers |
| Customer | `/[lang]/care/book?center=&service=&listing=` | Booking wizard: vehicle → center → slot → review |
| Customer | `/[lang]/account/bookings`, `/[lang]/account/bookings/[code]` | Bookings, timeline, report, invoice, review |
| Customer | `/[lang]/account/garage` | Owner vehicles and service history |
| Public | `/[lang]/care/apply` | Center application |
| Center | `/[lang]/center/[slug]/…` | Dashboard: bookings, services, hours, reports/new, invoices, reviews, staff |
| Admin | `/[lang]/admin/centers`, `/[lang]/admin/complaints` | Applications, checklist, credentials, status changes, disputes |
| Report | `/[lang]/reports/[id]` | Permitted report view |
| API | `POST /api/care/evidence/[itemId]`, `POST /api/care/credentials/[centerId]` | Multipart uploads, same image pipeline |
| API | `GET /api/care/files/[id]` | Auth-checked redirect to a short-lived signed URL (private bucket) |

Mutations are server actions in `src/server/actions/care/*.ts`, each with zod validation, rate limiting and an audit entry.

## 8. Center approval criteria (proposed default; admin checklist)

1. A valid commercial register and a tax card, uploaded, readable and not expired.
2. The physical address is confirmed, by a visit or a live video call.
3. At least one named technician is linked to a MOTORNA account.
4. For pre-purchase inspection: an OBD diagnostic scanner, a paint-thickness gauge, and access to a lift.
5. The center accepts the MOTORNA center terms (a legal draft is needed, like the existing Terms).

All criteria must pass before an admin can set the center to `approved`. The checklist rows and the decision are audited.

## 9. Stages and test plan

| Stage | Scope | Key tests |
|---|---|---|
| 1 | Center application, admin checklist and approval, private credentials, public directory | Self-approval impossible; subscription can't change status; non-admin blocked; only approved centers listed; credential files not public |
| 2 | Inspection booking, slots, lifecycle, customer/center views | Every transition × actor; double-booking race; cancel cutoff; center sees only its own bookings |
| 3 | Report builder, evidence, versioning, listing badge, disclosure | Immutability after submit; amendments create versions; VIN mismatch hides badge; expiry; seller can't edit; privacy of report view |
| 4 | Maintenance booking, garage, quotes, reviews | Quote flow; reviews only after completion; one review per booking |
| 5 | Workshop dashboard (services, hours, invoices, performance) | Cross-center access denied for every resource |
| 6 | Payments, commissions, notifications, once a provider is configured | Commission only on completed; webhook signature; no "paid" without a provider record |

Each stage ships with vitest coverage, e2e flows, an additive SQL update file (`supabase/update-*.sql`, same idempotent generator), and a live verification.

## 10. Decisions (settled 2026-10-25)

- **Q1 — report on listing:** only with the seller's consent. Everyone involved can always see it privately.
- **Q2 — VIN on listings:** optional, private, never public; required only to show an inspection badge.
- **Q3 — validity:** an inspection stays "current" on a listing for 60 days.
- **Q4 — payment at launch:** pay at the center; commission tracked and invoiced to centers monthly. Online payment later (needs a merchant account).

## 12. Stage 1 as built

- Tables: `service_centers`, `center_staff`, `center_credentials`, `center_approval_checks`, `center_services`, `center_hours` (migration `0003_care_centers`). The same migration adds DB triggers that make `audit_logs` append-only. The only change allowed is the FK setting `actor_id` to NULL when a user is deleted.
- Pages: `/[lang]/care` (directory and criteria), `/[lang]/care/centers/[slug]`, `/[lang]/care/apply`, `/[lang]/center` and `/[lang]/center/[slug]` (dashboard: profile, services, hours, documents, team), `/[lang]/admin/centers` and `/[lang]/admin/centers/[id]` (documents, checklist, status, history).
- API: `POST /api/care/centers/[id]/credentials` (owner/manager), `GET /api/care/credentials/[id]` (owner/manager/admin, `no-store`, sandboxed CSP).
- Rules enforced on the server:
  - Admin-only status changes.
  - Admins who are, or were, staff at a center can't review it.
  - Approval needs every applicable criterion plus an accepted, unexpired commercial register and tax card. The inspection-equipment criterion applies only when the center offers pre-purchase inspection.
  - Name, city and address lock after approval.
  - Only owners manage the team.
- Not in Stage 1: booking, reports, the listing VIN, payments and subscriptions. Booking isn't offered anywhere in the UI; the directory says to contact centers directly.

## 11. Manual steps you will need (no secrets in chat)

- Create a **private** Supabase bucket `care-private` (Stage 1).
- Run each stage's SQL update in the Supabase SQL editor; I verify before deploying code.
- Recruit real centers. None will be invented.
- Legal: center terms and an inspection-report disclaimer, reviewed by an Egyptian lawyer.
- Later: an email provider (notifications) and a payment provider (Stage 6).

## 13. Directory and application upgrade (migration `0004_care_workflow`)

**Application workflow.** These are the `center_status` values; `applied` is labelled "Submitted" in the UI.

```
draft ──owner submits (server checks completeness)──▶ applied ──admin──▶ under_review ──admin──▶ approved ⇄ suspended
  ▲                                                     │                   │                       │
  └── owner resubmits ◀── changes_requested ◀──admin────┴───────────────────┘                       └──▶ revoked
                          rejected ◀──admin── (applied | under_review | changes_requested)
```

- **Submit needs:** at least one active service, one active responsible technician, and an uploaded commercial register and tax card. If the center offers pre-purchase inspection, it also needs a declared OBD scanner, paint-thickness gauge and lift.
- **Request changes, reject, suspend, revoke:** each needs a message, and the center sees it.
- **Approve:** still needs every applicable checklist item plus accepted, unexpired documents. Approve and reinstate set `last_verified_at`.
- Admins can't act on drafts.

**New tables**
- `center_equipment`: what the center declares. Only the inspection-equipment criterion confirms it.
- `center_technicians`: names are visible to moderators only. The public page shows specialty and experience.
- `center_review_notes`: internal and append-only. Never returned by any center-facing query.

**New columns:** `service_centers.submitted_at` and `last_verified_at`.

**Directory.** Approved centers only, with filters for governorate, area (distinct areas of approved centers), service and sort (name / most recently reviewed). There are 12 per page. The count, pages and items all come from one filtered SQL query. Cards show today's hours in Cairo time when the center published hours.

**Center page.** Shows only recorded data:
- Services and prices, declared equipment, and a technician count with specialties.
- Each confirmed criterion with its check date, and the last review date.
- A Google Maps search link built from the address the center entered (no invented coordinates).
- A notice that MOTORNA's review is not a government license or any other official accreditation.

**Bookings and revenue (architecture only)**
- `src/lib/booking.ts` holds:
  - The booking state machine (`nextBookingStatus`): actors, a 12-hour customer cancel/reschedule cutoff, no-show only after the slot, and inspections must reach `report_ready` before `completed`.
  - Payment status, separate from booking status.
  - `commissionFor`: accrues only for completed bookings with a final price, and the most specific active rule wins.
  - The subscription type, which is billing-only and never an approval input.
- These are covered by `tests/booking.test.ts`. No booking or payment tables exist yet. `features.careBooking` is `false` and the UI says booking and payment aren't available.
- Tables to add when Stage 2 starts are listed in §3 (`bookings`, `booking_events`, `payments`, `commission_rules`, `commissions`, `subscription_plans`, `center_subscriptions`). They link `listing_id` and an owner vehicle, and keep payment state in `payments`, separate from booking state.
