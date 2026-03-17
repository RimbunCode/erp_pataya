import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/Components/ui/dropdown-menu";
import { calculateArray, inArray, isValidStatus } from "@/lib/utils";

import { Button } from "@/Components/ui/button";
import { ChevronsUpDownIcon } from "lucide-react";
import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import Link from "@/Components/Link";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Show({ purchaseInvoice, defaultData }) {
  const { t } = useLaravelReactI18n();
  return (
    <FormPage
      defaultValues={defaultData}
      isCreate={!purchaseInvoice}
      ignoreDraft={defaultData}
      name="purchaseInvoice"
      title={
        purchaseInvoice
          ? purchaseInvoice.code
          : t("finances.purchaseInvoice.new")
      }
      disabled={(purchaseInvoice?.status ?? "draft") != "draft"}
      submitable
      controls={() => {
        if (
          purchaseInvoice?.submitted_at &&
          isValidStatus(purchaseInvoice?.status) &&
          ((!purchaseInvoice?.is_return &&
            calculateArray(purchaseInvoice?.items, "unreturned_quantity", "+") >
              0) ||
            inArray(purchaseInvoice?.status, [
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
                    <ChevronsUpDownIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {inArray(purchaseInvoice?.status, [
                    "unpaid",
                    "partially_paid",
                    "returned",
                  ]) && (
                    <DropdownMenuItem asChild>
                      <Link
                        href={route("paymentEntries.create", {
                          ref: `purchaseInvoice/${purchaseInvoice?.id}`,
                        })}
                      >
                        {t(
                          "finances.purchaseInvoice.actions.create_payment_entry",
                        )}
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {!purchaseInvoice?.is_return &&
                    calculateArray(
                      purchaseInvoice?.items,
                      "unreturned_quantity",
                      "+",
                    ) > 0 && (
                      <DropdownMenuItem asChild>
                        <Link
                          href={route("purchaseInvoices.create", {
                            ref: `purchaseInvoice/${purchaseInvoice?.id}`,
                          })}
                        >
                          {t(
                            "finances.purchaseInvoice.actions.create_debit_note",
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
