import { Button } from "@/Components/ui/button";
import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import Link from "@/Components/Link";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Show({ generalLedger }) {
  const { t } = useLaravelReactI18n();
  const route = window.route;
  const referenceable = generalLedger?.referenceable;

  return (
    <FormPage
      isCreate={false}
      name="generalLedger"
      disabled
      deleteable={false}
      sidebarContent={false}
      bottombarContent={false}
      controls={
        referenceable && (
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href={route(`${referenceable.route}.show`, referenceable.id)}>
              {t("finances.generalLedger.actions.view_reference")}
            </Link>
          </Button>
        )
      }
    >
      <Form />
    </FormPage>
  );
}
