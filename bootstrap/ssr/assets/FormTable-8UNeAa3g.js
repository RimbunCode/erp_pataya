import { jsxs, Fragment, jsx } from "react/jsx-runtime";
import { A as AlertDialog, a as AlertDialogContent, b as AlertDialogHeader, c as AlertDialogTitle, d as AlertDialogDescription, e as AlertDialogFooter, f as AlertDialogCancel, g as AlertDialogAction } from "./MasterLayout-CRsmljQs.js";
import { SettingsIcon, CopyIcon, ArrowUpIcon, ArrowDownIcon, Trash2Icon, GripVerticalIcon, PencilIcon } from "lucide-react";
import { D as Dialog, f as DialogContent, g as DialogHeader, h as DialogTitle, i as DialogDescription, j as DialogFooter, m as DialogClose } from "./command-BSnyCa9u.js";
import { useSensors, useSensor, MouseSensor, TouchSensor, DndContext, closestCenter } from "@dnd-kit/core";
import React__default, { memo, forwardRef, useState, useRef, useMemo, useEffect, useImperativeHandle, useCallback } from "react";
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { T as Tooltip, a as TooltipTrigger, b as TooltipContent } from "./tooltip-Df8khweJ.js";
import { k as generateRandom, c as cn, s as saveToLocalStorage, b as getFromLocalStorage } from "./utils-ClCZGsDL.js";
import { B as Button } from "./button-Us2TB7GG.js";
import { CSS } from "@dnd-kit/utilities";
import { C as CurrencyInput } from "./CurrencyInput-DtXsGVaN.js";
import { j as FormChildren, a as FormInput, F as FormCheckbox } from "./checkbox-C_BEU5E4.js";
import { I as Input } from "./input-wk3Ou7wI.js";
import { L as Label } from "./label-DiFvdPYz.js";
import { isEqual } from "lodash";
import { b as useDidMountEffect } from "./Link-p0Z4AKax.js";
import { u as useDynamicRefs } from "./useDynamicRefs-DuDlSZ7v.js";
import { u as useIsMobile } from "./use-mobile-BsFue-bT.js";
import { useLaravelReactI18n } from "laravel-react-i18n";
const FORMTABLE_COLUMNS_KEY = "formtable-columns";
const Wrapper = memo(({ children, isDialog }) => {
  if (isDialog) return /* @__PURE__ */ jsx(Fragment, { children });
  else
    return /* @__PURE__ */ jsx("div", { className: "focus-within:border-0 focus-within:ring-offset-background focus-within:outline-none focus-within:ring-1 focus-within:ring-ring focus-within:ring-offset-1 h-full focus-visible:ring-offset-1 m-0.5", children });
});
Wrapper.displayName = "Wrapper";
const Cell = memo(
  forwardRef(
    ({
      index,
      item,
      col,
      isLast,
      updateData,
      readOnly,
      disabled,
      className,
      onOpenDialog,
      defaultValueRow,
      isDialog,
      additionalData,
      ...props
    }, ref) => {
      var _a;
      if (!item) return;
      const attributes = {
        ...props,
        ...col.props,
        readOnly: readOnly || disabled || col.readOnly || false,
        required: (Object.keys(item ?? {}).length > Object.keys(defaultValueRow ?? {}).length + 1 || !isLast) && col.required,
        name: col.name,
        className: cn(!isDialog && "h-full", className, (_a = col.props) == null ? void 0 : _a.className),
        ref
      };
      if (col.cell) {
        return col.cell(
          {
            dataRow: item,
            data: item[col.name],
            setData: (key, value) => updateData(index, key, value),
            additionalData: additionalData == null ? void 0 : additionalData[item.id],
            attributes,
            openDialog: onOpenDialog ?? (() => {
            }),
            reset: () => {
              updateData(index, {});
            },
            isEmpty: Object.keys(item).length <= Object.keys(defaultValueRow ?? {}).length + 1
          },
          index
        );
      }
      switch (col.type) {
        default:
          return isDialog ? /* @__PURE__ */ jsx(
            Input,
            {
              type: col.type ?? "text",
              value: col.name ? item[col.name] ?? "" : "",
              onChange: (e) => {
                updateData(
                  index,
                  col.name,
                  col.type == "number" ? +e.target.value : e.target.value
                );
              },
              ...attributes,
              className: cn(
                attributes.className,
                !isDialog && "m-0 bg-transparent! border-0! h-full focus-visible:ring-0! focus-visible:ring-offset-0!"
              )
            }
          ) : /* @__PURE__ */ jsx("div", { className: "w-full focus-within:border-0 focus-within:ring-offset-background focus-within:outline-none focus-within:ring-1 focus-within:ring-ring focus-within:ring-offset-0 h-full focus-visible:ring-offset-1 m-0.5", children: /* @__PURE__ */ jsx(
            Input,
            {
              type: col.type ?? "text",
              value: col.name ? item[col.name] ?? "" : "",
              onChange: (e) => {
                updateData(
                  index,
                  col.name,
                  col.type == "number" ? +e.target.value : e.target.value
                );
              },
              ...attributes,
              className: cn(
                attributes.className,
                !isDialog && "m-0 bg-transparent! border-0! h-full focus-visible:ring-0! focus-visible:ring-offset-0!"
              )
            }
          ) });
      }
    }
  )
);
const FormTableItem = memo(function FormTableItem2({
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
  defaultValueRow,
  forceCanDelete,
  additionalData
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };
  return /* @__PURE__ */ jsxs(
    "div",
    {
      ref: setNodeRef,
      style,
      className: cn(
        "grid group min-h-10 col-span-full items-center grid-cols-subgrid border-muted-foreground/25 [&>*:last-child]:border-r [&>*]:border-l [&>*]:border-muted-foreground/25 [&>*]:h-full [&>*]:items-center [&>*]:flex [&>*]:justify-center",
        className
      ),
      children: [
        /* @__PURE__ */ jsxs("div", { className: "px-1 justify-center! text-left ", children: [
          /* @__PURE__ */ jsx(
            "span",
            {
              className: cn(
                !(Object.keys(item).length <= Object.keys(defaultValueRow ?? {}).length + 1 && isLast) && !(readOnly || disabled) && "group-hover:hidden"
              ),
              children: index + 1
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              className: cn(
                "hidden cursor-move group-hover:inline ",
                (Object.keys(item).length <= Object.keys(defaultValueRow ?? {}).length + 1 && isLast || readOnly || disabled) && "hidden!"
              ),
              type: "button",
              ...listeners,
              ...attributes,
              children: /* @__PURE__ */ jsx(GripVerticalIcon, { className: "size-5" })
            }
          )
        ] }),
        columns && columns.map((col) => {
          return /* @__PURE__ */ jsx("div", { className: "has-[.custom-cell]:block!", children: /* @__PURE__ */ jsx(
            Cell,
            {
              onOpenDialog: () => {
                setCurrentIndex(index);
                if (submitable) setCurrentData(item);
              },
              ref: setRef(`${item.id}-${col.name}`),
              disabled,
              readOnly,
              index,
              item,
              additionalData,
              col,
              isLast,
              defaultValueRow,
              onKeyDown: (e) => cellOnKeyDown(e, index, col.name),
              updateData,
              className: "rounded-none border-0 focus-visible:ring-offset-1 bg-background m-0.5"
            }
          ) }, col.name);
        }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center px-1 gap-x-1", children: [
          /* @__PURE__ */ jsx(
            Button,
            {
              type: "button",
              variant: "ghost",
              size: "icon",
              className: "size-6 pointer-events-auto!",
              onClick: () => {
                setCurrentIndex(index);
                if (submitable) setCurrentData(item);
              },
              children: /* @__PURE__ */ jsx(PencilIcon, { className: "size-3" })
            }
          ),
          (!(readOnly || disabled) || forceCanDelete) && /* @__PURE__ */ jsx(
            Button,
            {
              type: "button",
              variant: "ghost",
              size: "icon",
              className: cn(
                "size-6",
                Object.keys(item).length <= Object.keys(defaultValueRow ?? {}).length + 1 && isLast && "hidden"
              ),
              onClick: () => deleteRow(index),
              children: /* @__PURE__ */ jsx(Trash2Icon, { className: "size-3 text-destructive" })
            }
          )
        ] })
      ]
    },
    item.id
  );
});
const createHeaders = (headers, reset) => {
  const columnsMap = new Map(
    headers.filter((col) => col).map((col) => [
      col.name,
      {
        ...col,
        show: col.required || (col.show ?? false)
      }
    ])
  );
  if (reset) return Array.from(columnsMap.values());
  let finalColumns = [];
  const columnsFromCookie = getFromLocalStorage(FORMTABLE_COLUMNS_KEY);
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
const FormTable = memo(
  forwardRef(function FormTable2({
    name,
    label,
    disabled = false,
    description,
    ignoreDisabled = false,
    readOnly = false,
    className,
    columns: columnsProps,
    value,
    onValueChange,
    defaultValueRow,
    form,
    submitable = false,
    mapItem,
    forceCanDelete = false,
    additionalData: _additionalData,
    asyncUpdateAdditionalData
  }, ref) {
    var _a, _b;
    if (!columnsProps) {
      throw new Error("columns is required");
    }
    const [__additionalData, setAdditionalData] = useState({});
    const additionalData = _additionalData ?? __additionalData;
    const [openConfigureColumns, setOpenConfigureColumns] = useState(false);
    const [columns, setColumns] = useState(createHeaders(columnsProps));
    const { t } = useLaravelReactI18n();
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [currentData, setCurrentData] = useState(null);
    const [getRef, setRef] = useDynamicRefs();
    const isMobile = useIsMobile();
    const prevValueRef = useRef(value);
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
      setColumns(createHeaders(columnsProps));
    }, [columnsProps]);
    useDidMountEffect(() => {
      saveToLocalStorage(
        FORMTABLE_COLUMNS_KEY + (name ? `_${name}` : ""),
        columns.map((x) => ({ name: x.name, show: x.show, width: x.width }))
      );
    }, [columns]);
    if (value && !Array.isArray(value)) {
      throw new Error("value must be an array");
    }
    value = value ?? [];
    if (!Array.isArray(columns)) {
      throw new Error("columns must be an array");
    }
    const filteredColumns = useMemo(
      () => columns.filter((x) => x.required || (x.show ?? true)),
      [columns]
    );
    const [_data, _setData] = useState(() => {
      return readOnly || disabled && value.length > 0 ? value : [
        ...value.map((x) => ({
          ...defaultValueRow ?? {},
          ...x,
          id: x.id ?? generateRandom(5)
        })),
        { id: generateRandom(5), ...defaultValueRow ?? {} }
        // Row kosong selalu ada di akhir
      ];
    });
    const idChanges = useRef(new Set(value.map((x) => x.id)));
    useEffect(() => {
      const debounce = setTimeout(async () => {
        var _a2, _b2, _c;
        if (((_a2 = idChanges.current) == null ? void 0 : _a2.size) === 0) return;
        try {
          const result = await asyncUpdateAdditionalData(
            value,
            Array.from(((_b2 = idChanges.current) == null ? void 0 : _b2.values()) ?? []).filter(Boolean)
          );
          const data = (result == null ? void 0 : result.data) ?? {};
          for (const id in data ?? {}) {
            (_c = idChanges.current) == null ? void 0 : _c.delete(id);
          }
          setAdditionalData((prev) => ({ ...prev, ...data }));
        } catch {
        }
      }, 200);
      return () => clearTimeout(debounce);
    }, [_data]);
    useImperativeHandle(
      ref,
      () => ({
        resetColumns: () => {
          setColumns(createHeaders(columnsProps));
        },
        openConfigureColumns: () => {
          setOpenConfigureColumns(true);
        },
        closeConfigureColumns: () => {
          setOpenConfigureColumns(false);
        }
      }),
      [columnsProps, mapItem, _data]
    );
    const getColumn = (name2, attributes) => {
      var _a2;
      const col = columns.find((x) => x.name === name2);
      if (!col) return null;
      return /* @__PURE__ */ jsx(
        FormInput,
        {
          required: col.required,
          label: col.titleTrans ? t(col.titleTrans) : col.title,
          name: col.name,
          children: /* @__PURE__ */ jsx(
            Cell,
            {
              isDialog: true,
              defaultValueRow,
              readOnly,
              disabled,
              index: currentIndex,
              item: _data[currentIndex],
              additionalData,
              col,
              updateData,
              ...attributes
            }
          )
        },
        `${(_a2 = _data[currentIndex]) == null ? void 0 : _a2.id}-${col.name}`
      );
    };
    const formRef = useRef();
    const onKeyDown = useCallback(
      (e) => {
        e.stopPropagation();
        if (e.ctrlKey && e.key == "s") {
          e.preventDefault();
          const form2 = formRef.current;
          if (form2) {
            form2.requestSubmit();
          }
        }
      },
      [formRef]
    );
    useEffect(() => {
      if (value != prevValueRef.current && !isEqual(value, prevValueRef.current)) {
        prevValueRef.current = value;
        idChanges.current = new Set(value.map((x) => x.id));
        if (readOnly || disabled && value.length > 0) {
          _setData([...value]);
          return;
        }
        _setData((prev) => {
          return [
            ...value.map((x, index) => {
              const data = {
                ...defaultValueRow ?? {},
                ...x,
                id: x.id ?? generateRandom(5)
              };
              if (mapItem)
                return mapItem({ item: data, dataTable: prev, index });
              return data;
            }),
            { ...defaultValueRow ?? {}, id: generateRandom(5) }
            // Pastikan ada row kosong
          ];
        });
      }
    }, [value, readOnly, disabled, mapItem]);
    const updateParent = useCallback(
      (data, key) => {
        var _a2;
        if (onValueChange) {
          let filteredData = readOnly || disabled ? data : data.slice(0, -1);
          if (!isEqual(filteredData, prevValueRef.current)) {
            prevValueRef.current = filteredData;
            if (key) (_a2 = idChanges.current) == null ? void 0 : _a2.add(key);
            onValueChange(filteredData, key);
          }
        }
      },
      [onValueChange]
    );
    const updateDataCurrent = useCallback(
      (key, newValue) => {
        setCurrentData((prevData) => {
          const payload = typeof key === "string" || typeof key === "number" ? { [key]: newValue } : key;
          return {
            ...prevData,
            id: (prevData == null ? void 0 : prevData.id) ?? generateRandom(5),
            ...payload
          };
        });
      },
      [setCurrentData]
    );
    const updateData = useCallback(
      (index, key, newValue) => {
        const update = (prevData) => {
          var _a2, _b2;
          const isLastRow = index === prevData.length - 1;
          if (disabled && prevData.length > 0 || !readOnly && index === prevData.length - 1 && key == null)
            return prevData;
          let newData = [...prevData];
          if (!newData[index]) return prevData;
          const payload = typeof key === "string" || typeof key === "number" ? { [key]: newValue } : key ?? {};
          const resetRow = (idx) => {
            newData[idx] = {
              ...defaultValueRow ?? {},
              id: generateRandom(5)
            };
            if (mapItem)
              newData[idx] = mapItem({
                item: newData[idx],
                dataTable: newData,
                index: idx
              });
          };
          const isDuplicateValue = (colName, value2) => {
            const isDuplicate = newData.some((row, idx) => {
              var _a3;
              if (idx == index) return false;
              if (row[value2] == value2 || isEqual(row[value2], value2))
                return true;
              if (typeof row[value2] === "object" && typeof value2 === "object" && ((_a3 = row[value2]) == null ? void 0 : _a3.id) == (value2 == null ? void 0 : value2.id))
                return true;
              return false;
            });
            return isDuplicate;
          };
          if (payload == null || payload == void 0 || Object.keys(payload).length <= 0) {
            if (newData[index].id.length <= 5 && Object.keys(payload).length > 0)
              return prevData;
            resetRow(index);
            return newData;
          }
          const keysToCheck = typeof key === "object" ? Object.keys(payload) : [key];
          for (const colName of keysToCheck) {
            if (typeof colName === "string" && ((_a2 = columns.find((c) => c.name === colName)) == null ? void 0 : _a2.unique)) {
              if (isDuplicateValue(colName, payload[colName])) {
                resetRow(index);
                return newData;
              }
            }
          }
          if (isLastRow && !readOnly) {
            if (isDuplicateValue("id", payload.id ?? newData[index].id)) {
              return prevData;
            }
          }
          newData[index] = {
            ...defaultValueRow ?? {},
            ...newData[index],
            id: ((_b2 = newData[index]) == null ? void 0 : _b2.id) ?? generateRandom(5),
            ...payload
          };
          if (mapItem)
            newData[index] = mapItem({
              item: newData[index],
              dataTable: newData,
              index
            });
          if (isLastRow && !readOnly) {
            newData.push({ ...defaultValueRow ?? {}, id: generateRandom(5) });
          }
          return newData;
        };
        _setData((prevData) => {
          var _a2;
          const result = update(prevData);
          updateParent(result, (_a2 = result[index]) == null ? void 0 : _a2.id);
          return result;
        });
      },
      [columns, _setData, mapItem]
    );
    const insertRow = useCallback(
      (index) => {
        const update = (prev) => {
          const newData = [...prev];
          newData.splice(index, 0, { id: generateRandom(5) });
          setCurrentIndex(index);
          if (submitable) setCurrentData(newData[index]);
          return newData;
        };
        _setData((prevData) => {
          var _a2;
          const result = update(prevData);
          updateParent(result, (_a2 = result[index]) == null ? void 0 : _a2.id);
          return result;
        });
      },
      [_setData]
    );
    const duplicateRow = useCallback(
      (index) => {
        const update = (prev) => {
          const newData = [...prev];
          newData.splice(index + 1, 0, {
            ...defaultValueRow ?? {},
            ...newData[index],
            id: generateRandom(5)
          });
          setCurrentIndex(index + 1);
          if (submitable) setCurrentData(newData[index + 1]);
          return newData;
        };
        _setData((prevData) => {
          var _a2;
          const result = update(prevData);
          updateParent(result, (_a2 = result[index]) == null ? void 0 : _a2.id);
          return result;
        });
      },
      [_setData]
    );
    const deleteRow = useCallback(
      (index) => {
        _setData((prev) => {
          const newData = [...prev];
          if (index === newData.length - 1 && !(readOnly || disabled)) {
            return newData;
          }
          newData.splice(index, 1);
          if (submitable) setCurrentData(newData[currentIndex]);
          updateParent(newData);
          return newData;
        });
      },
      [readOnly, disabled]
    );
    const cellOnKeyDown = useCallback(
      (e, currentIndex2, currentCol) => {
        var _a2, _b2;
        if (e.key == "Enter") {
          e.preventDefault();
          const indexCol = columns.findIndex((x) => x.name === currentCol);
          if (indexCol >= columns.length - 1) {
            if (currentIndex2 >= _data.length - 1) return;
            currentIndex2++;
            currentCol = columns[0].name;
          } else currentCol = columns[indexCol + 1].name;
        } else if (e.ctrlKey) {
          switch (e.key) {
            case "ArrowRight": {
              e.preventDefault();
              const indexCol = columns.findIndex((x) => x.name === currentCol);
              if (indexCol >= columns.length - 1) {
                if (currentIndex2 >= _data.length - 1) return;
                currentIndex2++;
                currentCol = columns[0].name;
              } else currentCol = columns[indexCol + 1].name;
              break;
            }
            case "ArrowLeft": {
              e.preventDefault();
              const indexCol = columns.findIndex((x) => x.name === currentCol);
              if (indexCol <= 0) {
                if (currentIndex2 <= 0) return;
                currentIndex2--;
                currentCol = columns[columns.length - 1].name;
              } else currentCol = columns[indexCol - 1].name;
              break;
            }
            case "ArrowUp": {
              e.preventDefault();
              if (currentIndex2 <= 0) return;
              currentIndex2--;
              break;
            }
            case "ArrowDown": {
              e.preventDefault();
              if (currentIndex2 >= _data.length - 1) return;
              currentIndex2++;
              break;
            }
            default:
              return;
          }
        }
        const item = _data[currentIndex2];
        (_b2 = (_a2 = getRef(`${item.id}-${currentCol}`)) == null ? void 0 : _a2.current) == null ? void 0 : _b2.focus();
      },
      [_data, columns]
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
            const result = arrayMove(items, oldIndex, newIndex);
            updateParent(result);
            return result;
          });
        }
      },
      [_setData]
    );
    const MyDialog = submitable ? AlertDialog : Dialog;
    const MyDialogContent = submitable ? AlertDialogContent : DialogContent;
    const MyDialogHeader = submitable ? AlertDialogHeader : DialogHeader;
    const MyDialogTitle = submitable ? AlertDialogTitle : DialogTitle;
    const MyDialogDescription = submitable ? AlertDialogDescription : DialogDescription;
    return /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs(
        "div",
        {
          className: cn("flex flex-col gap-y-2 w-full", className),
          role: !ignoreDisabled ? "forminput" : "",
          children: [
            /* @__PURE__ */ jsx(Label, { children: label }),
            description && (typeof description == "string" ? /* @__PURE__ */ jsx("p", { className: "text-sm font-normal text-muted-foreground", children: description }) : description),
            /* @__PURE__ */ jsxs(
              "div",
              {
                className: "rounded-md grid grid-cols-[auto_1fr_auto] text-sm  max-w-full w-full overflow-x-auto   *:border-b *:border-muted-foreground/25",
                style: {
                  gridTemplateColumns: `auto ${filteredColumns.map((x) => `${x.width ?? 1}fr`).join(" ")} auto`
                },
                children: [
                  /* @__PURE__ */ jsxs(
                    "div",
                    {
                      className: "relative grid border-t *:py-2 *:px-2 grid-cols-subgrid col-span-full\n            items-center rounded-t-md bg-muted [&>p]:font-semibold [&>p]:text-sm lg:[&>p]:text-sm [&>p]:py-0.5! [&>p:last-child]:border-r [&>p]:border-l [&>p]:border-muted-foreground/25 [&>p]:flex",
                      children: [
                        /* @__PURE__ */ jsx("p", { className: "justify-center! text-center px-4! ", children: "#" }),
                        filteredColumns && filteredColumns.map((item) => {
                          return /* @__PURE__ */ jsxs(Tooltip, { children: [
                            /* @__PURE__ */ jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxs("p", { className: "relative text-center justify-start! w-full line-clamp-2 break-words leading-snug", children: [
                              item.titleTrans ? t(item.titleTrans) : item.title,
                              item.required && /* @__PURE__ */ jsx("span", { className: "ml-1 text-red-500", children: "*" })
                            ] }) }),
                            /* @__PURE__ */ jsx(TooltipContent, { children: /* @__PURE__ */ jsxs("p", { children: [
                              item.titleTrans ? t(item.titleTrans) : item.title,
                              item.required && /* @__PURE__ */ jsx("span", { className: "ml-1 text-red-500", children: "*" })
                            ] }) })
                          ] }, item.name);
                        }),
                        /* @__PURE__ */ jsx("p", { className: "text-center", children: /* @__PURE__ */ jsx(
                          Button,
                          {
                            type: "button",
                            variant: "ghost",
                            size: "icon",
                            className: "size-5 pointer-events-auto!",
                            onClick: () => setOpenConfigureColumns(true),
                            children: /* @__PURE__ */ jsx(SettingsIcon, { className: "size-3" })
                          }
                        ) })
                      ]
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    DndContext,
                    {
                      onDragOver: handleDragOver,
                      sensors,
                      collisionDetection: closestCenter,
                      children: /* @__PURE__ */ jsx(
                        SortableContext,
                        {
                          items: _data.map((x) => x.id),
                          strategy: verticalListSortingStrategy,
                          children: Array.isArray(_data) && _data.map((item, index) => {
                            return /* @__PURE__ */ jsx(
                              FormTableItem,
                              {
                                disabled,
                                readOnly: readOnly || item.readOnly,
                                item,
                                index,
                                columns: filteredColumns,
                                isLast: index >= _data.length - 1,
                                setRef,
                                cellOnKeyDown,
                                updateData,
                                submitable,
                                setCurrentIndex,
                                setCurrentData,
                                deleteRow,
                                defaultValueRow,
                                additionalData,
                                className: index == _data.length - 1 ? "rounded-b-md" : "",
                                forceCanDelete: !disabled && forceCanDelete
                              },
                              item.id
                            );
                          })
                        }
                      )
                    }
                  )
                ]
              }
            )
          ]
        }
      ),
      /* @__PURE__ */ jsx(
        MyDialog,
        {
          open: currentIndex >= 0,
          onOpenChange: (e) => {
            if (!e && !submitable) setCurrentIndex(-1);
          },
          children: /* @__PURE__ */ jsx(
            MyDialogContent,
            {
              hideX: true,
              className: "max-w-full sm:max-w-(--breakpoint-sm) md:w-fit md:min-w-[672px]  md:max-w-3xl lg:max-w-(--breakpoint-lg)",
              asChild: true,
              children: /* @__PURE__ */ jsxs(
                "form",
                {
                  ref: formRef,
                  onKeyDown,
                  onSubmit: (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setCurrentIndex(-1);
                    setCurrentData(null);
                  },
                  children: [
                    /* @__PURE__ */ jsxs(MyDialogHeader, { children: [
                      /* @__PURE__ */ jsx(MyDialogTitle, { asChild: true, children: /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
                        /* @__PURE__ */ jsx("h2", { children: `${t("core.formtable.editing_row")} #${(currentIndex ?? 0) + 1}` }),
                        /* @__PURE__ */ jsxs("div", { className: "flex flex-row items-center justify-end gap-2", children: [
                          !submitable && /* @__PURE__ */ jsxs(Fragment, { children: [
                            Object.keys(_data[currentIndex] ?? {}).length > Object.keys(defaultValueRow ?? {}).length + 1 && !(readOnly || disabled) && (isMobile ? /* @__PURE__ */ jsxs(Tooltip, { children: [
                              /* @__PURE__ */ jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsx(
                                Button,
                                {
                                  type: "button",
                                  variant: "secondary",
                                  size: "sm",
                                  className: "size-8",
                                  onClick: () => insertRow(currentIndex - 1),
                                  children: /* @__PURE__ */ jsx(
                                    "svg",
                                    {
                                      xmlns: "http://www.w3.org/2000/svg",
                                      viewBox: "0 0 2048 2048",
                                      children: /* @__PURE__ */ jsx(
                                        "path",
                                        {
                                          fill: "currentColor",
                                          d: "M2048 128v1664H0V128h512L384 256H128v384h640v512h384V640h768V256h-384l-128-128zM640 1280H128v384h512zm640 0H768v384h512zm640 0h-512v384h512zM621 525l-90-90L960 6l429 429l-90 90l-275-275v774H896V250z"
                                        }
                                      )
                                    }
                                  )
                                }
                              ) }),
                              /* @__PURE__ */ jsx(TooltipContent, { children: t("core.formtable.insert_above") })
                            ] }) : /* @__PURE__ */ jsx(
                              Button,
                              {
                                type: "button",
                                variant: "secondary",
                                size: "sm",
                                className: "h-8",
                                onClick: () => insertRow(currentIndex - 1),
                                children: t("core.formtable.insert_above")
                              }
                            )),
                            Object.keys(_data[currentIndex] ?? {}).length > Object.keys(defaultValueRow ?? {}).length + 1 && !(readOnly || disabled) && currentIndex < _data.length - 2 && (isMobile ? /* @__PURE__ */ jsxs(Tooltip, { children: [
                              /* @__PURE__ */ jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsx(
                                Button,
                                {
                                  type: "button",
                                  variant: "secondary",
                                  size: "sm",
                                  className: "size-8",
                                  onClick: () => insertRow(currentIndex + 1),
                                  children: /* @__PURE__ */ jsx(
                                    "svg",
                                    {
                                      xmlns: "http://www.w3.org/2000/svg",
                                      viewBox: "0 0 2048 2048",
                                      children: /* @__PURE__ */ jsx(
                                        "path",
                                        {
                                          fill: "currentColor",
                                          d: "M2048 128v1664h-640l128-128h384v-384h-768V768H768v512H128v384h256l128 128H0V128zM640 256H128v384h512zm640 0H768v384h512zm640 0h-512v384h512zm-621 1139l90 90l-429 429l-429-429l90-90l275 275V896h128v774z"
                                        }
                                      )
                                    }
                                  )
                                }
                              ) }),
                              /* @__PURE__ */ jsx(TooltipContent, { children: t("core.formtable.insert_below") })
                            ] }) : /* @__PURE__ */ jsx(
                              Button,
                              {
                                type: "button",
                                variant: "secondary",
                                size: "sm",
                                className: "h-8",
                                onClick: () => insertRow(currentIndex + 1),
                                children: t("core.formtable.insert_below")
                              }
                            ))
                          ] }),
                          Object.keys(_data[currentIndex] ?? {}).length > Object.keys(defaultValueRow ?? {}).length + 1 && !(readOnly || disabled || ((_a = _data[currentIndex]) == null ? void 0 : _a.readOnly)) && /* @__PURE__ */ jsxs(
                            Button,
                            {
                              type: "button",
                              variant: "secondary",
                              size: "sm",
                              className: "w-8 h-8 sm:w-auto",
                              onClick: () => duplicateRow(currentIndex),
                              children: [
                                /* @__PURE__ */ jsx(CopyIcon, { className: "size-4" }),
                                /* @__PURE__ */ jsx("span", { className: "hidden lg:inline", children: t("core.formtable.duplicate") })
                              ]
                            }
                          ),
                          !submitable && /* @__PURE__ */ jsxs(Fragment, { children: [
                            currentIndex > 0 && /* @__PURE__ */ jsx(
                              Button,
                              {
                                type: "button",
                                variant: "secondary",
                                size: "icon",
                                className: "h-8 size-8",
                                onClick: () => {
                                  setCurrentIndex((prev) => prev - 1);
                                  if (submitable)
                                    setCurrentData(_data[currentIndex - 1]);
                                },
                                children: /* @__PURE__ */ jsx(ArrowUpIcon, { className: "size-4" })
                              }
                            ),
                            currentIndex < _data.length - 1 && /* @__PURE__ */ jsx(
                              Button,
                              {
                                type: "button",
                                variant: "secondary",
                                size: "icon",
                                className: "h-8 size-8",
                                onClick: () => {
                                  setCurrentIndex((prev) => prev + 1);
                                  if (submitable)
                                    setCurrentData(_data[currentIndex + 1]);
                                },
                                children: /* @__PURE__ */ jsx(ArrowDownIcon, { className: "size-4" })
                              }
                            )
                          ] }),
                          (Object.keys(_data[currentIndex] ?? {}).length > Object.keys(defaultValueRow ?? {}).length + 1 || currentIndex < _data.length - 1) && (!(readOnly || disabled || ((_b = _data[currentIndex]) == null ? void 0 : _b.readOnly)) || !disabled && forceCanDelete) && /* @__PURE__ */ jsx(
                            Button,
                            {
                              type: "button",
                              variant: "destructive",
                              size: "icon",
                              className: "h-8 size-8",
                              onClick: () => deleteRow(currentIndex),
                              children: /* @__PURE__ */ jsx(Trash2Icon, { className: "size-4" })
                            }
                          )
                        ] })
                      ] }) }),
                      /* @__PURE__ */ jsx(MyDialogDescription, { className: "sr-only" })
                    ] }),
                    form ? /* @__PURE__ */ jsx(
                      FormChildren,
                      {
                        className: "",
                        showHeader: false,
                        errors: {},
                        fieldNameTrans: "",
                        data: (submitable ? currentData : _data[currentIndex]) ?? {},
                        setData: (...args) => submitable ? updateDataCurrent(...args) : updateData(currentIndex, ...args),
                        children: typeof form === "function" ? form({ getColumn }) : React__default.cloneElement(form, { getColumn })
                      }
                    ) : /* @__PURE__ */ jsx(
                      "div",
                      {
                        className: cn(
                          columns.length <= 1 ? "grid-cols-1" : columns.length <= 2 ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3",
                          "grid gap-x-4 gap-y-3"
                        ),
                        children: columns && columns.map((col) => {
                          var _a2;
                          return /* @__PURE__ */ jsx(
                            FormInput,
                            {
                              required: col.required,
                              label: col.titleTrans ? t(col.titleTrans) : col.title,
                              name: col.name,
                              children: /* @__PURE__ */ jsx(
                                Cell,
                                {
                                  isDialog: true,
                                  disabled,
                                  readOnly,
                                  index: currentIndex,
                                  item: _data[currentIndex],
                                  additionalData,
                                  col,
                                  isLast: currentIndex >= _data.length - 1,
                                  defaultValueRow,
                                  updateData
                                }
                              )
                            },
                            `${(_a2 = _data[currentIndex]) == null ? void 0 : _a2.id}-${col.name}`
                          );
                        })
                      }
                    ),
                    submitable && /* @__PURE__ */ jsxs(AlertDialogFooter, { className: "order-2 mt-4", children: [
                      /* @__PURE__ */ jsx(
                        AlertDialogCancel,
                        {
                          className: "h-8",
                          onClick: () => {
                            setCurrentIndex(-1);
                          },
                          children: t("core.form.cancel")
                        }
                      ),
                      /* @__PURE__ */ jsx(
                        AlertDialogAction,
                        {
                          className: "h-8",
                          type: "button",
                          onClick: () => {
                            var _a2;
                            (_a2 = formRef.current) == null ? void 0 : _a2.requestSubmit();
                          },
                          children: t("core.form.save")
                        }
                      )
                    ] })
                  ]
                }
              )
            }
          )
        }
      ),
      /* @__PURE__ */ jsx(
        ConfigureColumns,
        {
          columns,
          setColumns,
          open: openConfigureColumns,
          setOpen: setOpenConfigureColumns,
          onReset: () => {
            setColumns(createHeaders(columnsProps, true));
          }
        }
      )
    ] });
  })
);
const ConfigureColumns = memo(function ConfigureColumns2({
  columns: columnsProps,
  setColumns: setColumnsProps,
  open,
  setOpen,
  onReset
}) {
  const [columns, setColumns] = useState([]);
  const [openSelectColumn, setOpenSelectColumn] = useState(false);
  const { t } = useLaravelReactI18n();
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
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(Dialog, { open, onOpenChange: setOpen, children: /* @__PURE__ */ jsxs(DialogContent, { className: "max-w-lg", children: [
      /* @__PURE__ */ jsxs(DialogHeader, { className: "pb-2 border-b border-muted-foreground/25", children: [
        /* @__PURE__ */ jsx(DialogTitle, { children: t("core.formtable.configure_columns") }),
        /* @__PURE__ */ jsx(DialogDescription, { className: "sr-only" })
      ] }),
      /* @__PURE__ */ jsx(
        DndContext,
        {
          onDragOver: handleDragOver,
          sensors,
          collisionDetection: closestCenter,
          children: /* @__PURE__ */ jsxs("div", { className: "overflow-x-hidden grid border rounded-lg border-muted-foreground/25 grid-cols-[auto_2fr_minmax(auto,1fr)_auto]  text-sm max-w-full w-full [&>div]:h-fit [&>*:not(:last-child)]:border-b *:border-muted-foreground/25", children: [
            /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-subgrid col-span-full items-center rounded-t-md bg-muted [&>div]:font-semibold [&>div]:text-sm lg:[&>div]:text-sm [&>div]:py-1! *:px-2", children: [
              /* @__PURE__ */ jsx("div", {}),
              /* @__PURE__ */ jsx("div", { children: t("core.formtable.column") }),
              /* @__PURE__ */ jsx("div", { children: t("core.formtable.width") })
            ] }),
            /* @__PURE__ */ jsx("div", { className: "overflow-y-auto overflow-x-hidden grid grid-cols-subgrid col-span-full [&>div>*]:py-1 [&>div>*]:px-2 [&>div>*]:border-muted-foreground/25 [&>div>*]:h-full [&>div>*]:items-center [&>div>*]:flex [&>div]:h-fit [&>*:not(:last-child)]:border-b *:border-muted-foreground/25", children: /* @__PURE__ */ jsx(
              SortableContext,
              {
                items: showedColumns.map((x) => x.name),
                strategy: verticalListSortingStrategy,
                children: showedColumns.map((col) => {
                  return /* @__PURE__ */ jsx(
                    ColumnItem,
                    {
                      onChangeWidth: (name, val) => {
                        setColumns((x) => {
                          return x.map((col2) => {
                            if (col2.name === name) {
                              return { ...col2, width: val };
                            }
                            return col2;
                          });
                        });
                      },
                      onRemove: (name) => {
                        setColumns((x) => {
                          return x.map((col2) => {
                            if (col2.name === name) {
                              return { ...col2, show: false };
                            }
                            return col2;
                          });
                        });
                      },
                      column: col
                    },
                    col.name + "_showed"
                  );
                })
              }
            ) })
          ] })
        }
      ),
      /* @__PURE__ */ jsx(
        Button,
        {
          type: "button",
          variant: "ghost",
          size: "sm",
          className: "inline h-6 -mt-3 font-medium text-left w-fit",
          onClick: () => setOpenSelectColumn(true),
          children: t("core.formtable.add_or_remove_columns")
        }
      ),
      /* @__PURE__ */ jsxs(DialogFooter, { className: "pt-2 -mb-2 border-t border-muted-foreground/25", children: [
        /* @__PURE__ */ jsx(DialogClose, { asChild: true, children: /* @__PURE__ */ jsx(
          Button,
          {
            type: "button",
            variant: "secondary",
            className: "h-8",
            onClick: () => onReset(),
            children: t("core.formtable.reset_to_default")
          }
        ) }),
        /* @__PURE__ */ jsx(DialogClose, { asChild: true, children: /* @__PURE__ */ jsx(
          Button,
          {
            className: "h-8",
            onClick: () => setColumnsProps(columns),
            type: "button",
            children: t("core.formtable.apply")
          }
        ) })
      ] })
    ] }) }),
    /* @__PURE__ */ jsx(
      SelectColumn,
      {
        columns,
        setColumns,
        open: openSelectColumn,
        setOpen: setOpenSelectColumn
      }
    )
  ] });
});
const SelectColumn = memo(function SelectColumn2({
  columns: columnsProps,
  setColumns: setColumnsProps,
  open,
  setOpen
}) {
  const [columns, setColumns] = useState([]);
  const { t } = useLaravelReactI18n();
  useEffect(() => {
    if (open) {
      setColumns(columnsProps);
    }
  }, [open]);
  return /* @__PURE__ */ jsx(Dialog, { open, onOpenChange: setOpen, children: /* @__PURE__ */ jsxs(DialogContent, { className: "max-w-sm", children: [
    /* @__PURE__ */ jsxs(DialogHeader, { className: "pb-2 border-b border-muted-foreground/25", children: [
      /* @__PURE__ */ jsx(DialogTitle, { children: t("core.formtable.select_columns") }),
      /* @__PURE__ */ jsx(DialogDescription, { className: "sr-only" })
    ] }),
    /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground", children: t("core.formtable.select_columns.description") }),
    /* @__PURE__ */ jsx("div", { className: "space-y-4 columns-3xs", children: columns && columns.map((col) => {
      return /* @__PURE__ */ jsx(
        FormCheckbox,
        {
          label: /* @__PURE__ */ jsxs(Fragment, { children: [
            col.titleTrans ? t(col.titleTrans) : col.title,
            col.required && /* @__PURE__ */ jsx("span", { className: "ml-1 text-red-500", children: "*" })
          ] }),
          classNameCheckbox: "pointer-events-auto!",
          disabled: col.required,
          checked: col.required || col.show,
          onCheckedChange: (val) => {
            setColumns((x) => {
              return x.map((y) => {
                if (y.required) return y;
                if (y.name === col.name) {
                  return { ...y, show: val };
                }
                return y;
              });
            });
          }
        },
        col.name
      );
    }) }),
    /* @__PURE__ */ jsxs(DialogFooter, { className: "pt-2 -mb-2 border-t border-muted-foreground/25", children: [
      /* @__PURE__ */ jsx(
        Button,
        {
          type: "button",
          variant: "secondary",
          className: "h-8",
          onClick: () => {
            setColumns((x) => {
              return x.map((y) => {
                return { ...y, show: true };
              });
            });
          },
          children: t("core.formtable.select_all")
        }
      ),
      /* @__PURE__ */ jsx(DialogClose, { asChild: true, children: /* @__PURE__ */ jsx(
        Button,
        {
          className: "h-8",
          onClick: () => setColumnsProps(columns),
          type: "button",
          children: t("core.formtable.apply")
        }
      ) })
    ] })
  ] }) });
});
const ColumnItem = memo(function ColumnItem2({
  column,
  onChangeWidth,
  onRemove
}) {
  const { t } = useLaravelReactI18n();
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: column.name });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };
  return /* @__PURE__ */ jsxs(
    "div",
    {
      ref: setNodeRef,
      style,
      className: "grid bg-background group col-span-full items-center grid-cols-subgrid border-muted-foreground/25 [&>div]:text-sm lg:[&>div]:text-base",
      children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            className: "cursor-move ",
            ...listeners,
            ...attributes,
            type: "button",
            children: /* @__PURE__ */ jsx(GripVerticalIcon, { className: "transition-[color,opacity] group-hover:text-foreground text-muted-foreground/50 size-5" })
          }
        ),
        /* @__PURE__ */ jsxs("div", { children: [
          column.titleTrans ? t(column.titleTrans) : column.title,
          column.required && /* @__PURE__ */ jsx("span", { className: "ml-1 text-red-500", children: "*" })
        ] }),
        /* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsx(
          CurrencyInput,
          {
            className: "text-left",
            min: "1",
            max: "10",
            step: "1",
            value: column.width ?? 1,
            onValueChange: (val) => {
              onChangeWidth(column.name, val);
            }
          }
        ) }),
        /* @__PURE__ */ jsx("div", { className: "w-10", children: !column.required && /* @__PURE__ */ jsx(
          Button,
          {
            type: "button",
            variant: "ghost",
            size: "icon",
            className: cn("size-6"),
            onClick: () => onRemove(column.name),
            children: /* @__PURE__ */ jsx(Trash2Icon, { className: "size-3 text-destructive" })
          }
        ) })
      ]
    }
  );
});
export {
  FormTable as F
};
