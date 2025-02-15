import "@/../css/table.css";

import {
  DndContext,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { cn, getCookieByName, setCookie } from "@/lib/utils";

import { Checkbox } from "../ui/checkbox";
import ColumnsFilter from "./ColumnsFilter";
import { Dialog } from "../ui/dialog";
import Header from "./Header";
import { Label } from "../ui/label";
import NoDataImg from "./NoDataImg";
import Pagination from "./Pagination";
import { debounce } from "lodash";
import useDidMountEffect from "@/Hooks/useDidMountEffect";
import { usePage } from "@inertiajs/react";

const DATATABLE_COLUMNS_KEY = "datatable_columns";
const DATATABLE_COLUMNS_EXPIRED = 7; //days
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
        size: convertColWidth(col.width),
      },
    ]),
  );

  let finalColumns = [];
  const columnsFromCookie = JSON.parse(getCookieByName(DATATABLE_COLUMNS_KEY));
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
  totalPages = 1,
  setSort,
  resetSorting,
  reload,
}) {
  const route = window.route;
  const { num_per_page: numPerPage, per_page_options: perPageOptions } =
    usePage().props?.preferences ?? {
      num_per_page: 25,
      per_page_options: [25, 50, 100],
    };
  const [show, setShow] = useState(
    getCookieByName("datatable_show") ?? numPerPage,
  );
  const setShowNumber = useCallback((value) => {
    setShow(value);
    setCookie("datatable_show", value, {
      days: DATATABLE_COLUMNS_EXPIRED,
      path: route(route().current(), [], false),
      sameSite: "lax",
    });
    reload();
  }, []);
  const [data, setData] = useState(initialData);
  useDidMountEffect(() => {
    setData(initialData);
  }, [initialData]);
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
  useDidMountEffect(() => {
    setCookie(
      DATATABLE_COLUMNS_KEY,
      JSON.stringify(columns.map((x) => ({ name: x.name, show: x.show }))),
      {
        days: DATATABLE_COLUMNS_EXPIRED,
        path: route(route().current(), [], false),
        sameSite: "lax",
      },
    );
  }, [columns]);
  function handleDragOver(event) {
    const { active, over } = event;

    if (active.id !== over.id) {
      setColumns((items) => {
        const newItems = items.map((x) => x.title);

        const newIndex = newItems.indexOf(over.id);
        if (newIndex < freezeColumn) return items;

        const oldIndex = newItems.indexOf(active.id);
        const newColumn = arrayMove(items, oldIndex, newIndex);
        tableElement.current.style.gridTemplateColumns = newColumn
          .map((x) => x.size)
          .join(" ");
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

  const mouseMove = useCallback(
    (e) => {
      // const ori = tableElement.current.style.gridTemplateColumns
      //   .split(" ")
      //   .filter((x) => x.startsWith("minmax") || x.indexOf("px") >= 0);
      const newColumns = [];
      const gridColumns = columns.map((col, i) => {
        if (i === activeIndex) {
          const width = e.clientX - col.ref.current.offsetLeft;

          if (width >= minCellWidth) {
            const size = `${width}px`;
            newColumns.push({ ...col, size });
            return size;
          }
        }
        let size = "";
        if (i < activeIndex) {
          size = `${col.ref.current.offsetWidth}px`;
        } else {
          if (col.size?.startsWith("minmax")) {
            size = "minmax(0px, 1fr)";
          } else if (col.size == "1fr" || col.size == "max-content") {
            size = col.size;
          } else {
            size = `${col.ref.current.offsetWidth}px`;
          }
        }
        newColumns.push({ ...col, size });
        return size;
      });

      debounce(() => setColumns(newColumns), 500)();

      tableElement.current.style.gridTemplateColumns = `${gridColumns.join(
        " ",
      )}`;
    },
    [activeIndex, columns, minCellWidth],
  );
  const resetSizeHeader = (index) => {
    const newColumns = [];
    const gridColumns = columns.map((col, i) => {
      if (i === index) {
        const size = convertColWidth(col.width);
        newColumns.push({ ...col, size });
        return size;
      }
      newColumns.push({ ...col, size: col.size });
      return col.size;
    });

    debounce(() => setColumns(newColumns), 500)();

    tableElement.current.style.gridTemplateColumns = `${gridColumns.join(" ")}`;
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
  const showedColumns = columns.filter((x) => x.show);
  return (
    <div className={cn(className, "flex flex-col gap-x-2")}>
      <DndContext
        onDragOver={handleDragOver}
        sensors={sensors}
        collisionDetection={closestCenter}
      >
        <Dialog open={openColumnsFilter} onOpenChange={setOpenColumnsFilter}>
          <div className="flex-1">
            <table
              className={cn("resizeable-table")}
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
                    items={showedColumns.map((x) => x.title)}
                    strategy={horizontalListSortingStrategy}
                  >
                    {selectable && (
                      <th className="!py-2 !px-2 items-center">
                        <Checkbox
                          checked={data.every((x) => x.isSelected ?? false)}
                          onCheckedChange={checkAll}
                        />
                      </th>
                    )}
                    {actions && (
                      <th className="!py-2 !px-2 items-center">
                        <span>Action</span>
                      </th>
                    )}
                    {showedColumns.map(({ ref, resizeable, ...props }, i) => (
                      <Header
                        isEmpty={!data || data.length === 0}
                        setSort={setSort}
                        resetSorting={resetSorting}
                        options={options}
                        setOptions={setOptions}
                        freezeColumn={i < freezeColumn}
                        id={props.title}
                        key={props.title}
                        ref={ref}
                        resizeable={resizeable && i < showedColumns.length - 1}
                        {...props}
                        onResize={() => mouseDown(i)}
                        onResetSize={() => resetSizeHeader(i)}
                        tableHeight={tableHeight}
                      />
                    ))}
                  </SortableContext>
                </tr>
                {/* <tr>
                {selectable && <th className="!py-2 !px-2 items-center"></th>}
                {actions && (
                  <th className="">
                    <div className="w-full h-8 rounded-full cursor-not-allowed bg-muted border-muted"></div>
                  </th>
                )}
                {columns.map(({ title, name, search }) =>
                  search ? (
                    <th key={title} className="!py-2 !px-2">
                      {(() => {
                        if (Array.isArray(search)) {
                          return (
                            <Select
                              value={options.search?.[name] ?? ""}
                              onValueChange={(val) => setSearch(name, val)}
                            >
                              <SelectTrigger className="w-full capitalize">
                                <SelectValue
                                  placeholder={search && `Search ${title}`}
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {search.map((x) => (
                                  <SelectItem
                                    key={x}
                                    value={x.toString()}
                                    className="capitalize"
                                  >
                                    {x}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          );
                        }
                        switch (search) {
                          case "boolean":
                            return (
                              <div className="flex items-center justify-center w-full space-x-2">
                                <Checkbox
                                  id={`search-${name}`}
                                  onChange={(e) =>
                                    setSearch(name, e.current.value)
                                  }
                                />
                              </div>
                            );

                          case "number":
                          case "text":
                            return (
                              <Input
                                type={search}
                                value={options.search?.[name] ?? ""}
                                onChange={(e) =>
                                  setSearch(name, e.current.value)
                                }
                                variant="secondary"
                                className="!h-8 !px-2 !rounded-full focus:!ring-1 bg-muted font-normal"
                                placeholder={search && `Search ${title}`}
                              />
                            );

                          default:
                            break;
                        }
                      })()}
                    </th>
                  ) : (
                    <th key={title}>
                      <div className="w-full h-8 rounded-full cursor-not-allowed bg-muted border-muted"></div>
                    </th>
                  ),
                )}
              </tr> */}
              </thead>
              <tbody>
                {!data || data.length === 0 ? (
                  <tr>
                    <td
                      className="!border-b-0 items-center justify-center"
                      style={{
                        gridColumn: `span ${showedColumns.length + (selectable ? 1 : 0) + (actions ? 1 : 0)}`,
                      }}
                    >
                      <NoDataImg className="w-full max-w-lg" />
                    </td>
                  </tr>
                ) : (
                  <>
                    {data.map((row, i) => (
                      <tr key={i}>
                        {selectable && (
                          <td className="!py-2 !px-2 items-center">
                            <Checkbox
                              checked={row.isSelected ?? false}
                              onCheckedChange={(check) => checklist(row, check)}
                            />
                          </td>
                        )}
                        {actions && (
                          <td className="w-full">{actions({ row })}</td>
                        )}
                        {showedColumns.map(({ cell, name, parse }) => {
                          return (
                            <td key={name}>
                              {cell ? (
                                cell({
                                  dataRow: row,
                                  valueCell: parse
                                    ? parse[row[name].toString()]
                                    : row[name],
                                })
                              ) : (
                                <span>
                                  {parse
                                    ? parse[row[name].toString()]
                                    : row[name]}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}

                    <tr>
                      <td
                        className="!border-b-0 items-center justify-center row-auto h-full"
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
              setOpenColumnsFilter(false);
            }}
          />
        </Dialog>
      </DndContext>
      <div className="flex justify-between px-4 py-4 border-t border-muted-foreground/25 gap-x-4">
        <div className="flex items-center gap-x-2">
          <Label>Show</Label>
          <Select value={`${show}`} onValueChange={(e) => setShowNumber(e)}>
            <SelectTrigger className="!w-fit gap-x-2">
              <SelectValue placeholder="Show"></SelectValue>
            </SelectTrigger>
            <SelectContent>
              {perPageOptions.map((x) => (
                <SelectItem key={x} value={x.toString()}>
                  {x}
                </SelectItem>
              ))}
              {/* <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem> */}
            </SelectContent>
          </Select>
        </div>
        <Pagination
          currentPage={options.page}
          totalPages={Math.floor(totalPages / show) + 1}
          onPageChanged={(page) => setOptions({ ...options, page })}
          className="justify-end"
        />
      </div>
    </div>
  );
}

export default Table;
