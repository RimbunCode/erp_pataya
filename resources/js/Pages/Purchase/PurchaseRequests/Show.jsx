import { Button } from "@/Components/ui/button";
import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import RelationPanels from "@/Pages/Core/Components/RelationPanels";
import Link from "@/Components/Link";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Show({ purchaseRequest, defaultData }) {
  const { t } = useLaravelReactI18n();
  const route = window.route;

  return (
    <FormPage
      isCreate={!purchaseRequest}
      ignoreDraft={defaultData}
      defaultValues={defaultData}
      name="purchaseRequest"
      disabled={purchaseRequest?.submitted_at}
      submitable
      controls={() => {
        if (purchaseRequest?.canCreatePo) {
          return (
            <Button
              type="button"
              className="p-2! size-fit h-8"
              variant="secondary"
              asChild
            >
              <Link
                href={route("purchaseOrders.create", {
                  ref: `purchaseRequest/${purchaseRequest?.id}`,
                })}
              >
                {t("purchase.purchaseRequest.actions.create_po")}
              </Link>
            </Button>
          );
        }
      }}
    >
      <Form />
      {purchaseRequest?.submitted_at && <RelationPanels />}
    </FormPage>
  );
}
