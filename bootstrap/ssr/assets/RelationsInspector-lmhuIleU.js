import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { A as Accordion, d as AccordionItem, e as AccordionTrigger, f as AccordionContent, F as FormCheckbox } from "./checkbox-C_BEU5E4.js";
import { D as Dialog, f as DialogContent, g as DialogHeader, h as DialogTitle, i as DialogDescription, j as DialogFooter, m as DialogClose } from "./command-BSnyCa9u.js";
import { useSensors, useSensor, MouseSensor, TouchSensor, DndContext, closestCenter } from "@dnd-kit/core";
import { GripVerticalIcon, Trash2Icon } from "lucide-react";
import { useMemo, memo, useState, useCallback, useEffect } from "react";
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from "@dnd-kit/sortable";
import { k as generateRandom, c as cn } from "./utils-ClCZGsDL.js";
import { usePage, useForm } from "@inertiajs/react";
import { B as Button } from "./button-Us2TB7GG.js";
import { CSS } from "@dnd-kit/utilities";
import { useEditor } from "@grapesjs/react";
import { useLaravelReactI18n } from "laravel-react-i18n";
import "@radix-ui/react-checkbox";
import "class-variance-authority";
import "./MasterLayout-CRsmljQs.js";
import "@radix-ui/react-alert-dialog";
import "./use-mobile-BsFue-bT.js";
import "sonner";
import "zustand";
import "./tooltip-Df8khweJ.js";
import "@radix-ui/react-tooltip";
import "./Link-p0Z4AKax.js";
import "@inertiajs/core";
import "./avatar-_KK8H2Pc.js";
import "@radix-ui/react-avatar";
import "./AppLayout-Drqdr6Z-.js";
import "@radix-ui/react-dialog";
import "./input-wk3Ou7wI.js";
import "@radix-ui/react-separator";
import "./skeleton-IN0PLOYc.js";
import "@radix-ui/react-slot";
import "./ToggleTheme-BSs-sHS2.js";
import "@radix-ui/react-dropdown-menu";
import "radix-ui";
import "./popover-CziqY8mR.js";
import "@radix-ui/react-popover";
import "cmdk";
import "./LoadingIcon-CRleOEtX.js";
import "axios";
import "lodash";
import "pluralize";
import "react-detect-click-outside";
import "./tabs-DhZjhdeH.js";
import "@radix-ui/react-tabs";
import "./InputError-2JjWc6nJ.js";
import "./label-DiFvdPYz.js";
import "@radix-ui/react-label";
import "./Select-DB9toH_t.js";
import "@radix-ui/react-accordion";
import "qs";
import "@radix-ui/react-progress";
import "@headlessui/react";
import "./Comments-Bvo3255G.js";
import "quill-mention/autoregister";
import "quill";
import "@date-fns/tz";
import "date-fns";
import "date-fns/locale";
import "buffer";
import "clsx";
import "tailwind-merge";
import "@remixicon/react";
import "./Tags-D6pM3ZUY.js";
import "@marcbachmann/cel-js";
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
            col.title || (col.titleTrans ? t(col.titleTrans) : col.title ?? col.name),
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
const ColumnItem = memo(function ColumnItem2({ column, onRemove }) {
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
          column.title || (column.titleTrans ? t(column.titleTrans) : column.title ?? column.name),
          column.required && /* @__PURE__ */ jsx("span", { className: "ml-1 text-red-500", children: "*" })
        ] }),
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
const ComponentItem = memo(function ComponentItem2({ component, data }) {
  const { t } = useLaravelReactI18n();
  const {
    data: _data,
    setData: _setData,
    isDirty,
    setDefaults
  } = useForm({
    columns: data.columns
  });
  const { columns, setColumns } = useMemo(() => {
    return {
      columns: _data.columns,
      setColumns(props) {
        if (typeof props === "function") {
          _setData((x) => {
            return {
              columns: props(x.columns)
            };
          });
          return;
        }
        _setData("columns", props);
      }
    };
  });
  const [openSelectColumn, setOpenSelectColumn] = useState(false);
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
  const handleDragOver = (event) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setColumns((items) => {
        const newItems = items.map((x) => x.name);
        const newIndex = newItems.indexOf(over.id);
        const oldIndex = newItems.indexOf(active.id);
        const newColumn = arrayMove(items, oldIndex, newIndex);
        return newColumn.map((x, i) => {
          return {
            ...x,
            order: i
          };
        });
      });
    }
  };
  const onApply = useCallback(() => {
    var _a, _b, _c;
    setDefaults(_data);
    const columns2 = ((_a = _data.columns) == null ? void 0 : _a.filter((col) => col.show).sort((a, b) => a.order - b.order)) || [];
    const attributes = component.getAttributes();
    const thead = (_b = Array.from(component.find("thead"))) == null ? void 0 : _b[0];
    const tbody = (_c = Array.from(component.find("tbody"))) == null ? void 0 : _c[0];
    thead.remove();
    tbody.remove();
    const genId = (prefix = "g") => `${prefix}-${generateRandom(8)}`;
    component.append([
      {
        type: "tableHead",
        tagName: "thead",
        toolbars: [],
        selectable: false,
        droppable: false,
        layerable: false,
        editable: false,
        draggable: false,
        components: [
          {
            type: "html-comment",
            attributes: {
              text: `{{#infoColumns @root.dataTableColumns key="${attributes["data-relations"]}" }}`
            }
          },
          {
            tagName: "tr",
            toolbars: [],
            selectable: false,
            droppable: false,
            layerable: false,
            editable: false,
            draggable: false,
            components: [
              {
                tagName: "th",
                selectable: false,
                droppable: false,
                layerable: false,
                editable: false,
                draggable: false,
                content: "#",
                attributes: {
                  "data-id": genId("cell")
                }
              },
              ...columns2.map((col) => ({
                tagName: "th",
                content: `{{trans ${col.name}}}`,
                selectable: false,
                droppable: false,
                layerable: false,
                editable: false,
                draggable: false,
                attributes: {
                  "data-id": genId("cell"),
                  name: col.name,
                  class: "border border-gray-400 px-2 py-1 text-left bg-gray-100"
                },
                toolbars: []
              }))
            ]
          },
          {
            type: "html-comment",
            attributes: { text: `{{/infoColumns}}` }
          }
        ]
      },
      {
        tagName: "tbody",
        toolbars: [],
        selectable: false,
        droppable: false,
        layerable: false,
        editable: false,
        draggable: false,
        components: [
          {
            type: "html-comment",
            attributes: { text: `{{#each ${attributes["data-relations"]}}}` }
          },
          {
            tagName: "tr",
            toolbars: [],
            selectable: false,
            droppable: false,
            layerable: false,
            editable: false,
            draggable: false,
            components: [
              {
                tagName: "td",
                toolbars: [],
                selectable: false,
                droppable: false,
                layerable: false,
                editable: false,
                draggable: false,
                content: "{{idx}}",
                attributes: {
                  "data-id": genId("cell")
                }
              },
              ...columns2.map((col) => ({
                tagName: "td",
                content: `{{${col.type == "relation" ? "relation " : ""}${col.name}}}`,
                toolbars: [],
                selectable: false,
                droppable: false,
                layerable: false,
                editable: false,
                draggable: false,
                attributes: {
                  "data-id": genId("cell"),
                  name: col.name,
                  class: "border border-gray-300 px-2 py-1"
                }
              }))
            ]
          },
          {
            type: "html-comment",
            attributes: { text: `{{/each}}` }
          }
        ]
      }
    ]);
  }, [_data]);
  const onReset = useCallback(() => {
    setColumns(data.columns);
  }, []);
  const showedColumns = useMemo(
    () => columns.filter((col) => col.show),
    [columns]
  );
  return /* @__PURE__ */ jsxs(AccordionItem, { value: data == null ? void 0 : data.name, children: [
    /* @__PURE__ */ jsx(AccordionTrigger, { className: "px-4", children: data.title || t(data == null ? void 0 : data.titleTrans) }),
    /* @__PURE__ */ jsxs(AccordionContent, { className: "px-4", children: [
      /* @__PURE__ */ jsx(
        DndContext,
        {
          onDragOver: handleDragOver,
          sensors,
          collisionDetection: closestCenter,
          children: /* @__PURE__ */ jsxs("div", { className: "overflow-x-hidden grid border rounded-lg border-muted-foreground/25 grid-cols-[auto_2fr_auto]  text-sm max-w-full w-full [&>div]:h-fit [&>*:not(:last-child)]:border-b *:border-muted-foreground/25", children: [
            /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-subgrid col-span-full items-center rounded-t-md bg-muted [&>div]:font-semibold [&>div]:text-sm lg:[&>div]:text-sm [&>div]:py-1! *:px-2", children: [
              /* @__PURE__ */ jsx("div", {}),
              /* @__PURE__ */ jsx("div", { children: t("core.formtable.column") })
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
          className: "inline h-6 my-2 font-medium text-left w-fit",
          onClick: () => setOpenSelectColumn(true),
          children: t("core.formtable.add_or_remove_columns")
        }
      ),
      isDirty && /* @__PURE__ */ jsxs("div", { className: "pt-2 -mb-2 border-t border-muted-foreground/25 flex gap-x-2 justify-end", children: [
        /* @__PURE__ */ jsx(
          Button,
          {
            type: "button",
            variant: "secondary",
            className: "h-8",
            onClick: () => onReset(),
            children: t("core.formtable.reset_to_default")
          }
        ),
        /* @__PURE__ */ jsx(Button, { className: "h-8", onClick: () => onApply(), type: "button", children: t("core.formtable.apply") })
      ] })
    ] }),
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
function RelationsInspector() {
  const editor = useEditor();
  const { dataTableColumns } = usePage().props;
  const components = useMemo(() => {
    const comps = editor.getComponents().filter((x) => {
      return x.getType() == "gjsRelationsTable";
    }).map((comp, idx) => {
      var _a, _b, _c;
      const attributes = comp.getAttributes();
      const headers = Array.from(
        comp.find("[data-gjs-type=tableHead] th")
      ).filter((col) => col.getAttributes()["name"]);
      const getConfig = (name) => {
        for (let i = 0; i < headers.length; i++) {
          if (headers[i].getAttributes()["name"] == name) {
            return {
              show: true,
              order: i
            };
          }
        }
        return {
          show: false
        };
      };
      let dataCol = ((_a = dataTableColumns.find((x) => x.type == "data")) == null ? void 0 : _a.columns) ?? [];
      const keys = ((_b = attributes["data-relations"]) == null ? void 0 : _b.split(".")) ?? "";
      for (let i = 0; i < keys.length; i++) {
        const temp = dataCol == null ? void 0 : dataCol.find((x) => x.name == keys[i]);
        if (temp) {
          dataCol = i == keys.length - 1 ? temp : temp.columns;
        }
      }
      console.log(dataCol, keys);
      if (!dataCol) return;
      dataCol.columns = (_c = dataCol.columns) == null ? void 0 : _c.map((col) => {
        const config = getConfig(col.name);
        return {
          ...col,
          ...config
        };
      }).sort((a, b) => {
        if ((a == null ? void 0 : a.order) == null && (b == null ? void 0 : b.order) == null) return 0;
        if ((a == null ? void 0 : a.order) == null) return 1;
        if ((b == null ? void 0 : b.order) == null) return -1;
        return (a == null ? void 0 : a.order) - (b == null ? void 0 : b.order);
      });
      return /* @__PURE__ */ jsx(
        ComponentItem,
        {
          component: comp,
          data: dataCol
        },
        `${dataCol == null ? void 0 : dataCol.name}-${idx}`
      );
    });
    return comps;
  }, [editor]);
  return /* @__PURE__ */ jsx(Accordion, { type: "single", collapsible: true, className: "w-full", children: components });
}
export {
  RelationsInspector as default
};
