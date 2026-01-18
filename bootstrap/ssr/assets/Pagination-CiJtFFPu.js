import { jsxs, jsx } from "react/jsx-runtime";
import { D as Dialog, e as DialogTrigger, f as DialogContent, g as DialogHeader, h as DialogTitle, i as DialogDescription } from "./command-BSnyCa9u.js";
import { Filter, Plus, MoreHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import { P as Popover, a as PopoverTrigger, b as PopoverContent } from "./popover-CziqY8mR.js";
import { k as generateRandom, c as cn } from "./utils-ClCZGsDL.js";
import * as React from "react";
import { memo, useState, useEffect } from "react";
import { B as Button, b as buttonVariants } from "./button-Us2TB7GG.js";
import { F as FilterItem } from "./Header-C9Xb62yg.js";
import { useLaravelReactI18n } from "laravel-react-i18n";
const defaultFilter = {
  id: "",
  column: "",
  operator: "",
  value: ""
};
function FilterTable({ columns, initialFilters, onApply, isMobile = false }) {
  const { t } = useLaravelReactI18n();
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState([
    { ...defaultFilter, id: generateRandom(8) }
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
      const newFilters = initialFilters.map((value) => {
        if (Array.isArray(value)) {
          if (value.length < 3) return null;
          return {
            id: generateRandom(8),
            column: value[0],
            operator: value[1],
            value: value[2]
          };
        }
        return null;
      }).filter((x) => x);
      if (newFilters.length === 0) {
        return [{ ...defaultFilter, id: generateRandom(8) }];
      }
      return newFilters;
    });
  }, [open]);
  const countFilters = initialFilters.length;
  const FilterProvider = isMobile ? Dialog : Popover;
  const FilterTrigger = isMobile ? DialogTrigger : PopoverTrigger;
  const FilterContent = isMobile ? DialogContent : PopoverContent;
  return /* @__PURE__ */ jsxs(FilterProvider, { open, onOpenChange: setOpen, children: [
    /* @__PURE__ */ jsx(FilterTrigger, { asChild: true, children: isMobile ? /* @__PURE__ */ jsxs("div", { className: "hover:bg-accent relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0", children: [
      /* @__PURE__ */ jsx(Filter, {}),
      t("core.datatable.filter.filter"),
      countFilters > 0 && /* @__PURE__ */ jsx("span", { className: "badge secondary bg-background! py-0.5! px-1.5! h-auto! aspect-square! rounded-full border border-muted-foreground/50 text-xs!", children: countFilters })
    ] }) : /* @__PURE__ */ jsxs(
      Button,
      {
        className: cn(
          countFilters > 0 ? "border-r rounded-r-none" : "rounded-r",
          "flex-1 relative py-0! h-8 px-2!  border-muted-foreground/50"
        ),
        variant: "secondary",
        children: [
          /* @__PURE__ */ jsx(Filter, {}),
          t("core.datatable.filter.filter"),
          countFilters > 0 && /* @__PURE__ */ jsx("span", { className: "badge secondary bg-background! py-0.5! px-1.5! h-auto! aspect-square! rounded-full border border-muted-foreground/50 text-xs!", children: countFilters })
        ]
      }
    ) }),
    /* @__PURE__ */ jsxs(FilterContent, { className: "flex flex-col w-auto max-w-full overflow-hidden", children: [
      isMobile && /* @__PURE__ */ jsxs(DialogHeader, { className: "border-b border-muted-foreground/30", children: [
        /* @__PURE__ */ jsx(DialogTitle, { className: "pb-2 ", children: t("core.datatable.filter.filter") }),
        /* @__PURE__ */ jsx(DialogDescription, { className: "sr-only", children: "Filter Table" })
      ] }),
      /* @__PURE__ */ jsx(
        "div",
        {
          className: cn(
            !isMobile && "max-h-64",
            "grid max-w-full flex-1 overflow-y-auto grid-cols-[max-content_max-content_auto_max-content] gap-y-2 mb-4 [&>div.grid:first-child]:border-t-0 [&>div.grid:first-child]:pt-0 [&>div.grid]:pt-2 [&>div.grid]:border-t [&>div.grid]:border-muted-foreground/30"
          ),
          children: filters.map(({ id, ...props }) => {
            if (props.type == "relations" || props.type == "mixed") return;
            return /* @__PURE__ */ jsx(
              FilterItem,
              {
                id,
                ...props,
                columns,
                onChanged: updateFilter,
                removeFilter
              },
              id
            );
          })
        }
      ),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between py-2 border-t gap-x-6 border-muted-foreground/50", children: [
        /* @__PURE__ */ jsxs(Button, { variant: "outline", className: "h-8 px-2!", onClick: addFilter, children: [
          /* @__PURE__ */ jsx(Plus, {}),
          t("core.datatable.filter.add_filter")
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex gap-x-2 ", children: [
          /* @__PURE__ */ jsx(
            Button,
            {
              variant: "secondary",
              className: "h-8 px-2!",
              onClick: () => setFilters([{ ...defaultFilter, id: generateRandom(8) }]),
              children: t("core.datatable.filter.clear_filters")
            }
          ),
          /* @__PURE__ */ jsx(Button, { className: "h-8 px-2!", onClick: applyFilters, children: t("core.datatable.filter.apply_filters") })
        ] })
      ] })
    ] })
  ] });
}
const FilterTable$1 = memo(FilterTable);
const Pagination$1 = ({ className, ...props }) => /* @__PURE__ */ jsx(
  "nav",
  {
    role: "navigation",
    "aria-label": "pagination",
    className: cn("mx-auto flex w-full justify-center", className),
    ...props
  }
);
Pagination$1.displayName = "Pagination";
const PaginationContent = React.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(
  "ul",
  {
    ref,
    className: cn("flex flex-row items-center gap-1", className),
    ...props
  }
));
PaginationContent.displayName = "PaginationContent";
const PaginationItem = React.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx("li", { ref, className: cn("", className), ...props }));
PaginationItem.displayName = "PaginationItem";
const PaginationButton = ({ className, isActive, size = "icon", ...props }) => /* @__PURE__ */ jsx(
  "button",
  {
    type: "button",
    "aria-current": isActive ? "page" : void 0,
    className: cn(
      buttonVariants({
        variant: isActive ? "secondary" : "ghost",
        size
      }),
      className
    ),
    ...props
  }
);
PaginationButton.displayName = "PaginationButton";
const PaginationEllipsis = ({ className, ...props }) => /* @__PURE__ */ jsxs(
  "span",
  {
    "aria-hidden": true,
    className: cn("flex h-9 w-9 items-center justify-center", className),
    ...props,
    children: [
      /* @__PURE__ */ jsx(MoreHorizontal, { className: "w-4 h-4" }),
      /* @__PURE__ */ jsx("span", { className: "sr-only", children: "More pages" })
    ]
  }
);
PaginationEllipsis.displayName = "PaginationEllipsis";
function condensePages(totalPages, currentPage, changePage) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  const maxAdjacent = 2;
  const result = [];
  let previousPage = null;
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    if (i < maxAdjacent || // Halaman awal
    i > pages.length - maxAdjacent - 1 || // Halaman akhir
    Math.abs(page - currentPage) <= maxAdjacent - 1) {
      if (previousPage !== null && page !== previousPage + 1) {
        result.push(
          /* @__PURE__ */ jsx(PaginationItem, { children: /* @__PURE__ */ jsx(PaginationEllipsis, {}) }, `ellipsis-${page}`)
        );
      }
      result.push(
        /* @__PURE__ */ jsx(PaginationItem, { children: /* @__PURE__ */ jsx(
          PaginationButton,
          {
            onClick: () => changePage(page),
            isActive: page === currentPage,
            children: page
          }
        ) }, page)
      );
      previousPage = page;
    }
  }
  return result;
}
function Pagination({ currentPage = 1, totalPages, onPageChanged, ...props }) {
  if (!totalPages || totalPages <= 1) {
    return null;
  }
  const changePage = (page) => {
    if (onPageChanged) onPageChanged(page);
  };
  return /* @__PURE__ */ jsx(Pagination$1, { ...props, children: /* @__PURE__ */ jsxs(PaginationContent, { children: [
    currentPage > 1 && /* @__PURE__ */ jsx(PaginationItem, { children: /* @__PURE__ */ jsxs(
      PaginationButton,
      {
        "aria-label": "Go to previous page",
        size: "default",
        className: cn("gap-1 pl-2.5"),
        onClick: () => changePage(currentPage - 1),
        children: [
          /* @__PURE__ */ jsx(ChevronLeft, { className: "w-4 h-4" }),
          /* @__PURE__ */ jsx("span", { children: "Previous" })
        ]
      }
    ) }),
    condensePages(totalPages, currentPage, changePage),
    currentPage < totalPages && /* @__PURE__ */ jsx(PaginationItem, { children: /* @__PURE__ */ jsxs(
      PaginationButton,
      {
        "aria-label": "Go to next page",
        size: "default",
        className: cn("gap-1 pr-2.5"),
        onClick: () => changePage(currentPage + 1),
        children: [
          /* @__PURE__ */ jsx("span", { children: "Next" }),
          /* @__PURE__ */ jsx(ChevronRight, { className: "w-4 h-4" })
        ]
      }
    ) })
  ] }) });
}
export {
  FilterTable$1 as F,
  Pagination as P
};
