import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolveLocale } from "@/i18n/server";
import { requireUser } from "@/server/session";
import { listingForEdit } from "@/server/queries";
import { listingFormOptions } from "@/server/form-data";
import { ListingForm } from "@/components/listing-form";
import { Badge, statusTone } from "@/components/ui/badge";
import { Notice } from "@/components/ui/states";
import { t } from "@/i18n/t";

export async function generateMetadata({ params }: PageProps<"/[lang]/account/listings/[id]/edit">): Promise<Metadata> {
  const { dict } = await resolveLocale(params);
  return { title: dict.sell.editTitle, robots: { index: false } };
}

export default async function EditListingPage({ params }: PageProps<"/[lang]/account/listings/[id]/edit">) {
  const { id } = await params;
  const { locale, dict } = await resolveLocale(params);
  const user = await requireUser(locale, `/${locale}/account/listings/${id}/edit`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await listingForEdit(user.id, id);
  if (!data) notFound();
  const l = data.listing;
  if (l.status === "sold") notFound();
  const opts = await listingFormOptions(user.id);
  const str = (n: number | null) => (n == null ? "" : String(n));
  return (
    <div className="container-page py-8">
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold sm:text-3xl">{dict.sell.editTitle}</h1>
        <Badge tone={statusTone(l.status)}>{dict.enums.status[l.status]}</Badge>
      </div>
      {l.status === "rejected" && l.rejectionReason && (
        <Notice tone="danger" className="mb-6">{t(dict.listing.statusNotice.rejected, { reason: l.rejectionReason })}</Notice>
      )}
      <ListingForm
        locale={locale}
        dict={{ sell: dict.sell, enums: dict.enums, common: dict.common, validation: dict.validation, errors: dict.errors }}
        {...opts}
        initial={{
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
        }}
        initialImages={data.images}
      />
    </div>
  );
}
