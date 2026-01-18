import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/Components/ui/dropdown-menu";

import { Button } from "@/Components/ui/button";
import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import Link from "@/Components/Link";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Show({ purchaseOrder, required_date, loadFrom }) {
  const { t } = useLaravelReactI18n();
  const route = window.route;

  return (
    <FormPage
      isCreate={!purchaseOrder}
      ignoreDraft={loadFrom}
      name="purchaseOrder"
      title={
        purchaseOrder ? purchaseOrder.code : t("purchase.purchaseOrder.new")
      }
      disabled={purchaseOrder?.submitted_at}
      submitable
      defaultValues={{
        required_date,
        date: new Date(),
      }}
      controls={() => {
        if (purchaseOrder?.submitted_at) {
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
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem asChild>
                    <Link
                      href={route("purchaseOrders.create", {
                        ref: `purchaseOrder/${purchaseOrder?.id}`,
                      })}
                    >
                      {t(
                        "purchase.purchaseOrder.actions.create_purchase_receipt",
                      )}
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
