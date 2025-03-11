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
import { useMemo, useRef, useState } from "react";

import { Button } from "@/Components/ui/button";
import DataTable from "@/Pages/Core/DataTable";
import Form from "./Form";
import { FormPageDialog } from "@/Pages/Core/FormPage";
import Link from "@/Components/Link";
import { Trash2Icon } from "lucide-react";
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
    "unit",
    {},
    {
      onContinueDraft: () => {
        setShowNewForm(true);
      },
    },
  );
  const onSubmit = (e) => {
    e.preventDefault();

    post(route("units.store"));
  };
  const onDelete = (id) => {
    router.delete(route("units.destroy", id), {
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
        titleTrans: "inventory.unit.columns.code",
        name: "code",
        searchType: "text",
        width: "fit",
        sortable: true,
        resizeable: true,
        cell: ({ dataRow }) => (
          <Link
            className="hover:underline"
            href={route("units.show", dataRow.id)}
          >
            {dataRow.code}
          </Link>
        ),
      },
      {
        titleTrans: "inventory.unit.columns.name",
        name: "name",
        searchType: "text",
        sortable: true,
        resizeable: true,
        cell: ({ dataRow }) => (
          <Link
            className="hover:underline"
            href={route("units.show", dataRow.id)}
          >
            {dataRow.name}
          </Link>
        ),
      },
      {
        titleTrans: "inventory.unit.columns.group",
        name: "group",
        searchType: "text",
        sortable: true,
        resizeable: true,
        cell: ({ dataRow }) => (
          <button
            type="button"
            className="text-left hover:underline"
            onClick={() => {
              tableRef.current.addFilter("group", "eq", dataRow.group);
            }}
          >
            {dataRow.group}
          </button>
        ),
      },
      {
        titleTrans: "inventory.unit.columns.conversion_factor",
        name: "conversion_factor",
        searchType: "text",
        sortable: false,
        resizeable: true,
      },
    ],
    [lang],
  );
  return (
    <>
      <DataTable
        ref={tableRef}
        actions={({ dataRow }) => {
          if (dataRow.is_default) return null;
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
        title={t("inventory.unit.title")}
        addButton={{
          title: t("inventory.unit.add_unit"),
          onClick: () => {
            setShowNewForm(true);
          },
        }}
        templateItem={({ dataRow }) => (
          <div className="flex items-center justify-between p-4 border-b gap-x-4 border-muted-foreground/25">
            <Link
              as="button"
              href={route("units.show", dataRow.id)}
              className=""
            >
              <p className="text-base font-medium text-left text-muted-foreground">
                {dataRow.group}
              </p>
              <p className="text-base font-medium text-left">
                {dataRow.name} ({dataRow.code})
              </p>
            </Link>
            {!dataRow.is_default && (
              <Button
                variant="destructive"
                size="icon"
                className="size-8"
                onClick={() => setIdDelete(dataRow.id)}
              >
                <Trash2Icon />
              </Button>
            )}
          </div>
        )}
        columns={columns}
      />
      <FormPageDialog
        title={t("inventory.unit.new")}
        disabled={processing}
        errors={errors}
        onSubmit={onSubmit}
        open={showNewForm}
        onOpenChange={setShowNewForm}
        setData={setData}
        className="max-w-xl"
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
            <AlertDialogTitle>{t("inventory.unit.delete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("inventory.unit.delete.description")}
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
              {t("inventory.unit.delete.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
