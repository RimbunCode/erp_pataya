import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/Components/ui/alert-dialog";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/Components/ui/button";
import DataTable from "@/Pages/Core/DataTable";
import Form from "./Form";
import { FormPageDialog } from "@/Pages/Core/FormPage";
import Link from "@/Components/Link";
import { Trash2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { router } from "@inertiajs/react";
import { useDraftForm } from "@/Hooks/useDraftForm";
import { useLaravelReactI18n } from "laravel-react-i18n";

// eslint-disable-next-line jsdoc/require-jsdoc
export default function Index({ lang }) {
  const route = window.route;
  const { t } = useLaravelReactI18n();
  const tableRef = useRef();
  const [showNewForm, setShowNewForm] = useState(false);
  const [idDelete, setIdDelete] = useState(null);
  const { data, setData, post, processing, errors } = useDraftForm(
    "warehouse",
    {},
    {
      onContinueDraft: () => {
        setShowNewForm(true);
      },
    },
  );
  useEffect(() => {
    if (!showNewForm) {
      setData({});
    }
  });
  const onSubmit = (e) => {
    e.preventDefault();

    post(route("warehouses.store"));
  };
  const onDelete = (id) => {
    router.delete(route("warehouses.destroy", id), {
      onSuccess: () => {
        setIdDelete(null);
      },
    });
  };
  /**
   * @typedef {import('@/Pages/Core/DataTable').ColumnProps} ColumnProps
   * @type {ColumnProps[]}
   */
  const columns = useMemo(
    () => [
      {
        name: "code",
        titleTrans: "inventory.warehouse.columns.code",
        searchType: "text",
        sortable: true,
        resizeable: true,
        cell: ({ dataRow }) => (
          <Link
            className="hover:underline"
            href={route("warehouses.show", dataRow.id)}
          >
            {dataRow.code}
          </Link>
        ),
      },
      {
        name: "name",
        titleTrans: "inventory.warehouse.columns.name",
        searchType: "text",
        sortable: true,
        resizeable: true,
        cell: ({ dataRow }) => (
          <Link
            className="hover:underline"
            href={route("warehouses.show", dataRow.id)}
          >
            {dataRow.name}
          </Link>
        ),
      },
      {
        name: "branch_id",
        titleTrans: "inventory.warehouse.columns.branch",
        searchType: "text",
        sortable: true,
        resizeable: true,
        cell: ({ dataRow }) => (
          <button
            className={cn("w-fit hover:underline")}
            type="button"
            onClick={() => {
              tableRef.current.addFilter("branch_id", "eq", dataRow.branch_id);
            }}
          >
            {dataRow.branch_name}
          </button>
        ),
      },
    ],
    [lang],
  );
  return (
    <>
      <DataTable
        ref={tableRef}
        title={t("inventory.warehouse.title")}
        addButton={{
          title: t("inventory.warehouse.add_warehouse"),
          onClick: () => {
            setShowNewForm(true);
          },
        }}
        actions={({ dataRow }) => {
          return (
            <Button
              variant="destructive"
              size="icon"
              className="size-8"
              onClick={() => setIdDelete(dataRow.id)}
            >
              <Trash2Icon />
            </Button>
          );
        }}
        templateItem={({ dataRow }) => (
          <div className="flex items-center justify-between p-4 border-b gap-x-4 border-muted-foreground/25">
            <Link
              as="button"
              href={route("warehouses.show", dataRow.id)}
              className=""
            >
              <p className="text-base font-medium text-left text-muted-foreground">
                {dataRow.branch_name}
              </p>
              <p className="text-base font-medium text-left">
                ({dataRow.code}) {dataRow.name}
              </p>
            </Link>
            <Button
              variant="destructive"
              size="icon"
              className="size-8"
              onClick={() => setIdDelete(dataRow.id)}
            >
              <Trash2Icon />
            </Button>
          </div>
        )}
        columns={columns}
      />
      <FormPageDialog
        title={t("inventory.warehouse.new")}
        disabled={processing}
        errors={errors}
        onSubmit={onSubmit}
        open={showNewForm}
        onOpenChange={setShowNewForm}
        className="max-w-lg"
      >
        <Form data={data} setData={setData} />
      </FormPageDialog>

      <AlertDialog
        open={idDelete}
        onOpenChange={(v) => {
          if (!v) {
            setIdDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("inventory.warehouse.delete")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("inventory.warehouse.delete.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={processing}
              onClick={() => setIdDelete(null)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={processing}
              onClick={() => {
                onDelete(idDelete);
              }}
            >
              {t("inventory.warehouse.delete.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
