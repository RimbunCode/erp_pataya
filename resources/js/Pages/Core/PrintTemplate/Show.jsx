import { Button } from "@/Components/ui/button";
import { EditIcon } from "lucide-react";
import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import Link from "@/Components/Link";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";

export default function Show({ printTemplate }) {
  const { t } = useLaravelReactI18n();
  const loadFrom = usePage().props.loadFrom;
  const route = window.route;

  return (
    <FormPage
      isCreate={!printTemplate}
      ignoreDraft={loadFrom}
      name="printTemplate"
      controls={() => {
        return (
          <Button type="button" asChild className="h-8 w-fit">
            <Link href={route("printTemplates.editor", printTemplate.id)}>
              <EditIcon />
              {t("core.printTemplate.open_editor")}
            </Link>
          </Button>
        );
      }}
    >
      <Form />
    </FormPage>
  );
}
