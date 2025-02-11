import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Ellipsis,
  Plus,
  RefreshCw,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/Components/ui/select";
import { forwardRef, useCallback, useImperativeHandle, useState } from "react";
import { router, usePage } from "@inertiajs/react";

import AppLayout from "@/Layouts/AppLayout";
import FilterTable from "@/Components/Table/FilterTable";
import React from "react";
import Table from "@/Components/Table/Table";
import { cn } from "@/lib/utils";
import useDidMountEffect from "@/Hooks/useDidMountEffect";

export default forwardRef(function DataTable(
  { data, defaultSort, columns, actions, title, buttonAdd },
  ref,
) {
  const route = window.route;
  const query = usePage().props.ziggy.query;
  const [options, setOptions] = useState({
    sort: query?.sort ?? defaultSort,
    f: query?.f ?? [],
    page: query?.page ?? 1,
  });

  const loadData = () => {
    router.get(route(route().current()), options, {
      reset: ["data", "ziggy"],
      preserveScroll: true,
      preserveState: true,
      replace: true,
    });
  };
  const optionsSort = (options.sort ?? "").split("-");
  const optionsSortKey = optionsSort[optionsSort.length - 1];
  const optionsSortOrder = optionsSort[0] === optionsSortKey ? "asc" : "desc";

  const resetSorting = () => {
    setOptions({
      ...options,
      sort: defaultSort,
    });
  };
  const setSort = useCallback(
    (name, sort) => {
      const order =
        sort ??
        (optionsSortKey == name && optionsSortOrder == "asc" ? "desc" : "asc");

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
  const onApplyFilters = (filters) => {
    setOptions((prev) => {
      return { ...prev, f: filters };
    });
  };
  useImperativeHandle(ref, () => ({
    addFilter(key, operator, value) {
      const filters = options.f;
      if (
        filters.find((x) => x[0] === key && x[1] === operator && x[2] === value)
      )
        return;
      filters.push([key, operator, value]);
      setOptions((prev) => ({ ...prev, f: filters }));
    },
  }));

  return (
    <AppLayout>
      <div className="flex items-center justify-between gap-x-4">
        <h1 className="text-xl font-bold">{title}</h1>
        <div className="flex items-center gap-x-4 ">
          <div className="flex items-center gap-x-4 lg:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" className="!p-2 size-fit ">
                  <Ellipsis />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>
                  <RefreshCw />
                  <span>Refresh</span>
                </DropdownMenuItem>
                <FilterTable
                  columns={columns}
                  onApply={onApplyFilters}
                  initialFilters={options.f}
                  isMobile={true}
                />
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Sorting</DropdownMenuLabel>
                  {columns
                    .filter((x) => x.sortable)
                    .map(({ name, title }) => (
                      <DropdownMenuSub key={name}>
                        <DropdownMenuSubTrigger
                          className={cn(
                            optionsSortKey == name ? "bg-accent" : "",
                          )}
                        >
                          {title}
                        </DropdownMenuSubTrigger>
                        <DropdownMenuPortal>
                          <DropdownMenuSubContent>
                            <DropdownMenuRadioGroup
                              value={`${optionsSortKey}-${optionsSortOrder}`}
                              onValueChange={(val) =>
                                setSort(name, val.replace(`${name}-`, ""))
                              }
                            >
                              <DropdownMenuRadioItem
                                className="cursor-pointer"
                                showDot={true}
                                value={`${name}-asc`}
                              >
                                Ascending
                              </DropdownMenuRadioItem>
                              <DropdownMenuRadioItem
                                className="cursor-pointer"
                                showDot={true}
                                value={`${name}-desc`}
                              >
                                Descending
                              </DropdownMenuRadioItem>
                            </DropdownMenuRadioGroup>
                          </DropdownMenuSubContent>
                        </DropdownMenuPortal>
                      </DropdownMenuSub>
                    ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="items-center hidden lg:flex gap-x-4 ">
            <Button
              variant="secondary"
              className="!p-2 size-fit "
              onClick={loadData}
            >
              <RefreshCw />
            </Button>
            <div className="inline-flex overflow-hidden rounded-lg">
              <FilterTable
                columns={columns}
                onApply={onApplyFilters}
                initialFilters={options.f}
              />
              <Button
                className="!py-0 h-8 !px-2 rounded-l-none"
                variant="secondary"
                onClick={() => setOptions({ ...options, f: {} })}
              >
                <X />
              </Button>
            </div>

            <div className="inline-flex overflow-hidden rounded-lg">
              <Button
                className="!py-0 h-8 !px-2 rounded-r-none border-r  border-muted-foreground/50"
                variant="secondary"
                onClick={() => setSort(optionsSortKey)}
              >
                {optionsSortOrder == "asc" ? (
                  <ArrowUpNarrowWide />
                ) : (
                  <ArrowDownWideNarrow />
                )}
              </Button>
              <Select
                value={optionsSortKey}
                onValueChange={(val) => setSort(val, optionsSortOrder)}
              >
                <SelectTrigger
                  className={cn(
                    buttonVariants({ variant: "secondary", size: "default" }),
                    "flex-1 !py-0 h-8 !px-2 !border-none rounded-l-none !ring-0",
                  )}
                >
                  <SelectValue placeholder="Sort By" />
                </SelectTrigger>
                <SelectContent>
                  {columns
                    .filter((x) => x.sortable)
                    .map((column) => (
                      <SelectItem key={column.name} value={column.name}>
                        {column.title}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {buttonAdd?.title && (
            <Button className="!p-2 size- fit h-8" onClick={buttonAdd.onClick}>
              <Plus />
              {buttonAdd.title}
            </Button>
          )}
        </div>
      </div>
      <div className="flex flex-col flex-1 max-w-full mt-4 border rounded-lg border-muted-foreground/25">
        <Table
          reload={loadData}
          className="flex-1"
          actions={actions}
          columns={columns}
          data={data.data}
          totalPages={data.total}
          options={options}
          setSort={setSort}
          resetSorting={resetSorting}
          onOptionsChanged={(opt) => {
            setOptions(opt);
          }}
        />
      </div>
    </AppLayout>
  );
});
