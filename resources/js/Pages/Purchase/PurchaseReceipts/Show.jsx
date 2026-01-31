import { Button } from "@/Components/ui/button";
import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import Link from "@/Components/Link";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { calculateArray, inArray, isValidStatus } from "@/lib/utils";

export default function Show({ purchaseReceipt, defaultData }) {
  const { t } = useLaravelReactI18n();
  const route = window.route;
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
      controls={() => {
        if (
          purchaseReceipt?.submitted_at &&
          isValidStatus(purchaseReceipt?.status) &&
          inArray(purchaseReceipt?.status, "received") &&
          calculateArray(purchaseReceipt?.items, "unreturned_quantity", "+") > 0
        ) {
          return (
            <Button
              type="button"
              className="p-2! size-fit h-8"
              variant="secondary"
              asChild
            >
              <Link
                href={route("purchaseReceipts.create", {
                  ref: `purchaseReceipt/${purchaseReceipt?.id}`,
                })}
              >
                {t("purchase.purchaseReceipt.create_purchase_return")}
              </Link>
            </Button>
          );
        }
      }}
    >
      <Form />
    </FormPage>
  );
}
