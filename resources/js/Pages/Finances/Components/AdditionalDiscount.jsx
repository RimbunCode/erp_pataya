import React, { useMemo } from "react";

import CurrencyInput from "@/Components/CurrencyInput";
import FormInput from "@/Components/FormInput";
import { FormPageContent } from "@/Pages/Core/FormPage";
import Select from "@/Components/Select";
import { calculateArray } from "@/lib/utils";
import useDidMountEffect from "@/Hooks/useDidMountEffect";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";

function AdditionalDiscount({ data, setData, netAmount, taxAmount }) {
  const { t } = useLaravelReactI18n();
  const { default_currency_id } = usePage().props.preferences;
  const setDiscount = (key, value) => {
    setData((prev) => {
      let latestDiscountKey = prev.latestDiscountKey ?? "discount_rate";
      let discount_on = prev.discount_on;
      let discount_rate = prev.discount_rate ?? 0;
      let discount_amount = prev.discount_amount ?? 0;
      const net_total = calculateArray(prev.items, "basic_amount", "+");
      const tax_amount = calculateArray(prev.items, "tax_amount", "+");
      if (key == "discount_on") {
        if (discount_on == value) return prev;
        discount_on = value;
        if (!value) {
          return {
            ...prev,
            discount_on,
            discount_rate: undefined,
            discount_amount: undefined,
            latestDiscountKey,
          };
        }

        key = latestDiscountKey;
        value = prev[key] ?? 0;
      }
      const total =
        discount_on == "grand_total"
          ? net_total + tax_amount
          : discount_on == "net_total"
            ? net_total
            : 0;

      if (key == "discount_rate") {
        latestDiscountKey = "discount_rate";
        discount_rate = value;
        discount_amount = (total * discount_rate) / 100;
      }
      if (key == "discount_amount") {
        latestDiscountKey = "discount_amount";
        discount_amount = value;
        discount_rate = (discount_amount * 100) / total;
      }
      if (
        !(
          prev.discount_on != discount_on ||
          prev.discount_rate != discount_rate ||
          prev.discount_amount != discount_amount
        )
      ) {
        return prev;
      }
      return {
        ...prev,
        discount_on,
        discount_rate,
        discount_amount,
        latestDiscountKey,
      };
    });
  };

  useDidMountEffect(() => {
    const latestKey = data.latestDiscountKey ?? "discount_rate";
    setDiscount(latestKey, data[latestKey] ?? 0);
  }, [netAmount, taxAmount]);

  const amount = useMemo(() => {
    return netAmount + taxAmount - (data?.discount_amount ?? 0);
  }, [netAmount, taxAmount, data.discount_amount]);

  return (
    <>
      <FormPageContent
        value="detail"
        title={t("sales.salesOrder.columns.additional_discount")}
        collapsible
        defaultOpen
      >
        <div className="grid gap-x-4 gap-y-4 md:grid-cols-2">
          <FormInput label={t("sales.salesOrder.columns.discount_on")}>
            <Select
              value={data.discount_on}
              onValueChange={(val) => setDiscount("discount_on", val)}
              placeholder={t(
                "sales.salesOrder.columns.discount_on.placeholder",
              )}
              optionTrans="sales.salesOrder.columns.discount_on.options"
              options={["net_total", "grand_total"]}
            />
          </FormInput>
          <FormInput
            disabled={!data?.discount_on}
            label={`${t("sales.salesOrder.columns.additional_discount_rate")}`}
          >
            <CurrencyInput
              className="text-right"
              value={data.discount_rate}
              decimalScale={2}
              onValueChange={(val) => setDiscount("discount_rate", val)}
              suffix="%"
              min={0}
              max={100}
            ></CurrencyInput>
          </FormInput>

          <FormInput
            className="col-start-2"
            disabled={!data?.discount_on}
            label={`${t("sales.salesOrder.columns.additional_discount_amount")}`}
          >
            <CurrencyInput
              className="text-right "
              value={data.discount_amount}
              onValueChange={(val) => setDiscount("discount_amount", val)}
              currencyCode={data?.currency?.code ?? "default"}
              min={0}
              max={
                data.discount_on == "net_total"
                  ? netAmount
                  : netAmount + taxAmount
              }
            ></CurrencyInput>
          </FormInput>
        </div>
      </FormPageContent>
      {data.discount_on && (
        <FormPageContent value="detail">
          <div className="grid grid-cols-2 gap-x-4 gap-y-4 border-t -mt-4 pt-4">
            {data?.currency?.code &&
              data?.currency?.code !== default_currency_id && (
                <FormInput
                  readOnly
                  label={`${t("sales.salesOrder.columns.total")} (${default_currency_id.toUpperCase()})`}
                >
                  <CurrencyInput
                    className="text-right"
                    value={amount * (data?.exchange_rate ?? 1)}
                    currencyCode="default"
                  ></CurrencyInput>
                </FormInput>
              )}
            <FormInput
              readOnly
              label={`${t("sales.salesOrder.columns.total")} (${(data?.currency?.code ?? default_currency_id).toUpperCase()})`}
              className="col-start-2"
            >
              <CurrencyInput
                className="text-right"
                decimalScale={2}
                value={amount}
                currencyCode={data?.currency?.code ?? "default"}
              ></CurrencyInput>
            </FormInput>
          </div>
        </FormPageContent>
      )}
    </>
  );
}

export default AdditionalDiscount;
