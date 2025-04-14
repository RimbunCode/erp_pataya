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
import { Avatar, AvatarFallback, AvatarImage } from "@/Components/ui/avatar";
import { useCallback, useMemo, useRef, useState } from "react";

import { Button } from "@/Components/ui/button";
import DataTable from "@/Pages/Core/DataTable";
import Form from "./Form";
import { FormPageDialog } from "@/Pages/Core/FormPage";
import Link from "@/Components/Link";
import { Trash2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { router } from "@inertiajs/react";
import { useLaravelReactI18n } from "laravel-react-i18n";

// eslint-disable-next-line jsdoc/require-jsdoc
export default function Index({ branchSettings }) {
  const route = window.route;
  const { t } = useLaravelReactI18n();
  const tableRef = useRef();
  const [showNewForm, setShowNewForm] = useState(false);
  const [idDelete, setIdDelete] = useState(null);

  const onDelete = useCallback((id) => {
    router.delete(route("warehouses.destroy", id), {
      onSuccess: () => {
        setIdDelete(null);
      },
    });
  }, []);
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
        width: "fit",
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
        name: "branches.name",
        titleTrans: "inventory.warehouse.columns.branch",
        searchType: "text",
        sortable: true,
        resizeable: true,
        cell: ({ dataRow }) => (
          <button
            className={cn("w-fit hover:underline")}
            type="button"
            onClick={() => {
              tableRef.current.addFilter(
                "branches.name",
                "eq",
                dataRow.branch_name,
              );
            }}
          >
            {dataRow.branch_name}
          </button>
        ),
      },

      {
        name: "pic",
        titleTrans: "inventory.warehouse.columns.pic",
        resizeable: true,
        cell: ({ dataRow }) => {
          if (!dataRow.user_username) return <>-</>;

          const alias = dataRow.user_name
            .split(" ")
            .slice(0, 2)
            .map((n) => n.charAt(0))
            .join("");
          return (
            <div className="flex items-center gap-3 text-sm text-left">
              <Avatar className="rounded-lg size-10">
                {dataRow.user_image && (
                  <AvatarImage
                    src={
                      route("files.show", dataRow.user_image) +
                      `?v=${new Date(dataRow.user_updated_at).getTime()}`
                    }
                    alt={dataRow.user_name}
                  />
                )}
                <AvatarFallback className="text-xl font-semibold rounded-lg !flex">
                  {alias}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-base leading-tight text-left">
                <span className="font-semibold truncate">
                  {dataRow.user_name}
                </span>
                <span className="text-sm truncate text-foreground/80">
                  {dataRow.user_email}
                </span>
              </div>
            </div>
          );
        },
      },
    ],
    [],
  );
  return (
    <>
      <DataTable
        ref={tableRef}
        title={`${branchSettings.currentBranch.name} ${t("inventory.warehouse.title")}`}
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
        name="warehouse"
        open={showNewForm}
        onOpenChange={setShowNewForm}
        className="max-w-lg"
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
              {t("inventory.warehouse.delete")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("inventory.warehouse.delete.description")}
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
              {t("inventory.warehouse.delete.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
