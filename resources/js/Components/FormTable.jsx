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
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { cn, generateRandom, getCookieByName, setCookie } from "@/lib/utils";

import { Button } from "./ui/button";
import { CSS } from "@dnd-kit/utilities";
import { FormCheckbox } from "./ui/checkbox";
import FormInput from "./FormInput";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { isEqual } from "lodash";
import useDidMountEffect from "@/Hooks/useDidMountEffect";
import useDynamicRefs from "@/Hooks/useDynamicRefs";
import { useIsMobile } from "@/Hooks/use-mobile";
import { useLaravelReactI18n } from "laravel-react-i18n";

const FORMTABLE_COLUMNS_KEY = "formtable-columns";
const FORMTABLE_COLUMNS_EXPIRED = 7;

const Cell = memo(
  forwardRef(
    (
      { index, item, col, isLast, updateData, readonly, className, ...props },
      ref,
    ) => {
      if (!item) return;
      const attributes = {
        ...props,
        ...col.props,
        readOnly: readonly || col.readonly || false,
        required:
          (Object.keys(item ?? {}).length > 1 || !isLast) && col.required,
        name: col.name,
        className: cn(className, col.props?.className),
        ref,
      };
      if (col.cell) {
        return col.cell(
          {
            dataRow: item,
            data: item[col.name],
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
              type={col.type ?? "text"}
              value={col.name ? (item[col.name] ?? "") : ""}
              onChange={(e) => {
                updateData(
                  index,
                  col.name,
                  col.type == "number" ? +e.target.value : e.target.value,
                );
              }}
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
  readonly,
  className,
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
      className={cn(
        "grid group col-span-full items-center grid-cols-subgrid border-muted-foreground/25 [&>div]:text-sm lg:[&>div]:text-base",
        className,
      )}
    >
      <div className="px-2 !justify-center text-left ">
        <span
          className={cn(
            !(Object.keys(item).length <= 1 && isLast) &&
              !readonly &&
              "group-hover:hidden",
          )}
        >
          {index + 1}
        </span>
        <button
          className={cn(
            "hidden cursor-move group-hover:inline",
            ((Object.keys(item).length <= 1 && isLast) || readonly) &&
              "!hidden",
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
                readonly={readonly}
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
        {!readonly && (
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
        )}
      </div>
    </div>
  );
});

const createHeaders = (headers, reset) => {
  const columnsMap = new Map(
    headers.map((col) => [
      col.name,
      {
        ...col,
        show: col.required || (col.show ?? false),
      },
    ]),
  );
  if (reset) return Array.from(columnsMap.values());

  let finalColumns = [];
  const columnsFromCookie = JSON.parse(getCookieByName(FORMTABLE_COLUMNS_KEY));
  if (!columnsFromCookie) {
    return Array.from(columnsMap.values());
  }

  columnsFromCookie.forEach((col) => {
    const oriCol = columnsMap.get(col.name);
    if (!oriCol) return;
    oriCol.show = col.show || oriCol.required || (oriCol.show ?? false);
    oriCol.width = col.width ?? oriCol.width ?? 1;

    finalColumns.push(oriCol);
    columnsMap.delete(col.name);
  });

  columnsMap.values().forEach((col) => {
    finalColumns.push(col);
  });
  return finalColumns;
};
/**
 * @namespace FormTable
 */
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
 * @property {boolean} required default is false, require
 * @property {boolean} show default is false, but will be true when required is true
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
  readonly = false,
  className,
  columns: columnsProps,
  value,
  onValueChange,
}) {
  if (!columnsProps) {
    throw new Error("columns is required");
  }
  const [openConfigureColumns, setOpenConfigureColumns] = useState(false);
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
  useDidMountEffect(() => {
    setCookie(
      FORMTABLE_COLUMNS_KEY,
      JSON.stringify(
        columns.map((x) => ({ name: x.name, show: x.show, width: x.width })),
      ),
      {
        days: FORMTABLE_COLUMNS_EXPIRED,
        path: window.location.pathname,
        sameSite: "lax",
      },
    );
  }, [columns]);

  if (!value || !Array.isArray(value)) {
    throw new Error("value must be an array");
  }
  if (!Array.isArray(columns)) {
    throw new Error("columns must be an array");
  }

  const filteredColumns = useMemo(
    () => columns.filter((x) => x.required || (x.show ?? true)),
    [columns],
  );
  const [_data, _setData] = useState(() =>
    readonly
      ? value
      : [
          ...value.map((x) => ({ ...x, id: x.id ?? generateRandom(5) })),
          { id: generateRandom(5) }, // Row kosong selalu ada di akhir
        ],
  );

  // Sinkronisasi data lokal hanya jika `value` berubah dari parent
  useEffect(() => {
    if (!isEqual(value, prevValueRef.current)) {
      prevValueRef.current = value;
      if (readonly) {
        _setData([...value]);
        return;
      }
      _setData([
        ...value.map((x) => ({ ...x, id: x.id ?? generateRandom(5) })),
        { id: generateRandom(5) }, // Pastikan ada row kosong
      ]);
    }
  }, [value, readonly]);

  // Kirim perubahan ke parent hanya jika ada perubahan nyata
  useEffect(() => {
    if (onValueChange) {
      const filteredData = readonly ? _data : _data.slice(0, -1); // Buang row kosong terakhir sebelum dikirim
      if (!isEqual(filteredData, prevValueRef.current)) {
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
      if (index === newData.length - 1 && !readonly) {
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
        switch (e.key) {
          case "ArrowRight": {
            e.preventDefault();

            const indexCol = columns.findIndex((x) => x.name === currentCol);
            if (indexCol >= columns.length - 1) {
              if (currentIndex >= _data.length - 1) return;
              currentIndex++;
              currentCol = columns[0].name;
            } else currentCol = columns[indexCol + 1].name;
            break;
          }
          case "ArrowLeft": {
            e.preventDefault();

            const indexCol = columns.findIndex((x) => x.name === currentCol);
            if (indexCol <= 0) {
              if (currentIndex <= 0) return;
              currentIndex--;
              currentCol = columns[columns.length - 1].name;
            } else currentCol = columns[indexCol - 1].name;
            break;
          }
          case "ArrowUp": {
            e.preventDefault();

            if (currentIndex <= 0) return;
            currentIndex--;
            break;
          }
          case "ArrowDown": {
            e.preventDefault();

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
  const handleDragOver = useCallback(
    (event) => {
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
    },
    [_setData],
  );

  return (
    <>
      <div
        className={cn("flex flex-col gap-y-2 w-full", className)}
        role={!ignoreDisabled ? "forminput" : ""}
      >
        <Label>{label}</Label>
        {description &&
          (typeof description == "string" ? (
            <p className="text-sm font-normal text-muted-foreground">
              {description}
            </p>
          ) : (
            description
          ))}

        <div
          className="rounded-md grid grid-cols-[auto_1fr_auto] text-sm [&>div>*:last-child]:border-r [&>div>*]:border-l [&>div>*]:border-muted-foreground/25 max-w-full w-full overflow-x-auto [&>div>*]:h-full [&>div>*]:items-center [&>div>*]:flex [&>div>*]:justify-center  [&>*]:border-b [&>*]:border-muted-foreground/25"
          style={{
            gridTemplateColumns: `auto ${filteredColumns
              .map((x) => `${x.width ?? 1}fr`)
              .join(" ")} auto`,
          }}
        >
          <div className="grid border-t [&>*]:py-2 [&>*]:px-4 grid-cols-subgrid col-span-full items-center rounded-t-md bg-muted [&>div]:font-semibold [&>div]:text-sm lg:[&>div]:text-sm [&>div]:!py-1">
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
                onClick={() => setOpenConfigureColumns(true)}
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
              strategy={verticalListSortingStrategy}
            >
              {Array.isArray(_data) &&
                _data.map((item, index) => {
                  return (
                    <FormTableItem
                      readonly={readonly}
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
                      className={
                        index == _data.length - 1 ? "rounded-b-md" : ""
                      }
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
                    !readonly &&
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
                    !readonly &&
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
                  {Object.keys(_data[currentIndex] ?? {}).length > 1 &&
                    !readonly && (
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
                    currentIndex < _data.length - 1) &&
                    !readonly && (
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
                      readonly={readonly}
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
      <ConfigureColumns
        columns={columns}
        setColumns={setColumns}
        open={openConfigureColumns}
        setOpen={setOpenConfigureColumns}
        onReset={() => {
          setColumns(createHeaders(columnsProps, true));
        }}
      />
    </>
  );
});

const ConfigureColumns = memo(function ConfigureColumns({
  columns: columnsProps,
  setColumns: setColumnsProps,
  open,
  setOpen,
  onReset,
}) {
  const [columns, setColumns] = useState([]);
  const [openSelectColumn, setOpenSelectColumn] = useState(false);
  const { t } = useLaravelReactI18n();
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
  useEffect(() => {
    if (open) {
      setColumns(columnsProps);
    }
  }, [open]);

  const handleDragOver = (event) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      setColumns((items) => {
        const newItems = items.map((x) => x.name);

        const newIndex = newItems.indexOf(over.id);
        const oldIndex = newItems.indexOf(active.id);
        const newColumn = arrayMove(items, oldIndex, newIndex);
        return newColumn;
      });
    }
  };

  const showedColumns = columns.filter((col) => col.show);
  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="pb-2 border-b border-muted-foreground/25">
            <DialogTitle>{t("core.formtable.configure_columns")}</DialogTitle>
            <DialogDescription className="sr-only"></DialogDescription>
          </DialogHeader>
          <DndContext
            onDragOver={handleDragOver}
            sensors={sensors}
            collisionDetection={closestCenter}
          >
            <div className="overflow-x-hidden grid border rounded-lg border-muted-foreground/25 grid-cols-[auto_2fr_minmax(auto,1fr)_auto]  text-sm max-w-full w-full [&>div]:h-fit [&>*:not(:last-child)]:border-b [&>*]:border-muted-foreground/25">
              <div className="grid grid-cols-subgrid col-span-full items-center rounded-t-md bg-muted [&>div]:font-semibold [&>div]:text-sm lg:[&>div]:text-sm [&>div]:!py-1 [&>*]:px-2">
                <div></div>
                <div>{t("core.formtable.column")}</div>
                <div>{t("core.formtable.width")}</div>
              </div>
              <div className="overflow-y-auto overflow-x-hidden grid grid-cols-subgrid col-span-full [&>div>*]:py-1 [&>div>*]:px-2 [&>div>*]:border-muted-foreground/25 [&>div>*]:h-full [&>div>*]:items-center [&>div>*]:flex [&>div]:h-fit [&>*:not(:last-child)]:border-b [&>*]:border-muted-foreground/25">
                <SortableContext
                  items={showedColumns.map((x) => x.name)}
                  strategy={verticalListSortingStrategy}
                >
                  {showedColumns.map((col) => {
                    return (
                      <ColumnItem
                        key={col.name}
                        onChangeWidth={(name, val) => {
                          setColumns((x) => {
                            return x.map((col) => {
                              if (col.name === name) {
                                return { ...col, width: val };
                              }
                              return col;
                            });
                          });
                        }}
                        onRemove={(name) => {
                          setColumns((x) => {
                            return x.map((col) => {
                              if (col.name === name) {
                                return { ...col, show: false };
                              }
                              return col;
                            });
                          });
                        }}
                        column={col}
                      />
                    );
                  })}
                </SortableContext>
              </div>
            </div>
          </DndContext>
          <Button
            variant="ghost"
            size="sm"
            className="inline h-6 -mt-3 font-medium text-left w-fit"
            onClick={() => setOpenSelectColumn(true)}
          >
            {t("core.formtable.add_or_remove_columns")}
          </Button>
          <DialogFooter className="pt-2 -mb-2 border-t border-muted-foreground/25">
            <DialogClose asChild>
              <Button
                variant="secondary"
                className="h-8"
                onClick={() => onReset()}
              >
                {t("core.formtable.reset_to_default")}
              </Button>
            </DialogClose>
            <DialogClose asChild>
              <Button className="h-8" onClick={() => setColumnsProps(columns)}>
                {t("core.formtable.apply")}
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <SelectColumn
        columns={columns}
        setColumns={setColumns}
        open={openSelectColumn}
        setOpen={setOpenSelectColumn}
      />
    </>
  );
});
const SelectColumn = memo(function SelectColumn({
  columns: columnsProps,
  setColumns: setColumnsProps,
  open,
  setOpen,
}) {
  const [columns, setColumns] = useState([]);
  const { t } = useLaravelReactI18n();

  useEffect(() => {
    if (open) {
      setColumns(columnsProps);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader className="pb-2 border-b border-muted-foreground/25">
          <DialogTitle>{t("core.formtable.select_columns")}</DialogTitle>
          <DialogDescription className="sr-only"></DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t("core.formtable.select_columns.description")}
        </p>
        <div className="space-y-4 columns-3xs">
          {columns &&
            columns.map((col) => {
              return (
                <FormCheckbox
                  key={col.name}
                  label={
                    <>
                      {col.titleTrans ? t(col.titleTrans) : col.title}
                      {col.required && (
                        <span className="ml-1 text-red-500">*</span>
                      )}
                    </>
                  }
                  classNameCheckbox="!pointer-events-auto"
                  disabled={col.required}
                  checked={col.required || col.show}
                  onCheckedChange={(val) => {
                    setColumns((x) => {
                      return x.map((y) => {
                        if (y.required) return y;
                        if (y.name === col.name) {
                          return { ...y, show: val };
                        }
                        return y;
                      });
                    });
                  }}
                />
              );
            })}
        </div>
        <DialogFooter className="pt-2 -mb-2 border-t border-muted-foreground/25">
          <Button
            type="button"
            variant="secondary"
            className="h-8"
            onClick={() => {
              setColumns((x) => {
                return x.map((y) => {
                  return { ...y, show: true };
                });
              });
            }}
          >
            {t("core.formtable.select_all")}
          </Button>
          <DialogClose asChild>
            <Button className="h-8" onClick={() => setColumnsProps(columns)}>
              {t("core.formtable.apply")}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
const ColumnItem = memo(function ColumnItem({
  column,
  onChangeWidth,
  onRemove,
}) {
  const { t } = useLaravelReactI18n();
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: column.name });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="grid bg-background group col-span-full items-center grid-cols-subgrid border-muted-foreground/25 [&>div]:text-sm lg:[&>div]:text-base"
    >
      <button className="cursor-move " {...listeners} {...attributes}>
        <GripVerticalIcon className="transition-[color,opacity] group-hover:text-foreground text-muted-foreground/50 size-5" />
      </button>
      <div>
        {column.titleTrans ? t(column.titleTrans) : column.title}
        {column.required && <span className="ml-1 text-red-500">*</span>}
      </div>
      <div>
        <Input
          type="number"
          min="1"
          max="10"
          step="1"
          value={column.width ?? 1}
          onChange={(e) => {
            onChangeWidth(column.name, e.target.value);
          }}
        />
      </div>
      <div className="w-10">
        {!column.required && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn("size-6")}
            onClick={() => onRemove(column.name)}
          >
            <Trash2Icon className="size-3 text-destructive" />
          </Button>
        )}
      </div>
    </div>
  );
});
