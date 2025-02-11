import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Filter, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { cn, generateRandom } from "@/lib/utils";
import { useEffect, useState } from "react";

import { Button } from "../ui/button";
import FilterItem from "./FilterItem";
import React from "react";

export const defaultFilter = {
  id: "",
  column: "",
  operator: "",
  value: "",
};
function FilterTable({ columns, initialFilters, onApply, isMobile = false }) {
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState([
    { ...defaultFilter, id: generateRandom(8) },
  ]);
  const addFilter = () => {
    setFilters([...filters, { ...defaultFilter, id: generateRandom(8) }]);
  };
  const removeFilter = (id) => {
    setFilters((prev) => {
      const newFilters = prev.filter((f) => f.id !== id);
      if (newFilters.length === 0) {
        return [{ ...defaultFilter, id: generateRandom(8) }];
      }
      return newFilters;
    });
  };
  const updateFilter = (id, payload) => {
    setFilters((prev) => {
      const updatedFilters = prev.map((f) => {
        if (f.id === id) {
          return { ...f, ...payload };
        }
        return f;
      });
      return updatedFilters;
    });
  };
  const applyFilters = () => {
    const newFilters = [];
    filters.forEach(({ column, operator, value }) => {
      if (!column || !operator || !value) return;
      newFilters.push([column, operator, value]);
    });
    onApply(newFilters);
    setOpen(false);
  };
  useEffect(() => {
    if (!open) return;
    setFilters(() => {
      const newFilters = initialFilters
        .map((value) => {
          if (Array.isArray(value)) {
            if (value.length < 3) return null;
            return {
              id: generateRandom(8),
              column: value[0],
              operator: value[1],
              value: value[2],
            };
          }
          return null;
        })
        .filter((x) => x);
      if (newFilters.length === 0) {
        return [{ ...defaultFilter, id: generateRandom(8) }];
      }
      return newFilters;
    });
  }, [open]);

  const countFilters = Object.keys(initialFilters).length;
  const FilterProvider = isMobile ? Dialog : Popover;
  const FilterTrigger = isMobile ? DialogTrigger : PopoverTrigger;
  const FilterContent = isMobile ? DialogContent : PopoverContent;

  return (
    <FilterProvider open={open} onOpenChange={setOpen}>
      <FilterTrigger asChild>
        {isMobile ? (
          <div className="hover:bg-accent relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0">
            <Filter />
            Filter
            {countFilters > 0 && (
              <span className="badge secondary !bg-background !py-0.5 !px-1.5 !h-auto !aspect-square rounded-full border border-muted-foreground/50 !text-xs">
                {countFilters}
              </span>
            )}
          </div>
        ) : (
          <Button
            className="flex-1 relative !py-0 h-8 !px-2 border-r rounded-r-none border-muted-foreground/50"
            variant="secondary"
          >
            <Filter />
            Filter
            {countFilters > 0 && (
              <span className="badge secondary !bg-background !py-0.5 !px-1.5 !h-auto !aspect-square rounded-full border border-muted-foreground/50 !text-xs">
                {countFilters}
              </span>
            )}
          </Button>
        )}
      </FilterTrigger>
      <FilterContent className="flex flex-col w-fit">
        {isMobile && (
          <DialogHeader className="border-b border-muted-foreground/30">
            <DialogTitle className="pb-2 ">Filter</DialogTitle>
            <DialogDescription className="sr-only">
              Filter Table
            </DialogDescription>
          </DialogHeader>
        )}
        <div
          className={cn(
            !isMobile && "max-h-64",
            "grid flex-1 overflow-y-auto grid-cols-[max-content_max-content_1fr_max-content] gap-y-2 mb-4 [&>div.grid:first-child]:border-t-0 [&>div.grid:first-child]:pt-0 [&>div.grid]:pt-2 [&>div.grid]:border-t [&>div.grid]:border-muted-foreground/30",
          )}
        >
          {filters.map(({ id, ...props }) => (
            <FilterItem
              key={id}
              id={id}
              {...props}
              columns={columns}
              onChanged={updateFilter}
              removeFilter={removeFilter}
            />
          ))}
        </div>
        <div className="flex items-center justify-between py-2 border-t gap-x-6 border-muted-foreground/50">
          <Button variant="outline" className="h-8 !px-2" onClick={addFilter}>
            <Plus />
            Add Filter
          </Button>

          <div className="flex gap-x-2 ">
            <Button
              variant="secondary"
              className="h-8 !px-2"
              onClick={() =>
                setFilters([{ ...defaultFilter, id: generateRandom(8) }])
              }
            >
              Clear Filters
            </Button>
            <Button className="h-8 !px-2" onClick={applyFilters}>
              Apply Filters
            </Button>
          </div>
        </div>
      </FilterContent>
    </FilterProvider>
  );
}

export default FilterTable;
