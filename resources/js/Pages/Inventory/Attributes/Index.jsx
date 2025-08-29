import { useMemo, useRef, useState } from "react";

import { Button } from "@/Components/ui/button";
import DataTable from "@/Pages/Core/DataTable";
import Form from "./Form";
import { FormPageDialog } from "@/Pages/Core/FormPage";
import Link from "@/Components/Link";
import { Trash2Icon } from "lucide-react";
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
        titleTrans: "inventory.attribute.columns.name",
        name: "name",
        searchType: "text",
        sortable: true,
        resizeable: true,
        cell: ({ dataRow }) => (
          <Link
            className="hover:underline"
            href={route("attributes.show", dataRow.id)}
          >
            {dataRow.name}
          </Link>
        ),
      },
      {
        titleTrans: "inventory.attribute.columns.values",
        name: "values",
        searchType: "text",
        sortable: true,
        resizeable: true,
        cell: ({ dataRow }) => (
          <>{dataRow.values.map((x) => x.value).join(", ")}</>
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
          return (
            <Button
              variant="destructive"
              size="icon"
              className="size-8"
              onClick={() => deleteItem("attributes.destroy", dataRow.id)}
            >
              <Trash2Icon />
            </Button>
          );
        }}
        title={t("inventory.attribute.title")}
        addButton={{
          title: t("inventory.attribute.add_attribute"),
          onClick: () => {
            setShowNewForm(true);
          },
        }}
        templateItem={({ dataRow }) => (
          <div className="flex items-center justify-between p-4 border-b gap-x-4 border-muted-foreground/25">
            <Link
              as="button"
              href={route("attributes.show", dataRow.id)}
              className=""
            >
              <p className="text-base font-medium text-left">{dataRow.name}</p>
            </Link>

            <Button
              variant="destructive"
              size="icon"
              className="size-8"
              onClick={() => deleteItem("attributes.destroy", dataRow.id)}
            >
              <Trash2Icon />
            </Button>
          </div>
        )}
        columns={columns}
      />
      <FormPageDialog
        title={t("inventory.attribute.new")}
        name="attribute"
        open={showNewForm}
        onOpenChange={setShowNewForm}
        className="max-w-xl"
      >
        <Form />
      </FormPageDialog>
    </>
  );
}
