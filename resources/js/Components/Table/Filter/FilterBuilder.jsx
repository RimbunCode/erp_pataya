import { Plus } from "lucide-react";
import { useEffect, useRef } from "react";
import useNestedFilters, {
  NestedFiltersProvider,
} from "@/Hooks/useNestedFilters";

import { Button } from "../../ui/button";
import FilterGroup2 from "./FilterGroup2";
import { cn } from "@/lib/utils";
import { useLaravelReactI18n } from "laravel-react-i18n";

/**
 * FilterBuilder — komponen presentational reusable untuk menyusun filter tree
 * nested (AND/OR). TIDAK mengandung Dialog atau logika saved-filter, sehingga
 * dapat dipakai ulang (mis. SelectModel) hanya dengan controlled props.
 *
 * Kontrak:
 *   columns  : peta kolom dari getColumns() (sumber type/options/related)
 *   value    : filter tree controlled ({ root: { k, c } }) — opsional
 *   onChange : (tree) => void, dipanggil tiap tree berubah
 *
 * State builder dipegang `useNestedFilters` (headless). FilterBuilder hanya
 * menyediakan Provider + UI; konsumen lain boleh memakai `FilterBuilderBody`
 * langsung bila sudah berada dalam NestedFiltersProvider.
 */
export default function FilterBuilder({ columns, value, onChange, className }) {
  return (
    <NestedFiltersProvider initialFilters={value} columns={columns}>
      <FilterBuilderBody value={value} onChange={onChange} className={className} />
    </NestedFiltersProvider>
  );
}

/**
 * Body builder — harus dipakai di dalam NestedFiltersProvider. Mengangkat state
 * tree ke `onChange` dan menyinkronkan kembali bila `value` controlled berubah
 * dari luar.
 */
export function FilterBuilderBody({ value, onChange, className }) {
  const { t } = useLaravelReactI18n();
  const { filters, setFromInitial, resetFilters, addItemToGroup } =
    useNestedFilters();

  // Angkat perubahan tree ke parent. Bandingkan referensi agar tak loop dengan
  // sinkronisasi controlled di bawah.
  const lastEmitted = useRef(null);
  useEffect(() => {
    if (!onChange) return;
    if (filters === lastEmitted.current) return;
    lastEmitted.current = filters;
    onChange(filters);
  }, [filters, onChange]);

  // Sinkronkan bila parent menyetel `value` baru (mis. load saved filter).
  const lastValue = useRef(value);
  useEffect(() => {
    if (value === lastValue.current) return;
    lastValue.current = value;
    if (value && value !== filters) {
      setFromInitial(value);
    }
  }, [value, filters, setFromInitial]);

  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn(
          "grid max-w-full flex-1 overflow-y-auto grid-cols-[auto_max-content_auto_max-content] gap-y-2 gap-x-4 [&>div.grid:first-child]:border-t-0 [&>div.grid:first-child]:pt-0 [&>div.grid]:pt-2 [&>div.grid]:border-t [&>div.grid]:border-muted-foreground/30",
          className,
        )}
      >
        {Object.entries(filters).map(([id]) => (
          <FilterGroup2 key={id} id={id} />
        ))}
      </div>
      <div className="flex items-center justify-between gap-x-6">
        <Button
          variant="outline"
          className="h-8 px-2!"
          type="button"
          onClick={() => addItemToGroup("root")}
        >
          <Plus />
          {t("core.datatable.filter.add_filter")}
        </Button>
        <Button
          variant="secondary"
          className="h-8 px-2!"
          type="button"
          onClick={resetFilters}
        >
          {t("core.datatable.filter.clear_filters")}
        </Button>
      </div>
    </div>
  );
}
