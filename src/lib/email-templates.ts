import type { Locale } from "@/i18n/config";

/** Plain, bilingual-safe transactional emails. Every interpolated value is HTML-escaped. */
export type Rendered = { subject: string; text: string; html: string };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(locale: Locale, heading: string, paragraphs: string[], cta?: { label: string; url: string }, footer?: string): string {
  const dir = locale === "ar" ? "rtl" : "ltr";
  const ps = paragraphs.map((p) => `<p style="margin:0 0 14px;line-height:1.6">${esc(p)}</p>`).join("");
  const button = cta
    ? `<p style="margin:22px 0"><a href="${esc(cta.url)}" style="background:#2563eb;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;font-weight:600">${esc(cta.label)}</a></p><p style="margin:0 0 14px;font-size:12px;color:#64748b;word-break:break-all">${esc(cta.url)}</p>`
    : "";
  return `<!doctype html><html lang="${locale}" dir="${dir}"><body style="margin:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a"><div style="max-width:560px;margin:0 auto;padding:28px 20px"><p style="font-weight:800;letter-spacing:.04em;margin:0 0 20px">MOTORNA</p><div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px"><h1 style="font-size:20px;margin:0 0 16px">${esc(heading)}</h1>${ps}${button}</div><p style="font-size:12px;color:#64748b;margin:16px 4px 0;line-height:1.5">${esc(footer ?? (locale === "ar" ? "الرسالة دي اتبعتت تلقائيًا من موتورنا." : "This message was sent automatically by MOTORNA."))}</p></div></body></html>`;
}

function textOf(heading: string, paragraphs: string[], cta?: { label: string; url: string }) {
  return [heading, "", ...paragraphs, ...(cta ? ["", `${cta.label}: ${cta.url}`] : [])].join("\n");
}

function build(locale: Locale, subject: string, heading: string, paragraphs: string[], cta?: { label: string; url: string }): Rendered {
  return { subject, text: textOf(heading, paragraphs, cta), html: layout(locale, heading, paragraphs, cta) };
}

export function passwordResetEmail(locale: Locale, url: string): Rendered {
  return locale === "ar"
    ? build(locale, "إعادة تعيين كلمة المرور — موتورنا", "إعادة تعيين كلمة المرور", ["حد طلب تغيير كلمة المرور لحسابك على موتورنا. الرابط صالح لمدة 30 دقيقة ولمرة واحدة.", "لو مش إنت اللي طلبت، تجاهل الرسالة دي وكلمة المرور هتفضل زي ما هي."], { label: "تعيين كلمة مرور جديدة", url })
    : build(locale, "Reset your MOTORNA password", "Reset your password", ["Someone asked to reset the password for your MOTORNA account. The link works once and expires in 30 minutes.", "If this wasn't you, ignore this email and your password stays the same."], { label: "Set a new password", url });
}

export function listingApprovedEmail(locale: Locale, title: string, url: string): Rendered {
  return locale === "ar"
    ? build(locale, `إعلانك اتنشر: ${title}`, "إعلانك اتنشر", [`مشرف من موتورنا راجع إعلان «${title}» ونشره. المشترين يقدروا يشوفوه ويراسلوك دلوقتي.`], { label: "شوف الإعلان", url })
    : build(locale, `Your listing is live: ${title}`, "Your listing is live", [`A MOTORNA moderator reviewed "${title}" and published it. Buyers can now see it and message you.`], { label: "View listing", url });
}

export function listingRejectedEmail(locale: Locale, title: string, reason: string, editUrl: string, takenDown = false): Rendered {
  return locale === "ar"
    ? build(locale, `إعلانك محتاج تعديل: ${title}`, takenDown ? "إعلانك اتشال من النشر" : "إعلانك محتاج تعديل", [`${takenDown ? "مشرف من موتورنا شال" : "مشرف من موتورنا مانشرش"} إعلان «${title}».`, `السبب: ${reason}`, "عدّل الإعلان وابعته للمراجعة تاني."], { label: "عدّل الإعلان", url: editUrl })
    : build(locale, `Your listing needs changes: ${title}`, takenDown ? "Your listing was taken down" : "Your listing needs changes", [`A MOTORNA moderator ${takenDown ? "took down" : "didn't publish"} "${title}".`, `Reason: ${reason}`, "Edit the listing and submit it for review again."], { label: "Edit listing", url: editUrl });
}

export type CenterNotice = "requestChanges" | "reject" | "approve" | "suspend" | "reinstate" | "revoke";

export function centerStatusEmail(locale: Locale, action: CenterNotice, center: string, reason: string | null, url: string): Rendered {
  const ar: Record<CenterNotice, [string, string]> = {
    requestChanges: ["مطلوب تعديلات على طلب مركزك", `مشرف من موتورنا راجع طلب «${center}» ومحتاج تعديلات قبل ما يكمل.`],
    reject: ["طلب مركزك اترفض", `طلب «${center}» اترفض. تقدر تعدّل البيانات وتبعته تاني.`],
    approve: ["مركزك اتعمد على موتورنا كير", `«${center}» بقى ظاهر في دليل موتورنا كير.`],
    suspend: ["مركزك اتوقف مؤقتًا", `«${center}» اتوقف مؤقتًا ومش ظاهر في الدليل.`],
    reinstate: ["مركزك رجع للدليل", `«${center}» رجع ظاهر في دليل موتورنا كير.`],
    revoke: ["تم سحب اعتماد مركزك", `اعتماد «${center}» على موتورنا كير اتسحب.`],
  };
  const en: Record<CenterNotice, [string, string]> = {
    requestChanges: ["Changes requested on your center application", `A MOTORNA moderator reviewed "${center}" and needs changes before continuing.`],
    reject: ["Your center application was rejected", `The application for "${center}" was rejected. You can update it and submit again.`],
    approve: ["Your center is approved on MOTORNA Care", `"${center}" is now listed in the MOTORNA Care directory.`],
    suspend: ["Your center was suspended", `"${center}" is temporarily suspended and hidden from the directory.`],
    reinstate: ["Your center is listed again", `"${center}" is listed in the MOTORNA Care directory again.`],
    revoke: ["Your center's approval was revoked", `MOTORNA Care approval for "${center}" was revoked.`],
  };
  const [subject, line] = (locale === "ar" ? ar : en)[action];
  const paras = [line, ...(reason ? [locale === "ar" ? `رسالة المشرف: ${reason}` : `Moderator's message: ${reason}`] : [])];
  return build(locale, `${subject} — MOTORNA`, subject, paras, { label: locale === "ar" ? "افتح لوحة المركز" : "Open center dashboard", url });
}
