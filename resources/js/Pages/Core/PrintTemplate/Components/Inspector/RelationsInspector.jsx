import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/Components/ui/accordion";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/Components/ui/dialog";
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { GripVerticalIcon, Trash2Icon } from "lucide-react";
import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { cn, generateRandom } from "@/lib/utils";
import { useForm, usePage } from "@inertiajs/react";

import { Button } from "@/components/ui/button";
import { CSS } from "@dnd-kit/utilities";
import { FormCheckbox } from "@/Components/ui/checkbox";
import { useEditor } from "@grapesjs/react";
import { useLaravelReactI18n } from "laravel-react-i18n";

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
                      {col.title ||
                        (col.titleTrans
                          ? t(col.titleTrans)
                          : (col.title ?? col.name))}
                      {col.required && (
                        <span className="ml-1 text-red-500">*</span>
                      )}
                    </>
                  }
                  classNameCheckbox="pointer-events-auto!"
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
const ColumnItem = memo(function ColumnItem({ column, onRemove }) {
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
        {column.title ||
          (column.titleTrans
            ? t(column.titleTrans)
            : (column.title ?? column.name))}
        {column.required && <span className="ml-1 text-red-500">*</span>}
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
const ComponentItem = memo(function ComponentItem({ component, data }) {
  const { t } = useLaravelReactI18n();
  const {
    data: _data,
    setData: _setData,
    isDirty,
    setDefaults,
  } = useForm({
    columns: data.columns,
  });
  const { columns, setColumns } = useMemo(() => {
    return {
      columns: _data.columns,
      setColumns(props) {
        if (typeof props === "function") {
          _setData((x) => {
            return {
              columns: props(x.columns),
            };
          });
          return;
        }
        _setData("columns", props);
      },
    };
  });
  const [openSelectColumn, setOpenSelectColumn] = useState(false);
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
            order: i,
          };
        });
      });
    }
  };
  const onApply = useCallback(() => {
    setDefaults(_data);
    const columns =
      _data.columns
        ?.filter((col) => col.show)
        .sort((a, b) => a.order - b.order) || [];
    // update component relational table
    const attributes = component.getAttributes();
    const thead = Array.from(component.find("thead"))?.[0];
    const tbody = Array.from(component.find("tbody"))?.[0];
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
              text: `{{#infoColumns @root.dataTableColumns key="${attributes["data-relations"]}" }}`,
            },
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
                  "data-id": genId("cell"),
                },
              },
              ...columns.map((col) => ({
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
                  class:
                    "border border-gray-400 px-2 py-1 text-left bg-gray-100",
                },
                toolbars: [],
              })),
            ],
          },
          {
            type: "html-comment",
            attributes: { text: `{{/infoColumns}}` },
          },
        ],
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
            attributes: { text: `{{#each ${attributes["data-relations"]}}}` },
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
                  "data-id": genId("cell"),
                },
              },
              ...columns.map((col) => ({
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
                  class: "border border-gray-300 px-2 py-1",
                },
              })),
            ],
          },
          {
            type: "html-comment",
            attributes: { text: `{{/each}}` },
          },
        ],
      },
    ]);
  }, [_data]);
  const onReset = useCallback(() => {
    setColumns(data.columns);
  }, []);

  const showedColumns = useMemo(
    () => columns.filter((col) => col.show),
    [columns],
  );
  return (
    <AccordionItem value={data?.name}>
      <AccordionTrigger className="px-4">
        {data.title || t(data?.titleTrans)}
      </AccordionTrigger>
      <AccordionContent className="px-4">
        <DndContext
          onDragOver={handleDragOver}
          sensors={sensors}
          collisionDetection={closestCenter}
        >
          <div className="overflow-x-hidden grid border rounded-lg border-muted-foreground/25 grid-cols-[auto_2fr_auto]  text-sm max-w-full w-full [&>div]:h-fit [&>*:not(:last-child)]:border-b *:border-muted-foreground/25">
            <div className="grid grid-cols-subgrid col-span-full items-center rounded-t-md bg-muted [&>div]:font-semibold [&>div]:text-sm lg:[&>div]:text-sm [&>div]:py-1! *:px-2">
              <div></div>
              <div>{t("core.formtable.column")}</div>
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
          className="inline h-6 my-2 font-medium text-left w-fit"
          onClick={() => setOpenSelectColumn(true)}
        >
          {t("core.formtable.add_or_remove_columns")}
        </Button>
        {isDirty && (
          <div className="pt-2 -mb-2 border-t border-muted-foreground/25 flex gap-x-2 justify-end">
            <Button
              type="button"
              variant="secondary"
              className="h-8"
              onClick={() => onReset()}
            >
              {t("core.formtable.reset_to_default")}
            </Button>
            <Button className="h-8" onClick={() => onApply()} type="button">
              {t("core.formtable.apply")}
            </Button>
          </div>
        )}
      </AccordionContent>
      <SelectColumn
        columns={columns}
        setColumns={setColumns}
        open={openSelectColumn}
        setOpen={setOpenSelectColumn}
      />
    </AccordionItem>
  );
});

export default function RelationsInspector() {
  const editor = useEditor();
  const { dataTableColumns } = usePage().props;

  const components = useMemo(() => {
    const comps = editor
      .getComponents()
      .filter((x) => {
        return x.getType() == "gjsRelationsTable";
      })
      .map((comp, idx) => {
        const attributes = comp.getAttributes();
        const headers = Array.from(
          comp.find("[data-gjs-type=tableHead] th"),
        ).filter((col) => col.getAttributes()["name"]);
        const getConfig = (name) => {
          for (let i = 0; i < headers.length; i++) {
            if (headers[i].getAttributes()["name"] == name) {
              return {
                show: true,
                order: i,
              };
            }
          }
          return {
            show: false,
          };
        };
        let dataCol =
          dataTableColumns.find((x) => x.type == "data")?.columns ?? [];
        const keys = attributes["data-relations"]?.split(".") ?? "";

        for (let i = 0; i < keys.length; i++) {
          const temp = dataCol?.find((x) => x.name == keys[i]);
          if (temp) {
            dataCol = i == keys.length - 1 ? temp : temp.columns;
          }
        }
        console.log(dataCol, keys);

        if (!dataCol) return;
        dataCol.columns = dataCol.columns
          ?.map((col) => {
            const config = getConfig(col.name);
            return {
              ...col,
              ...config,
            };
          })
          .sort((a, b) => {
            if (a?.order == null && b?.order == null) return 0;
            if (a?.order == null) return 1;
            if (b?.order == null) return -1;
            return a?.order - b?.order;
          });

        return (
          <ComponentItem
            key={`${dataCol?.name}-${idx}`}
            component={comp}
            data={dataCol}
          />
        );
      });

    return comps;
  }, [editor]);

  return (
    <Accordion type="single" collapsible className="w-full">
      {components}
    </Accordion>
  );
}

// export default function RelationsInspector() {
//   const { dataTableColumns } = usePage().props;
//   const [comp, setComp] = useState(null);
//   const [columns, setColumns] = useState([]); // all columns list
//   const [visible, setVisible] = useState([]); // visible columns
//   const [order, setOrder] = useState([]); // column order
//   const editor = useEditor();

//   useEffect(() => {
//     console.log(editor);
//     if (!editor) return;

//     const onSelect = () => {
//       const sel = editor.getSelected();
//       if (!sel || sel.get("type") !== "gjsDynamicTable") {
//         setComp(null);
//         return;
//       }

//       setComp(sel);

//       const allCols =
//         (dataTableColumns ?? []).find(
//           (col) => col.name == sel.getAttributes()["data-relations"],
//         )?.columns ?? [];

//       console.log(
//         dataTableColumns,
//         allCols,
//         sel.getAttributes()["data-relations"],
//       );

//       const initialOrder = sel.get("columnOrder") || allCols.slice();
//       const initialVisible = sel.get("visibleColumns") || allCols.slice();

//       setColumns(allCols);
//       setOrder(initialOrder);
//       setVisible(initialVisible);
//     };
//     editor.on("selector:state", (cmp) => {
//       console.log("SELECTED from selector:state", cmp);
//     });

//     editor.on("component:selected", onSelect);
//     // also update on component:update (when created from drop)
//     editor.on("component:update", onSelect);

//     return () => {
//       editor.off("component:selected", onSelect);
//       editor.off("component:update", onSelect);
//     };
//   }, [editor]);

//   // update component when visible changes
//   useEffect(() => {
//     if (!comp) return;
//     comp.set("visibleColumns", visible);
//     // also set attributes so save/restore works
//     const colsJson = JSON.stringify(columns);
//     comp.addAttributes({ "data-columns": colsJson });
//     comp.set("columnOrder", order);
//     // rebuild HTML inside component — plugin should observe change, but we proactively update components
//     rebuildTable(
//       comp,
//       order.filter((c) => visible.includes(c)),
//     );
//     comp.trigger("change:visibleColumns");
//     comp.trigger("change:columnOrder");
//     // persist
//     const editor = window.gjsEditorRef;
//     editor && editor.store();
//   }, [visible, order]);

//   const rebuildTable = (componentModel, visibleOrdered) => {
//     // Replace inner markup with table using visibleOrdered.
//     // We keep the outer component as single wrapper.
//     const relation =
//       componentModel.getAttributes()["data-relations"] ||
//       componentModel.get("relation") ||
//       "relation";
//     const thead = {
//       tagName: "thead",
//       components: [
//         {
//           tagName: "tr",
//           components: visibleOrdered.map((c) => ({
//             tagName: "th",
//             content: c,
//           })),
//         },
//       ],
//     };
//     const tbody = {
//       tagName: "tbody",
//       components: [
//         {
//           tagName: "tr",
//           components: visibleOrdered.map((c) => ({
//             tagName: "td",
//             content: `{{${relation}.${c}}}`,
//           })),
//         },
//       ],
//     };
//     // replace inner components
//     componentModel.components([thead, tbody]);
//   };

//   if (!comp) return null;

//   return (
//     <div className="p-3 border-t">
//       <Collapsible defaultOpen>
//         <CollapsibleTrigger className="flex items-center justify-between w-full">
//           <div>
//             <div className="font-medium">
//               Relations: {comp.getAttributes()["data-relations"]}
//             </div>
//             <div className="text-xs text-muted-foreground">
//               Atur kolom & urutan
//             </div>
//           </div>
//           <ChevronDown className="w-4 h-4" />
//         </CollapsibleTrigger>
//         <CollapsibleContent className="mt-2">
//           <div className="text-sm mb-2">Tampilkan Kolom</div>
//           <div className="space-y-1">
//             {columns.map((col) => (
//               <label key={col.name} className="flex items-center gap-2">
//                 <Checkbox
//                   checked={visible.includes(col)}
//                   onCheckedChange={() => {
//                     setVisible((prev) =>
//                       prev.includes(col)
//                         ? prev.filter((c) => c !== col)
//                         : [...prev, col],
//                     );
//                   }}
//                 />
//                 <span className="text-sm">{col}</span>
//               </label>
//             ))}
//           </div>

//           <div className="text-sm mt-4 mb-2">Urutan Kolom</div>
//           <Reorder.Group
//             axis="y"
//             values={order}
//             onReorder={setOrder}
//             className="space-y-2"
//           >
//             {order.map((col) => (
//               <Reorder.Item
//                 key={col}
//                 value={col}
//                 className="p-2 border rounded bg-background cursor-grab"
//               >
//                 {col}
//               </Reorder.Item>
//             ))}
//           </Reorder.Group>

//           <div className="flex gap-2 mt-3">
//             <Button
//               onClick={() => {
//                 setVisible(columns.slice());
//                 setOrder(columns.slice());
//               }}
//             >
//               Reset
//             </Button>
//             <Button
//               variant="ghost"
//               onClick={() => {
//                 // quick apply: hide all
//                 setVisible([]);
//               }}
//             >
//               Clear
//             </Button>
//           </div>
//         </CollapsibleContent>
//       </Collapsible>
//     </div>
//   );
// }
