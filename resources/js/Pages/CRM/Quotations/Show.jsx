import { Button } from "@/Components/ui/button";
import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import Link from "@/Components/Link";
import { inArray, isValidStatus } from "@/lib/utils";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Show({ quotation, defaultData }) {
  const { t } = useLaravelReactI18n();
  const route = window.route;

  return (
    <FormPage
      isCreate={!quotation}
      ignoreDraft={defaultData}
      name="quotation"
      fieldNameTrans="crm.quotation.columns"
      disabled={quotation?.submitted_at}
      submitable
      defaultValues={defaultData}
      controls={() => {
        if (!quotation) return null;

        return (
          isValidStatus(quotation?.status) &&
          inArray(quotation?.status, ["submitted"]) && (
            <Button type="button" size="sm" asChild>
              <Link
                href={route("salesOrders.create", {
                  ref: `quotation/${quotation.id}`,
                })}
              >
                {t("crm.quotation.actions.create_sales_order")}
              </Link>
            </Button>
          )
        );
      }}
    >
      <Form />
    </FormPage>
  );
}
