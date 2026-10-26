import { resolveLocale } from "@/i18n/server";
import { requireUser } from "@/server/session";
import { getProfile } from "@/server/queries";
import { getCities } from "@/server/listings";
import { ProfileForm } from "@/components/profile-form";
import { PhoneVerify } from "@/components/phone-verify";
import { phoneVerified } from "@/lib/verification";
import { smsDeliveryAvailable } from "@/lib/sms";

export const metadata = { robots: { index: false } };

export default async function ProfilePage({ params }: PageProps<"/[lang]/account/profile">) {
  const { locale, dict } = await resolveLocale(params);
  const user = await requireUser(locale);
  const [profile, cities] = await Promise.all([getProfile(user.id), getCities()]);
  if (!profile) return null;
  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">{dict.account.profileTitle}</h1>
      <ProfileForm
        locale={locale}
        profile={profile}
        cities={cities.map(({ id, nameAr, nameEn }) => ({ id, nameAr, nameEn }))}
        dict={{ account: dict.account, common: dict.common, validation: dict.validation, errors: dict.errors, auth: dict.auth }}
      />
      <PhoneVerify dict={{ verify: dict.verify, errors: dict.errors }} phone={profile.phone} verified={phoneVerified(profile)} available={smsDeliveryAvailable()} />
    </div>
  );
}
