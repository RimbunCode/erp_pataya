import { Button } from "@/Components/ui/button";
import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import Link from "@/Components/Link";
import ServiceActivityLog from "./ServiceActivityLog";
import usePermission from "@/Hooks/usePermission";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Show({ assetService, defaultData }) {
  const { t } = useLaravelReactI18n();
  const route = window.route;
  const { canGlobal } = usePermission();
  const isApproved = (assetService?.status ?? []).includes("approved");
  const canRequestPurchase = assetService?.submitted_at;

  return (
    <FormPage
      isCreate={!assetService}
      ignoreDraft={defaultData}
      name="assetService"
      disabled={assetService?.submitted_at}
      submitable
      defaultValues={defaultData}
      controls={() => {
        if (!canRequestPurchase) {
          return null;
        }
        return (
          <>
            {canGlobal("App\\Models\\Purchase\\PurchaseRequest", "create") && (
              <Button
                type="button"
                className="p-2! size-fit h-8"
                variant="secondary"
                asChild
              >
                <Link
                  href={route("purchaseRequests.create", {
                    ref: `assetService/${assetService.id}`,
                  })}
                >
                  {t("asset.service.actions.create_pr")}
                </Link>
              </Button>
            )}
            {canGlobal("App\\Models\\Purchase\\PurchaseOrder", "create") && (
              <Button
                type="button"
                className="p-2! size-fit h-8"
                variant="secondary"
                asChild
              >
                <Link
                  href={route("purchaseOrders.create", {
                    ref: `assetService/${assetService.id}`,
                  })}
                >
                  {t("asset.service.actions.create_po")}
                </Link>
              </Button>
            )}
          </>
        );
      }}
    >
      <Form />
      {assetService && isApproved && (
        <ServiceActivityLog assetService={assetService} />
      )}
    </FormPage>
  );
}
