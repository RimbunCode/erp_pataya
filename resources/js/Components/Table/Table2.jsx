import "@/../css/table.css";

import {
  DndContext,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import React, {
  cloneElement,
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  cn,
  getCookieByName,
  getLocaleDate,
  removeCookie,
  setCookie,
} from "@/lib/utils";
import { router, usePage } from "@inertiajs/react";

import BadgeStatus from "../BadgeStatus";
import { Checkbox } from "../ui/checkbox";
import ColumnsFilter from "./ColumnsFilter";
import { Dialog } from "../ui/dialog";
import Header from "./Header";
import Link from "../Link";
import LoadingIcon from "../LoadingIcon";
import NoDataImg from "./NoDataImg";
import { TZDate } from "@date-fns/tz";
import { convertTemplateLink } from "../LinkModel";
import { debounce } from "lodash";
import { format } from "date-fns";
import useDidMountEffect from "@/Hooks/useDidMountEffect";
import useDynamicRefs from "@/Hooks/useDynamicRefs";
import { useLaravelReactI18n } from "laravel-react-i18n";

export const DATATABLE_COLUMNS_KEY = "datatable_columns";
const DATATABLE_COLUMNS_EXPIRED = 7; //days
export const convertColWidth = (colWidth) => {
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
export const createHeaders = (headers, ignoreCookie = false) => {
  const columnsFromCookie = JSON.parse(
    getCookieByName(`${DATATABLE_COLUMNS_KEY}_${window.location.pathname}`),
  );
  // const newHeaders = { ...headers };
  Object.values(headers).forEach((col) => {
    const colFromCookie = ignoreCookie ? null : columnsFromCookie?.[col.name];
    const show = colFromCookie
      ? true
      : columnsFromCookie && Object.keys(columnsFromCookie).length > 0
        ? false
        : (col.show ?? true);
    headers[col.name] = {
      ...col,
      sort: null,
      show: show,
      order: show ? colFromCookie?.order || col.order : undefined,
      size: colFromCookie?.size ?? convertColWidth(col.width),
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
        return (
          <span className="text-center">
            <Checkbox readOnly checked={value} className="cursor-default" />
          </span>
        );
      case "formStatus": {
        return (
          <div className="text-center">
            <BadgeStatus className="text-sm" status={value} />
          </div>
        );
      }
      case "formStatuses": {
        return (
          <div
            className={cn(
              value.length > 1
                ? "flex gap-x-1 gap-y-1 flex-wrap w-full"
                : "text-center",
            )}
          >
            {value.map((status, idx) => (
              <BadgeStatus
                className="text-xs py-0.5 px-2"
                key={idx}
                status={status}
              />
            ))}
          </div>
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
              locale: getLocaleDate(lang),
            },
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
        valueCell = valueTrans
          ? t(`${valueTrans}.${value?.toString()}`)
          : parse
            ? (parse[value?.toString()] ?? "")
            : value;
        break;
      default:
        valueCell = value;
    }
    if (typeof cell == "function") {
      const child = cell({
        dataRow: row,
        valueCell,
      });
      if (child) {
        return cloneElement(child, {
          ...child.props,
          className: cn(child.props.className, "text-ellipsis truncate"),
        });
      }
    }
    if (isLink) {
      return (
        <Link
          className="text-blue-800 dark:text-blue-200 hover:underline"
          href={window.route(route ?? "", row[primaryKey] ?? "")}
        >
          {valueCell}
        </Link>
      );
    } else if (type == "relation" && route && !colProps?.disabledNavigation) {
      return (
        <Link
          href={window.route(
            value?.["route"] ? value?.["route"] + ".show" : (route ?? ""),
            value?.[primaryKey] ?? "",
          )}
          className="text-blue-800 dark:text-blue-200 hover:underline"
        >
          {valueCell}
        </Link>
      );
    }
    return <span>{valueCell}</span>;
  },
);
Cell.displayName = "TableCell";
const Table2 = forwardRef(function Table2(
  {
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
    isLoading,
  },
  ref,
) {
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
      order: null,
    },
    search: {},
  });
  const options = initialOptions ?? _options;
  const setOptions = React.useCallback(
    (value) => {
      const optionsState = typeof value === "function" ? value(options) : value;
      if (onOptionsChanged) {
        onOptionsChanged(optionsState);
      } else {
        _setOptions(optionsState);
      }
    },
    [initialOptions, _options],
  );
  useImperativeHandle(
    ref,
    () => ({
      getSelectedItem() {
        return data.filter((x) => x.isSelected);
      },
    }),
    [data],
  );

  const minCellWidth = 120;

  // const [tableHeight, setTableHeight] = useState("auto");
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
        distance: 10,
      },
    }),
    useSensor(TouchSensor, {
      // Press delay of 250ms, with tolerance of 5px of movement
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    // useSensor(KeyboardSensor, {
    //   coordinateGetter: sortableKeyboardCoordinates,
    // }),
  );
  // useDidMountEffect(() => {
  //   saveToLocalStorage(
  //     `${DATATABLE_COLUMNS_KEY}_${window.location.pathname}`,
  //     columns.map((x) => ({ name: x.name, show: x.show })),
  //     DATATABLE_COLUMNS_EXPIRED,
  //   );
  // }, [columns]);
  const mergeColumns = useCallback((columns, showColumns) => {
    return columns.map((col) => {
      for (const key in showColumns) {
        const colShowed = showColumns[key];
        if (col.name == colShowed.name) {
          return {
            ...col,
            order: key,
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
        const showColumn = items
          .filter((x) => x.show)
          .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
        const newItems = showColumn.map((x) => x.name);

        const newIndex = newItems.indexOf(over.id);
        if (newIndex < freezeColumn) return items;

        const oldIndex = newItems.indexOf(active.id);
        const newColumn = arrayMove(showColumn, oldIndex, newIndex);
        tableElement.current.style.gridTemplateColumns = `${selectable ? "max-content" : ""} ${actions ? "max-content" : ""}  ${[
          ...newColumn,
        ]
          .map((x) => x.size)
          .join(" ")}`;

        return mergeColumns(items, newColumn);
      });
    }
  }

  // useEffect(() => {
  //   setTableHeight(tableElement.current.offsetHeight);
  // }, [tableElement]);

  const mouseDown = (index) => {
    setActiveIndex(index);
  };
  const getShowedColumns = useCallback((columns) => {
    const newCols = [];
    if (!Array.isArray(columns)) {
      columns = Object.values(columns);
    }
    columns.forEach((col) => {
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
      (a, b) => (a.order ?? Infinity) - (b.order ?? Infinity),
    );
  }, [columns]);

  useEffect(() => {
    if (isDynamicData) return;
    const newShowedColumns = {};
    showedColumns.forEach((col, index) => {
      newShowedColumns[col.name] = {
        size: col.size,
        order: index,
      };
    });
    setCookie(
      `${DATATABLE_COLUMNS_KEY}_${window.location.pathname}`,
      JSON.stringify(newShowedColumns),
      {
        days: DATATABLE_COLUMNS_EXPIRED,
        path: window.location.pathname,
        sameSite: "lax",
      },
    );
  }, [showedColumns]);
  const mouseMove = useCallback(
    (e) => {
      // const ori = tableElement.current.style.gridTemplateColumns
      //   .split(" ")
      //   .filter((x) => x.startsWith("minmax") || x.indexOf("px") >= 0);

      const newColumns = Object.fromEntries(columns.map((x) => [x.name, x]));
      const gridColumns = showedColumns.map((col, i) => {
        const ref = getRef(`col.${col.name}`);
        if (i === activeIndex) {
          const width = e.clientX - ref?.current?.offsetLeft;

          if (width >= minCellWidth) {
            const size = `${width}px`;
            newColumns[col.name] = { ...col, size };
            return size;
          }
        }
        let size = "";
        if (i < activeIndex) {
          size = `${ref?.current?.offsetWidth}px`;
        } else {
          if (col.size?.startsWith("minmax")) {
            size = "minmax(0px, 1fr)";
          } else if (col.size == "1fr" || col.size == "max-content") {
            size = col.size;
          } else {
            size = `${ref?.current?.offsetWidth}px`;
          }
        }

        newColumns[col.name] = { ...col, size };
        return size;
      });

      tableElement.current.style.gridTemplateColumns = `${selectable ? "max-content" : ""} ${actions ? "max-content" : ""} ${gridColumns.join(
        " ",
      )}`;
    },
    [activeIndex, columns, minCellWidth],
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
      " ",
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
    setData((data) => {
      const newData = data.map((x) => ({ ...x, isSelected: check }));
      return newData;
    });
  };

  const checklist = (row, check) => {
    setData((data) => {
      const newData = data.map((x) => {
        if (x.id === row.id) {
          return { ...x, isSelected: check };
        }
        return x;
      });
      return newData;
    });
  };
  return (
    <div className={cn("grid grid-cols-1", className)}>
      <DndContext
        onDragOver={handleDragOver}
        sensors={sensors}
        collisionDetection={closestCenter}
      >
        <Dialog open={openColumnsFilter} onOpenChange={setOpenColumnsFilter}>
          <div className="flex-1">
            <table
              className="resizeable-table"
              ref={tableElement}
              style={{
                gridTemplateRows: [
                  "auto",
                  ...data.map(() => "auto"),
                  "1fr",
                ].join(" "),
                gridTemplateColumns:
                  (selectable ? "max-content " : "") +
                  (actions ? "max-content " : "") +
                  showedColumns
                    .map((col) => convertColWidth(col.width))
                    .join(" "),
              }}
            >
              <thead>
                <tr>
                  <SortableContext
                    items={showedColumns.map((x) => x.name)}
                    strategy={horizontalListSortingStrategy}
                  >
                    {selectable && (
                      <th className="py-2! px-2! items-center">
                        <Checkbox
                          checked={data.every((x) => x.isSelected ?? false)}
                          onCheckedChange={checkAll}
                        />
                      </th>
                    )}
                    {actions && (
                      <th className="py-2! px-2! pr-4! items-center">
                        <span>{t("core.datatable.action")}</span>
                        <div
                          style={{
                            height: tableElement?.current?.offsetHeight,
                          }}
                          className={cn(
                            !data || data.length === 0 ? "h-[40px]!" : "",
                            `flex opacity-100 justify-center items-center absolute w-4 -right-2 top-0 z-1`,
                          )}
                        >
                          <div
                            className={cn(
                              "h-full border-r border-muted-foreground/15 w-px",
                            )}
                          ></div>
                        </div>
                      </th>
                    )}
                    {showedColumns.map(({ resizeable, ...props }, i) => (
                      <Header
                        isEmpty={!data || data.length === 0}
                        setSort={setSort}
                        resetSorting={resetSorting}
                        options={options}
                        setOptions={setOptions}
                        freezeColumn={i < freezeColumn}
                        id={props.name}
                        key={props.name}
                        ref={setRef(`col.${props.name}`)}
                        resizeable={resizeable}
                        {...props}
                        onResize={() => mouseDown(i)}
                        onResetSize={() => resetSizeHeader(i)}
                        tableHeight={tableElement?.current?.offsetHeight}
                      />
                    ))}
                  </SortableContext>
                </tr>
              </thead>
              <tbody>
                {isLoading || !data || data.length === 0 ? (
                  <tr>
                    <td
                      className="border-b-0! items-center justify-center"
                      style={{
                        gridColumn: `span ${showedColumns.length + (selectable ? 1 : 0) + (actions ? 1 : 0)}`,
                      }}
                    >
                      {isLoading ? (
                        <div className="flex justify-center py-6 text-sm font-normal text-center text-foreground gap-x-4">
                          <LoadingIcon className="size-4" />
                          <span>{t("core.form.loading")} ...</span>
                        </div>
                      ) : !isDynamicData ? (
                        <NoDataImg className="w-full max-w-lg max-h-full" />
                      ) : (
                        <p className="text-muted-foreground">
                          {t("core.datatable.no_data")}
                        </p>
                      )}
                    </td>
                  </tr>
                ) : (
                  <>
                    {data.map((row, i) => (
                      <tr key={i}>
                        {selectable && (
                          <td className="py-2! px-2! items-center">
                            <Checkbox
                              checked={row.isSelected ?? false}
                              onCheckedChange={(check) => checklist(row, check)}
                            />
                          </td>
                        )}
                        {actions && (
                          <td className="w-full flex flex-row! items-center gap-x-2">
                            {actions({ dataRow: row })}
                          </td>
                        )}
                        {showedColumns.map(
                          ({ type, name, parse, valueTrans, ...colProps }) => {
                            return (
                              <td key={name}>
                                <Cell
                                  row={row}
                                  type={type}
                                  name={name}
                                  parse={parse}
                                  valueTrans={valueTrans}
                                  {...colProps}
                                />
                              </td>
                            );
                          },
                        )}
                      </tr>
                    ))}

                    <tr>
                      <td
                        className="border-b-0! items-center justify-center row-auto h-full z-[2] relative bg-background"
                        style={{
                          gridColumn: `span ${showedColumns.length + (selectable ? 1 : 0) + (actions ? 1 : 0)}`,
                        }}
                      />
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
          <ColumnsFilter
            columns={columns}
            open={openColumnsFilter}
            onApply={(val) => {
              setColumns(val);
              reload?.(val);
              setOpenColumnsFilter(false);
            }}
            onReset={() => {
              removeCookie(
                `${DATATABLE_COLUMNS_KEY}_${window.location.pathname}`,
                window.location.pathname,
              );
              router.reload();
              setOpenColumnsFilter(false);
            }}
          />
        </Dialog>
      </DndContext>
    </div>
  );
});

export default memo(Table2);
