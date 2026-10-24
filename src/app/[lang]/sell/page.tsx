import type { Metadata } from "next";
import { resolveLocale } from "@/i18n/server";
import { requireUser } from "@/server/session";
import { listingFormOptions } from "@/server/form-data";
import { ListingForm } from "@/components/listing-form";

export async function generateMetadata({ params }: PageProps<"/[lang]/sell">): Promise<Metadata> {
  const { dict } = await resolveLocale(params);
  return { title: dict.sell.title };
}

export default async function SellPage({ params }: PageProps<"/[lang]/sell">) {
  const { locale, dict } = await resolveLocale(params);
  await requireUser(locale, `/${locale}/sell`);
  const opts = await listingFormOptions();
  return (
    <div className="container-page py-8">
      <h1 className="text-2xl font-bold sm:text-3xl">{dict.sell.title}</h1>
      <p className="mb-8 mt-1.5 text-ink-2">{dict.sell.intro}</p>
      <ListingForm
        locale={locale}
        dict={{ sell: dict.sell, enums: dict.enums, common: dict.common, validation: dict.validation, errors: dict.errors }}
        {...opts}
        initial={{}}
        initialImages={[]}
      />
    </div>
  );
}
