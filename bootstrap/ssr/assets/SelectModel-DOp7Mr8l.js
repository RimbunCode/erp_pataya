import { jsx, Fragment, jsxs } from "react/jsx-runtime";
import { D as Dialog, e as DialogTrigger, f as DialogContent, g as DialogHeader, h as DialogTitle, i as DialogDescription, j as DialogFooter } from "./command-BSnyCa9u.js";
import { k as generateRandom, c as cn } from "./utils-ClCZGsDL.js";
import { memo, forwardRef, useRef, useState, useCallback, useMemo } from "react";
import { B as Button } from "./button-Us2TB7GG.js";
import { F as FilterItem } from "./Header-C9Xb62yg.js";
import { a as FormInput } from "./checkbox-C_BEU5E4.js";
import PermissionLinkModel from "./PermissionLinkModel-Cy7R6yf4.js";
import { PlusIcon } from "lucide-react";
import QueryString from "qs";
import { S as Select } from "./Select-DB9toH_t.js";
import { T as Table2 } from "./Table2-DWJgyKWG.js";
import { c as TooltipProvider } from "./tooltip-Df8khweJ.js";
import axios from "axios";
import { b as useDidMountEffect } from "./Link-p0Z4AKax.js";
import { useForm } from "@inertiajs/react";
import { useLaravelReactI18n } from "laravel-react-i18n";
const defaultFilter = {
  id: "",
  column: "",
  operator: "",
  value: ""
};
const defaultSort = "-created_at";
const SelectModel = memo(
  forwardRef(function SelectModel2({
    title,
    label,
    variant = "secondary",
    size = "sm",
    className,
    from,
    onSelected
  }, ref) {
    const route = window.route;
    const tableRef = useRef();
    const { t } = useLaravelReactI18n();
    const [open, setOpen] = useState(false);
    const [model, setModel] = useState(null);
    const [loading, setLoading] = useState(false);
    const [select, setSelect] = useState(null);
    const [dataModel, setDataModel] = useState({});
    const [dataTable, setDataTable] = useState({ data: [], total: 0 });
    const { data, setData, isDirty, setDefaults } = useForm({
      filters: []
    });
    const [options, setOptions] = useState({
      // sort:"",
      sort: defaultSort,
      f: [],
      page: 1
    });
    useDidMountEffect(() => {
      const reloadData = setTimeout(() => {
        var _a;
        if (!model) return;
        axios.get(
          route("model.columns", { model: model == null ? void 0 : model.model }) + "?" + QueryString.stringify({
            select,
            columns: (select ? (_a = configModel == null ? void 0 : configModel.select[select]) == null ? void 0 : _a.columns : configModel == null ? void 0 : configModel.columns) ?? []
          })
        ).then((res) => {
          var _a2;
          const data2 = res.data;
          setDataModel({
            ...data2,
            filters: (select ? (_a2 = configModel == null ? void 0 : configModel.select[select]) == null ? void 0 : _a2.filters : configModel == null ? void 0 : configModel.filters) ?? {}
          });
        }).catch((err) => {
          console.log(err);
        }).finally(() => {
        });
      }, 500);
      return () => clearTimeout(reloadData);
    }, [model, select]);
    const loadData = useCallback(
      (columns2) => {
        if (!(dataModel == null ? void 0 : dataModel.model)) return;
        setLoading(true);
        axios.post(route("model.datatable"), {
          model: dataModel.model,
          showedColumns: columns2 == null ? void 0 : columns2.filter((x) => x.show).sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity)).map((x) => x.name),
          filters: configModel == null ? void 0 : configModel.filters,
          with: selects && selects.length > 0 && select == null ? selects : void 0,
          ...options
        }).then((res) => {
          const data2 = res.data;
          setDataTable(data2.data);
        }).catch((err) => {
          setDataTable({ data: [], total: 0 });
          console.log(err);
        }).finally(() => {
          setLoading(false);
        });
      },
      [options, dataModel]
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
            route: col.isLink && !parentColumn ? `${dataModel.route}.show` : col.route
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
      [dataModel.route]
    );
    const [mapColumns, columns] = useMemo(() => {
      const newColumns = getColumns(t, dataModel.columns);
      return [newColumns, Object.values(newColumns)];
    }, [dataModel.columns, t]);
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
      (name, sort) => {
        const order = sort ?? (optionsSortKey == name && optionsSortOrder == "asc" ? "desc" : "asc");
        setOptions({
          ...options,
          sort: order ? `${order == "asc" ? "" : "-"}${name}` : null
        });
      },
      [options.sort]
    );
    useDidMountEffect(() => {
      const reloadData = setTimeout(() => {
        loadData(dataModel == null ? void 0 : dataModel.columns);
      }, 500);
      return () => clearTimeout(reloadData);
    }, [options, dataModel]);
    const setFilters = useCallback(
      (val) => {
        setData((prev) => {
          const filters = typeof val == "function" ? val((prev == null ? void 0 : prev.filters) ?? []) : val;
          return {
            ...prev,
            filters
          };
        });
      },
      [setData]
    );
    const addFilter = useCallback(() => {
      setFilters((prev) => [
        ...prev,
        { ...defaultFilter, id: generateRandom(8) }
      ]);
    }, [setFilters]);
    const removeFilter = useCallback(
      (id) => {
        setFilters((prev) => {
          const newFilters = prev.filter((f) => f.id !== id);
          if (newFilters.length === 0) {
            return [{ ...defaultFilter, id: generateRandom(8) }];
          }
          return newFilters;
        });
      },
      [setFilters]
    );
    const updateFilter = useCallback(
      (id, payload) => {
        setFilters((prev) => {
          const updatedFilters = prev.map((f) => {
            if (f.id === id) {
              return { ...f, ...payload };
            }
            return f;
          });
          return updatedFilters;
        });
      },
      [setFilters]
    );
    const applyFilters = useCallback(() => {
      data.filters.forEach(({ column, operator, value }) => {
        if (!column || !operator || !value) return;
      });
      setDefaults(data);
    }, [data, setDefaults]);
    const [filterModel, configModels] = useMemo(() => {
      if (typeof from === "string") {
        return [
          {
            model: from
          },
          {}
        ];
      }
      if (typeof from === "object") {
        const froms = [];
        const config = {};
        Object.entries(from).forEach(([key, value]) => {
          froms.push(key);
          config[key] = value;
        });
        return [
          {
            model: {
              or: froms
            }
          },
          config
        ];
      }
    }, [from]);
    const configModel = useMemo(() => {
      var _a;
      const nameModel = (_a = model == null ? void 0 : model.model) == null ? void 0 : _a.replace("\\\\", "\\");
      const config = configModels[nameModel] ?? {};
      return config;
    }, [model, configModels]);
    const selects = useMemo(() => {
      const config = configModel;
      const selects2 = config.select;
      if (!selects2) return null;
      return Object.keys(selects2);
    }, [configModel]);
    const _onSelected = useCallback(() => {
      var _a, _b, _c;
      const dataSelected = (_a = tableRef == null ? void 0 : tableRef.current) == null ? void 0 : _a.getSelectedItem();
      if (!dataSelected || dataSelected.length <= 0) return;
      if (!onSelected) {
        setOpen(false);
        return;
      }
      const selects2 = Object.keys((configModel == null ? void 0 : configModel.select) ?? {});
      let data2, model2;
      if (select == null && selects2.length <= 1) {
        if (selects2.length == 0) {
          data2 = dataSelected;
          model2 = dataModel.model;
        } else {
          data2 = dataSelected.length > 1 ? dataSelected.reduce((a, b) => {
            if (Array.isArray(a)) {
              return [...a, ...b[selects2[0]]];
            }
            return [...a[selects2[0]], ...b[selects2[0]]];
          }) : dataSelected[0][selects2[0]];
          model2 = (_c = (_b = dataModel.columns.filter((x) => x.name == selects2[0])) == null ? void 0 : _b[0]) == null ? void 0 : _c.related;
        }
      } else {
        data2 = dataSelected;
        model2 = dataModel.model;
      }
      onSelected(data2, model2);
      setOpen(false);
    }, [tableRef, configModel, select, dataModel, setOpen]);
    return /* @__PURE__ */ jsx(Fragment, { children: /* @__PURE__ */ jsxs(Dialog, { open, onOpenChange: setOpen, children: [
      /* @__PURE__ */ jsx(DialogTrigger, { ref, asChild: true, onClick: () => setOpen(true), children: /* @__PURE__ */ jsx(
        Button,
        {
          type: "button",
          variant,
          size,
          className: cn(className),
          children: label
        }
      ) }),
      /* @__PURE__ */ jsx(DialogContent, { className: "max-w-(--breakpoint-xl) p-0", children: /* @__PURE__ */ jsxs(TooltipProvider, { children: [
        /* @__PURE__ */ jsxs(DialogHeader, { className: "px-6 pt-6 mb-2 border-b border-muted-foreground/30", children: [
          /* @__PURE__ */ jsx(DialogTitle, { className: "flex items-center mb-1 gap-x-2", children: title ?? t("core.form.select_model") }),
          /* @__PURE__ */ jsx(DialogDescription, { className: "sr-only" })
        ] }),
        /* @__PURE__ */ jsxs(
          "div",
          {
            className: cn(
              "max-h-screen overflow-y-auto flex flex-col px-6"
            ),
            children: [
              /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 px-1 pb-4 my-2 border-b gap-x-3 border-muted-foreground/30", children: [
                /* @__PURE__ */ jsx(FormInput, { label: t("core.form.from"), required: true, children: /* @__PURE__ */ jsx(
                  PermissionLinkModel,
                  {
                    required: false,
                    placeholder: t("core.form.model.placeholder"),
                    value: model,
                    onValueChange: setModel,
                    filters: filterModel
                  }
                ) }),
                selects && /* @__PURE__ */ jsx(FormInput, { label: t("core.form.select"), required: true, children: /* @__PURE__ */ jsx(
                  Select,
                  {
                    required: false,
                    value: select,
                    onValueChange: setSelect,
                    placeholder: t("core.form.select.placeholder"),
                    optionTrans: `${model == null ? void 0 : model.translateKey}.columns`,
                    options: selects
                  }
                ) })
              ] }),
              /* @__PURE__ */ jsx(
                "div",
                {
                  className: cn(
                    "grid max-w-full flex-1 grid-cols-[max-content_max-content_auto_max-content] gap-y-2 mb-2 [&>div.grid:first-child]:border-t-0 [&>div.grid:first-child]:pt-0 [&>div.grid]:pt-2 [&>div.grid]:border-t [&>div.grid]:border-muted-foreground/30"
                  ),
                  children: data.filters.map(({ id, ...props }) => {
                    if (props.type == "relations" || props.type == "mixed")
                      return;
                    return /* @__PURE__ */ jsx(
                      FilterItem,
                      {
                        id,
                        ...props,
                        columns,
                        onChanged: updateFilter,
                        removeFilter
                      },
                      id
                    );
                  })
                }
              ),
              /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between py-2 pb-3 border-b gap-x-6 border-muted-foreground/30", children: [
                /* @__PURE__ */ jsxs(
                  Button,
                  {
                    variant: "outline",
                    className: "h-8 px-2!",
                    onClick: addFilter,
                    children: [
                      /* @__PURE__ */ jsx(PlusIcon, {}),
                      t("core.datatable.filter.add_filter")
                    ]
                  }
                ),
                /* @__PURE__ */ jsxs("div", { className: "flex gap-x-2 ", children: [
                  /* @__PURE__ */ jsx(
                    Button,
                    {
                      variant: "secondary",
                      className: "h-8 px-2!",
                      onClick: () => setFilters([]),
                      children: t("core.datatable.filter.clear_filters")
                    }
                  ),
                  isDirty && /* @__PURE__ */ jsx(Button, { className: "h-8 px-2!", onClick: applyFilters, children: t("core.datatable.filter.apply_filters") })
                ] })
              ] }),
              model && (dataModel == null ? void 0 : dataModel.columns) && /* @__PURE__ */ jsx(
                Table2,
                {
                  ref: tableRef,
                  selectable: true,
                  reload: loadData,
                  className: "flex-1",
                  columns: mapColumns,
                  data: dataTable.data,
                  isDynamicData: true,
                  isLoading: loading,
                  options,
                  setSort,
                  resetSorting,
                  onOptionsChanged: setOptions
                }
              )
            ]
          }
        ),
        /* @__PURE__ */ jsxs(DialogFooter, { className: "px-6 pb-6 mt-2", children: [
          /* @__PURE__ */ jsx(
            Button,
            {
              type: "button",
              variant: "outline",
              size: "lg",
              className: "h-8 mt-2 sm:mt-0 p-2 size-fit",
              onClick: () => setOpen(false),
              children: t("core.form.cancel")
            }
          ),
          /* @__PURE__ */ jsx(
            Button,
            {
              type: "button",
              variant: "primary",
              size: "lg",
              className: "h-8 p-2 size-fit",
              onClick: _onSelected,
              children: t("core.form.select")
            }
          )
        ] })
      ] }) })
    ] }) });
  })
);
const loadFromModel = async (model, id, select) => {
  var _a, _b, _c;
  try {
    const res = await axios.post(window.route("model.datatable"), {
      model,
      id,
      with: select ? [select] : void 0
    });
    const dataRes = res.data;
    let data, dataModel;
    if (select) {
      data = (_a = dataRes == null ? void 0 : dataRes.data) == null ? void 0 : _a[select];
      dataModel = (_c = (_b = dataRes.dataTableColumns.filter((x) => x.wname == select)) == null ? void 0 : _b[0]) == null ? void 0 : _c.related;
    } else {
      data = dataRes == null ? void 0 : dataRes.data;
      dataModel = model;
    }
    console.log({ value: data, model: dataModel });
    return { value: data, model: dataModel };
  } catch (error) {
    console.log(error);
    return null;
  }
};
export {
  SelectModel as S,
  loadFromModel as l
};
