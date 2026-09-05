import { Button } from "@/Components/ui/button";
import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import Link from "@/Components/Link";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { calculateArray, inArray, isValidStatus } from "@/lib/utils";
import AssetCompletionAlert from "@/Pages/Asset/Assets/AssetCompletionAlert";

export default function Show({ purchaseReceipt, defaultData, fixedAssets }) {
  const { t } = useLaravelReactI18n();
  const route = window.route;
  return (
    <FormPage
      isCreate={!purchaseReceipt}
      ignoreDraft={defaultData}
      name="purchaseReceipt"
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
      banner={
        <AssetCompletionAlert
          assets={fixedAssets}
          sourceDocumentType="purchase_receipt"
          sourceDocumentId={purchaseReceipt?.id}
        />
      }
    >
      <Form />
    </FormPage>
  );
}
