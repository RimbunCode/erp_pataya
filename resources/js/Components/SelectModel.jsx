import { AlertDialogAction, AlertDialogCancel } from "./ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { cn, generateRandom } from "@/lib/utils";
import { forwardRef, memo, useCallback, useMemo, useState } from "react";

import { Button } from "./ui/button";
import FilterItem from "./Table/FilterItem";
import FormInput from "./FormInput";
import PermissionLinkModel from "@/Pages/Core/PermissionLinkModel";
import { PlusIcon } from "lucide-react";
import QueryString from "qs";
import React from "react";
import Table2 from "./Table/Table2";
import { TooltipProvider } from "./ui/tooltip";
import axios from "axios";
import useDidMountEffect from "@/Hooks/useDidMountEffect";
import { useForm } from "@inertiajs/react";
import { useLaravelReactI18n } from "laravel-react-i18n";

const defaultFilter = {
  id: "",
  column: "",
  operator: "",
  value: "",
};
const defaultSort = "-created_at";
export default memo(
  forwardRef(function SelectModel({ title, trigger, from }, ref) {
    const route = window.route;
    const { t } = useLaravelReactI18n();
    const [open, setOpen] = useState(false);
    const [model, setModel] = useState(null);
    const [loading, setLoading] = useState(false);
    const [select, setSelect] = useState(null);
    const [dataModel, setDataModel] = useState({});
    const [dataTable, setDataTable] = useState({ data: [], total: 0 });
    const { data, setData, isDirty, setDefaults } = useForm({
      filters: [],
    });
    const [options, setOptions] = useState({
      // sort:"",
      sort: defaultSort,
      f: [],
      page: 1,
    });
    useDidMountEffect(() => {
      const reloadData = setTimeout(() => {
        if (!model) return;
        axios
          .get(
            route("model.columns", { model: model?.model }) +
              "?" +
              QueryString.stringify({
                select,
                columns:
                  (select
                    ? configModel?.select[select]?.columns
                    : configModel?.columns) ?? [],
              }),
          )
          .then((res) => {
            const data = res.data;
            setDataModel({
              ...data,
              filters:
                (select
                  ? configModel?.select[select]?.filters
                  : configModel?.filters) ?? {},
            });
          })
          .catch((err) => {
            console.log(err);
          })
          .finally(() => {});
      }, 500);

      return () => clearTimeout(reloadData);
    }, [model, select]);

    const loadData = useCallback(
      (columns) => {
        console.log(
          columns
            ?.filter((x) => x.show)
            .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))
            .map((x) => ({ name: x.name, order: x.order ?? Infinity })),
        );
        setLoading(true);
        axios
          .post(route("model.datatable"), {
            model: dataModel.model,
            showedColumns: columns
              ?.filter((x) => x.show)
              .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))
              .map((x) => x.name),
            filters: configModel?.filters,
            ...options,
          })
          .then((res) => {
            const data = res.data;
            setDataTable(data.data);
          })
          .catch((err) => {
            setDataTable({ data: [], total: 0 });
            console.log(err);
          })
          .finally(() => {
            setLoading(false);
          });
      },
      [options, dataModel],
    );
    // useDidMountEffect(() => {
    //   loadData(dataModel?.columns);
    // }, [dataModel]);

    const getColumns = useCallback(
      (t, columns, parentColumn) => {
        let newColumns = {};
        Object.values(columns ?? {}).forEach((col) => {
          const title = col.title ?? t(col.titleTrans);
          const colName = !parentColumn
            ? col.name
            : `${parentColumn.name}.${col.name}`;

          const currentColumn = {
            ...col,
            name: colName,
            title: title,
            show: !parentColumn ? (col.show ?? false) : false,
            searchable: col.searchable ?? true,
            parentCol: parentColumn,
            sortable: !parentColumn ? (col.sortable ?? true) : false,
            resizeable: col.resizeable ?? true,
            route:
              col.isLink && !parentColumn
                ? `${dataModel.route}.show`
                : col.route,
          };
          newColumns[colName] = currentColumn;
          if (col.type == "relation" && col.columns) {
            newColumns[colName].columns = getColumns(
              t,
              col.columns,
              newColumns[colName],
            );
          }
        });
        return newColumns;
      },
      [dataModel.route],
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
        sort: defaultSort,
      });
    }, []);
    const setSort = useCallback(
      (name, sort) => {
        const order =
          sort ??
          (optionsSortKey == name && optionsSortOrder == "asc"
            ? "desc"
            : "asc");

        setOptions({
          ...options,
          sort: order ? `${order == "asc" ? "" : "-"}${name}` : null,
        });
      },
      [options.sort],
    );
    useDidMountEffect(() => {
      const reloadData = setTimeout(() => {
        loadData(dataModel?.columns);
      }, 500);

      return () => clearTimeout(reloadData);
    }, [options, dataModel]);

    const setFilters = useCallback(
      (val) => {
        setData((prev) => {
          const filters =
            typeof val == "function" ? val(prev?.filters ?? []) : val;
          return {
            ...prev,
            filters,
          };
        });
      },
      [setData],
    );
    const addFilter = useCallback(() => {
      setFilters((prev) => [
        ...prev,
        { ...defaultFilter, id: generateRandom(8) },
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
      [setFilters],
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
      [setFilters],
    );
    const applyFilters = useCallback(() => {
      const newFilters = [];
      data.filters.forEach(({ column, operator, value }) => {
        if (!column || !operator || !value) return;
        newFilters.push([column, operator, value]);
      });
      setDefaults(data);
      // onApply(newFilters);
      // setOpen(false);
    }, [data, setDefaults]);

    const [filterModel, configModels] = useMemo(() => {
      if (typeof from === "string") {
        return [
          {
            model: from,
          },
          {},
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
              or: froms,
            },
          },
          config,
        ];
      }
    }, [from]);
    const configModel = useMemo(() => {
      const nameModel = model?.model?.replace("\\\\", "\\");
      const config = configModels[nameModel] ?? {};
      return config;
    }, [model, configModels]);
    const selects = useMemo(() => {
      const config = configModel;
      const selects = config.select;
      if (!selects) return null;
      return Object.keys(selects);
    }, [configModel]);
    return (
      <>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            ref={ref}
            asChild
            className="w-full"
            onClick={() => setOpen(true)}
          >
            {trigger}
          </DialogTrigger>
          <DialogContent className="max-w-screen-xl p-0">
            <TooltipProvider>
              <DialogHeader className="px-6 pt-6 mb-2 border-b border-muted-foreground/30">
                <DialogTitle className="flex items-center mb-1 gap-x-2">
                  {title ?? t("core.form.select_model")}
                </DialogTitle>
                <DialogDescription className="sr-only"></DialogDescription>
              </DialogHeader>
              <div
                className={cn(
                  "max-h-screen overflow-y-auto flex flex-col px-6",
                )}
              >
                <div className="grid grid-cols-2 px-1 pb-4 my-2 border-b gap-x-3 border-muted-foreground/30">
                  <FormInput label={t("core.form.from")} required={true}>
                    <PermissionLinkModel
                      required={false}
                      placeholder={t("core.form.model.placeholder")}
                      value={model}
                      onValueChange={setModel}
                      filters={filterModel}
                    />
                  </FormInput>
                  {selects && (
                    <FormInput label={t("core.form.select")} required={true}>
                      <Select
                        required={false}
                        value={select}
                        onValueChange={setSelect}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t("core.form.select.placeholder")}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={null}>{model?.name}</SelectItem>
                          {selects.map((x) => (
                            <SelectItem key={x} value={x}>
                              {model?.translateKey
                                ? t(`${model?.translateKey}.columns.${x}`)
                                : x}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormInput>
                  )}
                </div>
                <div
                  className={cn(
                    "grid max-w-full flex-1 grid-cols-[max-content_max-content_auto_max-content] gap-y-2 mb-2 [&>div.grid:first-child]:border-t-0 [&>div.grid:first-child]:pt-0 [&>div.grid]:pt-2 [&>div.grid]:border-t [&>div.grid]:border-muted-foreground/30",
                  )}
                >
                  {data.filters.map(({ id, ...props }) => {
                    if (props.type == "relations" || props.type == "mixed")
                      return;
                    return (
                      <FilterItem
                        key={id}
                        id={id}
                        {...props}
                        columns={columns}
                        onChanged={updateFilter}
                        removeFilter={removeFilter}
                      />
                    );
                  })}
                </div>
                <div className="flex items-center justify-between py-2 pb-3 border-b gap-x-6 border-muted-foreground/30">
                  <Button
                    variant="outline"
                    className="h-8 !px-2"
                    onClick={addFilter}
                  >
                    <PlusIcon />
                    {t("core.datatable.filter.add_filter")}
                  </Button>

                  <div className="flex gap-x-2 ">
                    <Button
                      variant="secondary"
                      className="h-8 !px-2"
                      onClick={() => setFilters([])}
                    >
                      {t("core.datatable.filter.clear_filters")}
                    </Button>
                    {isDirty && (
                      <Button className="h-8 !px-2" onClick={applyFilters}>
                        {t("core.datatable.filter.apply_filters")}
                      </Button>
                    )}
                  </div>
                </div>
                {model && dataModel?.columns && (
                  <Table2
                    selectable={true}
                    reload={loadData}
                    className="flex-1"
                    columns={mapColumns}
                    data={dataTable.data}
                    isDynamicData={true}
                    isLoading={loading}
                    // totalPages={data.total}
                    options={options}
                    setSort={setSort}
                    resetSorting={resetSorting}
                    onOptionsChanged={setOptions}
                  />
                )}
              </div>
              <DialogFooter className="px-6 pb-6 mt-2">
                <AlertDialogCancel
                  className="h-8"
                  onClick={() => setOpen(false)}
                >
                  {t("core.form.cancel")}
                </AlertDialogCancel>
                <AlertDialogAction
                  className="h-8"
                  type="submit"
                  onClick={() => {}}
                >
                  {t("core.form.select")}
                </AlertDialogAction>
              </DialogFooter>
            </TooltipProvider>
          </DialogContent>
        </Dialog>
      </>
    );
  }),
);
