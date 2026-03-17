import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Ellipsis,
  Plus,
  RefreshCw,
  Trash2Icon,
  X,
} from "lucide-react";
import { Button, buttonVariants } from "@/Components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/Components/ui/dropdown-menu";
import { Head, router, usePage } from "@inertiajs/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/Components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/Components/ui/tooltip";
import {
  cloneElement,
  forwardRef,
  memo,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn, getCookieByName, setCookie } from "@/lib/utils";

import AppLayout from "@/Layouts/AppLayout";
import FilterTable2 from "@/Components/Table/Filter/FilterTable2";
import { FormPageDialog } from "./FormPage";
import { Label } from "@/Components/ui/label";
import NoDataImg from "@/Components/Table/NoDataImg";
import Pagination from "@/Components/Table/Pagination";
import QueryString from "qs";
import React from "react";
import { ScrollArea } from "@/Components/ui/scroll-area";
import Table2 from "@/Components/Table/Table2";
import pluralize from "pluralize";
import useDeleteModal from "@/Hooks/useDeleteModal";
import useDidMountEffect from "@/Hooks/useDidMountEffect";
import { useIsMobile } from "@/Hooks/use-mobile";
import { useLaravelReactI18n } from "laravel-react-i18n";

const DATATABLE_COLUMNS_EXPIRED = 7; //days
/**
 * @namespace DataTable
 */
/**
 * @typedef {object} CellProps
 * @property {object} dataRow
 * @property {string} valueCell
 * @callback CellCallback
 * @param {CellProps} props
 * @returns {React.JSX.Element}
 */
/**
 * @typedef {object} ActionProps
 * @property {object} dataRow
 * @callback ActionCallback
 * @param {ActionProps} props
 * @returns {React.JSX.Element}
 */
/**
 * @typedef {object} TemplateItemProps
 * @property {object} dataRow
 * @callback TemplateItemCallback
 * @param {ActionProps} props
 * @returns {React.JSX.Element}
 */
/**
 * @typedef {object} ColumnProps
 * @property {string} name Cocokan saja dengan nama column pada database
 * @property {string} titleTrans
 * @property {'text' | 'number' | 'boolean' | 'date' | string[]} searchType
 * @property {'grow' | 'fit' | string | null} width
 * @property {boolean} sortable
 * @property {boolean} resizeable
 * @property {boolean} show default is true
 * @property {string} parseTrans mirip seperti "parse", pada properti ini akan mengacu pada file locale
 * - contoh: parseTrans: "core.form.parse"
 *
 * ini akan terkonversi menjadi { true: "core.form.parse.true", false: "core.form.parse.false" } bergantung pada attribute pada kolom tersebut
 * @property {object?} parse untuk konversi value sebelum ditampilkan
 * - contoh: { true: "Enabled", false: "Disabled" }
 * - Ini dapat berdampak pada filter jika searchType berupa boolean atau string[]
 * - Ini dapat berdampak pada valueCell yang ada pada CellCallback
 * @property {CellCallback} cell
 */
/**
 * @typedef {object} ActionProps
 * @property {object} row
 */
/**
 * @typedef {object} AddButtonProps
 * @property {string} title
 * @property {React.MouseEvent} onClick
 */

/**
 * @typedef {object} props
 * @property {ColumnProps[]} columns
 * @property {ActionCallback} actions
 * @property {TemplateItemCallback} templateItem akan ditampilkan saat mode mobile
 * @property {string} title
 * @property {AddButtonProps} addButton
 */

/**
 * @type {React.ForwardRefRenderFunction<HTMLDivElement, props>}
 */
export default memo(
  forwardRef(function DataTable2(
    {
      form,
      defaultValueForm,
      classNameDialog,
      actions: _actions,
      templateItem,
    },
    ref,
  ) {
    // const lang = usePage().props.lang;
    // const route = window.route;
    const isMobile = useIsMobile();
    const { t } = useLaravelReactI18n();
    const query = usePage().props.ziggy.query;
    const { deleteItem } = useDeleteModal();
    const { data, defaultSort, dataTableColumns, translateKey, name } =
      usePage().props;
    const [options, setOptions] = useState({
      sort: query?.sort ?? defaultSort,
      f: query?.f ?? [],
      page: query?.page ?? 1,
    });
    const dialogRef = useRef();

    const actions = useCallback(
      (props) => {
        if (props.dataRow.canDelete === false) return _actions?.(props);
        return (
          <>
            <Button
              variant="destructive"
              size="icon"
              className="size-8"
              onClick={() =>
                deleteItem(
                  `${pluralize.plural(name ?? "")}.destroy`,
                  props.dataRow.id,
                )
              }
            >
              <Trash2Icon />
            </Button>
            {_actions?.(props)}
          </>
        );
      },
      [_actions, name],
    );
    // const [columns] = useState(
    //   _columns.findIndex((x) => x.name === "created_at") > -1
    //     ? _columns
    //     : [
    //         ..._columns,
    //         {
    //           name: "created_at",
    //           titleTrans: "user.user.columns.created_at",
    //           searchType: "date",
    //           width: "fit",
    //           sortable: true,
    //           show: false,
    //           cell: ({ dataRow }) => {
    //             return (
    //               <span>
    //                 {format(new TZDate(dataRow.created_at, "UTC"), "PPPp", {
    //                   locale: getLocaleDate(lang),
    //                 })}
    //               </span>
    //             );
    //           },
    //         },
    //       ],
    // );
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
                ? `${pluralize.plural(name ?? "")}.show`
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
      [name],
    );

    const [mapColumns, columns] = useMemo(() => {
      const newColumns = getColumns(t, dataTableColumns);
      return [newColumns, Object.values(newColumns)];
    }, [dataTableColumns, t]);

    const loadData = useCallback(() => {
      router.get(
        window.location.pathname + "?" + QueryString.stringify(options),
        {},
        {
          reset: ["data", "ziggy"],
          preserveScroll: true,
          preserveState: true,
          replace: true,
        },
      );
    }, [options]);
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
        loadData();
      }, 500);

      return () => clearTimeout(reloadData);
    }, [options]);
    const onApplyFilters = useCallback((filters) => {
      setOptions((prev) => {
        return { ...prev, f: filters };
      });
    }, []);
    useImperativeHandle(ref, () => ({
      addFilter(key, operator, value) {
        const filters = options.f;
        value = value.toString();
        if (
          filters.find(
            (x) => x[0] === key && x[1] === operator && x[2] === value,
          )
        )
          return;
        filters.push([key, operator, value]);
        setOptions((prev) => ({ ...prev, f: filters }));
      },
    }));
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
        path: window.location.pathname,
        sameSite: "lax",
      });
    }, []);
    const title = t(`${translateKey}.title`);
    return (
      <>
        <AppLayout>
          <Head title={title} />
          <div className="flex items-center justify-between gap-x-4">
            <h1 className="text-xl font-bold">{title}</h1>
            <div className="flex items-center gap-x-4 ">
              <div className="flex items-center gap-x-4 lg:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" className="p-2! size-fit ">
                      <Ellipsis />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <ScrollArea className="max-h-56">
                      <DropdownMenuItem onClick={loadData}>
                        <RefreshCw />
                        <span>{t("core.datatable.reload")}</span>
                      </DropdownMenuItem>
                      <FilterTable2
                        columns={mapColumns}
                        onApply={onApplyFilters}
                        initialFilters={options.f}
                        isMobile={true}
                      />
                      {isMobile && (
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            {t("core.datatable.show")}
                          </DropdownMenuSubTrigger>
                          <DropdownMenuPortal>
                            <DropdownMenuSubContent>
                              <DropdownMenuRadioGroup
                                value={`${show}`}
                                onValueChange={(val) => setShowNumber(val)}
                              >
                                {perPageOptions.map((x) => (
                                  <DropdownMenuRadioItem
                                    key={x}
                                    value={x.toString()}
                                    className="cursor-pointer"
                                    showDot={true}
                                  >
                                    {x}
                                  </DropdownMenuRadioItem>
                                ))}
                              </DropdownMenuRadioGroup>
                            </DropdownMenuSubContent>
                          </DropdownMenuPortal>
                        </DropdownMenuSub>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuLabel>Sorting</DropdownMenuLabel>
                        {columns.map(
                          ({ name, title, titleTrans, type, sortable }) => {
                            if (
                              type == "relations" ||
                              type == "mixed" ||
                              type == "json" ||
                              !sortable
                            )
                              return;

                            return (
                              <DropdownMenuSub key={name}>
                                <DropdownMenuSubTrigger
                                  className={cn(
                                    optionsSortKey == name ? "bg-accent" : "",
                                  )}
                                >
                                  {title ?? t(titleTrans)}
                                </DropdownMenuSubTrigger>
                                <DropdownMenuPortal>
                                  <DropdownMenuSubContent>
                                    <DropdownMenuRadioGroup
                                      value={`${optionsSortKey}-${optionsSortOrder}`}
                                      onValueChange={(val) =>
                                        setSort(
                                          name,
                                          val.replace(`${name}-`, ""),
                                        )
                                      }
                                    >
                                      <DropdownMenuRadioItem
                                        className="cursor-pointer"
                                        showDot={true}
                                        value={`${name}-asc`}
                                      >
                                        {t("core.datatable.sorting.ascending")}
                                      </DropdownMenuRadioItem>
                                      <DropdownMenuRadioItem
                                        className="cursor-pointer"
                                        showDot={true}
                                        value={`${name}-desc`}
                                      >
                                        {t("core.datatable.sorting.descending")}
                                      </DropdownMenuRadioItem>
                                    </DropdownMenuRadioGroup>
                                  </DropdownMenuSubContent>
                                </DropdownMenuPortal>
                              </DropdownMenuSub>
                            );
                          },
                        )}
                      </DropdownMenuGroup>
                    </ScrollArea>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="items-center hidden lg:flex gap-x-4 ">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="secondary"
                      className="p-2! size-fit "
                      onClick={loadData}
                    >
                      <RefreshCw />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {t("core.datatable.reload")}
                  </TooltipContent>
                </Tooltip>
                <div className="inline-flex overflow-hidden rounded-lg">
                  <FilterTable2
                    columns={mapColumns}
                    onApply={onApplyFilters}
                    initialFilters={options.f}
                  />
                  {Object.keys(options.f).length > 0 && (
                    <Button
                      className="py-0! h-8 px-2! rounded-l-none"
                      variant="secondary"
                      onClick={() =>
                        setOptions({
                          ...options,
                          f: [],
                        })
                      }
                    >
                      <X />
                    </Button>
                  )}
                </div>

                <div className="inline-flex overflow-hidden rounded-lg">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        className="py-0! h-8 px-2! rounded-r-none border-r  border-muted-foreground/50"
                        variant="secondary"
                        onClick={() => setSort(optionsSortKey)}
                      >
                        {optionsSortOrder == "asc" ? (
                          <ArrowUpNarrowWide />
                        ) : (
                          <ArrowDownWideNarrow />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent align="center" side="bottom">
                      {optionsSortOrder == "asc"
                        ? t("core.datatable.sorting.ascending")
                        : t("core.datatable.sorting.descending")}
                    </TooltipContent>
                  </Tooltip>
                  <Select
                    value={optionsSortKey}
                    onValueChange={(val) => setSort(val, optionsSortOrder)}
                  >
                    <SelectTrigger
                      className={cn(
                        buttonVariants({
                          variant: "secondary",
                          size: "default",
                        }),
                        "flex-1 py-0! h-8 px-2! border-none! rounded-l-none ring-0!",
                      )}
                    >
                      <SelectValue placeholder="Sort By" />
                    </SelectTrigger>
                    <SelectContent>
                      {columns
                        .filter((x) => x.sortable)
                        .map((column) => {
                          if (
                            column.type == "relations" ||
                            column.type == "mixed" ||
                            column.type == "json" ||
                            !column.sortable
                          )
                            return;

                          return (
                            <SelectItem key={column.name} value={column.name}>
                              {column.title ?? t(column.titleTrans)}
                            </SelectItem>
                          );
                        })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {form && (
                <Button
                  className="p-2! size- fit h-8"
                  onClick={() => dialogRef?.current?.open()}
                >
                  <Plus />
                  {t(`${translateKey}.add`)}
                </Button>
              )}
            </div>
          </div>
          <div className="flex flex-col flex-1 max-w-full mt-4 border rounded-lg border-muted-foreground/25">
            {isMobile ? (
              <div className="flex flex-col flex-1">
                {data?.data && data.data.length > 0 ? (
                  data.data.map((x) => {
                    const item = templateItem?.({ dataRow: x });
                    if (!item) return null;
                    return cloneElement(item, { key: x.id, ...item.props });
                  })
                ) : (
                  <NoDataImg className="self-center w-full max-w-sm" />
                )}
              </div>
            ) : (
              <Table2
                reload={loadData}
                className="flex-1"
                actions={actions}
                columns={mapColumns}
                data={data.data}
                totalPages={data.total}
                options={options}
                setSort={setSort}
                resetSorting={resetSorting}
                onOptionsChanged={setOptions}
              />
            )}
            <div
              className={cn(
                !isMobile || Math.floor(data.total / show) + 1 > 1
                  ? "flex"
                  : "hidden",
                " justify-between px-4 py-4 border-t border-muted-foreground/25 gap-x-4",
              )}
            >
              {!isMobile && (
                <div className="flex items-center gap-x-2">
                  <Label>{t("core.datatable.show")}</Label>
                  <Select
                    value={`${show}`}
                    onValueChange={(e) => setShowNumber(e)}
                  >
                    <SelectTrigger className="w-fit! gap-x-2">
                      <SelectValue placeholder="Show"></SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {perPageOptions.map((x) => (
                        <SelectItem key={x} value={x.toString()}>
                          {x}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Pagination
                currentPage={options.page}
                totalPages={Math.floor(data.total / show) + 1}
                onPageChanged={(page) => setOptions({ ...options, page })}
                className="justify-end"
              />
            </div>
          </div>
        </AppLayout>
        {form && (
          <FormPageDialog
            ref={dialogRef}
            title={t(`${translateKey}.new`)}
            className={classNameDialog}
            defaultValue={defaultValueForm}
            name={name}
          >
            {form}
          </FormPageDialog>
        )}
      </>
    );
  }),
);
