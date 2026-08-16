import React, { useMemo } from "react";

import NumberInput from "@/Components/NumberInput";
import FormInput from "@/Components/FormInput";
import { FormPageContent } from "@/Pages/Core/FormPage";
import Select from "@/Components/Select";
import { calculateArray } from "@/lib/utils";
import useDidMountEffect from "@/Hooks/useDidMountEffect";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";

// Catatan arsitektur: komponen ini HANYA menyimpan discount_on/discount_rate/
// discount_amount ke state header -- TIDAK menulis basic_amount/tax_amount per
// item, karena FormTable (dipakai Form.jsx PO/SO) me-reset basic_amount/tax_amount
// tiap baris lewat mapItem() setiap kali array `items` berubah referensinya
// (lihat FormTable.jsx useEffect di sekitar applyMapItem). Kalau komponen ini
// menulis balik ke item.basic_amount, nilainya akan langsung ditimpa lagi oleh
// mapItem's raw quantity*rate. Realokasi diskon per baris karena itu dilakukan
// di dalam mapItem masing-masing Form.jsx (PO & SO), yang punya akses closure ke
// discount_on/discount_rate/discount_amount dari data -- lihat discountAllocation.js.
function AdditionalDiscount({
  data,
  setData,
  netAmount,
  taxAmount,
  rawNetAmount,
  rawTaxAmount,
}) {
  const { t } = useLaravelReactI18n();
  const { default_currency_id } = usePage().props.preferences;
  const setDiscount = (key, value) => {
    setData((prev) => {
      let latestDiscountKey = prev.latestDiscountKey ?? "discount_rate";
      let discount_on = prev.discount_on;
      let discount_rate = prev.discount_rate ?? 0;
      let discount_amount = prev.discount_amount ?? 0;
      // Basis diskon HARUS dari basic_amount/tax_amount MENTAH (rawNetAmount/
      // rawTaxAmount, dihitung parent dari quantity*rate sebelum diskon apapun),
      // BUKAN dari prev.items -- basic_amount di prev.items bisa saja sudah hasil
      // alokasi diskon putaran sebelumnya (via mapItem), jadi basis akan menyusut
      // terus tiap kali fungsi ini terpanggil ulang kalau baca dari situ.
      const net_total =
        rawNetAmount ?? calculateArray(prev.items, "basic_amount", "+");
      const tax_amount =
        rawTaxAmount ?? calculateArray(prev.items, "tax_amount", "+");
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

  // Deps HARUS rawNetAmount/rawTaxAmount (basis mentah, independen dari
  // discount_amount), BUKAN netAmount/taxAmount (hasil alokasi -- turunan dari
  // discount_amount itu sendiri). Kalau pakai netAmount/taxAmount di sini, efek
  // ini akan terpicu ulang oleh perubahan yang ia sendiri sebabkan (re-derive
  // discount_amount -> net_amount berubah -> netAmount berubah -> efek jalan lagi).
  useDidMountEffect(() => {
    const latestKey = data.latestDiscountKey ?? "discount_rate";
    setDiscount(latestKey, data[latestKey] ?? 0);
  }, [rawNetAmount, rawTaxAmount]);

  // netAmount/taxAmount yang diterima dari Form.jsx SUDAH hasil alokasi diskon
  // (dihitung dari data.items yang basic_amount/tax_amount-nya sudah dipotong
  // proporsional oleh mapItem) -- jadi Total di sini tinggal dijumlah langsung,
  // tidak perlu dikurangi discount_amount lagi (itu penyebab bug lama: dikurangi
  // dua kali secara konsep -- sekali di item, sekali lagi di total).
  const amount = useMemo(() => {
    return netAmount + taxAmount;
  }, [netAmount, taxAmount]);

  return (
    <>
      <FormPageContent
        value="detail"
        title={t("sales.salesOrder.columns.additional_discount")}
        collapsible
        defaultOpen
      >
        <div className="grid gap-x-4 gap-y-4 md:grid-cols-2">
          <FormInput
            name="discount_on"
            label={t("sales.salesOrder.columns.discount_on")}
          >
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
            name="discount_rate"
            disabled={!data?.discount_on}
            label={`${t("sales.salesOrder.columns.additional_discount_rate")}`}
          >
            <NumberInput
              className="text-right"
              value={data.discount_rate}
              decimalScale={2}
              onValueChange={(val) => setDiscount("discount_rate", val)}
              suffix="%"
              min={0}
              max={100}
            ></NumberInput>
          </FormInput>

          <FormInput
            name="discount_amount"
            className="col-start-2"
            disabled={!data?.discount_on}
            label={`${t("sales.salesOrder.columns.additional_discount_amount")}`}
          >
            <NumberInput
              className="text-right "
              value={data.discount_amount}
              decimalScale={2}
              onValueChange={(val) => setDiscount("discount_amount", val)}
              currencyCode={data?.currency?.code ?? "default"}
              min={0}
              max={
                data.discount_on == "net_total"
                  ? rawNetAmount
                  : rawNetAmount + rawTaxAmount
              }
            ></NumberInput>
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
                  <NumberInput
                    className="text-right"
                    decimalScale={2}
                    value={amount * (data?.exchange_rate ?? 1)}
                    currencyCode="default"
                  ></NumberInput>
                </FormInput>
              )}
            <FormInput
              readOnly
              label={`${t("sales.salesOrder.columns.total")} (${(data?.currency?.code ?? default_currency_id).toUpperCase()})`}
              className="col-start-2"
            >
              <NumberInput
                className="text-right"
                decimalScale={2}
                value={amount}
                currencyCode={data?.currency?.code ?? "default"}
              ></NumberInput>
            </FormInput>
          </div>
        </FormPageContent>
      )}
    </>
  );
}

export default AdditionalDiscount;
