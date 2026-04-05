import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../ui/dialog";
import { Filter, Plus } from "lucide-react";
import { memo, useEffect, useState } from "react";
import useNestedFilters, {
  NestedFiltersProvider,
  flattenFilters,
} from "@/Hooks/useNestedFilters";

import { Button } from "../../ui/button";
import FilterGroup2 from "./FilterGroup2";
import { cn } from "@/lib/utils";
import { useLaravelReactI18n } from "laravel-react-i18n";

function FilterTable({ columns, initialFilters, onApply, isMobile = false }) {
  const { t } = useLaravelReactI18n();
  const [open, setOpen] = useState(false);

  // const countFilters = initialFilters.length;
  const FilterProvider = Dialog;
  const FilterTrigger = DialogTrigger;
  const FilterContent = DialogContent;

  return (
    <NestedFiltersProvider initialFilters={initialFilters} columns={columns}>
      <FilterProvider open={open} onOpenChange={setOpen}>
        <FilterTrigger asChild>
          {isMobile ? (
            <div className="hover:bg-accent relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0">
              <Filter />
              {t("core.datatable.filter.filter")}
              {/* {countFilters > 0 && (
                <span className="badge secondary bg-background! py-0.5! px-1.5! h-auto! aspect-square! rounded-full border border-muted-foreground/50 text-xs!">
                  {countFilters}
                </span>
              )} */}
            </div>
          ) : (
            <Button
              className={cn(
                // countFilters > 0 ? "border-r rounded-r-none" : "rounded-r",
                "flex-1 relative py-0! h-8 px-2!  border-muted-foreground/50",
              )}
              variant="secondary"
            >
              <Filter />
              {t("core.datatable.filter.filter")}
              {/* {countFilters > 0 && (
                <span className="badge secondary bg-background! py-0.5! px-1.5! h-auto! aspect-square! rounded-full border border-muted-foreground/50 text-xs!">
                  {countFilters}
                </span>
              )} */}
            </Button>
          )}
        </FilterTrigger>
        <FilterContent
          forceAsDialog
          className="flex flex-col max-w-full md:max-w-(--breakpoint-xl) w-full h-auto max-h-[92svh] overflow-hidden"
        >
          <FilterTableContent
            initialFilters={initialFilters}
            onApply={onApply}
            isMobile={isMobile}
            open={open}
            setOpen={setOpen}
          />
        </FilterContent>
      </FilterProvider>
    </NestedFiltersProvider>
  );
}

export default memo(FilterTable);

function FilterTableContent({
  initialFilters,
  onApply,
  isMobile,
  open,
  setOpen,
}) {
  const { t } = useLaravelReactI18n();
  const { filters, setFromInitial, resetFilters, addItemToGroup } =
    useNestedFilters();
  const applyFilters = () => {
    const flatFilters = flattenFilters(filters);
    onApply?.(flatFilters, filters);
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    setFromInitial(initialFilters);
  }, [open, initialFilters, setFromInitial]);

  return (
    <>
      <DialogHeader className="border-b border-muted-foreground/30">
        <DialogTitle className="pb-2 ">
          {t("core.datatable.filter.filter")}
        </DialogTitle>
        <DialogDescription className="sr-only">Filter Table</DialogDescription>
      </DialogHeader>
      <div
        className={cn(
          !isMobile && "max-h-[92%]",
          "grid max-w-full flex-1 overflow-y-auto grid-cols-[auto_max-content_auto_max-content] gap-y-2 gap-x-4 mb-4 [&>div.grid:first-child]:border-t-0 [&>div.grid:first-child]:pt-0 [&>div.grid]:pt-2 [&>div.grid]:border-t [&>div.grid]:border-muted-foreground/30",
        )}
      >
        {Object.entries(filters).map(([id]) => {
          // if (props.type == "relations" || props.type == "mixed") return;
          return (
            <FilterGroup2 key={id} id={id} />
            // <FilterItem
            //   key={id}
            //   id={id}
            //   {...props}
            //   columns={columns}
            //   onChanged={updateFilter}
            //   removeFilter={removeFilter}
            // />
          );
        })}
      </div>
      <div className="flex items-center justify-between py-2 border-t gap-x-6 border-muted-foreground/50">
        <Button
          variant="outline"
          className="h-8 px-2!"
          type="button"
          onClick={() => addItemToGroup("root")}
        >
          <Plus />
          {t("core.datatable.filter.add_filter")}
        </Button>

        <div className="flex gap-x-2 ">
          <Button
            variant="secondary"
            className="h-8 px-2!"
            onClick={resetFilters}
          >
            {t("core.datatable.filter.clear_filters")}
          </Button>
          <Button className="h-8 px-2!" onClick={applyFilters}>
            {t("core.datatable.filter.apply_filters")}
          </Button>
        </div>
      </div>
    </>
  );
}
