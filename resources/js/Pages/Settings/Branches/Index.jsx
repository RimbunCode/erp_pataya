import { cn, getLocaleDate } from "@/lib/utils";
import { useMemo, useRef, useState } from "react";

import DataTable from "@/Pages/Core/DataTable";
import Link from "@/Components/Link";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { Dialog, DialogContent } from "@/Components/ui/dialog";

// eslint-disable-next-line jsdoc/require-jsdoc
export default function Index({ lang }) {
  const route = window.route;
  const { t } = useLaravelReactI18n();
  const tableRef = useRef();
  const [showNewForm, setShowNewForm] = useState(false);
  /**
   * @typedef {import('@/Pages/Core/DataTable').ColumnProps} ColumnProps
   * @type {ColumnProps[]}
   */
  const columns = useMemo(
    () => [
      {
        titleTrans: "core.branch.columns.name",
        name: "name",
        searchType: "text",
        sortable: true,
        resizeable: true,
        cell: ({ dataRow }) => (
          <Link
            className="hover:underline"
            href={route("branches.show", dataRow.id)}
          >
            {dataRow.name}
          </Link>
        ),
      },
      {
        titleTrans: "core.branch.columns.email",
        name: "email",
        searchType: "text",
        sortable: true,
        resizeable: true,
        show: false,
      },
      {
        titleTrans: "core.branch.columns.phone",
        name: "phone",
        searchType: "text",
        sortable: true,
        resizeable: true,
        show: false,
      },
      {
        titleTrans: "core.branch.columns.address",
        name: "billing_address",
        sortable: false,
        resizeable: true,
        show: true,
        cell: ({ dataRow }) => {
          return (
            <span>
              {dataRow.shipping_street}, {dataRow.shipping_city},{" "}
              {dataRow.shipping_state}, {dataRow.shipping_zip_code},{" "}
              {dataRow.shipping_country.name}
            </span>
          );
        },
      },
      {
        titleTrans: "core.branch.columns.street",
        name: "billing_street",
        searchType: "text",
        sortable: true,
        resizeable: true,
        show: false,
      },
      {
        titleTrans: "core.branch.columns.city",
        name: "billing_city",
        searchType: "text",
        sortable: true,
        resizeable: true,
        show: false,
      },
      {
        titleTrans: "core.branch.columns.state",
        name: "billing_state",
        searchType: "text",
        sortable: true,
        resizeable: true,
        show: false,
      },
      {
        titleTrans: "core.branch.columns.zip_code",
        name: "billing_zip_code",
        searchType: "text",
        sortable: true,
        resizeable: true,
        show: false,
      },
      {
        titleTrans: "core.branch.columns.country",
        name: "billing_country",
        searchType: "text",
        sortable: true,
        resizeable: true,
        show: false,
      },
      {
        name: "is_disabled",
        width: "fit",
        titleTrans: "core.branch.columns.is_disabled",
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
        titleTrans: "core.branch.columns.created_at",
        searchType: "date",
        width: "fit",
        sortable: true,
        show: false,
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
    <Dialog open={showNewForm} onOpenChange={setShowNewForm}>
      <DataTable
        title={t("core.branch.title")}
        addButton={{
          title: t("core.branch.add_branch"),
          onClick: () => {
            setShowNewForm(true);
          },
        }}
        templateItem={({ dataRow }) => (
          <Link
            as="button"
            href={route("branches.show", dataRow.id)}
            className="items-center block p-4 border-b border-muted-foreground/25"
          >
            <p className="flex items-center font-semibold text-left">
              {dataRow.name}
              {dataRow.is_main_branch && (
                <span className="py-1 ml-4 text-xs badge primary">
                  {t("core.branch.columns.is_main_branch")}
                </span>
              )}
            </p>
            <p className="text-sm text-left text-muted-foreground">
              {dataRow.shipping_street}, {dataRow.shipping_city},{" "}
              {dataRow.shipping_state}, {dataRow.shipping_zip_code},{" "}
              {dataRow.shipping_country.name}
            </p>
          </Link>
        )}
        columns={columns}
      />
      <DialogContent className="w-fit"></DialogContent>
    </Dialog>
  );
}
