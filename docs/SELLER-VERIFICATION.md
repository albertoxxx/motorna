# Seller verification — phone and vehicle licence

Decided 2026-10-26:
- Verify the **seller's phone** by SMS code only. It stays off until an SMS provider is configured.
- Verify the **vehicle licence** (رخصة العربية) as an **optional** per-listing badge.
- Personal ID cards are **not** collected.

## What buyers see (car page "Verification status")

| Row | Shows "done" only when |
|---|---|
| Listing review | An admin approved the listing (existing moderation) |
| Seller's phone | The seller entered an SMS code sent to their **current** profile number. Changing the number voids it |
| Vehicle licence | An admin accepted a licence for this listing that hasn't expired, **and** the listing still has the same make, model and year as when it was uploaded. Also shown as a badge on the car page and on result cards |
| Technical inspection | Always "Not inspected" until inspection reports exist |

The seller page shows "Mobile number verified by SMS" or "not verified". Only booleans leave the server; numbers and licence files never do.

## Phone (SMS)

- **Provider boundary:** `src/lib/sms.ts`.
  - `SMS_PROVIDER=twilio`, with `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and either `TWILIO_FROM` or `TWILIO_MESSAGING_SERVICE_SID`.
  - `console` is local only.
  - **Unset means the profile says "coming soon" and the server refuses to send codes.**
- **Codes:**
  - 6 digits, valid 10 minutes.
  - At most 5 wrong attempts per code.
  - 60-second resend cooldown.
  - 5 codes per user per day and 5 per number per day.
  - Only an HMAC of the code is stored, and a new code voids older ones.
- **Audit:** `user.phone.verified`.

## Vehicle licence

- **Upload:** the seller goes to My listings → "Vehicle licence" (`/account/listings/[id]/licence`).
  - Front is required, back is optional; JPG, PNG, WebP or PDF up to 5 MB.
  - Images are re-encoded with metadata stripped.
  - Files go to **private storage** (`S3_PRIVATE_BUCKET`).
  - One pending check per listing (enforced in the DB). The seller can withdraw a pending check, which deletes its files.
- **Viewing:** `GET /api/licence/[id]/[front|back]` works only for the seller and admins, sent `no-store` with a sandboxed CSP.
- **Review:** `/admin/licences`.
  - The admin accepts if the licence is readable and current and matches the listing. An expiry date is optional.
  - Rejecting needs a note, which the seller sees.
  - Admins can't review their own listings.
  - The seller gets an in-app notification.
  - Audit actions: `listing.licence.submit / accept / reject / withdraw`.
- **Retention:** the daily job deletes licence files **30 days after the decision**. The decision record (status, date, reviewer, snapshot) stays, so the badge remains.
- **Scope wording everywhere:** this is not an official ownership check with the traffic authority.

## Migration

- `drizzle/0009_seller_verification.sql`, additive only:
  - Two `users` columns: `phone_verified_at`, `phone_verified_number`.
  - Tables `phone_verifications` and `listing_licence_checks`.
  - Enum `licence_check_status`.
- Update script: `supabase/update-2026-10-26-seller-verification.sql`. On a prod-like copy it ran twice cleanly with result `10 | 2 | 2 | 0 | 1`.

## Before turning SMS on (manual)

1. Choose a provider that delivers to Egyptian mobiles and register a sender. Local sender-ID rules may apply.
2. Add the variables to Vercel (Production) and redeploy. The profile then offers "Send me a code".
3. Update the privacy page with the provider's name once it's chosen. Have a lawyer review the licence handling under Egypt's Personal Data Protection Law (151/2020).
