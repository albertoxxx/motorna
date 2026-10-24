# Manual production checks

Automated tests run against a local copy of the app. These checks confirm the same flows on the **deployed** site.

There is no separate staging environment yet. Run these on `motorna.vercel.app` with test accounts **you** create:
- **Buyer:** a second email you own.
- **Seller:** your normal account.
- **Admin:** your admin account.
- **Center:** a third email you own. It must not be your admin account, because admins can't review a center they belong to.

When you finish, clean up test data from the UI:
- Archive or delete the test listing.
- Reject the test center application.

Expected results are in *italics*. Send a screenshot of anything that doesn't match.

## A. Accounts and email (after Resend is configured)

1. **Sign up as the buyer** from a listing: open a car page → *"اعمل حساب وراسل البائع"*. *The sign-up page shows why an account is needed. After sign-up you return to the same car.*
2. **Sign out**, then **Forgot password** with the buyer email. *The page says a link is on its way. An email arrives within a minute with a link valid for 30 minutes. The link sets a new password, and you can sign in with it.*
3. **Request a reset for an email that has no account.** *You see the same message, and no email is sent.*

## B. Buyer flows

4. **Save** a car (heart). *It appears in حسابي ← المحفوظة.*
5. **Message** the seller from the car page. *The conversation appears for the buyer, and for the seller in الرسائل.*
6. **Phone:** on a listing where the seller didn't allow it, *there's no "اظهر رقم الموبايل" button*. On one where they did, *the number appears only after sign-in*.
7. **Report** a listing. *It appears in الإدارة ← البلاغات.*

## C. Seller flows

8. Create a listing from your phone (all 7 steps).
   - *In step 4, "اسمح للمشترين يشوفوا رقم موبايلي" is unticked by default.*
   - *Ticking it asks for a mobile number.*
9. Submit it. *Status is "قيد المراجعة". The listing isn't visible to signed-out visitors.*
10. **Admin approves it.** *Within a minute the seller gets the "إعلانك اتنشر" email, and the listing is public.*
11. **Edit the price only.** *It stays published.* **Edit the trim.** *It goes back to "قيد المراجعة".*

## D. Your BMW X6 trim fix (do this yourself, in your seller account)

1. Open **إعلاناتي** → BMW X6 → **تعديل**.
2. Step 1 (العربية): clear **الفئة** (it says `3000cc`). Leave it empty or enter the real trim, for example *M Sport*.
3. Step 2 (المواصفات): check that **سعة المحرك** still says `3000`.
4. Continue to the end and save.
   - *Because the trim is a reviewed field, the listing goes back to **قيد المراجعة** and is hidden until approved.*
5. In **الإدارة ← مراجعة الإعلانات**, approve it. *It's public again with no `3000cc` under the title.*

## E. Service centers

12. With the center account: **مراكز الصيانة** → **قدّم طلب انضمام** → create a draft.
    - Add a service and a technician.
    - Upload a PDF as commercial register and another as tax card.
    - Submit. *"لوحة المركز" appears in your account menu.*
13. Admin: **الإدارة ← المراكز ← مستنية المراجعة** → **طلب تعديلات** with a message. *The center owner gets the email and sees the message in the dashboard.*
14. With the buyer account, open the document "عرض" link (copy it from the center dashboard). *You get 403 / Forbidden.*
15. Admin approves after ticking every criterion. *The center appears on `/ar/care` with today's hours, and its page shows "مش ترخيص حكومي".*

## F. Admin permissions

16. With the buyer account, open `/ar/admin` and `/ar/admin/centers`. *You're redirected to the home page.*

## G. Mobile images (visual check)

On a real phone, or in Chrome DevTools (`⌘⌥I` → device toolbar), check widths **360, 390 and 430 px** on:

- `/ar`: the listing card photo fills its box with no stretching or blank space, and the price and title aren't cut off.
- `/ar/cars`: the same, for every card.
- `/ar/cars/2025-bmw-x6-daxpjr`:
  - The main photo is sharp and swipes between all 6.
  - Fullscreen works.
  - The thumbnails are in the right order, with the cover photo first.
- No page scrolls sideways.

Send one screenshot per width of the home card and the car page gallery. Any cropping or ordering problem can then be fixed precisely.
