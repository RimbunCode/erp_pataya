import { jsxs, Fragment, jsx } from "react/jsx-runtime";
import { Trash2Icon, Ellipsis, RefreshCw, X, ArrowUpNarrowWide, ArrowDownWideNarrow, Plus } from "lucide-react";
import { B as Button, b as buttonVariants } from "./button-Us2TB7GG.js";
import { D as DropdownMenu, a as DropdownMenuTrigger, b as DropdownMenuContent, c as DropdownMenuItem, h as DropdownMenuSub, i as DropdownMenuSubTrigger, j as DropdownMenuPortal, k as DropdownMenuSubContent, l as DropdownMenuRadioGroup, m as DropdownMenuRadioItem, f as DropdownMenuSeparator, g as DropdownMenuGroup, d as DropdownMenuLabel } from "./ToggleTheme-BSs-sHS2.js";
import { usePage, router, Head } from "@inertiajs/react";
import { S as Select, a as SelectTrigger, b as SelectValue, c as SelectContent, d as SelectItem } from "./select-XM4G_Lvw.js";
import { T as Tooltip, a as TooltipTrigger, b as TooltipContent } from "./tooltip-Df8khweJ.js";
import { memo, forwardRef, useState, useRef, useCallback, useMemo, useImperativeHandle, cloneElement } from "react";
import { n as getCookieByName, q as setCookie, c as cn } from "./utils-ClCZGsDL.js";
import { A as AppLayout } from "./AppLayout-Drqdr6Z-.js";
import { F as FilterTable, P as Pagination } from "./Pagination-CiJtFFPu.js";
import { b as FormPageDialog } from "./checkbox-C_BEU5E4.js";
import { L as Label } from "./label-DiFvdPYz.js";
import { N as NoDataImg } from "./Header-C9Xb62yg.js";
import QueryString from "qs";
import { S as ScrollArea } from "./DatetimePicker-C3h7-5Qi.js";
import { T as Table2 } from "./Table2-DWJgyKWG.js";
import pluralize from "pluralize";
import { u as useDeleteModal } from "./MasterLayout-CRsmljQs.js";
import { b as useDidMountEffect } from "./Link-p0Z4AKax.js";
import { u as useIsMobile } from "./use-mobile-BsFue-bT.js";
import { useLaravelReactI18n } from "laravel-react-i18n";
import "radix-ui";
import "class-variance-authority";
import "@radix-ui/react-dropdown-menu";
import "@radix-ui/react-select";
import "@radix-ui/react-tooltip";
import "date-fns/locale";
import "lodash";
import "buffer";
import "clsx";
import "tailwind-merge";
import "./command-BSnyCa9u.js";
import "@radix-ui/react-dialog";
import "cmdk";
import "./input-wk3Ou7wI.js";
import "@radix-ui/react-separator";
import "./skeleton-IN0PLOYc.js";
import "@radix-ui/react-slot";
import "./popover-CziqY8mR.js";
import "@radix-ui/react-popover";
import "./avatar-_KK8H2Pc.js";
import "@radix-ui/react-avatar";
import "@radix-ui/react-checkbox";
import "./LoadingIcon-CRleOEtX.js";
import "axios";
import "react-detect-click-outside";
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
import "@date-fns/tz";
import "date-fns";
import "@inertiajs/core";
import "zustand";
import "@remixicon/react";
import "./Tags-D6pM3ZUY.js";
import "@marcbachmann/cel-js";
import "sonner";
import "@radix-ui/react-label";
import "./Combobox-CnMmTQqc.js";
import "./drawer-D3vDykaS.js";
import "vaul";
import "@dnd-kit/utilities";
import "@dnd-kit/sortable";
import "react-day-picker";
import "@radix-ui/react-scroll-area";
import "@dnd-kit/core";
import "./useDynamicRefs-DuDlSZ7v.js";
import "@radix-ui/react-alert-dialog";
const DATATABLE_COLUMNS_EXPIRED = 7;
const DataTable2 = memo(
  forwardRef(function DataTable22({
    form,
    defaultValueForm,
    classNameDialog,
    actions: _actions,
    templateItem
  }, ref) {
    var _a;
    const isMobile = useIsMobile();
    const { t } = useLaravelReactI18n();
    const query = usePage().props.ziggy.query;
    const { deleteItem } = useDeleteModal();
    const { data, defaultSort, dataTableColumns, translateKey, name } = usePage().props;
    const [options, setOptions] = useState({
      sort: (query == null ? void 0 : query.sort) ?? defaultSort,
      f: (query == null ? void 0 : query.f) ?? [],
      page: (query == null ? void 0 : query.page) ?? 1
    });
    const dialogRef = useRef();
    const actions = useCallback(
      (props) => {
        if (props.dataRow.canDelete === false) return _actions == null ? void 0 : _actions(props);
        return /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx(
            Button,
            {
              variant: "destructive",
              size: "icon",
              className: "size-8",
              onClick: () => deleteItem(
                `${pluralize.plural(name ?? "")}.destroy`,
                props.dataRow.id
              ),
              children: /* @__PURE__ */ jsx(Trash2Icon, {})
            }
          ),
          _actions == null ? void 0 : _actions(props)
        ] });
      },
      [_actions, name]
    );
    const getColumns = useCallback(
      (t2, columns2, parentColumn) => {
        let newColumns = {};
        Object.values(columns2 ?? {}).forEach((col) => {
          const title2 = col.title ?? t2(col.titleTrans);
          const colName = !parentColumn ? col.name : `${parentColumn.name}.${col.name}`;
          const currentColumn = {
            ...col,
            name: colName,
            title: title2,
            show: !parentColumn ? col.show ?? false : false,
            searchable: col.searchable ?? true,
            parentCol: parentColumn,
            sortable: !parentColumn ? col.sortable ?? true : false,
            resizeable: col.resizeable ?? true,
            route: col.isLink && !parentColumn ? `${pluralize.plural(name ?? "")}.show` : col.route
          };
          newColumns[colName] = currentColumn;
          if (col.type == "relation" && col.columns) {
            newColumns[colName].columns = getColumns(
              t2,
              col.columns,
              newColumns[colName]
            );
          }
        });
        return newColumns;
      },
      [name]
    );
    const [mapColumns, columns] = useMemo(() => {
      const newColumns = getColumns(t, dataTableColumns);
      return [newColumns, Object.values(newColumns)];
    }, [dataTableColumns, t]);
    const loadData = useCallback(() => {
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
      (name2, sort) => {
        const order = sort ?? (optionsSortKey == name2 && optionsSortOrder == "asc" ? "desc" : "asc");
        setOptions({
          ...options,
          sort: order ? `${order == "asc" ? "" : "-"}${name2}` : null
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
      getCookieByName("datatable_show") ?? numPerPage
    );
    const setShowNumber = useCallback((value) => {
      setShow(value);
      setCookie("datatable_show", value, {
        days: DATATABLE_COLUMNS_EXPIRED,
        path: window.location.pathname,
        sameSite: "lax"
      });
    }, []);
    const title = t(`${translateKey}.title`);
    return /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs(AppLayout, { children: [
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
                  columns.map(
                    ({ name: name2, title: title2, titleTrans, type, sortable }) => {
                      if (type == "relations" || type == "mixed" || type == "json" || !sortable)
                        return;
                      return /* @__PURE__ */ jsxs(DropdownMenuSub, { children: [
                        /* @__PURE__ */ jsx(
                          DropdownMenuSubTrigger,
                          {
                            className: cn(
                              optionsSortKey == name2 ? "bg-accent" : ""
                            ),
                            children: title2 ?? t(titleTrans)
                          }
                        ),
                        /* @__PURE__ */ jsx(DropdownMenuPortal, { children: /* @__PURE__ */ jsx(DropdownMenuSubContent, { children: /* @__PURE__ */ jsxs(
                          DropdownMenuRadioGroup,
                          {
                            value: `${optionsSortKey}-${optionsSortOrder}`,
                            onValueChange: (val) => setSort(
                              name2,
                              val.replace(`${name2}-`, "")
                            ),
                            children: [
                              /* @__PURE__ */ jsx(
                                DropdownMenuRadioItem,
                                {
                                  className: "cursor-pointer",
                                  showDot: true,
                                  value: `${name2}-asc`,
                                  children: t("core.datatable.sorting.ascending")
                                }
                              ),
                              /* @__PURE__ */ jsx(
                                DropdownMenuRadioItem,
                                {
                                  className: "cursor-pointer",
                                  showDot: true,
                                  value: `${name2}-desc`,
                                  children: t("core.datatable.sorting.descending")
                                }
                              )
                            ]
                          }
                        ) }) })
                      ] }, name2);
                    }
                  )
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
                            buttonVariants({
                              variant: "secondary",
                              size: "default"
                            }),
                            "flex-1 py-0! h-8 px-2! border-none! rounded-l-none ring-0!"
                          ),
                          children: /* @__PURE__ */ jsx(SelectValue, { placeholder: "Sort By" })
                        }
                      ),
                      /* @__PURE__ */ jsx(SelectContent, { children: columns.filter((x) => x.sortable).map((column) => {
                        if (column.type == "relations" || column.type == "mixed" || column.type == "json" || !column.sortable)
                          return;
                        return /* @__PURE__ */ jsx(SelectItem, { value: column.name, children: column.title ?? t(column.titleTrans) }, column.name);
                      }) })
                    ]
                  }
                )
              ] })
            ] }),
            form && /* @__PURE__ */ jsxs(
              Button,
              {
                className: "p-2! size- fit h-8",
                onClick: () => {
                  var _a2;
                  return (_a2 = dialogRef == null ? void 0 : dialogRef.current) == null ? void 0 : _a2.open();
                },
                children: [
                  /* @__PURE__ */ jsx(Plus, {}),
                  t(`${translateKey}.add`)
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
            Table2,
            {
              reload: loadData,
              className: "flex-1",
              actions,
              columns: mapColumns,
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
      ] }),
      form && /* @__PURE__ */ jsx(
        FormPageDialog,
        {
          ref: dialogRef,
          title: t(`${translateKey}.new`),
          className: classNameDialog,
          defaultValue: defaultValueForm,
          name,
          children: form
        }
      )
    ] });
  })
);
export {
  DataTable2 as default
};
