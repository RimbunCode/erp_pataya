/* eslint-disable react-hooks/refs */
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogFooter,
} from "./ui/alert-dialog";
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
  startTransition,
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
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import {
  cn,
  generateRandom,
  getFromLocalStorage,
  saveToLocalStorage,
} from "@/lib/utils";

import { Button } from "./ui/button";
import { CSS } from "@dnd-kit/utilities";
import CurrencyInput from "./CurrencyInput";
import { FormCheckbox } from "./ui/checkbox";
import { FormChildren } from "@/Pages/Core/FormPage";
import FormInput from "./FormInput";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { isEqual } from "lodash";
import useDidMountEffect from "@/Hooks/useDidMountEffect";
import useDynamicRefs from "@/Hooks/useDynamicRefs";
import { useIsMobile } from "@/Hooks/use-mobile";
import { useLaravelReactI18n } from "laravel-react-i18n";

const FORMTABLE_COLUMNS_KEY = "formtable-columns";
const FORMTABLE_COLUMNS_EXPIRED = 30;

const Wrapper = memo(({ children, isDialog }) => {
  if (isDialog) return <>{children}</>;
  else
    return (
      <div className="focus-within:border-0 focus-within:ring-offset-background focus-within:outline-none focus-within:ring-1 focus-within:ring-ring focus-within:ring-offset-1 h-full focus-visible:ring-offset-1">
        {children}
      </div>
    );
});

Wrapper.displayName = "Wrapper";

const getRowFieldCount = (row) => Object.keys(row ?? {}).length;
const isSameArrayReferences = (first = [], second = []) => {
  if (first.length !== second.length) {
    return false;
  }
  for (let index = 0; index < first.length; index++) {
    if (first[index] !== second[index]) {
      return false;
    }
  }
  return true;
};

const CellComponent = forwardRef(function Cell(
  {
    index,
    item,
    col,
    isLast,
    updateData,
    readOnly,
    disabled,
    className,
    onToggleDialog,
    onCellKeyDown,
    defaultValueRow,
    defaultRowFieldCount,
    rowFieldCount,
    isDialog,
    additionalData,
    ...props
  },
  ref,
) {
  if (!item) {
    return null;
  }

  const currentRowFieldCount = rowFieldCount ?? getRowFieldCount(item);
  const minimumRowFieldCount =
    defaultRowFieldCount ?? getRowFieldCount(defaultValueRow) + 1;
  const isRowEmpty = currentRowFieldCount <= minimumRowFieldCount;
  const attributes = {
    ...props,
    ...col.props,
    readOnly: readOnly || disabled || col.readOnly || false,
    required: (!isRowEmpty || !isLast) && col.required,
    name: col.name,
    className: cn(!isDialog && "h-full", className, col.props?.className),
    ref,
  };
  const handleKeyDown = (event) => {
    attributes.onKeyDown?.(event);
    onCellKeyDown?.(event, index, col.name);
  };

  if (col.cell) {
    return col.cell(
      {
        dataRow: item,
        data: item[col.name],
        setData: (key, value) => updateData(index, key, value),
        additionalData,
        attributes,
        toggleDialog: onToggleDialog ?? (() => {}),
        reset: () => {
          updateData(index, {});
        },
        isEmpty: isRowEmpty,
      },
      index,
    );
  }

  switch (col.type) {
    default:
      return isDialog ? (
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
          onKeyDown={handleKeyDown}
          className={cn(
            attributes.className,
            !isDialog &&
              "m-0 bg-transparent! border-0! h-full focus-visible:ring-0! focus-visible:ring-offset-0!",
          )}
          // onBlur={(e) => {
          //   if (!e.target.value) return;
          //   e.target.value = null;
          //   e.target.focus();
          // }}
        />
      ) : (
        <div className="w-full focus-within:border-0 focus-within:ring-offset-background focus-within:outline-none focus-within:ring-1 focus-within:ring-ring focus-within:ring-offset-0 h-full focus-visible:ring-offset-1">
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
            onKeyDown={handleKeyDown}
            className={cn(
              attributes.className,
              !isDialog &&
                "m-0 bg-transparent! border-0! h-full focus-visible:ring-0! focus-visible:ring-offset-0!",
            )}
            // onBlur={(e) => {
            //   if (!e.target.value) return;
            //   e.target.value = null;
            //   e.target.focus();
            // }}
          />
        </div>
      );
  }
});

const areCellPropsEqual = (prevProps, nextProps) => {
  if (prevProps.col !== nextProps.col) {
    return false;
  }
  if (prevProps.index !== nextProps.index) {
    return false;
  }
  if (prevProps.isLast !== nextProps.isLast) {
    return false;
  }
  if (prevProps.readOnly !== nextProps.readOnly) {
    return false;
  }
  if (prevProps.disabled !== nextProps.disabled) {
    return false;
  }
  if (prevProps.className !== nextProps.className) {
    return false;
  }
  if (prevProps.isDialog !== nextProps.isDialog) {
    return false;
  }
  if (prevProps.keyItem !== nextProps.keyItem) {
    return false;
  }
  if (prevProps.updateData !== nextProps.updateData) {
    return false;
  }
  if (prevProps.onToggleDialog !== nextProps.onToggleDialog) {
    return false;
  }
  if (prevProps.onCellKeyDown !== nextProps.onCellKeyDown) {
    return false;
  }
  if (prevProps.additionalData !== nextProps.additionalData) {
    return false;
  }
  if (prevProps.rowFieldCount !== nextProps.rowFieldCount) {
    return false;
  }
  if (prevProps.defaultRowFieldCount !== nextProps.defaultRowFieldCount) {
    return false;
  }
  if (prevProps.col?.cell || nextProps.col?.cell) {
    return prevProps.item === nextProps.item;
  }

  const columnName = prevProps.col?.name;
  if (columnName !== nextProps.col?.name) {
    return false;
  }
  return Object.is(prevProps.item?.[columnName], nextProps.item?.[columnName]);
};

export const Cell = memo(CellComponent, areCellPropsEqual);

const FormTableItem = memo(function FormTableItem({
  index,
  columns,
  isLast,
  item,
  setRef,
  cellOnKeyDown,
  updateData,
  submitable,
  setCurrentIndex,
  setCurrentData,
  deleteRow,
  readOnly,
  disabled,
  className,
  defaultRowFieldCount,
  forceCanDelete,
  rowAdditionalData,
  keyItem = "id",
  actions,
}) {
  const rowKey = item?.[keyItem];
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: rowKey });
  const rowFieldCount = getRowFieldCount(item);
  const isEmptyRow = rowFieldCount <= defaultRowFieldCount;
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const toggleDialog = useCallback(() => {
    setCurrentIndex(index);
    if (submitable) {
      setCurrentData(item);
    }
  }, [index, item, setCurrentData, setCurrentIndex, submitable]);

  return (
    <div
      key={rowKey}
      ref={setNodeRef}
      style={style}
      className={cn(
        "grid group min-h-10 col-span-full items-center grid-cols-subgrid border-muted-foreground/25 [&>*:last-child]:border-r *:border-l *:border-muted-foreground/25 *:h-full *:items-center *:flex *:justify-center",
        className,
      )}
    >
      <div className="px-1 justify-center! text-left ">
        <span
          className={cn(
            !(isEmptyRow && isLast) &&
              !(readOnly || disabled) &&
              "group-hover:hidden",
          )}
        >
          {index + 1}
        </span>
        <button
          className={cn(
            "hidden cursor-move group-hover:inline ",
            ((isEmptyRow && isLast) || readOnly || disabled) && "hidden!",
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
            <div key={col.name} className="has-[.custom-cell]:block!">
              <Cell
                onToggleDialog={toggleDialog}
                onCellKeyDown={cellOnKeyDown}
                ref={setRef(`${rowKey}-${col.name}`)}
                disabled={disabled}
                readOnly={readOnly}
                index={index}
                item={item}
                additionalData={rowAdditionalData}
                keyItem={keyItem}
                col={col}
                isLast={isLast}
                defaultRowFieldCount={defaultRowFieldCount}
                rowFieldCount={rowFieldCount}
                updateData={updateData}
                className="rounded-none border-0 focus-visible:ring-offset-1 bg-background"
              />
            </div>
          );
        })}
      <div className="flex items-center px-1 gap-x-1">
        {actions && actions({ row: item, index, toggleDialog })}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6 pointer-events-auto!"
          onClick={toggleDialog}
        >
          <PencilIcon className="size-3" />
        </Button>
        {(!(readOnly || disabled) || forceCanDelete) && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn("size-6", isEmptyRow && isLast && "hidden")}
            onClick={() => deleteRow(index)}
          >
            <Trash2Icon className="size-3 text-destructive" />
          </Button>
        )}
      </div>
    </div>
  );
});

const createHeaders = (key, headers, reset) => {
  const columnsMap = new Map(
    headers
      .filter((col) => col)
      .map((col) => [
        col.name,
        {
          ...col,
          show: col.required || col.locked || (col.show ?? false),
        },
      ]),
  );
  if (reset) return Array.from(columnsMap.values());

  let finalColumns = [];
  const columnsFromCookie = getFromLocalStorage(key);
  if (!columnsFromCookie) {
    return Array.from(columnsMap.values());
  }

  columnsFromCookie.forEach((col) => {
    const oriCol = columnsMap.get(col.name);
    if (!oriCol) return;
    oriCol.show =
      col.show || oriCol.required || col.locked || (oriCol.show ?? false);
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
 * @property {(key: string | object, value?: unknown) => void} setData
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
 * @property {boolean} locked default is false
 * @property {boolean} unique default is false
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
 * @param {(value: object[]) => void} props.onValueChange
 * @param {object | ((value: object) => object)} props.additionalData Accepts object map keyed by row id or a callback `(value) => object`
 * @param {(value: object) => Promise<object>} props.asyncAdditionalData
 * @returns {React.JSX.Element}
 */
export default memo(
  forwardRef(function FormTable(
    {
      name,
      keyItem = "id",
      label,
      disabled = false,
      description,
      ignoreDisabled = false,
      readOnly = false,
      className,
      classNameDialog,
      columns: columnsProps,
      value,
      onValueChange,
      defaultValueRow,
      form,
      submitable = false,
      mapItem,
      forceCanDelete = false,
      additionalData: _additionalData,
      asyncAdditionalData,
      actions,
    },
    ref,
  ) {
    if (!columnsProps) {
      throw new Error("columns is required");
    }
    const key = useMemo(
      () => FORMTABLE_COLUMNS_KEY + (name ? `_${name}` : ""),
      [name],
    );
    const [__additionalData, setAdditionalData] = useState({});
    const [openConfigureColumns, setOpenConfigureColumns] = useState(false);
    const [columns, setColumns] = useState(createHeaders(key, columnsProps));
    const { t } = useLaravelReactI18n();
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [currentData, setCurrentData] = useState(null);
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
      setColumns(createHeaders(key, columnsProps));
    }, [columnsProps]);
    useDidMountEffect(() => {
      saveToLocalStorage(
        key,
        columns.map((x) => ({ name: x.name, show: x.show, width: x.width })),
        FORMTABLE_COLUMNS_EXPIRED,
      );
    }, [columns]);
    if (value && !Array.isArray(value)) {
      throw new Error("value must be an array");
    }
    value = value ?? [];
    const getItemKey = useCallback((item) => item?.[keyItem], [keyItem]);
    const withItemKey = useCallback(
      (item = {}) => ({
        ...item,
        [keyItem]: item?.[keyItem] ?? generateRandom(5),
      }),
      [keyItem],
    );
    const applyMapItem = useCallback(
      (item, dataTable, index) => {
        if (!mapItem) {
          return item;
        }
        const mappedItem = mapItem({ item, dataTable, index });
        return mappedItem ?? item;
      },
      [mapItem],
    );
    const additionalData = useMemo(() => {
      if (typeof _additionalData === "function") {
        return _additionalData(value, keyItem);
      }
      return _additionalData ?? __additionalData;
    }, [_additionalData, __additionalData, value, keyItem]);
    if (!Array.isArray(columns)) {
      throw new Error("columns must be an array");
    }

    const filteredColumns = useMemo(
      () => columns.filter((x) => x.required || x.locked || (x.show ?? true)),
      [columns],
    );
    const defaultRowFieldCount = useMemo(
      () => getRowFieldCount(defaultValueRow) + 1,
      [defaultValueRow],
    );
    const [_data, _setData] = useState(() => {
      return readOnly || (disabled && value.length > 0)
        ? value.map((x) => withItemKey(x))
        : [
            ...value.map((x) =>
              withItemKey({
                ...(defaultValueRow ?? {}),
                ...x,
              }),
            ),
            withItemKey({ ...(defaultValueRow ?? {}) }), // Row kosong selalu ada di akhir
          ];
    });
    const dataRef = useRef(_data);
    const pendingParentUpdateRef = useRef(null);
    const pendingAnimationFrameRef = useRef(null);
    useEffect(() => {
      dataRef.current = _data;
    }, [_data]);
    const flushParentUpdate = useCallback(() => {
      pendingAnimationFrameRef.current = null;
      if (!onValueChange) {
        pendingParentUpdateRef.current = null;
        return;
      }
      const pendingUpdate = pendingParentUpdateRef.current;
      if (!pendingUpdate) {
        return;
      }
      pendingParentUpdateRef.current = null;
      startTransition(() => {
        onValueChange(pendingUpdate.data, pendingUpdate.key);
      });
    }, [onValueChange]);
    const scheduleParentUpdate = useCallback(
      (data, key, immediate = false) => {
        pendingParentUpdateRef.current = { data, key };
        if (immediate) {
          if (pendingAnimationFrameRef.current != null) {
            cancelAnimationFrame(pendingAnimationFrameRef.current);
            pendingAnimationFrameRef.current = null;
          }
          flushParentUpdate();
          return;
        }
        if (pendingAnimationFrameRef.current != null) {
          return;
        }
        pendingAnimationFrameRef.current =
          requestAnimationFrame(flushParentUpdate);
      },
      [flushParentUpdate],
    );
    useEffect(() => {
      return () => {
        if (pendingAnimationFrameRef.current != null) {
          cancelAnimationFrame(pendingAnimationFrameRef.current);
          pendingAnimationFrameRef.current = null;
        }
        flushParentUpdate();
      };
    }, [flushParentUpdate]);

    const idChanges = useRef(new Set(value.map((x) => getItemKey(x))));
    useEffect(() => {
      if (typeof asyncAdditionalData !== "function") {
        return;
      }
      const debounce = setTimeout(async () => {
        if (idChanges.current?.size === 0) return;
        try {
          const result = await asyncAdditionalData(
            value,
            Array.from(idChanges.current?.values() ?? []).filter(Boolean),
            keyItem,
          );
          const data = result?.data ?? {};
          for (const id in data ?? {}) {
            idChanges.current?.delete(id);
          }
          setAdditionalData((prev) => ({ ...prev, ...data }));
        } catch {
          // catch error
        }
      }, 200);

      return () => clearTimeout(debounce);
    }, [asyncAdditionalData, keyItem, value]);

    useImperativeHandle(
      ref,
      () => ({
        resetColumns: () => {
          setColumns(createHeaders(key, columnsProps));
        },
        openConfigureColumns: () => {
          setOpenConfigureColumns(true);
        },
        closeConfigureColumns: () => {
          setOpenConfigureColumns(false);
        },
      }),
      [columnsProps],
    );
    const formRef = useRef();
    const onKeyDown = useCallback(
      (e) => {
        e.stopPropagation();
        if (e.ctrlKey && e.key == "s") {
          e.preventDefault();
          const form = formRef.current;

          if (form) {
            form.requestSubmit();
          }
        }
      },
      [formRef],
    );

    // Sinkronisasi data lokal hanya jika `value` berubah dari parent
    useEffect(() => {
      if (
        value != prevValueRef.current &&
        !isEqual(value, prevValueRef.current)
      ) {
        prevValueRef.current = value;
        idChanges.current = new Set(value.map((x) => getItemKey(x)));
        if (readOnly || (disabled && value.length > 0)) {
          _setData(value.map((x) => withItemKey(x)));
          return;
        }
        _setData((prev) => {
          return [
            ...value.map((x, index) => {
              const data = withItemKey({
                ...(defaultValueRow ?? {}),
                ...x,
              });
              return applyMapItem(data, prev, index);
            }),
            withItemKey({ ...(defaultValueRow ?? {}) }), // Pastikan ada row kosong
          ];
        });
      }
    }, [
      value,
      readOnly,
      disabled,
      applyMapItem,
      defaultValueRow,
      getItemKey,
      withItemKey,
    ]);

    // Kirim perubahan ke parent hanya jika ada perubahan nyata

    const updateParent = useCallback(
      (data, key, options = {}) => {
        const { immediate = false } = options;
        if (!onValueChange) {
          return;
        }
        const filteredData = readOnly || disabled ? data : data.slice(0, -1);
        const previousData = prevValueRef.current ?? [];
        if (isSameArrayReferences(filteredData, previousData)) {
          return;
        }
        prevValueRef.current = filteredData;
        if (key) {
          idChanges.current?.add(key);
        }
        scheduleParentUpdate(filteredData, key, immediate);
      },
      [disabled, onValueChange, readOnly, scheduleParentUpdate],
    );

    // Memperbarui data current
    const updateDataCurrent = useCallback(
      (key, newValue) => {
        setCurrentData((prevData) => {
          const payload =
            typeof key === "string" || typeof key === "number"
              ? { [key]: newValue }
              : key;
          return {
            ...prevData,
            [keyItem]: prevData?.[keyItem] ?? generateRandom(5),
            ...payload,
          };
        });
      },
      [setCurrentData, keyItem],
    );
    // Memperbarui data di index tertentu
    const updateData = useCallback(
      (index, key, newValue) => {
        const update = (prevData) => {
          const isLastRow = index === prevData.length - 1;
          if (
            (disabled && prevData.length > 0) ||
            (!readOnly && index === prevData.length - 1 && key == null)
          )
            return prevData;
          let newData = [...prevData];
          if (!newData[index]) return prevData;

          const payload =
            typeof key === "string" || typeof key === "number"
              ? { [key]: newValue }
              : (key ?? {});
          const resetRow = (idx) => {
            newData[idx] = withItemKey({
              ...(defaultValueRow ?? {}),
            });
            newData[idx] = applyMapItem(newData[idx], newData, idx);
          };
          const isDuplicateValue = (colName, value) => {
            const isDuplicate = newData.some((row, idx) => {
              if (idx == index) return false;
              if (row[colName] == value || isEqual(row[colName], value))
                return true;
              if (
                typeof row[colName] === "object" &&
                typeof value === "object" &&
                row[colName]?.id == value?.id
              )
                return true;
              return false;
            });
            return isDuplicate;
          };
          // Jika payload null → reset row kecuali id pendek
          if (
            payload == null ||
            payload == undefined ||
            Object.keys(payload).length <= 0
          ) {
            if (
              typeof newData[index]?.[keyItem] === "string" &&
              newData[index][keyItem].length <= 5 &&
              Object.keys(payload).length > 0
            )
              return prevData;
            resetRow(index);
            return newData;
          }
          // Cek kolom unique
          const keysToCheck =
            typeof key === "object" ? Object.keys(payload) : [key];
          for (const colName of keysToCheck) {
            if (
              typeof colName === "string" &&
              columns.find((c) => c.name === colName)?.unique
            ) {
              if (isDuplicateValue(colName, payload[colName])) {
                resetRow(index);
                return newData;
              }
            }
          }

          // Cek duplikat ID di row terakhir
          if (isLastRow && !readOnly) {
            if (
              isDuplicateValue(
                keyItem,
                payload[keyItem] ?? newData[index][keyItem],
              )
            ) {
              return prevData;
            }
          }

          // if (isLastRow && !readOnly) {
          //   const isDuplicate = newData.some((x, idx) => {
          //     if (idx == index) return false;
          //     if (x.id == (payload.id ?? newData[index].id)) return true;
          //     return false;
          //   });
          //   if (isDuplicate) return prevData;
          // }

          newData[index] = {
            ...(defaultValueRow ?? {}),
            ...newData[index],
            [keyItem]: newData[index]?.[keyItem] ?? generateRandom(5),
            ...payload,
          };
          newData[index] = applyMapItem(newData[index], newData, index);

          // Jika mengubah row terakhir, tambahkan row kosong baru
          if (isLastRow && !readOnly) {
            newData.push(withItemKey({ ...(defaultValueRow ?? {}) }));
          }

          return newData;
        };

        _setData((prevData) => {
          const result = update(prevData);
          if (result === prevData) {
            return prevData;
          }
          updateParent(result, result[index]?.[keyItem], { immediate: false });
          return result;
        });
      },
      [
        columns,
        _setData,
        applyMapItem,
        defaultValueRow,
        disabled,
        keyItem,
        readOnly,
        updateParent,
        withItemKey,
      ],
    );
    const insertRow = useCallback(
      (index) => {
        const update = (prev) => {
          const newData = [...prev];
          newData.splice(index, 0, withItemKey({}));
          setCurrentIndex(index);
          if (submitable) setCurrentData(newData[index]);
          return newData;
        };
        _setData((prevData) => {
          const result = update(prevData);
          if (result === prevData) {
            return prevData;
          }
          updateParent(result, result[index]?.[keyItem], { immediate: true });
          return result;
        });
      },
      [
        _setData,
        keyItem,
        setCurrentData,
        setCurrentIndex,
        submitable,
        updateParent,
        withItemKey,
      ],
    );
    const duplicateRow = useCallback(
      (index) => {
        const update = (prev) => {
          const newData = [...prev];
          newData.splice(
            index + 1,
            0,
            withItemKey({
              ...(defaultValueRow ?? {}),
              ...newData[index],
            }),
          );
          setCurrentIndex(index + 1);
          if (submitable) setCurrentData(newData[index + 1]);
          return newData;
        };
        _setData((prevData) => {
          const result = update(prevData);
          if (result === prevData) {
            return prevData;
          }
          updateParent(result, result[index]?.[keyItem], { immediate: true });
          return result;
        });
      },
      [
        _setData,
        defaultValueRow,
        keyItem,
        setCurrentData,
        setCurrentIndex,
        submitable,
        updateParent,
        withItemKey,
      ],
    );
    const deleteRow = useCallback(
      (index) => {
        _setData((prev) => {
          const newData = [...prev];
          if (index === newData.length - 1 && !(readOnly || disabled)) {
            return prev;
          }
          newData.splice(index, 1);
          if (submitable) setCurrentData(newData[currentIndex]);

          updateParent(newData, undefined, { immediate: true });
          return newData;
        });
      },
      [currentIndex, disabled, readOnly, submitable, updateParent],
    );
    const cellOnKeyDown = useCallback(
      (e, currentIndex, currentCol) => {
        const currentData = dataRef.current ?? [];
        if (e.key == "Enter") {
          e.preventDefault();
          const indexCol = columns.findIndex((x) => x.name === currentCol);
          if (indexCol >= columns.length - 1) {
            if (currentIndex >= currentData.length - 1) return;
            currentIndex++;
            currentCol = columns[0].name;
          } else currentCol = columns[indexCol + 1].name;
        } else if (e.ctrlKey) {
          switch (e.key) {
            case "ArrowRight": {
              e.preventDefault();

              const indexCol = columns.findIndex((x) => x.name === currentCol);
              if (indexCol >= columns.length - 1) {
                if (currentIndex >= currentData.length - 1) return;
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

              if (currentIndex >= currentData.length - 1) return;
              currentIndex++;
              break;
            }
            default:
              return;
          }
        }
        const item = currentData[currentIndex];
        getRef(`${item?.[keyItem]}-${currentCol}`)?.current?.focus();
      },
      [columns, getRef, keyItem],
    );
    const handleDragOver = useCallback(
      (event) => {
        const { active, over } = event;
        if (!over || active.id === over.id) {
          return;
        }

        _setData((items) => {
          const newItems = items.map((x) => x[keyItem]);

          let newIndex = newItems.indexOf(over.id);
          const oldIndex = newItems.indexOf(active.id);
          if (oldIndex >= newItems.length - 1) return items;
          if (newIndex >= newItems.length - 1) newIndex--;
          const result = arrayMove(items, oldIndex, newIndex);

          updateParent(result, undefined, { immediate: true });
          return result;
        });
      },
      [_setData, keyItem, updateParent],
    );
    const sortableItems = useMemo(
      () => _data.map((row) => row?.[keyItem]),
      [_data, keyItem],
    );
    const currentRow = _data[currentIndex];
    const currentRowFieldCount = getRowFieldCount(currentRow);
    const isCurrentRowEmpty = currentRowFieldCount <= defaultRowFieldCount;
    const currentAdditionalData = currentRow?.[keyItem]
      ? additionalData?.[currentRow[keyItem]]
      : undefined;
    const getColumn = useCallback(
      (name, attributes) => {
        const col = columns.find((column) => column.name === name);
        if (!col) {
          return null;
        }

        return (
          <FormInput
            key={`${currentRow?.[keyItem]}-${col.name}`}
            required={col.required}
            label={col.titleTrans ? t(col.titleTrans) : col.title}
            name={col.name}
          >
            <Cell
              isDialog
              readOnly={readOnly}
              disabled={disabled}
              index={currentIndex}
              item={currentRow}
              additionalData={currentAdditionalData}
              keyItem={keyItem}
              col={col}
              rowFieldCount={currentRowFieldCount}
              defaultRowFieldCount={defaultRowFieldCount}
              updateData={updateData}
              {...attributes}
            />
          </FormInput>
        );
      },
      [
        columns,
        currentAdditionalData,
        currentIndex,
        currentRow,
        currentRowFieldCount,
        defaultRowFieldCount,
        disabled,
        keyItem,
        readOnly,
        t,
        updateData,
      ],
    );

    const MyDialog = submitable ? AlertDialog : Dialog;
    const MyDialogContent = submitable ? AlertDialogContent : DialogContent;
    const MyDialogHeader = submitable ? AlertDialogHeader : DialogHeader;
    const MyDialogTitle = submitable ? AlertDialogTitle : DialogTitle;
    const MyDialogDescription = submitable
      ? AlertDialogDescription
      : DialogDescription;
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
            className="rounded-md grid grid-cols-[auto_1fr_auto] text-sm  max-w-full w-full overflow-x-auto   *:border-b *:border-muted-foreground/25"
            style={{
              gridTemplateColumns: `auto ${filteredColumns
                .map((x) => `${x.width ?? 1}fr`)
                .join(" ")} auto`,
            }}
          >
            <div
              className="relative grid border-t *:py-2 *:px-2 grid-cols-subgrid col-span-full
            items-center rounded-t-md bg-muted [&>p]:font-semibold [&>p]:text-sm lg:[&>p]:text-sm [&>p]:py-0.5! [&>p:last-child]:border-r [&>p]:border-l [&>p]:border-muted-foreground/25 [&>p]:flex"
            >
              <p className="justify-center! text-center px-4! ">#</p>
              {filteredColumns &&
                filteredColumns.map((item) => {
                  return (
                    <Tooltip key={item.name}>
                      <TooltipTrigger asChild>
                        <p className="relative text-center justify-start! w-full line-clamp-2 wrap-break-word leading-snug">
                          {item.titleTrans ? t(item.titleTrans) : item.title}
                          {item.required && (
                            <span className="ml-1 text-red-500">*</span>
                          )}
                        </p>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          {item.titleTrans ? t(item.titleTrans) : item.title}
                          {item.required && (
                            <span className="ml-1 text-red-500">*</span>
                          )}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              <p className="text-center justify-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-5 pointer-events-auto!"
                  onClick={() => setOpenConfigureColumns(true)}
                >
                  <SettingsIcon className="size-3" />
                </Button>
              </p>
            </div>
            <DndContext
              onDragOver={handleDragOver}
              sensors={sensors}
              collisionDetection={closestCenter}
            >
              <SortableContext
                items={sortableItems}
                strategy={verticalListSortingStrategy}
              >
                {Array.isArray(_data) &&
                  _data.map((item, index) => {
                    return (
                      <FormTableItem
                        disabled={disabled}
                        readOnly={readOnly || item?.readOnly}
                        item={item}
                        index={index}
                        key={item?.[keyItem]}
                        keyItem={keyItem}
                        columns={filteredColumns}
                        isLast={index >= _data.length - 1}
                        setRef={setRef}
                        cellOnKeyDown={cellOnKeyDown}
                        updateData={updateData}
                        submitable={submitable}
                        setCurrentIndex={setCurrentIndex}
                        setCurrentData={setCurrentData}
                        deleteRow={deleteRow}
                        defaultRowFieldCount={defaultRowFieldCount}
                        rowAdditionalData={additionalData?.[item?.[keyItem]]}
                        className={
                          index == _data.length - 1 ? "rounded-b-md" : ""
                        }
                        forceCanDelete={!disabled && forceCanDelete}
                        actions={actions}
                      />
                    );
                  })}
              </SortableContext>
            </DndContext>
          </div>
        </div>
        <MyDialog
          open={currentIndex >= 0}
          onOpenChange={(e) => {
            if (!e && !submitable) setCurrentIndex(-1);
          }}
        >
          <MyDialogContent
            hideX
            className={cn(
              "max-w-full sm:max-w-(--breakpoint-sm) md:w-fit md:min-w-[672px]  md:max-w-3xl lg:max-w-(--breakpoint-lg)",
              classNameDialog,
            )}
            asChild
          >
            <form
              ref={formRef}
              onKeyDown={onKeyDown}
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // updateData(currentIndex, currentData);

                setCurrentIndex(-1);
                setCurrentData(null);
              }}
            >
              <MyDialogHeader>
                <MyDialogTitle asChild>
                  <div className="flex items-center justify-between">
                    <h2>{`${t("core.formtable.editing_row")} #${(currentIndex ?? 0) + 1}`}</h2>

                    <div className="flex flex-row items-center justify-end gap-2">
                      {actions &&
                        actions({
                          row: currentData,
                          index: currentIndex,
                          toggleDialog: () => {
                            setCurrentIndex(-1);
                            setCurrentData(null);
                          },
                        })}
                      {!submitable && (
                        <>
                          {!isCurrentRowEmpty &&
                            !(readOnly || disabled) &&
                            (isMobile ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
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
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="h-8"
                                onClick={() => insertRow(currentIndex - 1)}
                              >
                                {t("core.formtable.insert_above")}
                              </Button>
                            ))}
                          {!isCurrentRowEmpty &&
                            !(readOnly || disabled) &&
                            currentIndex < _data.length - 2 &&
                            (isMobile ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
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
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="h-8"
                                onClick={() => insertRow(currentIndex + 1)}
                              >
                                {t("core.formtable.insert_below")}
                              </Button>
                            ))}
                        </>
                      )}
                      {!isCurrentRowEmpty &&
                        !(
                          readOnly ||
                          disabled ||
                          _data[currentIndex]?.readOnly
                        ) && (
                          <Button
                            type="button"
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
                      {!submitable && (
                        <>
                          {currentIndex > 0 && (
                            <Button
                              type="button"
                              variant="secondary"
                              size="icon"
                              className="h-8 size-8"
                              onClick={() => {
                                setCurrentIndex((prev) => prev - 1);
                                if (submitable)
                                  setCurrentData(_data[currentIndex - 1]);
                              }}
                            >
                              <ArrowUpIcon className="size-4" />
                            </Button>
                          )}
                          {currentIndex < _data.length - 1 && (
                            <Button
                              type="button"
                              variant="secondary"
                              size="icon"
                              className="h-8 size-8"
                              onClick={() => {
                                setCurrentIndex((prev) => prev + 1);
                                if (submitable)
                                  setCurrentData(_data[currentIndex + 1]);
                              }}
                            >
                              <ArrowDownIcon className="size-4" />
                            </Button>
                          )}
                        </>
                      )}
                      {(!isCurrentRowEmpty ||
                        currentIndex < _data.length - 1) &&
                        (!(
                          readOnly ||
                          disabled ||
                          _data[currentIndex]?.readOnly
                        ) ||
                          (!disabled && forceCanDelete)) && (
                          <Button
                            type="button"
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
                </MyDialogTitle>
                <MyDialogDescription className="sr-only" />
              </MyDialogHeader>
              {form ? (
                <FormChildren
                  className={""}
                  showHeader={false}
                  errors={{}}
                  fieldNameTrans={""}
                  data={(submitable ? currentData : currentRow) ?? {}}
                  setData={(...args) =>
                    submitable
                      ? updateDataCurrent(...args)
                      : updateData(currentIndex, ...args)
                  }
                >
                  {typeof form === "function"
                    ? form({ getColumn })
                    : React.cloneElement(form, { getColumn })}
                </FormChildren>
              ) : (
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
                          key={`${currentRow?.[keyItem]}-${col.name}`}
                          required={col.required}
                          label={col.titleTrans ? t(col.titleTrans) : col.title}
                          name={col.name}
                        >
                          <Cell
                            isDialog
                            disabled={disabled}
                            readOnly={readOnly}
                            index={currentIndex}
                            item={currentRow}
                            additionalData={currentAdditionalData}
                            keyItem={keyItem}
                            col={col}
                            isLast={currentIndex >= _data.length - 1}
                            rowFieldCount={currentRowFieldCount}
                            defaultRowFieldCount={defaultRowFieldCount}
                            updateData={updateData}
                          />
                        </FormInput>
                      );
                    })}
                </div>
              )}
              {submitable ? (
                <AlertDialogFooter className="order-2 mt-4">
                  <AlertDialogCancel
                    className="h-8"
                    onClick={() => {
                      setCurrentIndex(-1);
                    }}
                  >
                    {t("core.form.cancel")}
                  </AlertDialogCancel>
                  <AlertDialogAction
                    className="h-8"
                    type="button"
                    onClick={() => {
                      formRef.current?.requestSubmit();
                    }}
                  >
                    {t("core.form.save")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              ) : (
                <DialogFooter className="order-2 mt-4">
                  <Button
                    className="h-8"
                    type="button"
                    onClick={() => {
                      setCurrentIndex(-1);
                    }}
                  >
                    {t("core.form.close_and_apply")}
                  </Button>
                </DialogFooter>
              )}
            </form>
          </MyDialogContent>
        </MyDialog>
        <ConfigureColumns
          columns={columns}
          setColumns={setColumns}
          open={openConfigureColumns}
          setOpen={setOpenConfigureColumns}
          onReset={() => {
            setColumns(createHeaders(key, columnsProps, true));
          }}
        />
      </>
    );
  }),
);

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
            <div className="overflow-x-hidden grid border rounded-lg border-muted-foreground/25 grid-cols-[auto_2fr_minmax(auto,1fr)_auto]  text-sm max-w-full w-full [&>div]:h-fit [&>*:not(:last-child)]:border-b *:border-muted-foreground/25">
              <div className="grid grid-cols-subgrid col-span-full items-center rounded-t-md bg-muted [&>div]:font-semibold [&>div]:text-sm lg:[&>div]:text-sm [&>div]:py-1! *:px-2">
                <div></div>
                <div>{t("core.formtable.column")}</div>
                <div>{t("core.formtable.width")}</div>
              </div>
              <div className="overflow-y-auto overflow-x-hidden grid grid-cols-subgrid col-span-full [&>div>*]:py-1 [&>div>*]:px-2 [&>div>*]:border-muted-foreground/25 [&>div>*]:h-full [&>div>*]:items-center [&>div>*]:flex [&>div]:h-fit [&>*:not(:last-child)]:border-b *:border-muted-foreground/25">
                <SortableContext
                  items={showedColumns.map((x) => x.name)}
                  strategy={verticalListSortingStrategy}
                >
                  {showedColumns.map((col) => {
                    return (
                      <ColumnItem
                        key={col.name + "_showed"}
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
            type="button"
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
                type="button"
                variant="secondary"
                className="h-8"
                onClick={() => onReset()}
              >
                {t("core.formtable.reset_to_default")}
              </Button>
            </DialogClose>
            <DialogClose asChild>
              <Button
                className="h-8"
                onClick={() => setColumnsProps(columns)}
                type="button"
              >
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
                  classNameCheckbox="pointer-events-auto!"
                  disabled={col.required || col.locked}
                  checked={col.required || col.locked || col.show}
                  onCheckedChange={(val) => {
                    setColumns((x) => {
                      return x.map((y) => {
                        if (y.required || col.locked) return y;
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
            <Button
              className="h-8"
              onClick={() => setColumnsProps(columns)}
              type="button"
            >
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
      <button
        className="cursor-move "
        {...listeners}
        {...attributes}
        type="button"
      >
        <GripVerticalIcon className="transition-[color,opacity] group-hover:text-foreground text-muted-foreground/50 size-5" />
      </button>
      <div>
        {column.titleTrans ? t(column.titleTrans) : column.title}
        {column.required && <span className="ml-1 text-red-500">*</span>}
      </div>
      <div>
        <CurrencyInput
          className="text-left"
          min="1"
          max="10"
          step="1"
          value={column.width ?? 1}
          onValueChange={(val) => {
            onChangeWidth(column.name, val);
          }}
        />
      </div>
      <div className="w-10">
        {!(column.required || column.locked) && (
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
