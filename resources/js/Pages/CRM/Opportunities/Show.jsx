import { Button } from "@/Components/ui/button";
import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import Link from "@/Components/Link";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Show({ opportunity, defaultData }) {
  const { t } = useLaravelReactI18n();
  const route = window.route;

  return (
    <FormPage
      isCreate={!opportunity}
      name="opportunity"
      fieldNameTrans="crm.opportunity.columns"
      defaultValues={defaultData}
      controls={() => {
        if (!opportunity) return null;

        return (
          <Button type="button" size="sm" asChild>
            <Link
              href={route("quotations.create", {
                ref: `opportunity/${opportunity.id}`,
              })}
            >
              {t("crm.opportunity.create_quotation")}
            </Link>
          </Button>
        );
      }}
    >
      <Form />
    </FormPage>
  );
}
