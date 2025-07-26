import { cn, getLocaleDate } from "@/lib/utils";
import { useMemo, useRef, useState } from "react";

import DataTable from "@/Pages/Core/DataTable";
import Form from "./Form";
import { FormPageDialog } from "@/Pages/Core/FormPage";
import Link from "@/Components/Link";
import React from "react";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { useLaravelReactI18n } from "laravel-react-i18n";

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
        titleTrans: "service.workOrder.columns.code",
        name: "code",
        searchType: "text",
        sortable: true,
        resizeable: true,
        cell: ({ dataRow }) => (
          <Link
            className="hover:underline"
            href={route("workOrders.show", dataRow.id)}
          >
            {dataRow.code}
          </Link>
        ),
      },
      {
        titleTrans: "service.workOrder.columns.date",
        name: "date",
        searchType: "date",
        sortable: true,
        resizeable: true,
        cell: ({ dataRow }) => {
          return (
            <span>
              {format(new TZDate(dataRow.created_at, "UTC"), "PPP", {
                locale: getLocaleDate(lang),
              })}
            </span>
          );
        },
      },
      {
        titleTrans: "service.workOrder.columns.customer",
        name: "customer_name",
        searchType: "text",
        sortable: true,
        resizeable: true,
        cell: ({ dataRow }) => (
          <button
            type="button"
            className="text-left hover:underline"
            onClick={() => {
              tableRef.current.addFilter(
                "customer_name",
                "eq",
                dataRow.customer_name,
              );
            }}
          >
            {dataRow.customer_name}
          </button>
        ),
      },
      {
        titleTrans: "service.workOrder.columns.item_service",
        name: "item_service_name",
        searchType: "text",
        sortable: true,
        resizeable: true,
      },
      {
        titleTrans: "service.workOrder.columns.status",
        name: "status",
        searchType: "text",
        sortable: true,
        width: "fit",
        resizeable: true,
        cell: ({ dataRow }) => {
          let status = dataRow.status.toString().toLocaleUpperCase();
          let theme = "";
          switch (dataRow.status) {
            case "draft":
              theme = "secondary";
              break;
            case "submitted":
              theme = "primary";
              break;
            case "cancelled":
              theme = "error";
              break;
          }
          return (
            <span className={cn("badge text-center", theme)}>{status}</span>
          );
        },
      },
    ],
    [lang],
  );
  return (
    <>
      <DataTable
        ref={tableRef}
        title={t("service.workOrder.title")}
        addButton={{
          title: t("service.workOrder.add_work_order"),
          onClick: () => {
            setShowNewForm(true);
          },
        }}
        templateItem={({ dataRow }) => (
          <div className="flex items-center justify-between p-4 border-b gap-x-4 border-muted-foreground/25">
            <Link
              as="button"
              href={route("workOrders.show", dataRow.id)}
              className=""
            >
              <p className="text-base font-medium text-left text-muted-foreground">
                {t(`service.workOrder.types.${dataRow.type}`)}
              </p>
              <p className="text-base font-medium text-left">{dataRow.name}</p>
            </Link>
          </div>
        )}
        columns={columns}
      />
      <FormPageDialog
        title={t("service.workOrder.new")}
        open={showNewForm}
        onOpenChange={setShowNewForm}
        className="max-w-screen-lg"
        name="workOrder"
      >
        <Form />
      </FormPageDialog>
    </>
  );
}
