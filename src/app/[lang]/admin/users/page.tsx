import Link from "next/link";
import { resolveLocale } from "@/i18n/server";
import { requireAdmin } from "@/server/session";
import { adminUsers } from "@/server/queries";
import { UserSuspensionControl } from "@/components/admin-actions";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";

export default async function AdminUsers({ params, searchParams }: PageProps<"/[lang]/admin/users">) {
  const { locale, dict } = await resolveLocale(params);
  const me = await requireAdmin(locale);
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const suspendedOnly = sp.suspended === "1";
  const rows = await adminUsers(q, suspendedOnly);
  const A = dict.admin;
  const d = { admin: dict.admin, errors: dict.errors, common: dict.common };
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold">{A.usersPage}</h1>
      <form className="flex flex-wrap items-center gap-2" role="search">
        <input name="q" defaultValue={q} placeholder={A.usersSearch} aria-label={A.usersSearch} className="h-10 w-full max-w-sm rounded-[var(--radius-sm)] border border-line-strong bg-surface px-3 text-sm" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="suspended" value="1" defaultChecked={suspendedOnly} className="size-4 accent-brand-600" />{A.usersSuspendedOnly}</label>
        <button type="submit" className="h-10 rounded-[var(--radius-md)] bg-navy-900 px-4 text-sm font-medium text-white">{dict.home.search}</button>
      </form>
      {rows.length === 0 ? <p className="text-sm text-ink-3">{A.usersEmpty}</p> : (
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface">
          {rows.map((u) => (
            <li key={u.id} className="flex flex-col gap-2 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  <Link href={`/${locale}/sellers/${u.id}`} className="hover:underline"><bdi>{u.name}</bdi></Link>
                  <Badge tone={u.role === "admin" ? "dark" : u.role === "dealer" ? "brand" : "neutral"}>{A.roleLabels[u.role]}</Badge>
                  {u.suspendedAt && <Badge tone="danger">{A.usersSuspendedSince.replace("{date}", formatDate(u.suspendedAt, locale))}</Badge>}
                </p>
                <p dir="ltr" className="truncate text-ink-3 rtl:text-end">{u.email}</p>
                <p className="text-xs text-ink-3">{A.usersJoined} {formatDate(u.createdAt, locale)} · <span className="tabular">{u.listings}</span> {A.usersListings} · <span className="tabular">{u.centers}</span> {A.usersCenters}</p>
                {u.suspensionReason && <p dir="auto" className="mt-1 text-xs text-danger-700">{u.suspensionReason}</p>}
              </div>
              {u.role === "admin" || u.id === me.id ? <p className="text-xs text-ink-3">{A.usersAdminNote}</p> : <UserSuspensionControl userId={u.id} suspended={!!u.suspendedAt} dict={d} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
