import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/Components/ui/dialog";
import { useMemo, useRef, useState } from "react";
import DataTable from "@/Pages/Core/DataTable";
import FormInput from "@/Components/FormInput";
import { Input } from "@/Components/ui/input";
import Link from "@/Components/Link";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { cn, getLocaleDate } from "@/lib/utils";
import { router } from "@inertiajs/react";
import { useDraftForm } from "@/Hooks/useDraftForm";
import { FormPageDialog } from "@/Pages/Core/FormPage";
import Form from "./Form";

function Index({ lang }) {
  const route = window.route;
  const { t } = useLaravelReactI18n();
  const tableRef = useRef();
  const [showNewForm, setShowNewForm] = useState(false);
  const { data, setData, post, processing, errors, isDirty } = useDraftForm(
    "supplier",
    {},
    {
      onContinueDraft: () => {
        setShowNewForm(true);
      },
    },
  );
  const onSubmit = (e) => {
    e.preventDefault();

    post(route("suppliers.store"));
  };

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
            setShowNewForm(true);
          },
        }}
        columns={columns}
      />
      <FormPageDialog
        title={t("purchase.supplier.new")}
        disabled={processing}
        errors={errors}
        onSubmit={onSubmit}
        open={showNewForm}
        onOpenChange={setShowNewForm}
        className="max-w-lg"
      >
        <Form data={data} setData={setData} />
      </FormPageDialog>
    </>
  );
}
export default Index;
