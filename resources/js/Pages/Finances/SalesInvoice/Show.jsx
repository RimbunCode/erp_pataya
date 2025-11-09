import { cn, getThemeByStatus } from "@/lib/utils";
import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { useMemo } from "react";

export default function Show({
  salesInvoice,
  flash,
  date,
  sales_order,
  customer,
  customer_branch,
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
  const statusBadge = useMemo(() => {
    if (!salesInvoice) return;

    const status = t(`core.form.statuses.${salesInvoice?.status}`);
    const theme = getThemeByStatus(salesInvoice?.status);

    return (
      <span className={cn("text-sm badge capitalize", theme)}>{status}</span>
    );
  }, [salesInvoice?.status, t]);

  return (
    <FormPage
      defaultValues={{
        sales_order,
        date,
        customer,
        customer_branch,
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
      isCreate={!salesInvoice}
      ignoreDraft={sales_order}
      name="salesInvoice"
      title={salesInvoice ? salesInvoice.code : t("finances.salesInvoice.new")}
      disabled={(salesInvoice?.status ?? "draft") != "draft"}
      submitable
      badge={statusBadge}
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
