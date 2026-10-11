// GroupPager — pager mini di header sebuah node grup (spec
// datatable2-group-tree, Requirement 14.7): mengatur halaman ANAK node itu
// (sub-grup atau baris), independen dari node lain. `show` global = ukuran
// halaman tiap list. Tampil hanya bila `total > perPage`. Klik-nya TIDAK
// boleh men-toggle header di belakangnya (stopPropagation).

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLaravelReactI18n } from "laravel-react-i18n";

import { cn } from "@/lib/utils";

/**
 * @param {object} root0
 * @param {number} root0.page halaman aktif (1-based)
 * @param {number} root0.total total item anak node
 * @param {number} root0.perPage ukuran halaman (`per_page` respons node)
 * @param {(page: number) => void} root0.onPageChange
 * @param {string} [root0.className]
 */
export default function GroupPager({
  page,
  total,
  perPage,
  onPageChange,
  className,
}) {
  const { t } = useLaravelReactI18n();
  if (!perPage || total <= perPage) return null;

  const lastPage = Math.ceil(total / perPage);
  const start = (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, total);
  // Tombol kontras & berborder membulat (feedback user): warna primer, ikon
  // putih, hover lebih gelap; disabled tetap terlihat tapi redup.
  const buttonClass =
    "p-1 rounded-md border border-primary bg-primary text-primary-foreground shadow-sm hover:bg-primary/80 disabled:opacity-40 disabled:pointer-events-none";

  return (
    <span
      className={cn(
        // `inline-flex!`: table.css memaksa `td span { display: block }` --
        // tanpa `!` pager di baris header desktop bertumpuk (teks di atas panah).
        "ml-auto inline-flex! items-center gap-x-1 text-xs font-normal text-muted-foreground",
        className,
      )}
      onClick={(event) => event.stopPropagation()}
    >
      {/* Nama placeholder TIDAK boleh berawalan sama (`:to` vs `:total` ->
          "3tal"): laravel-react-i18n mengganti berurutan tanpa urut panjang. */}
      <span>
        {t("core.datatable.group_pager.range", { start, end, total })}
      </span>
      <button
        type="button"
        className={buttonClass}
        disabled={page <= 1}
        aria-label={t("core.datatable.group_pager.previous")}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft className="size-4" />
      </button>
      <button
        type="button"
        className={buttonClass}
        disabled={page >= lastPage}
        aria-label={t("core.datatable.group_pager.next")}
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRight className="size-4" />
      </button>
    </span>
  );
}
