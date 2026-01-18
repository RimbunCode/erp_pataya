import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/Components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { Button } from "@/Components/ui/button";
import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import Link from "@/Components/Link";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { useMemo } from "react";

export default function Show({ purchaseReceipt, defaultData }) {
  const { t } = useLaravelReactI18n();
  const route = window.route;

  const statusBadge = useMemo(() => {
    if (!purchaseReceipt) return;
    const status = t(`core.form.statuses.${purchaseReceipt?.status}`);

    return <span className={cn("text-sm badge capitalize")}>{status}</span>;
  }, [purchaseReceipt?.status, t]);
  return (
    <FormPage
      isCreate={!purchaseReceipt}
      ignoreDraft={defaultData}
      name="purchaseReceipt"
      title={
        purchaseReceipt
          ? purchaseReceipt.code
          : t("purchase.purchaseReceipt.new")
      }
      defaultValues={defaultData}
      disabled={(purchaseReceipt?.status ?? "draft") != "draft"}
      submitable
      badge={statusBadge}
      controls={() => {
        if ((purchaseReceipt?.status ?? "draft") != "draft") {
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
                        ref: `purchaseReceipt/${purchaseReceipt?.id}`,
                      })}
                    >
                      {t("purchase.purchaseReceipt.actions.create_po")}
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
