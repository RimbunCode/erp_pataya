import { calculateArray, inArray, isValidStatus } from "@/lib/utils";

import { Button } from "@/Components/ui/button";
import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import Link from "@/Components/Link";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Show({ deliveryNote, defaultData, flash }) {
  const { t } = useLaravelReactI18n();
  const route = window.route;

  return (
    <FormPage
      isCreate={!deliveryNote}
      name="deliveryNote"
      disabled={deliveryNote?.submitted_at}
      submitable
      ignoreDraft={defaultData}
      defaultValues={defaultData}
      banner={
        flash.errorItems && (
          <div className="flex flex-col gap-x-2 text-sm alert error p-4">
            <h3 className="text-base font-semibold">
              {t("core.form.errors.title")}
            </h3>
            <ul className="block pl-5">
              {flash.errorItems.map((value, index) => (
                <li key={index} className="list-disc">
                  {t(value)}
                </li>
              ))}
            </ul>
          </div>
        )
      }
      controls={() => {
        if (
          deliveryNote?.submitted_at &&
          isValidStatus(deliveryNote?.status) &&
          inArray(deliveryNote?.status, "delivered") &&
          calculateArray(deliveryNote?.items, "unreturned_quantity", "+") > 0
        ) {
          return (
            <Button
              type="button"
              className="p-2! size-fit h-8"
              variant="secondary"
              asChild
            >
              <Link
                href={route("deliveryNotes.create", {
                  ref: `deliveryNote/${deliveryNote?.id}`,
                })}
              >
                {t("inventory.deliveryNote.actions.create_sales_return")}
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
