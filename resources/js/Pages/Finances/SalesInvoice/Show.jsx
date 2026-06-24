import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/Components/ui/dropdown-menu";
import { calculateArray, inArray, isValidStatus } from "@/lib/utils";

import { Button } from "@/Components/ui/button";
import { ChevronsUpDown } from "lucide-react";
import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import Link from "@/Components/Link";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Show({ salesInvoice, defaultData }) {
  const route = window.route;
  const { t } = useLaravelReactI18n();

  return (
    <FormPage
      defaultValues={defaultData}
      isCreate={!salesInvoice}
      ignoreDraft={defaultData}
      name="salesInvoice"
      disabled={salesInvoice?.submitted_at}
      submitable
      controls={() => {
        if (
          salesInvoice?.submitted_at &&
          isValidStatus(salesInvoice?.status) &&
          ((!salesInvoice?.is_return &&
            calculateArray(salesInvoice?.items, "unreturned_quantity", "+") >
              0) ||
            inArray(salesInvoice?.status, [
              "unpaid",
              "partially_paid",
              "returned",
            ]))
        ) {
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
                  {inArray(salesInvoice?.status, [
                    "unpaid",
                    "partially_paid",
                    "returned",
                  ]) && (
                    <DropdownMenuItem asChild>
                      <Link
                        href={route("paymentEntries.create", {
                          ref: `salesInvoice/${salesInvoice?.id}`,
                        })}
                      >
                        {t(
                          "finances.salesInvoice.actions.create_payment_entry",
                        )}
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {!salesInvoice?.is_return &&
                    calculateArray(
                      salesInvoice?.items,
                      "unreturned_quantity",
                      "+",
                    ) > 0 && (
                      <DropdownMenuItem asChild>
                        <Link
                          href={route("salesInvoices.create", {
                            ref: `salesInvoice/${salesInvoice?.id}`,
                          })}
                        >
                          {t(
                            "finances.salesInvoice.actions.create_credit_note",
                          )}
                        </Link>
                      </DropdownMenuItem>
                    )}
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
