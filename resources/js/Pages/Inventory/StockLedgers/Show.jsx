import { Button } from "@/Components/ui/button";
import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import Link from "@/Components/Link";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Show({ stockLedger }) {
  const { t } = useLaravelReactI18n();
  const route = window.route;
  const referenceable = stockLedger?.referenceable;

  return (
    <FormPage
      isCreate={false}
      name="stockLedger"
      disabled
      deleteable={false}
      sidebarContent={false}
      bottombarContent={false}
      controls={
        referenceable && (
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href={route(`${referenceable.route}.show`, referenceable.id)}>
              {t("inventory.stockLedger.actions.view_reference")}
            </Link>
          </Button>
        )
      }
    >
      <Form />
    </FormPage>
  );
}
