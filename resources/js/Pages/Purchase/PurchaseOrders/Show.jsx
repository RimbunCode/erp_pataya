import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/Components/ui/dropdown-menu";
import { cn, getThemeByStatus } from "@/lib/utils";

import { Button } from "@/Components/ui/button";
import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import Link from "@/Components/Link";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { useMemo } from "react";

export default function Show({ purchaseOrder, required_date, loadFrom }) {
  const { t } = useLaravelReactI18n();
  const route = window.route;

  const statusBadge = useMemo(() => {
    if (!purchaseOrder) return;
    const status = t(`core.form.statuses.${purchaseOrder?.status}`);
    const theme = getThemeByStatus(purchaseOrder?.status);

    return (
      <span className={cn("text-sm badge capitalize", theme)}>{status}</span>
    );
  }, [purchaseOrder?.status, t]);
  return (
    <FormPage
      isCreate={!purchaseOrder}
      ignoreDraft={loadFrom}
      name="purchaseOrder"
      title={
        purchaseOrder ? purchaseOrder.code : t("purchase.purchaseOrder.new")
      }
      disabled={(purchaseOrder?.status ?? "draft") != "draft"}
      submitable
      badge={statusBadge}
      defaultValues={{
        required_date,
        date: new Date(),
      }}
      controls={() => {
        if ((purchaseOrder?.status ?? "draft") != "draft") {
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
                      {t("purchase.purchaseOrder.actions.create_po")}
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
