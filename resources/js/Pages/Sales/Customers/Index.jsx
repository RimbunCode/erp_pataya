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
        titleTrans: "sales.customer.columns.name",
        searchType: "text",
        sortable: true,
        resizeable: true,
        show: true,
        cell: ({ dataRow }) => (
          <Link
            href={route("customers.show", dataRow.id)}
            className="hover:underline"
          >
            {dataRow.name}
          </Link>
        ),
      },
      {
        name: "email",
        titleTrans: "sales.customer.columns.email",
        searchType: "text",
        sortable: true,
        resizeable: true,
        show: true,
      },
      {
        name: "phone",
        titleTrans: "sales.customer.columns.phone",
        searchType: "text",
        sortable: true,
        resizeable: true,
        show: true,
      },
      {
        name: "vat",
        titleTrans: "sales.customer.columns.vat",
        searchType: "text",
        sortable: true,
        resizeable: true,
        show: false,
      },

      {
        name: "street",
        titleTrans: "sales.customer.columns.street",
        searchType: "text",
        sortable: true,
        resizeable: true,
        show: false,
      },
      {
        name: "is_disabled",
        titleTrans: "sales.customer.columns.is_disabled",
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
        title={t("sales.customer.title")}
        addButton={{
          title: t("sales.customer.addButton"),
          onClick: () => {
            // router.visit(route("suppliers.create"));
            setShowNewForm(true);
          },
        }}
        columns={columns}
      />
      <FormPageDialog
        title={t("sales.customer.new")}
        name="customer"
        open={showNewForm}
        onOpenChange={setShowNewForm}
        className="max-w-(--breakpoint-lg)"
      >
        <Form />
      </FormPageDialog>
    </>
  );
}
export default Index;
