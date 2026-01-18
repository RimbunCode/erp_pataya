import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { H as Header, N as NoDataImg, C as ColumnsFilter } from "./Header-C9Xb62yg.js";
import { useSensors, useSensor, MouseSensor, TouchSensor, DndContext, closestCenter } from "@dnd-kit/core";
import React__default, { memo, forwardRef, useState, useImperativeHandle, useRef, useCallback, useMemo, useEffect, cloneElement } from "react";
import { SortableContext, horizontalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { q as setCookie, c as cn, u as removeCookie, n as getCookieByName, a as getLocaleDate } from "./utils-ClCZGsDL.js";
import { router, usePage } from "@inertiajs/react";
import { C as Checkbox, c as convertTemplateLink, B as BadgeStatus } from "./checkbox-C_BEU5E4.js";
import { D as Dialog } from "./command-BSnyCa9u.js";
import { b as useDidMountEffect, L as Link } from "./Link-p0Z4AKax.js";
import { L as LoadingIcon } from "./LoadingIcon-CRleOEtX.js";
import { TZDate } from "@date-fns/tz";
import { debounce } from "lodash";
import { format } from "date-fns";
import { u as useDynamicRefs } from "./useDynamicRefs-DuDlSZ7v.js";
import { useLaravelReactI18n } from "laravel-react-i18n";
const DATATABLE_COLUMNS_KEY = "datatable_columns";
const DATATABLE_COLUMNS_EXPIRED = 7;
const convertColWidth = (colWidth) => {
  if (colWidth) {
    switch (colWidth) {
      case "grow":
        return "1fr";
      case "fit":
        return "max-content";
      case "minimum":
        return "min-content";
      default:
        return colWidth;
    }
  } else {
    return "minmax(0px, 1fr)";
  }
};
const createHeaders = (headers, ignoreCookie = false) => {
  const columnsFromCookie = JSON.parse(
    getCookieByName(`${DATATABLE_COLUMNS_KEY}_${window.location.pathname}`)
  );
  Object.values(headers).forEach((col) => {
    const colFromCookie = ignoreCookie ? null : columnsFromCookie == null ? void 0 : columnsFromCookie[col.name];
    const show = colFromCookie ? true : columnsFromCookie && Object.keys(columnsFromCookie).length > 0 ? false : col.show ?? true;
    headers[col.name] = {
      ...col,
      sort: null,
      show,
      order: show ? (colFromCookie == null ? void 0 : colFromCookie.order) || col.order : void 0,
      size: (colFromCookie == null ? void 0 : colFromCookie.size) ?? convertColWidth(col.width)
    };
  });
  return Object.values(headers);
};
const Cell = memo(
  ({
    row,
    cell,
    type,
    route,
    name,
    valueTrans,
    parse,
    primaryKey,
    isLink,
    ...colProps
  }) => {
    const { lang } = usePage().props;
    const { t } = useLaravelReactI18n();
    const value = row[name];
    if (value == null) return;
    let valueCell = "";
    switch (type) {
      case "boolean":
        return /* @__PURE__ */ jsx("span", { className: "text-center", children: /* @__PURE__ */ jsx(Checkbox, { readOnly: true, checked: value, className: "cursor-default" }) });
      case "formStatus": {
        return /* @__PURE__ */ jsx("div", { className: "text-center", children: /* @__PURE__ */ jsx(BadgeStatus, { className: "text-sm", status: value }) });
      }
      case "formStatuses": {
        return /* @__PURE__ */ jsx(
          "div",
          {
            className: cn(
              value.length > 1 ? "flex gap-x-1 gap-y-1 flex-wrap w-full" : "text-center"
            ),
            children: value.map((status, idx) => /* @__PURE__ */ jsx(
              BadgeStatus,
              {
                className: "text-xs py-0.5 px-2",
                status
              },
              idx
            ))
          }
        );
      }
      case "date":
      case "time":
      case "datetime":
        if (!value) {
          valueCell = null;
        } else {
          valueCell = format(
            new TZDate(value, "UTC"),
            type == "date" ? "PPP" : type == "time" ? "pp" : "PPPpp",
            {
              locale: getLocaleDate(lang)
            }
          );
        }
        break;
      case "relation":
        valueCell = convertTemplateLink(value);
        break;
      case "mixed":
      case "json":
      case "relations":
        return;
      case "string":
        valueCell = valueTrans ? t(`${valueTrans}.${value == null ? void 0 : value.toString()}`) : parse ? parse[value == null ? void 0 : value.toString()] ?? "" : value;
        break;
      default:
        valueCell = value;
    }
    if (typeof cell == "function") {
      const child = cell({
        dataRow: row,
        valueCell
      });
      if (child) {
        return cloneElement(child, {
          ...child.props,
          className: cn(child.props.className, "text-ellipsis truncate")
        });
      }
    }
    if (isLink) {
      return /* @__PURE__ */ jsx(
        Link,
        {
          className: "text-blue-800 dark:text-blue-200 hover:underline",
          href: window.route(route ?? "", row[primaryKey] ?? ""),
          children: valueCell
        }
      );
    } else if (type == "relation" && route && !(colProps == null ? void 0 : colProps.disabledNavigation)) {
      return /* @__PURE__ */ jsx(
        Link,
        {
          href: window.route(
            (value == null ? void 0 : value["route"]) ? (value == null ? void 0 : value["route"]) + ".show" : route ?? "",
            (value == null ? void 0 : value[primaryKey]) ?? ""
          ),
          className: "text-blue-800 dark:text-blue-200 hover:underline",
          children: valueCell
        }
      );
    }
    return /* @__PURE__ */ jsx("span", { children: valueCell });
  }
);
Cell.displayName = "TableCell";
const Table2 = forwardRef(function Table22({
  className,
  selectable,
  actions,
  columns: headers,
  freezeColumn = 0,
  onOptionsChanged,
  options: initialOptions = {},
  data: initialData = [],
  setSort,
  resetSorting,
  reload,
  isDynamicData,
  isLoading
}, ref) {
  var _a;
  const { t } = useLaravelReactI18n();
  const [data, setData] = useState(initialData);
  useDidMountEffect(() => {
    setData(initialData);
  }, [initialData]);
  const [getRef, setRef] = useDynamicRefs();
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
  useImperativeHandle(
    ref,
    () => ({
      getSelectedItem() {
        return data.filter((x) => x.isSelected);
      }
    }),
    [data]
  );
  const minCellWidth = 120;
  const [activeIndex, setActiveIndex] = useState(null);
  const tableElement = useRef(null);
  const [columns, setColumns] = useState(createHeaders(headers, isDynamicData));
  const [openColumnsFilter, setOpenColumnsFilter] = useState(false);
  useDidMountEffect(() => {
    setColumns(createHeaders(headers, isDynamicData));
  }, [headers]);
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
  const mergeColumns = useCallback((columns2, showColumns) => {
    return columns2.map((col) => {
      for (const key in showColumns) {
        const colShowed = showColumns[key];
        if (col.name == colShowed.name) {
          return {
            ...col,
            order: key
          };
        }
      }
      return col;
    });
  }, []);
  function handleDragOver(event) {
    const { active, over } = event;
    if (active.id !== over.id) {
      setColumns((items) => {
        const showColumn = items.filter((x) => x.show).sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
        const newItems = showColumn.map((x) => x.name);
        const newIndex = newItems.indexOf(over.id);
        if (newIndex < freezeColumn) return items;
        const oldIndex = newItems.indexOf(active.id);
        const newColumn = arrayMove(showColumn, oldIndex, newIndex);
        tableElement.current.style.gridTemplateColumns = `${selectable ? "max-content" : ""} ${actions ? "max-content" : ""}  ${[
          ...newColumn
        ].map((x) => x.size).join(" ")}`;
        return mergeColumns(items, newColumn);
      });
    }
  }
  const mouseDown = (index) => {
    setActiveIndex(index);
  };
  const getShowedColumns = useCallback((columns2) => {
    const newCols = [];
    if (!Array.isArray(columns2)) {
      columns2 = Object.values(columns2);
    }
    columns2.forEach((col) => {
      if (!col.show) return;
      if (col.type == "relations" || col.type == "mixed" || col.type == "json")
        return;
      if (col.type == "relation" && col.columns) {
        newCols.push(...getShowedColumns(col.columns));
      }
      newCols.push(col);
    });
    return newCols;
  }, []);
  const showedColumns = useMemo(() => {
    return getShowedColumns(columns).sort(
      (a, b) => (a.order ?? Infinity) - (b.order ?? Infinity)
    );
  }, [columns]);
  useEffect(() => {
    if (isDynamicData) return;
    const newShowedColumns = {};
    showedColumns.forEach((col, index) => {
      newShowedColumns[col.name] = {
        size: col.size,
        order: index
      };
    });
    setCookie(
      `${DATATABLE_COLUMNS_KEY}_${window.location.pathname}`,
      JSON.stringify(newShowedColumns),
      {
        days: DATATABLE_COLUMNS_EXPIRED,
        path: window.location.pathname,
        sameSite: "lax"
      }
    );
  }, [showedColumns]);
  const mouseMove = useCallback(
    (e) => {
      const newColumns = Object.fromEntries(columns.map((x) => [x.name, x]));
      const gridColumns = showedColumns.map((col, i) => {
        var _a2, _b, _c, _d;
        const ref2 = getRef(`col.${col.name}`);
        if (i === activeIndex) {
          const width = e.clientX - ((_a2 = ref2 == null ? void 0 : ref2.current) == null ? void 0 : _a2.offsetLeft);
          if (width >= minCellWidth) {
            const size2 = `${width}px`;
            newColumns[col.name] = { ...col, size: size2 };
            return size2;
          }
        }
        let size = "";
        if (i < activeIndex) {
          size = `${(_b = ref2 == null ? void 0 : ref2.current) == null ? void 0 : _b.offsetWidth}px`;
        } else {
          if ((_c = col.size) == null ? void 0 : _c.startsWith("minmax")) {
            size = "minmax(0px, 1fr)";
          } else if (col.size == "1fr" || col.size == "max-content") {
            size = col.size;
          } else {
            size = `${(_d = ref2 == null ? void 0 : ref2.current) == null ? void 0 : _d.offsetWidth}px`;
          }
        }
        newColumns[col.name] = { ...col, size };
        return size;
      });
      tableElement.current.style.gridTemplateColumns = `${selectable ? "max-content" : ""} ${actions ? "max-content" : ""} ${gridColumns.join(
        " "
      )}`;
    },
    [activeIndex, columns, minCellWidth]
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
    debounce(() => setColumns(columns, newColumns), 500)();
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
  return /* @__PURE__ */ jsx("div", { className: cn("grid grid-cols-1", className), children: /* @__PURE__ */ jsx(
    DndContext,
    {
      onDragOver: handleDragOver,
      sensors,
      collisionDetection: closestCenter,
      children: /* @__PURE__ */ jsxs(Dialog, { open: openColumnsFilter, onOpenChange: setOpenColumnsFilter, children: [
        /* @__PURE__ */ jsx("div", { className: "flex-1", children: /* @__PURE__ */ jsxs(
          "table",
          {
            className: "resizeable-table",
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
                    selectable && /* @__PURE__ */ jsx("th", { className: "py-2! px-2! items-center", children: /* @__PURE__ */ jsx(
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
                          style: {
                            height: (_a = tableElement == null ? void 0 : tableElement.current) == null ? void 0 : _a.offsetHeight
                          },
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
                    showedColumns.map(({ resizeable, ...props }, i) => {
                      var _a2;
                      return /* @__PURE__ */ jsx(
                        Header,
                        {
                          isEmpty: !data || data.length === 0,
                          setSort,
                          resetSorting,
                          options,
                          setOptions,
                          freezeColumn: i < freezeColumn,
                          id: props.name,
                          ref: setRef(`col.${props.name}`),
                          resizeable,
                          ...props,
                          onResize: () => mouseDown(i),
                          onResetSize: () => resetSizeHeader(i),
                          tableHeight: (_a2 = tableElement == null ? void 0 : tableElement.current) == null ? void 0 : _a2.offsetHeight
                        },
                        props.name
                      );
                    })
                  ]
                }
              ) }) }),
              /* @__PURE__ */ jsx("tbody", { children: isLoading || !data || data.length === 0 ? /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx(
                "td",
                {
                  className: "border-b-0! items-center justify-center",
                  style: {
                    gridColumn: `span ${showedColumns.length + (selectable ? 1 : 0) + (actions ? 1 : 0)}`
                  },
                  children: isLoading ? /* @__PURE__ */ jsxs("div", { className: "flex justify-center py-6 text-sm font-normal text-center text-foreground gap-x-4", children: [
                    /* @__PURE__ */ jsx(LoadingIcon, { className: "size-4" }),
                    /* @__PURE__ */ jsxs("span", { children: [
                      t("core.form.loading"),
                      " ..."
                    ] })
                  ] }) : !isDynamicData ? /* @__PURE__ */ jsx(NoDataImg, { className: "w-full max-w-lg max-h-full" }) : /* @__PURE__ */ jsx("p", { className: "text-muted-foreground", children: t("core.datatable.no_data") })
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
                  actions && /* @__PURE__ */ jsx("td", { className: "w-full flex flex-row! items-center gap-x-2", children: actions({ dataRow: row }) }),
                  showedColumns.map(
                    ({ type, name, parse, valueTrans, ...colProps }) => {
                      return /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsx(
                        Cell,
                        {
                          row,
                          type,
                          name,
                          parse,
                          valueTrans,
                          ...colProps
                        }
                      ) }, name);
                    }
                  )
                ] }, i)),
                /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx(
                  "td",
                  {
                    className: "border-b-0! items-center justify-center row-auto h-full z-[2] relative bg-background",
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
              reload == null ? void 0 : reload(val);
              setOpenColumnsFilter(false);
            },
            onReset: () => {
              removeCookie(
                `${DATATABLE_COLUMNS_KEY}_${window.location.pathname}`,
                window.location.pathname
              );
              router.reload();
              setOpenColumnsFilter(false);
            }
          }
        )
      ] })
    }
  ) });
});
const Table2$1 = memo(Table2);
export {
  Table2$1 as T
};
