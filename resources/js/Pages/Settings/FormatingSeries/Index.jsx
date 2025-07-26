import DataTable from "@/Pages/Core/DataTable";
import Link from "@/Components/Link";
import React from "react";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { useMemo } from "react";

export default function Index({ lang }) {
  const route = window.route;
  const { t } = useLaravelReactI18n();
  /**
   * @typedef {import('@/Pages/Core/DataTable').ColumnProps} ColumnProps
   * @type {ColumnProps[]}
   */
  const columns = useMemo(
    () => [
      {
        titleTrans: "core.formatingSeries.columns.model",
        name: "name",
        searchType: "text",
        sortable: true,
        resizeable: true,
        cell: ({ dataRow }) => (
          <Link
            className="hover:underline"
            href={route("formatingSeries.show", dataRow.id)}
          >
            {dataRow.name}
          </Link>
        ),
      },
      {
        titleTrans: "core.formatingSeries.columns.format",
        name: "format",
        searchType: "text",
        sortable: true,
        resizeable: true,
        show: true,
        cell: ({ dataRow }) => (
          <p>{dataRow.format.replace(/@\[(.*?)\]/g, "{$1}")}</p>
        ),
      },
    ],
    [lang],
  );
  return (
    <>
      <DataTable
        title={t("core.formatingSeries.title")}
        templateItem={({ dataRow }) => (
          <Link
            as="button"
            href={route("formatingSeries.show", dataRow.id)}
            className="items-center block p-4 border-b border-muted-foreground/25"
          >
            <p className="flex items-center font-semibold text-left">
              {dataRow.name}
              {dataRow.is_main_branch && (
                <span className="py-1 ml-4 text-xs badge primary">
                  {t("core.formatingSeries.columns.is_main_branch")}
                </span>
              )}
            </p>
            <p className="text-sm text-left text-muted-foreground">
              {dataRow.shipping_street}, {dataRow.shipping_city},{" "}
              {dataRow.shipping_state}, {dataRow.shipping_zip_code},{" "}
              {dataRow.shipping_country?.name}
            </p>
          </Link>
        )}
        columns={columns}
      />
    </>
  );
}
