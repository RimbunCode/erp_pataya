import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { cn, generateRandom } from "@/lib/utils";
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Button } from "./ui/button";
import FilterItem from "./Table/FilterItem";
import FormInput from "./FormInput";
import PermissionLinkModel from "@/Pages/Core/PermissionLinkModel";
import { PlusIcon } from "lucide-react";
import QueryString from "qs";
import React from "react";
import Select from "./Select";
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
  forwardRef(function SelectModel(
    {
      title,
      label,
      variant = "secondary",
      size = "sm",
      className,
      from,
      onSelected,
    },
    ref,
  ) {
    const route = window.route;
    const tableRef = useRef();
    const { t } = useLaravelReactI18n();
    const [open, setOpen] = useState(false);
    const [model, setModel] = useState(null);
    const [loading, setLoading] = useState(false);
    const SELF_OPTION = "__self__";
    const [select, setSelect] = useState(SELF_OPTION);
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
    const normalizeFilters = useCallback((filters) => {
      if (!filters) return [];
      if (Array.isArray(filters)) return filters;
      const result = [];
      Object.entries(filters).forEach(([key, value]) => {
        if (
          Array.isArray(value) &&
          value.length === 3 &&
          typeof value[0] === "string"
        ) {
          result.push(value);
          return;
        }
        if (value && typeof value === "object") {
          Object.entries(value).forEach(([operator, val]) => {
            if (val === undefined || val === null) return;
            result.push([key, operator, val]);
          });
          return;
        }
        result.push([key, "eq", value]);
      });
      return result;
    }, []);
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
      return [{}, {}];
    }, [from]);
    const configModel = useMemo(() => {
      const nameModel = model?.model?.replace("\\\\", "\\");
      const config = configModels[nameModel] ?? {};
      return {
        model: nameModel,
        ...config,
      };
    }, [model, configModels]);
    const selects = useMemo(() => {
      const config = configModel;
      const selects = config.selects;
      if (!selects) return null;
      return Object.keys(selects);
    }, [configModel]);
    const selectOptions = useMemo(() => {
      if (!model) return [];
      const opts = [
        {
          value: SELF_OPTION,
          label: model?.translateKey
            ? t(`${model.translateKey}.title`)
            : model?.model,
        },
      ];
      selects?.forEach((sel) => {
        opts.push({
          value: sel,
          label: t(`${model?.translateKey}.columns.${sel}`),
        });
      });
      return opts;
    }, [model, selects, t]);
    const normalizedSelect = select === SELF_OPTION ? null : select;
    const baseFilters = useMemo(() => {
      const filterSource = normalizedSelect
        ? configModel?.selects?.[normalizedSelect]?.filters
        : configModel?.filters;
      return normalizeFilters(filterSource);
    }, [configModel, normalizedSelect, normalizeFilters]);
    // Default pilih model utama
    useEffect(() => {
      if (!model) return;
      setSelect(SELF_OPTION);
    }, [model]);
    useDidMountEffect(() => {
      const reloadData = setTimeout(() => {
        if (!model) return;
        axios
          .get(
            route("model.columns", { model: model?.model }) +
              "?" +
              QueryString.stringify({
                select: normalizedSelect,
                columns:
                  (normalizedSelect
                    ? configModel?.selects[normalizedSelect]?.columns
                    : configModel?.columns) ?? [],
              }),
          )
          .then((res) => {
            const data = res.data;
            setDataModel({
              ...data,
              filters:
                (normalizedSelect
                  ? configModel?.selects[normalizedSelect]?.filters
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
        if (!dataModel?.model) return;
        setLoading(true);
        axios
          .post(route("model.datatable"), {
            model: dataModel.model,
            configModel: configModel,
            select: select,
            showedColumns: columns
              ?.filter((x) => x.show)
              .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))
              .map((x) => x.name),
            with:
              selects && selects.length > 0 && normalizedSelect == null
                ? selects
                : undefined,
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
      [options, configModel, dataModel, select, normalizedSelect, selects],
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
            // Default tampilkan kolom utama jika backend tidak mengirim flag show
            show: !parentColumn ? (col.show ?? true) : false,
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
    }, [options, dataModel, loadData]);

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

    useEffect(() => {
      setOptions((prev) => ({
        ...prev,
        sort: defaultSort,
        page: 1,
        f: baseFilters,
      }));
      setFilters([]);
    }, [baseFilters, setFilters]);
    const applyFilters = useCallback(() => {
      const newFilters = [];
      data.filters.forEach(({ column, operator, value }) => {
        if (
          !column ||
          !operator ||
          value === undefined ||
          value === null ||
          value === ""
        )
          return;
        newFilters.push([column, operator, value]);
      });
      setDefaults(data);
      setOptions((prev) => ({
        ...prev,
        page: 1,
        f: [...baseFilters, ...newFilters],
      }));
    }, [data, setDefaults, baseFilters]);

    const _onSelected = useCallback(() => {
      const dataSelected = tableRef?.current?.getSelectedItem();
      if (!dataSelected || dataSelected.length <= 0) return;
      if (!onSelected) {
        setOpen(false);
        return;
      }
      const selects = Object.keys(configModel?.selects ?? {});
      let data, model;

      if (normalizedSelect == null && selects.length <= 1) {
        if (selects.length == 0) {
          data = dataSelected;
          model = dataModel.model;
        } else {
          data =
            dataSelected.length > 1
              ? dataSelected.reduce((a, b) => {
                  if (Array.isArray(a)) {
                    return [...a, ...b[selects[0]]];
                  }
                  return [...a[selects[0]], ...b[selects[0]]];
                })
              : dataSelected[0][selects[0]];
          model = dataModel.columns.filter((x) => x.name == selects[0])?.[0]
            ?.related;
        }
      } else {
        data = dataSelected;
        model = dataModel.model;
      }
      if (configModel?.columnAlias) {
        data = data.map((item) => {
          const newItem = { ...item };
          Object.entries(configModel.columnAlias).forEach(([key, value]) => {
            newItem[key] = item[value];
          });
          return newItem;
        });
      }
      onSelected(data, model);
      setOpen(false);
    }, [tableRef, configModel, select, dataModel, setOpen]);
    return (
      <>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger ref={ref} asChild onClick={() => setOpen(true)}>
            <Button
              type="button"
              variant={variant}
              size={size}
              className={cn(className)}
            >
              {label}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-(--breakpoint-2xl)! w-auto! p-0">
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
                      onValueChange={(val) => {
                        setModel(val);
                        setSelect(null);
                      }}
                      filters={filterModel}
                    />
                  </FormInput>
                  {selectOptions.length > 0 && (
                    <FormInput label={t("core.form.select")} required={true}>
                      <Select
                        required={false}
                        value={select}
                        onValueChange={setSelect}
                        placeholder={t("core.form.select.placeholder")}
                        options={selectOptions}
                      />
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
                    className="h-8 px-2!"
                    onClick={addFilter}
                  >
                    <PlusIcon />
                    {t("core.datatable.filter.add_filter")}
                  </Button>

                  <div className="flex gap-x-2 ">
                    <Button
                      variant="secondary"
                      className="h-8 px-2!"
                      onClick={() => setFilters([])}
                    >
                      {t("core.datatable.filter.clear_filters")}
                    </Button>
                    {isDirty && (
                      <Button className="h-8 px-2!" onClick={applyFilters}>
                        {t("core.datatable.filter.apply_filters")}
                      </Button>
                    )}
                  </div>
                </div>
                {model && dataModel?.columns && (
                  <Table2
                    ref={tableRef}
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
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="h-8 mt-2 sm:mt-0 p-2 size-fit"
                  onClick={() => setOpen(false)}
                >
                  {t("core.form.cancel")}
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  className="h-8 p-2 size-fit"
                  onClick={_onSelected}
                >
                  {t("core.form.select")}
                </Button>
              </DialogFooter>
            </TooltipProvider>
          </DialogContent>
        </Dialog>
      </>
    );
  }),
);

export const loadFromModel = async (model, id, select) => {
  try {
    const res = await axios.post(window.route("model.datatable"), {
      model: model,
      id: id,
      with: select ? [select] : undefined,
    });
    const dataRes = res.data;

    let data, dataModel;
    if (select) {
      data = dataRes?.data?.[select];
      dataModel = dataRes.dataTableColumns.filter((x) => x.wname == select)?.[0]
        ?.related;
    } else {
      data = dataRes?.data;
      dataModel = model;
    }
    console.log({ value: data, model: dataModel });
    return { value: data, model: dataModel };
  } catch (error) {
    console.log(error);
    return null;
  }
};
