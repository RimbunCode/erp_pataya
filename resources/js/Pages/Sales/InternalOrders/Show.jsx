import Link from "@/Components/Link";
import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import { Button } from "@/Components/ui/button";
import { calculateArray, isValidStatus } from "@/lib/utils";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Show({ internalOrder, defaultData }) {
  const { t } = useLaravelReactI18n();
  return (
    <FormPage
      isCreate={!internalOrder}
      ignoreDraft={defaultData}
      name="internalOrder"
      disabled={internalOrder?.submitted_at}
      submitable
      defaultValues={defaultData}
      controls={() => {
        if (
          internalOrder?.submitted_at &&
          isValidStatus(internalOrder?.status) &&
          calculateArray(internalOrder?.items, "undelivered_quantity", "+") > 0
        ) {
          return (
            <Button
              type="button"
              className="p-2! size-fit h-8"
              variant="secondary"
              asChild
            >
              <Link
                href={window.route("deliveryNotes.create", {
                  ref: `internalOrder/${internalOrder?.id}`,
                })}
              >
                {t("sales.internalOrder.actions.create_delivery_note")}
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
