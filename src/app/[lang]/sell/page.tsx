import type { Metadata } from "next";
import { resolveLocale } from "@/i18n/server";
import { requireUser } from "@/server/session";
import { listingFormOptions } from "@/server/form-data";
import { listingForEdit } from "@/server/queries";
import { ListingForm, type ListingFormInitial } from "@/components/listing-form";

export async function generateMetadata({ params }: PageProps<"/[lang]/sell">): Promise<Metadata> {
  const { dict } = await resolveLocale(params);
  return { title: dict.sell.title, robots: { index: false } };
}

const str = (n: number | null) => (n == null ? "" : String(n));

export default async function SellPage({ params, searchParams }: PageProps<"/[lang]/sell">) {
  const { locale, dict } = await resolveLocale(params);
  const user = await requireUser(locale, `/${locale}/sell`);
  const opts = await listingFormOptions(user.id);

  // Resume a draft the seller owns (?draft=<id>); anything else starts fresh.
  const draftId = (await searchParams).draft;
  const draft =
    typeof draftId === "string" && /^[0-9a-f-]{36}$/i.test(draftId) ? await listingForEdit(user.id, draftId) : null;
  const l = draft && draft.listing.status === "draft" ? draft.listing : null;
  const initial: ListingFormInitial = l
    ? {
        id: l.id,
        status: l.status,
        makeId: str(l.makeId),
        modelId: str(l.modelId),
        trim: l.trim ?? "",
        year: str(l.year),
        mileageKm: str(l.mileageKm),
        priceEgp: str(l.priceEgp),
        negotiable: l.negotiable,
        condition: l.condition,
        transmission: l.transmission,
        fuelType: l.fuelType,
        bodyType: l.bodyType ?? "",
        color: l.color ?? "",
        engineCc: str(l.engineCc),
        cityId: str(l.cityId),
        area: l.area ?? "",
        title: l.title,
        description: l.description,
        knownDefects: l.knownDefects ?? "",
      }
    : {};

  return (
    <div className="container-page py-8">
      <h1 className="text-2xl font-bold sm:text-3xl">{dict.sell.title}</h1>
      <p className="mb-8 mt-1.5 text-ink-2">{dict.sell.intro}</p>
      <ListingForm
        locale={locale}
        dict={{ sell: dict.sell, enums: dict.enums, common: dict.common, validation: dict.validation, errors: dict.errors }}
        {...opts}
        initial={initial}
        initialImages={l && draft ? draft.images : []}
      />
    </div>
  );
}
