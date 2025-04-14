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
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Index({ lang }) {
  const route = window.route;
  const { t } = useLaravelReactI18n();
  const tableRef = useRef();
  const [showNewForm, setShowNewForm] = useState(false);
  const [idDelete, setIdDelete] = useState(null);
  const onDelete = (id) => {
    router.delete(route("itemAlternatives.destroy", id), {
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
        titleTrans: "inventory.itemAlternative.columns.item_code",
        name: "item.code",
        searchType: "text",
        sortable: true,
        resizeable: true,
        cell: ({ dataRow }) => (
          <Link
            className="hover:underline"
            href={route("itemAlternatives.show", dataRow.id)}
          >
            {dataRow.item_code}
          </Link>
        ),
      },
      {
        titleTrans: "inventory.itemAlternative.columns.alternative_item_code",
        name: "alternative.code",
        searchType: "text",
        sortable: true,
        resizeable: true,
        cell: ({ dataRow }) => (
          <Link
            className="hover:underline"
            href={route("itemAlternatives.show", dataRow.id)}
          >
            {dataRow.alternative_code}
          </Link>
        ),
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
        title={t("inventory.itemAlternative.title")}
        addButton={{
          title: t("inventory.itemAlternative.add"),
          onClick: () => {
            setShowNewForm(true);
          },
        }}
        templateItem={({ dataRow }) => (
          <div className="flex items-center justify-between p-4 border-b gap-x-4 border-muted-foreground/25">
            <Link
              as="button"
              href={route("itemAlternatives.show", dataRow.id)}
              className=""
            >
              <p className="text-base font-medium text-left text-muted-foreground">
                {t(`inventory.itemAlternative.types.${dataRow.type}`)}
              </p>
              <p className="text-base font-medium text-left">{dataRow.name}</p>
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
        title={t("inventory.itemAlternative.new")}
        open={showNewForm}
        onOpenChange={setShowNewForm}
        className="max-w-xl"
        name="itemAlternative"
      >
        <Form />
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
              {t("inventory.itemAlternative.delete")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("inventory.itemAlternative.delete.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIdDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onDelete(idDelete);
              }}
            >
              {t("inventory.itemAlternative.delete.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
