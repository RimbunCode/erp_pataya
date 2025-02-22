import { cn, getLocaleDate } from "@/lib/utils";
import { useMemo, useRef } from "react";

import DataTable from "@/Pages/Core/DataTable";
import Link from "@/Components/Link";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Index({ lang }) {
  const route = window.route;
  const { t, loading } = useLaravelReactI18n();
  const tableRef = useRef();
  const columns = useMemo(
    () => [
      {
        title: t("core.branch.columns.name"),
        name: "name",
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
        title: t("core.branch.columns.email"),
        name: "email",
        searchType: "text",
        sortable: true,
        resizeable: true,
        show: false,
      },
      {
        title: t("core.branch.columns.phone"),
        name: "phone",
        searchType: "text",
        sortable: true,
        resizeable: true,
        show: false,
      },
      {
        title: t("core.branch.columns.billing_address"),
        name: "billing_address",
        sortable: false,
        resizeable: true,
        show: true,
        cell: ({ dataRow }) => {
          return (
            <span>
              {dataRow.billing_street}, {dataRow.billing_city},{" "}
              {dataRow.billing_state}, {dataRow.billing_zip},{" "}
              {dataRow.billing_country}
            </span>
          );
        },
      },
      {
        title: t("core.branch.columns.shipping_address"),
        name: "shipping_address",
        sortable: false,
        resizeable: true,
        show: true,
        cell: ({ dataRow }) => {
          return (
            <span>
              {dataRow.shipping_street}, {dataRow.shipping_city},{" "}
              {dataRow.shipping_state}, {dataRow.shipping_zip},{" "}
              {dataRow.shipping_country}
            </span>
          );
        },
      },
      {
        title: t("core.branch.columns.billing_street"),
        name: "billing_street",
        searchType: "text",
        sortable: true,
        resizeable: true,
        show: false,
      },
      {
        title: t("core.branch.columns.billing_city"),
        name: "billing_city",
        searchType: "text",
        sortable: true,
        resizeable: true,
        show: false,
      },
      {
        title: t("core.branch.columns.billing_state"),
        name: "billing_state",
        searchType: "text",
        sortable: true,
        resizeable: true,
        show: false,
      },
      {
        title: t("core.branch.columns.billing_zip"),
        name: "billing_zip",
        searchType: "text",
        sortable: true,
        resizeable: true,
        show: false,
      },
      {
        title: t("core.branch.columns.billing_country"),
        name: "billing_country",
        searchType: "text",
        sortable: true,
        resizeable: true,
        show: false,
      },
      {
        title: t("core.branch.columns.shipping_street"),
        name: "shipping_street",
        searchType: "text",
        sortable: true,
        resizeable: true,
        show: false,
      },
      {
        title: t("core.branch.columns.shipping_city"),
        name: "shipping_city",
        searchType: "text",
        sortable: true,
        resizeable: true,
        show: false,
      },
      {
        title: t("core.branch.columns.shipping_state"),
        name: "shipping_state",
        searchType: "text",
        sortable: true,
        resizeable: true,
        show: false,
      },
      {
        title: t("core.branch.columns.shipping_zip"),
        name: "shipping_zip",
        searchType: "text",
        sortable: true,
        resizeable: true,
        show: false,
      },
      {
        title: t("core.branch.columns.shipping_country"),
        name: "shipping_country",
        searchType: "text",
        sortable: true,
        resizeable: true,
        show: false,
      },
      {
        name: "is_disabled",
        width: "fit",
        title: t("core.branch.columns.is_disabled"),
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
        title: "Created at",
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
    [lang, loading],
  );
  return (
    <DataTable
      title={t("core.branch.title")}
      buttonAdd={{
        title: "Add Branch",
        onClick: () => {
          // setOpenNewUser(true);
        },
      }}
      columns={columns}
    />
  );
}
