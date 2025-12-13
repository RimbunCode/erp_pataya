import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/Components/ui/dropdown-menu";

import { Button } from "@/Components/ui/button";
import { ChevronsUpDown } from "lucide-react";
import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import Link from "@/Components/Link";
import { isValidStatus } from "@/lib/utils";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Show({ salesOrder, defaultData, flash }) {
  const { t } = useLaravelReactI18n();
  const route = window.route;

  return (
    <FormPage
      isCreate={!salesOrder}
      ignoreDraft={defaultData}
      name="salesOrder"
      title={salesOrder ? salesOrder.code : t("sales.salesOrder.new")}
      disabled={salesOrder?.submitted_at}
      submitable
      defaultValues={defaultData}
      banner={
        flash.errorItems && (
          <div className="flex flex-col gap-x-2 text-sm alert error p-4">
            <h3 className="text-base font-semibold">
              {t("core.form.errors.title")}
            </h3>
            <ul className="block pl-5">
              {flash.errorItems.map((value, index) => (
                <li key={index} className="list-disc">
                  {value}
                </li>
              ))}
            </ul>
          </div>
        )
      }
      controls={() => {
        if (salesOrder?.submitted_at && isValidStatus(salesOrder?.status)) {
          return (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    className="p-2! size-fit h-8"
                    variant="secondary"
                  >
                    {t("core.form.actions")}
                    <ChevronsUpDown />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem asChild>
                    <Link
                      href={route("salesInvoices.create", {
                        ref: salesOrder.id,
                      })}
                    >
                      {t("sales.salesOrder.actions.create_sales_invoice")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      href={route("deliveryNotes.create", {
                        ref: `salesOrder/${salesOrder?.id}`,
                      })}
                    >
                      {t("sales.salesOrder.actions.create_delivery_note")}
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          );
        }
      }}
    >
      <Form />
    </FormPage>
  );
}
