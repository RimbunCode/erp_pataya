import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Show({
  purchaseInvoice,
  flash,
  date,
  purchase_order,
  supplier,
  currency,
  items,
  paymentSchedules,
  amount,
  discount_on,
  discount_rate,
  discount_amount,
  exchange_rate,
  external_note,
}) {
  const { t } = useLaravelReactI18n();
  return (
    <FormPage
      defaultValues={{
        purchase_order,
        date,
        supplier,
        currency,
        items,
        paymentSchedules,
        amount,
        discount_on,
        discount_rate,
        discount_amount,
        exchange_rate,
        external_note,
      }}
      isCreate={!purchaseInvoice}
      ignoreDraft={purchase_order}
      name="purchaseInvoice"
      title={
        purchaseInvoice
          ? purchaseInvoice.code
          : t("finances.purchaseInvoice.new")
      }
      disabled={(purchaseInvoice?.status ?? "draft") != "draft"}
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
                  {value}
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
