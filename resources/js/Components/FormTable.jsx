import {
  ArrowDownIcon,
  ArrowUpIcon,
  CopyIcon,
  GripVerticalIcon,
  PencilIcon,
  SettingsIcon,
  Trash2Icon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { cn, generateRandom, getCookieByName } from "@/lib/utils";

import { Button } from "./ui/button";
import { CSS } from "@dnd-kit/utilities";
import FormInput from "./FormInput";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import useDidMountEffect from "@/Hooks/useDidMountEffect";
import useDynamicRefs from "@/Hooks/useDynamicRefs";
import { useIsMobile } from "@/Hooks/use-mobile";
import { useLaravelReactI18n } from "laravel-react-i18n";

const FORMTABLE_COLUMNS_KEY = "formtable-columns";

const Cell = memo(
  forwardRef(
    ({ index, item, col, isLast, updateData, className, ...props }, ref) => {
      if (!item) return;
      const attributes = {
        ...props,
        ...col.props,
      };
      if (col.cell) {
        return col.cell(
          {
            dataRow: item,
            setData: (key, value) => updateData(index, key, value),
            attributes,
          },
          index,
        );
      }
      switch (col.type) {
        default:
          return (
            <Input
              ref={ref}
              required={
                (Object.keys(item ?? {}).length > 1 || !isLast) && col.required
              }
              name={col.name}
              type={col.type ?? "text"}
              value={col.name ? (item[col.name] ?? "") : ""}
              onChange={(e) => {
                updateData(
                  index,
                  col.name,
                  col.type == "number" ? +e.target.value : e.target.value,
                );
              }}
              className={cn(
                attributes?.className,
                col.props?.className,
                className,
              )}
              {...attributes}
              // onBlur={(e) => {
              //   if (!e.target.value) return;
              //   e.target.value = null;
              //   e.target.focus();
              // }}
            />
          );
      }
    },
  ),
);

const FormTableItem = memo(function FormTableItem({
  index,
  columns,
  isLast,
  item,
  setRef,
  cellOnKeyDown,
  updateData,
  setCurrentIndex,
  deleteRow,
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      key={item.id}
      ref={setNodeRef}
      style={style}
      className="grid group col-span-full items-center grid-cols-subgrid border-muted-foreground/25 [&>div]:text-sm lg:[&>div]:text-base"
    >
      <div className="px-2 !justify-center text-left ">
        <span
          className={cn(
            !(Object.keys(item).length <= 1 && isLast) && "group-hover:hidden",
          )}
        >
          {index + 1}
        </span>
        <button
          className={cn(
            "hidden cursor-move group-hover:inline",
            Object.keys(item).length <= 1 && isLast && "!hidden",
          )}
          type="button"
          {...listeners}
          {...attributes}
        >
          <GripVerticalIcon className="size-5" />
        </button>
      </div>
      {columns &&
        columns.map((col) => {
          return (
            <div key={col.name} className="">
              <Cell
                ref={setRef(`${item.id}-${col.name}`)}
                index={index}
                item={item}
                col={col}
                isLast={isLast}
                onKeyDown={(e) => cellOnKeyDown(e, index, col.name)}
                updateData={updateData}
                className="rounded-none border-0 focus-visible:ring-offset-1 bg-background m-0.5"
              />
            </div>
          );
        })}
      <div className="flex items-center px-2 gap-x-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6"
          onClick={() => setCurrentIndex(index)}
        >
          <PencilIcon className="size-3" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "size-6",
            Object.keys(item).length <= 1 && isLast && "hidden",
          )}
          onClick={() => deleteRow(index)}
        >
          <Trash2Icon className="size-3 text-destructive" />
        </Button>
      </div>
    </div>
  );
});

const createHeaders = (headers) => {
  const columnsMap = new Map(
    headers.map((col) => [
      col.name,
      {
        ...col,
        show: col.show ?? false,
      },
    ]),
  );

  let finalColumns = [];
  const columnsFromCookie = JSON.parse(getCookieByName(FORMTABLE_COLUMNS_KEY));
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
/**
 * @typedef {object} CellProps
 * @property {object} dataRow
 * @property {Function} setData
 * @callback CellCallback
 * @param {CellProps} props
 * @param {number} index
 * @returns {React.JSX.Element}
 */
/**
 * @typedef {object} ColumnProps
 * @property {string} name Cocokan saja dengan nama column pada database
 * @property {string} title
 * @property {string} titleTrans
 * @property {string} type
 * @property {"left" | "center" | "right"} align
 * @property {number} width value width in fr, default is 1
 * @property {boolean} required
 * @property {boolean} show default is false, but will be true when mode required is true
 * @property {object} props
 * @property {CellCallback} Cell
 */

/**
 *
 * @param {object} props
 * @param {string | React.JSX.Element} props.label
 * @param {string | React.JSX.Element} props.description
 * @param {boolean} props.ignoreDisabled
 * @param {string} props.className
 * @param {ColumnProps[]} props.columns
 * @param {object} props.value
 * @param {Function} props.onValueChange
 * @returns {React.JSX.Element}
 */
export default memo(function FormTable({
  label,
  description,
  ignoreDisabled = false,
  className,
  columns: columnsProps,
  value,
  onValueChange,
}) {
  if (!columnsProps) {
    throw new Error("columns is required");
  }
  const [columns, setColumns] = useState(createHeaders(columnsProps));
  const { t } = useLaravelReactI18n();
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [getRef, setRef] = useDynamicRefs();
  const isMobile = useIsMobile();
  const prevValueRef = useRef(value); // Simpan `value` sebelumnya untuk mencegah loop
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
    setColumns(createHeaders(columnsProps));
  }, [columnsProps]);

  if (value && !Array.isArray(value)) {
    throw new Error("value must be an array");
  }
  if (!Array.isArray(columns)) {
    throw new Error("columns must be an array");
  }

  const filteredColumns = useMemo(
    () => columns.filter((x) => x.required || (x.show ?? true)),
    [columns],
  );
  const [_data, _setData] = useState(() => [
    ...value.map((x) => ({ ...x, id: x.id ?? generateRandom(5) })),
    { id: generateRandom(5) }, // Row kosong selalu ada di akhir
  ]);

  // Sinkronisasi data lokal hanya jika `value` berubah dari parent
  useEffect(() => {
    if (JSON.stringify(value) !== JSON.stringify(prevValueRef.current)) {
      prevValueRef.current = value;
      _setData([
        ...value.map((x) => ({ ...x, id: x.id ?? generateRandom(5) })),
        { id: generateRandom(5) }, // Pastikan ada row kosong
      ]);
    }
  }, [value]);

  // Kirim perubahan ke parent hanya jika ada perubahan nyata
  useEffect(() => {
    if (onValueChange) {
      const filteredData = _data.slice(0, -1); // Buang row kosong terakhir sebelum dikirim
      if (
        JSON.stringify(filteredData) !== JSON.stringify(prevValueRef.current)
      ) {
        prevValueRef.current = filteredData;
        onValueChange(filteredData);
      }
    }
  }, [_data, value, onValueChange]);

  // Memperbarui data di index tertentu
  const updateData = useCallback((index, key, newValue) => {
    _setData((prevData) => {
      let newData = [...prevData];

      if (!newData[index]) return prevData;

      newData[index] = {
        ...newData[index],
        id: newData[index]?.id ?? generateRandom(5),
        [key]: newValue,
      };

      // Jika mengubah row terakhir, tambahkan row kosong baru
      if (index === newData.length - 1) {
        newData.push({ id: generateRandom(5) });
      }

      return newData;
    });
  }, []);
  const insertRow = useCallback((index) => {
    _setData((prev) => {
      const newData = [...prev];
      newData.splice(index, 0, { id: generateRandom(5) });
      setCurrentIndex(index);
      return newData;
    });
  }, []);
  const duplicateRow = useCallback((index) => {
    _setData((prev) => {
      const newData = [...prev];
      newData.splice(index + 1, 0, {
        ...newData[index],
        id: generateRandom(5),
      });
      setCurrentIndex(index + 1);
      return newData;
    });
  });
  const deleteRow = useCallback((index) => {
    _setData((prev) => {
      const newData = [...prev];
      newData.splice(index, 1);
      return newData;
    });
  }, []);
  const cellOnKeyDown = useCallback(
    (e, currentIndex, currentCol) => {
      if (e.key == "Enter") {
        e.preventDefault();
        const indexCol = columns.findIndex((x) => x.name === currentCol);
        if (indexCol >= columns.length - 1) {
          if (currentIndex >= _data.length - 1) return;
          currentIndex++;
          currentCol = columns[0].name;
        } else currentCol = columns[indexCol + 1].name;
      } else if (e.ctrlKey) {
        e.preventDefault();
        switch (e.key) {
          case "ArrowRight": {
            const indexCol = columns.findIndex((x) => x.name === currentCol);
            if (indexCol >= columns.length - 1) {
              if (currentIndex >= _data.length - 1) return;
              currentIndex++;
              currentCol = columns[0].name;
            } else currentCol = columns[indexCol + 1].name;
            break;
          }
          case "ArrowLeft": {
            const indexCol = columns.findIndex((x) => x.name === currentCol);
            if (indexCol <= 0) {
              if (currentIndex <= 0) return;
              currentIndex--;
              currentCol = columns[columns.length - 1].name;
            } else currentCol = columns[indexCol - 1].name;
            break;
          }
          case "ArrowUp": {
            if (currentIndex <= 0) return;
            currentIndex--;
            break;
          }
          case "ArrowDown": {
            if (currentIndex >= _data.length - 1) return;
            currentIndex++;
            break;
          }
          default:
            return;
        }
      }
      const item = _data[currentIndex];
      getRef(`${item.id}-${currentCol}`)?.current?.focus();
    },
    [_data, columns],
  );
  const handleDragOver = (event) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      _setData((items) => {
        const newItems = items.map((x) => x.id);

        let newIndex = newItems.indexOf(over.id);
        const oldIndex = newItems.indexOf(active.id);
        if (oldIndex >= newItems.length - 1) return items;
        if (newIndex >= newItems.length - 1) newIndex--;
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  return (
    <>
      <div
        className={cn("flex flex-col gap-y-2 w-full", className)}
        role={!ignoreDisabled ? "forminput" : ""}
      >
        <Label>{label}</Label>
        {description && (
          <p className="text-sm font-normal text-muted-foreground">
            {description}
          </p>
        )}

        <div
          className="grid grid-cols-[auto_1fr_auto] text-sm [&>div>*:last-child]:border-r [&>div>*]:border-l [&>div>*]:border-muted-foreground/25 max-w-full w-full overflow-x-auto [&>div>*]:h-full [&>div>*]:items-center [&>div>*]:flex [&>div>*]:justify-center [&>*:last-child]:rounded-b-md [&>*]:border-b [&>*]:border-muted-foreground/25"
          style={{
            gridTemplateColumns: `auto ${filteredColumns
              .map((x) => `${x.width ?? 1}fr`)
              .join(" ")} auto`,
          }}
        >
          <div className="grid border-t [&>*]:py-2 [&>*]:px-4 grid-cols-subgrid col-span-full items-center rounded-t-md bg-muted [&>div]:font-semibold [&>div]:text-xs lg:[&>div]:text-sm [&>div]:!py-1">
            <div className="!justify-center text-left">#</div>
            {filteredColumns &&
              filteredColumns.map((item) => {
                return (
                  <div key={item.name} className="!justify-start text-left">
                    {item.titleTrans ? t(item.titleTrans) : item.title}
                    {item.required && (
                      <span className="ml-1 text-red-500">*</span>
                    )}
                  </div>
                );
              })}
            <div className="text-center">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-5"
              >
                <SettingsIcon className="size-3" />
              </Button>
            </div>
          </div>
          <DndContext
            onDragOver={handleDragOver}
            sensors={sensors}
            collisionDetection={closestCenter}
          >
            <SortableContext
              items={_data.map((x) => x.id)}
              strategy={horizontalListSortingStrategy}
            >
              {Array.isArray(_data) &&
                _data.map((item, index) => {
                  console.log(item);
                  return (
                    <FormTableItem
                      item={item}
                      index={index}
                      key={item.id}
                      columns={filteredColumns}
                      isLast={index >= _data.length - 1}
                      setRef={setRef}
                      cellOnKeyDown={cellOnKeyDown}
                      updateData={updateData}
                      setCurrentIndex={setCurrentIndex}
                      deleteRow={deleteRow}
                    />
                  );
                })}
            </SortableContext>
          </DndContext>
        </div>
      </div>
      <Dialog
        open={currentIndex >= 0}
        onOpenChange={(e) => {
          if (!e) setCurrentIndex(-1);
        }}
      >
        <DialogContent
          hideX
          className="max-w-full sm:max-w-screen-sm md:w-fit md:min-w-[672px]  md:max-w-3xl lg:max-w-screen-lg"
        >
          <DialogHeader>
            <DialogTitle asChild>
              <div className="flex items-center justify-between">
                <h2>{`${t("core.formtable.editing_row")} #${(currentIndex ?? 0) + 1}`}</h2>

                <div className="flex flex-row items-center justify-end gap-2">
                  {Object.keys(_data[currentIndex] ?? {}).length > 1 &&
                    (isMobile ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="size-8"
                            onClick={() => insertRow(currentIndex - 1)}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 2048 2048"
                            >
                              <path
                                fill="currentColor"
                                d="M2048 128v1664H0V128h512L384 256H128v384h640v512h384V640h768V256h-384l-128-128zM640 1280H128v384h512zm640 0H768v384h512zm640 0h-512v384h512zM621 525l-90-90L960 6l429 429l-90 90l-275-275v774H896V250z"
                              ></path>
                            </svg>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {t("core.formtable.insert_above")}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-8"
                        onClick={() => insertRow(currentIndex - 1)}
                      >
                        {t("core.formtable.insert_above")}
                      </Button>
                    ))}
                  {Object.keys(_data[currentIndex] ?? {}).length > 1 &&
                    currentIndex < _data.length - 2 &&
                    (isMobile ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="size-8"
                            onClick={() => insertRow(currentIndex + 1)}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 2048 2048"
                            >
                              <path
                                fill="currentColor"
                                d="M2048 128v1664h-640l128-128h384v-384h-768V768H768v512H128v384h256l128 128H0V128zM640 256H128v384h512zm640 0H768v384h512zm640 0h-512v384h512zm-621 1139l90 90l-429 429l-429-429l90-90l275 275V896h128v774z"
                              ></path>
                            </svg>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {t("core.formtable.insert_below")}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-8"
                        onClick={() => insertRow(currentIndex + 1)}
                      >
                        {t("core.formtable.insert_below")}
                      </Button>
                    ))}
                  {Object.keys(_data[currentIndex] ?? {}).length > 1 && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-8 h-8 sm:w-auto"
                      onClick={() => duplicateRow(currentIndex)}
                    >
                      <CopyIcon className="size-4" />
                      <span className="hidden lg:inline">
                        {t("core.formtable.duplicate")}
                      </span>
                    </Button>
                  )}
                  {currentIndex > 0 && (
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-8 size-8"
                      onClick={() => setCurrentIndex(currentIndex - 1)}
                    >
                      <ArrowUpIcon className="size-4" />
                    </Button>
                  )}
                  {currentIndex < _data.length - 1 && (
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-8 size-8"
                      onClick={() => setCurrentIndex(currentIndex + 1)}
                    >
                      <ArrowDownIcon className="size-4" />
                    </Button>
                  )}
                  {(Object.keys(_data[currentIndex] ?? {}).length > 1 ||
                    currentIndex < _data.length - 1) && (
                    <Button
                      variant="destructive"
                      size="icon"
                      className="h-8 size-8"
                      onClick={() => deleteRow(currentIndex)}
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                  )}
                </div>
              </div>
            </DialogTitle>
            <DialogDescription className="sr-only" />
          </DialogHeader>
          <div
            className={cn(
              columns.length <= 1
                ? "grid-cols-1"
                : columns.length <= 2
                  ? "md:grid-cols-2"
                  : "md:grid-cols-2 lg:grid-cols-3",
              "grid gap-x-4 gap-y-3",
            )}
          >
            {columns &&
              columns.map((col) => {
                return (
                  <FormInput
                    key={`${_data[currentIndex]?.id}-${col.name}`}
                    required={col.required}
                    label={col.titleTrans ? t(col.titleTrans) : col.title}
                    name={col.name}
                  >
                    <Cell
                      index={currentIndex}
                      item={_data[currentIndex]}
                      col={col}
                      updateData={updateData}
                    />
                  </FormInput>
                );
              })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});
