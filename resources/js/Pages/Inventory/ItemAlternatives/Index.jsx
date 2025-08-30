import { useMemo, useRef, useState } from "react";

import { Button } from "@/Components/ui/button";
import { Checkbox } from "@/Components/ui/checkbox";
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
      {
        titleTrans: "inventory.itemAlternative.columns.two_way",
        name: "two_way",
        searchType: "boolean",
        sortable: true,
        resizeable: true,
        cell: ({ dataRow }) => (
          <Checkbox
            checked={dataRow.two_way}
            readOnly
            className="cursor-default"
          />
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
              onClick={() => deleteItem("itemAlternatives.destroy", dataRow.id)}
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
              {dataRow.two_way && (
                <span className="mb-1 -ml-2 text-xs badge primary">
                  {t("inventory.itemAlternative.columns.two_way")}
                </span>
              )}
              <p className="text-base font-medium text-left">
                {dataRow.item_code}
              </p>
              <p className="text-sm font-medium text-left text-muted-foreground">
                {dataRow.alternative_code}
              </p>
            </Link>

            <Button
              variant="destructive"
              size="icon"
              className="size-8"
              onClick={() => deleteItem("itemAlternatives.destroy", dataRow.id)}
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
    </>
  );
}
