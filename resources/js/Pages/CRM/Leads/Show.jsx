import { router, usePage } from "@inertiajs/react";

import { Button } from "@/Components/ui/button";
import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import Link from "@/Components/Link";
import usePermission from "@/Hooks/usePermission";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { convertTemplateLink } from "@/lib/linkModelUtils";

export default function Show({ lead }) {
  const { t } = useLaravelReactI18n();
  const route = window.route;
  const { model } = usePage().props;
  const { can } = usePermission(model);

  const isConverted = lead?.status === "converted";

  const handleConvert = () => {
    router.put(route("leads.convert", lead.id));
  };

  return (
    <FormPage
      isCreate={!lead}
      name="lead"
      fieldNameTrans="crm.lead.columns"
      controls={() => {
        if (!lead) return null;

        if (isConverted) {
          return (
            <div className="flex items-center gap-x-2 text-sm">
              <span>{t("crm.lead.converted_to")}</span>
              <Link
                href={route("customers.show", lead.converted_customer_id)}
                className="text-primary hover:underline"
              >
                {convertTemplateLink(lead?.converted_customer)}
              </Link>
            </div>
          );
        }

        return (
          can("write") && (
            <Button type="button" size="sm" onClick={handleConvert}>
              {t("crm.lead.convert_to_customer")}
            </Button>
          )
        );
      }}
    >
      <Form />
    </FormPage>
  );
}
