import {
  FormPageContent,
  FormPageContentTitle,
  useFormPage,
} from "@/Pages/Core/FormPage";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import CurrencyInput from "@/Components/CurrencyInput";
import CurrencyLinkModel from "@/Pages/Core/CurrencyLinkModel";
import CustomerLinkModel from "@/Pages/Sales/Customers/CustomerLinkModel";
import DatetimePicker from "@/Components/DatetimePicker";
import FormInput from "@/Components/FormInput";
import PaymentMethodLinkModel from "../PaymentMethods/PaymentMethodLinkModel";
import React from "react";
import SupplierLinkModel from "@/Pages/Purchase/Suppliers/SupplierLinkModel";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Form() {
  const { data, setData } = useFormPage();
  const { t } = useLaravelReactI18n();

  return (
    <>
      <FormPageContent title={null} value="detail">
        <FormPageContentTitle></FormPageContentTitle>
        <div className="grid md:grid-cols-2  gap-x-3 gap-y-4">
          <FormInput
            required={true}
            label={t("finances.paymentEntry.columns.date")}
          >
            <DatetimePicker
              type="datetime"
              value={data?.date}
              onValueChange={(val) => setData("date", val)}
            />
          </FormInput>

          <FormInput
            required={true}
            label={t("finances.paymentEntry.columns.currency")}
            className="col-start-1"
          >
            <CurrencyLinkModel
              placeholder={t(
                "finances.paymentEntry.columns.currency.placeholder",
              )}
              value={data.currency}
              onValueChange={(val) => {
                setData("currency", val);
              }}
            />
          </FormInput>

          <FormInput
            required={true}
            label={t("finances.paymentEntry.columns.exchange_rate")}
          >
            <CurrencyInput
              disabled={!data.currency}
              className="text-left"
              value={data.exchange_rate}
              onValueChange={(val) => setData("exchange_rate", val)}
            />
          </FormInput>

          {/* <FormInput
            required={true}
            label={t("finances.paymentSchedule.columns.reference_to")}
            name="reference_to"
            className="col-start-2"
          >
            <LinkModel
              className="pointer-events-auto"
              value={data.paymentable}
              model={data.paymentable_type}
              disabledAddButton={true}
            />
          </FormInput> */}

          <FormInput
            className="col-start-1"
            required={true}
            label={t("finances.paymentEntry.columns.payment_type")}
          >
            <Select
              readOnly={true}
              placeholder={t(
                "finances.paymentEntry.columns.payment_type.placeholder",
              )}
              optionTrans="finances.paymentEntry.columns.payment_type.options"
              options={["receive", "pay"]}
              value={data.payment_type}
              onValueChange={(val) => {
                setData({
                  payment_type: val,
                  partyable_type:
                    val === "receive"
                      ? "App\\Models\\Sales\\Customer"
                      : val === "pay"
                        ? "App\\Models\\Purchase\\Supplier"
                        : null,
                });
              }}
            />
          </FormInput>
          {data.payment_type && (
            <FormInput
              required={true}
              disabled={!data.payment_type}
              label={t("finances.paymentEntry.columns.party")}
            >
              {data.payment_type === "receive" ? (
                <CustomerLinkModel
                  value={data.partyable}
                  onValueChange={(val) => setData("partyable", val)}
                  placeholder={t(
                    "finances.paymentEntry.columns.party.placeholder",
                  )}
                />
              ) : (
                <SupplierLinkModel
                  value={data.partyable}
                  onValueChange={(val) => setData("partyable", val)}
                  placeholder={t(
                    "finances.paymentEntry.columns.party.placeholder",
                  )}
                />
              )}
            </FormInput>
          )}

          <FormInput
            className="col-start-1"
            required={true}
            label={t("finances.paymentEntry.columns.payment_method")}
          >
            <PaymentMethodLinkModel
              value={data.payment_method}
              onValueChange={(val) => setData("payment_method", val)}
              placeholder={t(
                "finances.paymentEntry.columns.payment_method.placeholder",
              )}
            />
          </FormInput>

          <FormInput
            required={true}
            label={t("finances.paymentEntry.columns.paid_amount")}
          >
            <CurrencyInput
              className="text-left"
              value={data.paid_amount}
              onValueChange={(val) => setData("paid_amount", val)}
            />
          </FormInput>
        </div>
      </FormPageContent>
    </>
  );
}
