import { calculateArray, inArray, isValidStatus } from "@/lib/utils";

import { Button } from "@/Components/ui/button";
import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import Link from "@/Components/Link";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Show({ widget, defaultData, flash }) {
  const { t } = useLaravelReactI18n();
  const route = window.route;

  return (
    <FormPage
      isCreate={!widget}
      name="widget"
      title={widget ? widget.code : t("settings.widget.new")}
      disabled={widget?.submitted_at}
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
          widget?.submitted_at &&
          isValidStatus(widget?.status) &&
          inArray(widget?.status, "delivered") &&
          calculateArray(widget?.items, "remaining_quantity", "+") > 0
        ) {
          return (
            <Button
              type="button"
              className="p-2! size-fit h-8"
              variant="secondary"
              asChild
            >
              <Link
                href={route("widgets.create", {
                  ref: `widget/${widget?.id}`,
                })}
              >
                {t("settings.widget.actions.create_sales_return")}
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
