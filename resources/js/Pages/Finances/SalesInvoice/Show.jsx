import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Show({ salesInvoice, flash, defaultData }) {
  const { t } = useLaravelReactI18n();

  return (
    <FormPage
      defaultValues={defaultData}
      isCreate={!salesInvoice}
      ignoreDraft={defaultData}
      name="salesInvoice"
      title={salesInvoice ? salesInvoice.code : t("finances.salesInvoice.new")}
      disabled={salesInvoice?.submitted_at}
      submitable
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
    >
      <Form />
    </FormPage>
  );
}
