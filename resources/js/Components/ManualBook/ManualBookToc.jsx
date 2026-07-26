import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/Components/ui/collapsible";

import { ChevronRight } from "lucide-react";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { useMemo } from "react";

/**
 * Kelompokkan daftar heading h2/h3 datar jadi grup: tiap h2 memegang h3
 * berikutnya sampai h2 berikutnya muncul. h2 tanpa h3 di bawahnya tetap jadi
 * grup dengan `children` kosong (dirender sebagai link biasa, tanpa dropdown).
 * @param {Array<{id: string, text: string, level: number}>} headings
 * @returns {Array<{id: string, text: string, children: Array<{id: string, text: string}>}>}
 */
function groupHeadings(headings) {
  const groups = [];

  for (const heading of headings) {
    if (heading.level === 2) {
      groups.push({ id: heading.id, text: heading.text, children: [] });
    } else if (groups.length > 0) {
      groups.at(-1).children.push(heading);
    }
  }

  return groups;
}

function TocGroup({ group }) {
  if (group.children.length === 0) {
    return (
      <li>
        <a
          href={`#${group.id}`}
          className="block truncate py-1 text-muted-foreground hover:text-foreground hover:underline"
          title={group.text}
        >
          {group.text}
        </a>
      </li>
    );
  }

  return (
    <li>
      <Collapsible defaultOpen={false} className="group/toc-item">
        <div className="flex items-center gap-1">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex size-5 shrink-0 items-center justify-center rounded hover:bg-accent"
            >
              <ChevronRight className="size-3.5 transition-transform duration-200 group-data-[state=open]/toc-item:rotate-90" />
            </button>
          </CollapsibleTrigger>
          <a
            href={`#${group.id}`}
            className="block truncate py-1 text-muted-foreground hover:text-foreground hover:underline"
            title={group.text}
          >
            {group.text}
          </a>
        </div>
        <CollapsibleContent>
          <ul className="ml-6 space-y-1 border-l pl-2">
            {group.children.map((child) => (
              <li key={child.id}>
                <a
                  href={`#${child.id}`}
                  className="block truncate py-1 text-muted-foreground hover:text-foreground hover:underline"
                  title={child.text}
                >
                  {child.text}
                </a>
              </li>
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}

/**
 * Sidebar daftar isi untuk halaman detail Manual Book. Dibangun dari heading
 * h2/h3 yang sudah dirender di konten (id-nya sama dengan slug yang dipakai
 * backend lewat HeadingPermalinkExtension), jadi klik item di sini langsung
 * scroll ke section yang sesuai tanpa reload halaman. Tiap section h2 yang
 * punya sub-section (h3) bisa di-dropdown sendiri, supaya daftar isi tidak
 * memanjang ke bawah saat sub-section-nya banyak.
 * @param {object} props
 * @param {Array<{id: string, text: string, level: number}>} props.headings
 * @returns {JSX.Element | null}
 */
export default function ManualBookToc({ headings }) {
  const { t } = useLaravelReactI18n();
  const groups = useMemo(() => groupHeadings(headings), [headings]);

  if (groups.length === 0) {
    return null;
  }

  return (
    <nav className="sticky top-[calc(1rem+2.125rem+1rem)] max-h-[calc(100vh-9rem)] overflow-y-auto rounded-lg border bg-card p-4 text-sm print:hidden">
      <p className="mb-2 font-semibold text-foreground">
        {t("core.manualBook.tableOfContents", "Daftar Isi")}
      </p>
      <ul className="space-y-1">
        {groups.map((group) => (
          <TocGroup key={group.id} group={group} />
        ))}
      </ul>
    </nav>
  );
}
