import { cn, getLocaleDate } from "@/lib/utils";
import { useMemo, useRef } from "react";

import DataTable from "@/Pages/Core/DataTable";
import Link from "@/Components/Link";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { router } from "@inertiajs/react";
import { useLaravelReactI18n } from "laravel-react-i18n";

// eslint-disable-next-line jsdoc/require-jsdoc
export default function Index({ data, sort, show, lang }) {
  const route = window.route;
  const { t } = useLaravelReactI18n();
  const tableRef = useRef();
  /**
   * @typedef {import('@/Pages/Core/DataTable').ColumnProps} ColumnProps
   * @type {ColumnProps[]}
   */
  const columns = useMemo(
    () => [
      {
        name: "name",
        titleTrans: "user.role.columns.name",
        searchType: "text",
        sortable: true,
        resizeable: true,
        cell: ({ dataRow }) => (
          <Link
            className="hover:underline"
            href={route("roles.show", dataRow.id)}
          >
            {dataRow.name}
          </Link>
        ),
      },
      {
        name: "is_disabled",
        titleTrans: "user.role.columns.is_disabled",
        width: "fit",
        sortable: true,
        searchType: "boolean",
        parse: {
          true: "Disabled",
          false: "Enabled",
        },
        cell: ({ dataRow, valueCell }) => {
          return (
            <button
              className={cn(
                dataRow.is_disabled ? "error" : "primary",
                "capitalize badge w-fit",
              )}
              type="button"
              onClick={() => {
                tableRef.current.addFilter(
                  "is_disabled",
                  "eq",
                  dataRow.is_disabled,
                );
              }}
            >
              {valueCell}
            </button>
          );
        },
      },
      {
        name: "created_at",
        titleTrans: "user.role.columns.created_at",
        searchType: "date",
        width: "fit",
        sortable: true,
        cell: ({ dataRow }) => {
          return (
            <span>
              {format(new TZDate(dataRow.created_at, "UTC"), "PPPp", {
                locale: getLocaleDate(lang),
              })}
            </span>
          );
        },
      },
    ],
    [lang],
  );
  return (
    <DataTable
      ref={tableRef}
      title={t("user.role.title")}
      addButton={{
        title: t("user.role.add_role"),
        onClick: () => {
          router.visit(route("roles.create"));
        },
      }}
      templateItem={({ dataRow }) => (
        <Link
          as="button"
          href={route("roles.show", dataRow.id)}
          className="flex items-center p-4 border-b gap-x-4 border-muted-foreground/25"
        >
          <p className="text-base font-medium text-left">{dataRow.name}</p>
          <p
            className={cn(
              dataRow.is_disabled ? "error" : "primary",
              "text-left badge",
            )}
          >
            {dataRow.is_disabled ? "Disabled" : "Enabled"}
          </p>
        </Link>
      )}
      data={data}
      defaultSort={sort}
      defaultShow={show}
      columns={columns}
    />
  );
}
