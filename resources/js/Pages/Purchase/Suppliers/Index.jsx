/* eslint-disable jsdoc/require-jsdoc */
import { useMemo, useRef, useState } from "react";

import DataTable from "@/Pages/Core/DataTable";
import Form from "./Form";
import { FormPageDialog } from "@/Pages/Core/FormPage";
import Link from "@/Components/Link";
import { cn } from "@/lib/utils";
import { useLaravelReactI18n } from "laravel-react-i18n";

function Index({ lang }) {
  const route = window.route;
  const { t } = useLaravelReactI18n();
  const tableRef = useRef();
  const [showNewForm, setShowNewForm] = useState(false);

  const columns = useMemo(
    () => [
      {
        name: "name",
        titleTrans: "purchase.supplier.columns.name",
        searchType: "text",
        sortable: true,
        resizeable: true,
        show: true,
        cell: ({ dataRow }) => (
          <Link
            as="button"
            href={route("suppliers.show", dataRow.id)}
            className="items-center block p-4 border-b border-muted-foreground/25"
          >
            {dataRow.name}
          </Link>
        ),
      },
      {
        name: "email",
        titleTrans: "purchase.supplier.columns.email",
        searchType: "text",
        sortable: true,
        resizeable: true,
        show: true,
      },
      {
        name: "phone",
        titleTrans: "purchase.supplier.columns.phone",
        searchType: "text",
        sortable: true,
        resizeable: true,
        show: true,
      },
      {
        name: "street",
        titleTrans: "purchase.supplier.columns.street",
        searchType: "text",
        sortable: true,
        resizeable: true,
        show: true,
      },
      {
        name: "is_disabled",
        titleTrans: "purchase.supplier.columns.is_disabled",
        width: "fit",
        sortable: true,
        show: true,
        searchType: "boolean",
        parse: {
          false: "Active",
          true: "Inactive",
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
    ],
    [lang],
  );
  return (
    <>
      <DataTable
        ref={tableRef}
        title={t("purchase.supplier.title")}
        addButton={{
          title: t("purchase.supplier.addButton"),
          onClick: () => {
            // router.visit(route("suppliers.create"));
            setShowNewForm(true);
          },
        }}
        columns={columns}
      />
      <FormPageDialog
        title={t("purchase.supplier.new")}
        name="supplier"
        open={showNewForm}
        onOpenChange={setShowNewForm}
        className="max-w-2xl"
      >
        <Form />
      </FormPageDialog>
    </>
  );
}
export default Index;
