import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { StaticPage } from "@/content/pages";
import { Notice } from "@/components/ui/states";

export function StaticPageView({ page, dict, children }: { page: StaticPage; locale: Locale; dict: Dictionary; children?: React.ReactNode }) {
  return (
    <article className="container-page max-w-3xl py-12">
      <h1 className="text-3xl font-bold sm:text-4xl">{page.title}</h1>
      {page.intro && <p className="mt-4 text-lg leading-relaxed text-ink-2">{page.intro}</p>}
      {page.draft && <Notice tone="warning" className="mt-6">{dict.pages.draftNotice}</Notice>}
      <div className="mt-10 flex flex-col gap-9">
        {page.sections.map((s, i) => (
          <section key={i}>
            {s.heading && <h2 className="mb-3 text-xl font-semibold">{s.heading}</h2>}
            {s.paragraphs?.map((p) => <p key={p} className="mb-3 max-w-[70ch] leading-relaxed text-ink-2">{p}</p>)}
            {s.list && (
              <ul className="flex list-disc flex-col gap-2 ps-5 leading-relaxed text-ink-2">
                {s.list.map((li) => <li key={li}>{li}</li>)}
              </ul>
            )}
          </section>
        ))}
        {children}
      </div>
    </article>
  );
}
