import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { Ellipsis, RefreshCw, X, ArrowUpNarrowWide, ArrowDownWideNarrow, Plus } from "lucide-react";
import { B as Button, b as buttonVariants } from "./button-Us2TB7GG.js";
import { D as DropdownMenu, a as DropdownMenuTrigger, b as DropdownMenuContent, c as DropdownMenuItem, h as DropdownMenuSub, i as DropdownMenuSubTrigger, j as DropdownMenuPortal, k as DropdownMenuSubContent, l as DropdownMenuRadioGroup, m as DropdownMenuRadioItem, f as DropdownMenuSeparator, g as DropdownMenuGroup, d as DropdownMenuLabel } from "./ToggleTheme-BSs-sHS2.js";
import { usePage, router, Head } from "@inertiajs/react";
import { S as Select, a as SelectTrigger, b as SelectValue, c as SelectContent, d as SelectItem } from "./select-XM4G_Lvw.js";
import { T as Tooltip, a as TooltipTrigger, b as TooltipContent } from "./tooltip-Df8khweJ.js";
import React__default, { memo, useState, useRef, useEffect, useCallback, cloneElement, forwardRef, useImperativeHandle } from "react";
import { s as saveToLocalStorage, c as cn, b as getFromLocalStorage, a as getLocaleDate } from "./utils-ClCZGsDL.js";
import { A as AppLayout } from "./AppLayout-Drqdr6Z-.js";
import { F as FilterTable, P as Pagination } from "./Pagination-CiJtFFPu.js";
import { L as Label } from "./label-DiFvdPYz.js";
import { H as Header, N as NoDataImg, C as ColumnsFilter } from "./Header-C9Xb62yg.js";
import QueryString from "qs";
import { S as ScrollArea } from "./DatetimePicker-C3h7-5Qi.js";
import { TZDate } from "@date-fns/tz";
import { useSensors, useSensor, MouseSensor, TouchSensor, DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { C as Checkbox } from "./checkbox-C_BEU5E4.js";
import { D as Dialog } from "./command-BSnyCa9u.js";
import { debounce } from "lodash";
import { b as useDidMountEffect } from "./Link-p0Z4AKax.js";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { format } from "date-fns";
import { u as useIsMobile } from "./use-mobile-BsFue-bT.js";
import "radix-ui";
import "class-variance-authority";
import "@radix-ui/react-dropdown-menu";
import "./MasterLayout-CRsmljQs.js";
import "@radix-ui/react-alert-dialog";
import "sonner";
import "zustand";
import "@radix-ui/react-select";
import "@radix-ui/react-tooltip";
import "date-fns/locale";
import "buffer";
import "clsx";
import "tailwind-merge";
import "@radix-ui/react-dialog";
import "./input-wk3Ou7wI.js";
import "@radix-ui/react-separator";
import "./skeleton-IN0PLOYc.js";
import "@radix-ui/react-slot";
import "./popover-CziqY8mR.js";
import "@radix-ui/react-popover";
import "./avatar-_KK8H2Pc.js";
import "@radix-ui/react-avatar";
import "@radix-ui/react-label";
import "./Combobox-CnMmTQqc.js";
import "./drawer-D3vDykaS.js";
import "vaul";
import "@dnd-kit/utilities";
import "react-day-picker";
import "@radix-ui/react-scroll-area";
import "react-detect-click-outside";
import "@radix-ui/react-checkbox";
import "cmdk";
import "./LoadingIcon-CRleOEtX.js";
import "axios";
import "pluralize";
import "./tabs-DhZjhdeH.js";
import "@radix-ui/react-tabs";
import "./InputError-2JjWc6nJ.js";
import "./Select-DB9toH_t.js";
import "@radix-ui/react-accordion";
import "@radix-ui/react-progress";
import "@headlessui/react";
import "./Comments-Bvo3255G.js";
import "quill-mention/autoregister";
import "quill";
import "@inertiajs/core";
import "@remixicon/react";
import "./Tags-D6pM3ZUY.js";
import "@marcbachmann/cel-js";
const DATATABLE_COLUMNS_KEY = "datatable_columns";
const DATATABLE_COLUMNS_EXPIRED$1 = 7;
const convertColWidth = (colWidth) => {
  if (colWidth) {
    switch (colWidth) {
      case "grow":
        return "1fr";
      case "fit":
        return "max-content";
      default:
        return colWidth;
    }
  } else {
    return "minmax(0px, 1fr)";
  }
};
const createHeaders = (headers) => {
  const columnsMap = new Map(
    headers.map((col) => [
      col.name,
      {
        ...col,
        sort: null,
        show: col.show ?? true,
        ref: useRef(),
        size: convertColWidth(col.width)
      }
    ])
  );
  let finalColumns = [];
  const columnsFromCookie = getFromLocalStorage(DATATABLE_COLUMNS_KEY);
  if (!columnsFromCookie) {
    return Array.from(columnsMap.values());
  }
  columnsFromCookie.forEach((col) => {
    const oriCol = columnsMap.get(col.name);
    if (!oriCol) return;
    oriCol.show = col.show ?? oriCol.show;
    finalColumns.push(oriCol);
    columnsMap.delete(col.name);
  });
  columnsMap.values().forEach((col) => {
    finalColumns.push(col);
  });
  return finalColumns;
};
function Table({
  className,
  selectable,
  actions,
  columns: headers,
  freezeColumn = 0,
  onOptionsChanged,
  options: initialOptions = {},
  data: initialData = [],
  setSort,
  resetSorting
}) {
  const { t } = useLaravelReactI18n();
  const [data, setData] = useState(initialData);
  useDidMountEffect(() => {
    setData(initialData);
  }, [initialData]);
  const [_options, _setOptions] = useState({
    page: 1,
    sort: {
      key: null,
      order: null
    },
    search: {}
  });
  const options = initialOptions ?? _options;
  const setOptions = React__default.useCallback(
    (value) => {
      const optionsState = typeof value === "function" ? value(options) : value;
      if (onOptionsChanged) {
        onOptionsChanged(optionsState);
      } else {
        _setOptions(optionsState);
      }
    },
    [initialOptions, _options]
  );
  const minCellWidth = 120;
  const [tableHeight, setTableHeight] = useState("auto");
  const [activeIndex, setActiveIndex] = useState(null);
  const tableElement = useRef(null);
  const [columns, setColumns] = useState(createHeaders(headers));
  const [openColumnsFilter, setOpenColumnsFilter] = useState(false);
  const sensors = useSensors(
    useSensor(MouseSensor, {
      // Require the mouse to move by 10 pixels before activating
      activationConstraint: {
        distance: 10
      }
    }),
    useSensor(TouchSensor, {
      // Press delay of 250ms, with tolerance of 5px of movement
      activationConstraint: {
        delay: 250,
        tolerance: 5
      }
    })
    // useSensor(KeyboardSensor, {
    //   coordinateGetter: sortableKeyboardCoordinates,
    // }),
  );
  useDidMountEffect(() => {
    saveToLocalStorage(
      DATATABLE_COLUMNS_KEY,
      columns.map((x) => ({ name: x.name, show: x.show })),
      DATATABLE_COLUMNS_EXPIRED$1
    );
  }, [columns]);
  function handleDragOver(event) {
    const { active, over } = event;
    if (active.id !== over.id) {
      setColumns((items) => {
        const newItems = items.map((x) => x.name);
        const newIndex = newItems.indexOf(over.id);
        if (newIndex < freezeColumn) return items;
        const oldIndex = newItems.indexOf(active.id);
        const newColumn = arrayMove(items, oldIndex, newIndex);
        tableElement.current.style.gridTemplateColumns = `${selectable ? "max-content" : ""} ${actions ? "max-content" : ""}  ${newColumn.filter((x) => x.show).map((x) => x.size).join(" ")}`;
        return newColumn;
      });
    }
  }
  useEffect(() => {
    setTableHeight(tableElement.current.offsetHeight);
  }, [tableElement]);
  const mouseDown = (index) => {
    setActiveIndex(index);
  };
  const showedColumns = columns.filter((x) => x.show);
  const mouseMove = useCallback(
    (e) => {
      const newColumns = [];
      const gridColumns = showedColumns.map((col, i) => {
        var _a, _b, _c, _d;
        if (i === activeIndex) {
          const width = e.clientX - ((_a = col.ref.current) == null ? void 0 : _a.offsetLeft);
          if (width >= minCellWidth) {
            const size2 = `${width}px`;
            newColumns.push({ ...col, size: size2 });
            return size2;
          }
        }
        let size = "";
        if (i < activeIndex) {
          size = `${(_b = col.ref.current) == null ? void 0 : _b.offsetWidth}px`;
        } else {
          if ((_c = col.size) == null ? void 0 : _c.startsWith("minmax")) {
            size = "minmax(0px, 1fr)";
          } else if (col.size == "1fr" || col.size == "max-content") {
            size = col.size;
          } else {
            size = `${(_d = col.ref.current) == null ? void 0 : _d.offsetWidth}px`;
          }
        }
        newColumns.push({ ...col, size });
        return size;
      });
      debounce(() => setColumns(newColumns), 500)();
      tableElement.current.style.gridTemplateColumns = `${selectable ? "max-content" : ""} ${actions ? "max-content" : ""} ${gridColumns.join(
        " "
      )}`;
    },
    [activeIndex, showedColumns, minCellWidth]
  );
  const resetSizeHeader = (index) => {
    const newColumns = [];
    const gridColumns = showedColumns.map((col, i) => {
      if (i === index) {
        const size = convertColWidth(col.width);
        newColumns.push({ ...col, size });
        return size;
      }
      newColumns.push({ ...col, size: col.size });
      return col.size;
    });
    debounce(() => setColumns(newColumns), 500)();
    tableElement.current.style.gridTemplateColumns = `${selectable ? "max-content" : ""} ${actions ? "max-content" : ""} ${gridColumns.join(
      " "
    )}`;
  };
  const removeListeners = useCallback(() => {
    window.removeEventListener("mousemove", mouseMove);
    window.removeEventListener("mouseup", removeListeners);
  }, [mouseMove]);
  const mouseUp = useCallback(() => {
    setActiveIndex(null);
    removeListeners();
  }, [setActiveIndex, removeListeners]);
  useEffect(() => {
    if (activeIndex !== null) {
      window.addEventListener("mousemove", mouseMove);
      window.addEventListener("mouseup", mouseUp);
    }
    return () => {
      removeListeners();
    };
  }, [activeIndex, mouseMove, mouseUp, removeListeners]);
  const checkAll = (check) => {
    setData((data2) => {
      const newData = data2.map((x) => ({ ...x, isSelected: check }));
      return newData;
    });
  };
  const checklist = (row, check) => {
    setData((data2) => {
      const newData = data2.map((x) => {
        if (x.id === row.id) {
          return { ...x, isSelected: check };
        }
        return x;
      });
      return newData;
    });
  };
  return /* @__PURE__ */ jsx("div", { className: cn(className, "flex flex-col gap-x-2"), children: /* @__PURE__ */ jsx(
    DndContext,
    {
      onDragOver: handleDragOver,
      sensors,
      collisionDetection: closestCenter,
      children: /* @__PURE__ */ jsxs(Dialog, { open: openColumnsFilter, onOpenChange: setOpenColumnsFilter, children: [
        /* @__PURE__ */ jsx("div", { className: "flex-1", children: /* @__PURE__ */ jsxs(
          "table",
          {
            className: cn("resizeable-table"),
            ref: tableElement,
            style: {
              gridTemplateRows: [
                "auto",
                ...data.map(() => "auto"),
                "1fr"
              ].join(" "),
              gridTemplateColumns: (selectable ? "max-content " : "") + (actions ? "max-content " : "") + showedColumns.map((col) => convertColWidth(col.width)).join(" ")
            },
            children: [
              /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsxs(
                SortableContext,
                {
                  items: showedColumns.map((x) => x.name),
                  strategy: horizontalListSortingStrategy,
                  children: [
                    selectable && /* @__PURE__ */ jsx("th", { className: "py-2! px-2! pr-4! items-center", children: /* @__PURE__ */ jsx(
                      Checkbox,
                      {
                        checked: data.every((x) => x.isSelected ?? false),
                        onCheckedChange: checkAll
                      }
                    ) }),
                    actions && /* @__PURE__ */ jsxs("th", { className: "py-2! px-2! pr-4! items-center", children: [
                      /* @__PURE__ */ jsx("span", { children: t("core.datatable.action") }),
                      /* @__PURE__ */ jsx(
                        "div",
                        {
                          style: { height: tableHeight },
                          className: cn(
                            !data || data.length === 0 ? "h-[40px]!" : "",
                            `flex opacity-100 justify-center items-center absolute w-4 -right-2 top-0 z-1`
                          ),
                          children: /* @__PURE__ */ jsx(
                            "div",
                            {
                              className: cn(
                                "h-full border-r border-muted-foreground/15 w-px"
                              )
                            }
                          )
                        }
                      )
                    ] }),
                    showedColumns.map(({ ref, resizeable, ...props }, i) => /* @__PURE__ */ jsx(
                      Header,
                      {
                        isEmpty: !data || data.length === 0,
                        setSort,
                        resetSorting,
                        options,
                        setOptions,
                        freezeColumn: i < freezeColumn,
                        id: props.name,
                        ref,
                        resizeable: resizeable && i < showedColumns.length - 1,
                        ...props,
                        onResize: () => mouseDown(i),
                        onResetSize: () => resetSizeHeader(i),
                        tableHeight
                      },
                      props.name
                    ))
                  ]
                }
              ) }) }),
              /* @__PURE__ */ jsx("tbody", { children: !data || data.length === 0 ? /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx(
                "td",
                {
                  className: "border-b-0! items-center justify-center",
                  style: {
                    gridColumn: `span ${showedColumns.length + (selectable ? 1 : 0) + (actions ? 1 : 0)}`
                  },
                  children: /* @__PURE__ */ jsx(NoDataImg, { className: "w-full max-w-lg" })
                }
              ) }) : /* @__PURE__ */ jsxs(Fragment, { children: [
                data.map((row, i) => /* @__PURE__ */ jsxs("tr", { children: [
                  selectable && /* @__PURE__ */ jsx("td", { className: "py-2! px-2! items-center", children: /* @__PURE__ */ jsx(
                    Checkbox,
                    {
                      checked: row.isSelected ?? false,
                      onCheckedChange: (check) => checklist(row, check)
                    }
                  ) }),
                  actions && /* @__PURE__ */ jsx("td", { className: "w-full", children: actions({ dataRow: row }) }),
                  showedColumns.map(
                    ({ cell, name, parse, parseTrans }) => {
                      return /* @__PURE__ */ jsx("td", { children: (() => {
                        var _a, _b, _c, _d;
                        if (typeof cell == "function") {
                          const child = cell({
                            dataRow: row,
                            valueCell: parseTrans ? t(
                              `${parseTrans}.${(_a = row[name]) == null ? void 0 : _a.toString()}`
                            ) : parse ? parse[(_b = row[name]) == null ? void 0 : _b.toString()] ?? "" : row[name]
                          });
                          if (child) {
                            return cloneElement(child, {
                              ...child.props,
                              className: cn(
                                child.props.className,
                                "text-ellipsis truncate"
                              )
                            });
                          }
                        }
                        return /* @__PURE__ */ jsx("span", { children: parseTrans ? t(
                          `${parseTrans}.${(_c = row[name]) == null ? void 0 : _c.toString()}`
                        ) : parse ? parse[(_d = row[name]) == null ? void 0 : _d.toString()] ?? "" : row[name] });
                      })() }, name);
                    }
                  )
                ] }, i)),
                /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx(
                  "td",
                  {
                    className: "border-b-0! items-center justify-center row-auto h-full",
                    style: {
                      gridColumn: `span ${showedColumns.length + (selectable ? 1 : 0) + (actions ? 1 : 0)}`
                    }
                  }
                ) })
              ] }) })
            ]
          }
        ) }),
        /* @__PURE__ */ jsx(
          ColumnsFilter,
          {
            columns,
            open: openColumnsFilter,
            onApply: (val) => {
              setColumns(val);
              setOpenColumnsFilter(false);
            }
          }
        )
      ] })
    }
  ) });
}
const Table$1 = memo(Table);
const DATATABLE_COLUMNS_EXPIRED = 7;
const DataTable = memo(
  forwardRef(function DataTable2({ columns: _columns, actions, title, addButton, templateItem }, ref) {
    var _a;
    const lang = usePage().props.lang;
    const isMobile = useIsMobile();
    const { t } = useLaravelReactI18n();
    const query = usePage().props.ziggy.query;
    const { data, defaultSort } = usePage().props;
    const [options, setOptions] = useState({
      sort: (query == null ? void 0 : query.sort) ?? defaultSort,
      f: (query == null ? void 0 : query.f) ?? [],
      page: (query == null ? void 0 : query.page) ?? 1
    });
    const [columns] = useState(
      _columns.findIndex((x) => x.name === "created_at") > -1 ? _columns : [
        ..._columns,
        {
          name: "created_at",
          titleTrans: "user.user.columns.created_at",
          searchType: "date",
          width: "fit",
          sortable: true,
          show: false,
          cell: ({ dataRow }) => {
            return /* @__PURE__ */ jsx("span", { children: format(new TZDate(dataRow.created_at, "UTC"), "PPPp", {
              locale: getLocaleDate(lang)
            }) });
          }
        }
      ]
    );
    const loadData = useCallback(() => {
      console.log(options);
      router.get(
        window.location.pathname + "?" + QueryString.stringify(options),
        {},
        {
          reset: ["data", "ziggy"],
          preserveScroll: true,
          preserveState: true,
          replace: true
        }
      );
    }, [options]);
    const optionsSort = (options.sort ?? "").split("-");
    const optionsSortKey = optionsSort[optionsSort.length - 1];
    const optionsSortOrder = optionsSort[0] === optionsSortKey ? "asc" : "desc";
    const resetSorting = useCallback(() => {
      setOptions({
        ...options,
        sort: defaultSort
      });
    }, []);
    const setSort = useCallback(
      (name, sort) => {
        const order = sort ?? (optionsSortKey == name && optionsSortOrder == "asc" ? "desc" : "asc");
        setOptions({
          ...options,
          sort: order ? `${order == "asc" ? "" : "-"}${name}` : null
        });
      },
      [options.sort]
    );
    useDidMountEffect(() => {
      const reloadData = setTimeout(() => {
        loadData();
      }, 500);
      return () => clearTimeout(reloadData);
    }, [options]);
    const onApplyFilters = useCallback((filters) => {
      setOptions((prev) => {
        return { ...prev, f: filters };
      });
    }, []);
    useImperativeHandle(ref, () => ({
      addFilter(key, operator, value) {
        const filters = options.f;
        value = value.toString();
        if (filters.find(
          (x) => x[0] === key && x[1] === operator && x[2] === value
        ))
          return;
        filters.push([key, operator, value]);
        setOptions((prev) => ({ ...prev, f: filters }));
      }
    }));
    const { num_per_page: numPerPage, per_page_options: perPageOptions } = ((_a = usePage().props) == null ? void 0 : _a.preferences) ?? {
      num_per_page: 25,
      per_page_options: [25, 50, 100]
    };
    const [show, setShow] = useState(
      getFromLocalStorage("datatable_show") ?? numPerPage
    );
    const setShowNumber = useCallback((value) => {
      setShow(value);
      saveToLocalStorage("datatable_show", value, DATATABLE_COLUMNS_EXPIRED);
      loadData();
    }, []);
    return /* @__PURE__ */ jsxs(AppLayout, { children: [
      /* @__PURE__ */ jsx(Head, { title }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-x-4", children: [
        /* @__PURE__ */ jsx("h1", { className: "text-xl font-bold", children: title }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-x-4 ", children: [
          /* @__PURE__ */ jsx("div", { className: "flex items-center gap-x-4 lg:hidden", children: /* @__PURE__ */ jsxs(DropdownMenu, { children: [
            /* @__PURE__ */ jsx(DropdownMenuTrigger, { asChild: true, children: /* @__PURE__ */ jsx(Button, { variant: "secondary", className: "p-2! size-fit ", children: /* @__PURE__ */ jsx(Ellipsis, {}) }) }),
            /* @__PURE__ */ jsx(DropdownMenuContent, { children: /* @__PURE__ */ jsxs(ScrollArea, { className: "max-h-56", children: [
              /* @__PURE__ */ jsxs(DropdownMenuItem, { onClick: loadData, children: [
                /* @__PURE__ */ jsx(RefreshCw, {}),
                /* @__PURE__ */ jsx("span", { children: t("core.datatable.reload") })
              ] }),
              /* @__PURE__ */ jsx(
                FilterTable,
                {
                  columns,
                  onApply: onApplyFilters,
                  initialFilters: options.f,
                  isMobile: true
                }
              ),
              isMobile && /* @__PURE__ */ jsxs(DropdownMenuSub, { children: [
                /* @__PURE__ */ jsx(DropdownMenuSubTrigger, { children: t("core.datatable.show") }),
                /* @__PURE__ */ jsx(DropdownMenuPortal, { children: /* @__PURE__ */ jsx(DropdownMenuSubContent, { children: /* @__PURE__ */ jsx(
                  DropdownMenuRadioGroup,
                  {
                    value: `${show}`,
                    onValueChange: (val) => setShowNumber(val),
                    children: perPageOptions.map((x) => /* @__PURE__ */ jsx(
                      DropdownMenuRadioItem,
                      {
                        value: x.toString(),
                        className: "cursor-pointer",
                        showDot: true,
                        children: x
                      },
                      x
                    ))
                  }
                ) }) })
              ] }),
              /* @__PURE__ */ jsx(DropdownMenuSeparator, {}),
              /* @__PURE__ */ jsxs(DropdownMenuGroup, { children: [
                /* @__PURE__ */ jsx(DropdownMenuLabel, { children: "Sorting" }),
                columns.filter((x) => x.sortable).map(({ name, titleTrans }) => /* @__PURE__ */ jsxs(DropdownMenuSub, { children: [
                  /* @__PURE__ */ jsx(
                    DropdownMenuSubTrigger,
                    {
                      className: cn(
                        optionsSortKey == name ? "bg-accent" : ""
                      ),
                      children: t(titleTrans)
                    }
                  ),
                  /* @__PURE__ */ jsx(DropdownMenuPortal, { children: /* @__PURE__ */ jsx(DropdownMenuSubContent, { children: /* @__PURE__ */ jsxs(
                    DropdownMenuRadioGroup,
                    {
                      value: `${optionsSortKey}-${optionsSortOrder}`,
                      onValueChange: (val) => setSort(name, val.replace(`${name}-`, "")),
                      children: [
                        /* @__PURE__ */ jsx(
                          DropdownMenuRadioItem,
                          {
                            className: "cursor-pointer",
                            showDot: true,
                            value: `${name}-asc`,
                            children: t("core.datatable.sorting.ascending")
                          }
                        ),
                        /* @__PURE__ */ jsx(
                          DropdownMenuRadioItem,
                          {
                            className: "cursor-pointer",
                            showDot: true,
                            value: `${name}-desc`,
                            children: t("core.datatable.sorting.descending")
                          }
                        )
                      ]
                    }
                  ) }) })
                ] }, name))
              ] })
            ] }) })
          ] }) }),
          /* @__PURE__ */ jsxs("div", { className: "items-center hidden lg:flex gap-x-4 ", children: [
            /* @__PURE__ */ jsxs(Tooltip, { children: [
              /* @__PURE__ */ jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsx(
                Button,
                {
                  variant: "secondary",
                  className: "p-2! size-fit ",
                  onClick: loadData,
                  children: /* @__PURE__ */ jsx(RefreshCw, {})
                }
              ) }),
              /* @__PURE__ */ jsx(TooltipContent, { side: "bottom", children: t("core.datatable.reload") })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "inline-flex overflow-hidden rounded-lg", children: [
              /* @__PURE__ */ jsx(
                FilterTable,
                {
                  columns,
                  onApply: onApplyFilters,
                  initialFilters: options.f
                }
              ),
              Object.keys(options.f).length > 0 && /* @__PURE__ */ jsx(
                Button,
                {
                  className: "py-0! h-8 px-2! rounded-l-none",
                  variant: "secondary",
                  onClick: () => setOptions({
                    ...options,
                    f: []
                  }),
                  children: /* @__PURE__ */ jsx(X, {})
                }
              )
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "inline-flex overflow-hidden rounded-lg", children: [
              /* @__PURE__ */ jsxs(Tooltip, { children: [
                /* @__PURE__ */ jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsx(
                  Button,
                  {
                    className: "py-0! h-8 px-2! rounded-r-none border-r  border-muted-foreground/50",
                    variant: "secondary",
                    onClick: () => setSort(optionsSortKey),
                    children: optionsSortOrder == "asc" ? /* @__PURE__ */ jsx(ArrowUpNarrowWide, {}) : /* @__PURE__ */ jsx(ArrowDownWideNarrow, {})
                  }
                ) }),
                /* @__PURE__ */ jsx(TooltipContent, { align: "center", side: "bottom", children: optionsSortOrder == "asc" ? t("core.datatable.sorting.ascending") : t("core.datatable.sorting.descending") })
              ] }),
              /* @__PURE__ */ jsxs(
                Select,
                {
                  value: optionsSortKey,
                  onValueChange: (val) => setSort(val, optionsSortOrder),
                  children: [
                    /* @__PURE__ */ jsx(
                      SelectTrigger,
                      {
                        className: cn(
                          buttonVariants({ variant: "secondary", size: "default" }),
                          "flex-1 py-0! h-8 px-2! border-none! rounded-l-none ring-0!"
                        ),
                        children: /* @__PURE__ */ jsx(SelectValue, { placeholder: "Sort By" })
                      }
                    ),
                    /* @__PURE__ */ jsx(SelectContent, { children: columns.filter((x) => x.sortable).map((column) => /* @__PURE__ */ jsx(SelectItem, { value: column.name, children: t(column.titleTrans) }, column.name)) })
                  ]
                }
              )
            ] })
          ] }),
          (addButton == null ? void 0 : addButton.title) && /* @__PURE__ */ jsxs(
            Button,
            {
              className: "p-2! size- fit h-8",
              onClick: addButton == null ? void 0 : addButton.onClick,
              children: [
                /* @__PURE__ */ jsx(Plus, {}),
                addButton == null ? void 0 : addButton.title
              ]
            }
          )
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex flex-col flex-1 max-w-full mt-4 border rounded-lg border-muted-foreground/25", children: [
        isMobile ? /* @__PURE__ */ jsx("div", { className: "flex flex-col flex-1", children: (data == null ? void 0 : data.data) && data.data.length > 0 ? data.data.map((x) => {
          const item = templateItem == null ? void 0 : templateItem({ dataRow: x });
          if (!item) return null;
          return cloneElement(item, { key: x.id, ...item.props });
        }) : /* @__PURE__ */ jsx(NoDataImg, { className: "self-center w-full max-w-sm" }) }) : /* @__PURE__ */ jsx(
          Table$1,
          {
            reload: loadData,
            className: "flex-1",
            actions,
            columns,
            data: data.data,
            totalPages: data.total,
            options,
            setSort,
            resetSorting,
            onOptionsChanged: setOptions
          }
        ),
        /* @__PURE__ */ jsxs(
          "div",
          {
            className: cn(
              !isMobile || Math.floor(data.total / show) + 1 > 1 ? "flex" : "hidden",
              " justify-between px-4 py-4 border-t border-muted-foreground/25 gap-x-4"
            ),
            children: [
              !isMobile && /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-x-2", children: [
                /* @__PURE__ */ jsx(Label, { children: t("core.datatable.show") }),
                /* @__PURE__ */ jsxs(
                  Select,
                  {
                    value: `${show}`,
                    onValueChange: (e) => setShowNumber(e),
                    children: [
                      /* @__PURE__ */ jsx(SelectTrigger, { className: "w-fit! gap-x-2", children: /* @__PURE__ */ jsx(SelectValue, { placeholder: "Show" }) }),
                      /* @__PURE__ */ jsx(SelectContent, { children: perPageOptions.map((x) => /* @__PURE__ */ jsx(SelectItem, { value: x.toString(), children: x }, x)) })
                    ]
                  }
                )
              ] }),
              /* @__PURE__ */ jsx(
                Pagination,
                {
                  currentPage: options.page,
                  totalPages: Math.floor(data.total / show) + 1,
                  onPageChanged: (page) => setOptions({ ...options, page }),
                  className: "justify-end"
                }
              )
            ]
          }
        )
      ] })
    ] });
  })
);
export {
  DataTable as default
};
