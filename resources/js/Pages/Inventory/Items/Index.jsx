import { useMemo, useRef, useState } from "react";

import { Button } from "@/Components/ui/button";
import DataTable from "@/Pages/Core/DataTable";
import Form from "./Form";
import { FormPageDialog } from "@/Pages/Core/FormPage";
import Link from "@/Components/Link";
import { Trash2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLaravelReactI18n } from "laravel-react-i18n";
import useDeleteModal from "@/Hooks/useDeleteModal";

export default function Index({ lang }) {
  const route = window.route;
  const { t } = useLaravelReactI18n();
  const tableRef = useRef();
  const [showNewForm, setShowNewForm] = useState(false);
  const { deleteItem } = useDeleteModal();
  /**
   * @typedef {import('@/Pages/Core/DataTable').ColumnProps} ColumnProps
   * @type {ColumnProps[]}
   */
  const columns = useMemo(
    () => [
      {
        titleTrans: "inventory.item.columns.code",
        name: "code",
        searchType: "text",
        width: "fit",
        sortable: true,
        resizeable: true,
        cell: ({ dataRow }) => (
          <Link
            className="hover:underline"
            href={dataRow.id ? route("items.show", dataRow.id) : ""}
          >
            {dataRow.code}
          </Link>
        ),
      },
      {
        titleTrans: "inventory.item.columns.name",
        name: "name",
        searchType: "text",
        sortable: true,
        resizeable: true,
        cell: ({ dataRow }) => {
          return (
            <Link
              className="hover:underline"
              href={dataRow.id ? route("items.show", dataRow.id) : ""}
            >
              {dataRow.name}
            </Link>
          );
        },
      },
      {
        titleTrans: "inventory.item.columns.category",
        name: "categories.name",
        searchType: "text",
        sortable: true,
        resizeable: true,
        cell: ({ dataRow }) => (
          <button
            className={cn("w-fit hover:underline")}
            type="button"
            onClick={() => {
              tableRef.current.addFilter(
                "categories.name",
                "eq",
                dataRow.category_name,
              );
            }}
          >
            {dataRow.category_name}
          </button>
        ),
      },
      {
        titleTrans: "inventory.item.columns.description",
        name: "description",
        searchType: "text",
        show: false,
        sortable: true,
        resizeable: true,
      },
      {
        titleTrans: "inventory.item.columns.is_disabled",
        name: "is_disabled",
        searchType: "text",
        parseTrans: "inventory.item.columns.is_disabled.parse",
        show: "boolean",
        width: "fit",
        sortable: true,
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
          return (
            <Button
              variant="destructive"
              size="icon"
              className="size-8"
              onClick={() => deleteItem("items.destroy", dataRow.id)}
            >
              <Trash2Icon />
            </Button>
          );
        }}
        title={t("inventory.item.title")}
        addButton={{
          title: t("inventory.item.add_item"),
          onClick: () => {
            setShowNewForm(true);
          },
        }}
        templateItem={({ dataRow }) => (
          <div className="flex items-center justify-between p-4 border-b gap-x-4 border-muted-foreground/25">
            <Link
              as="button"
              href={dataRow.id ? route("items.show", dataRow.id) : ""}
              className=""
            >
              <p className="text-base font-medium text-left">{dataRow.name}</p>
            </Link>

            <Button
              variant="destructive"
              size="icon"
              className="size-8"
              onClick={() => deleteItem("items.destroy", dataRow.id)}
            >
              <Trash2Icon />
            </Button>
          </div>
        )}
        columns={columns}
      />
      <FormPageDialog
        title={t("inventory.item.new")}
        name="item"
        open={showNewForm}
        onOpenChange={setShowNewForm}
        className="max-w-6xl"
      >
        <Form />
      </FormPageDialog>
    </>
  );
}
