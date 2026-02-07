import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";
import CurrencyInput from "@/Components/CurrencyInput";
import CurrencyLinkModel from "@/Pages/Core/CurrencyLinkModel";
import CustomerLinkModel from "@/Pages/Sales/Customers/CustomerLinkModel";
import DatetimePicker from "@/Components/DatetimePicker";
import FormInput from "@/Components/FormInput";
import PaymentMethodLinkModel from "../PaymentMethods/PaymentMethodLinkModel";
import React from "react";
import Select from "@/Components/Select";
import SupplierLinkModel from "@/Pages/Purchase/Suppliers/SupplierLinkModel";
import { useLaravelReactI18n } from "laravel-react-i18n";
import LinkModel from "@/Components/LinkModel";
import AccountLinkModel from "../Accounts/AccountLinkModel";
import { Textarea } from "@/Components/ui/textarea";

export default function Form() {
  const { data, setData } = useFormPage();
  const { t } = useLaravelReactI18n();

  return (
    <>
      <FormPageContent title={"Payment Entry"} value="detail">
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
            className="col-start-1"
            required={true}
            label={t("finances.paymentEntry.columns.payment_type")}
          >
            <Select
              placeholder={t(
                "finances.paymentEntry.columns.payment_type.placeholder",
              )}
              optionTrans="finances.paymentEntry.columns.payment_type.options"
              options={["receive", "pay"]}
              value={data.payment_type}
              onValueChange={(val) => {
                setData({
                  payment_type: val,
                });
              }}
            />
          </FormInput>
          <FormInput
            required={true}
            label={t("finances.paymentSchedule.columns.reference_to")}
            name="reference_to"
            className="col-start-2"
          >
            <LinkModel
              className="pointer-events-auto"
              value={data.paymentable}
              model={
                data.payment_type === "receive"
                  ? "App\\Models\\Finances\\SalesInvoice"
                  : data.payment_type === "pay"
                    ? "App\\Models\\Finances\\PurchaseInvoice"
                    : null
              }
              disabledAddButton={true}
              with={[
                "currency",
                ...(data.payment_type === "receive"
                  ? ["customer", "currency"]
                  : data.payment_type === "pay"
                    ? []
                    : []),
              ]}
              onValueChange={(val) => setData("paymentable", val)}
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
      <FormPageContent title={"Account"} value="detail">
        <div className="grid md:grid-cols-2  gap-x-3 gap-y-4">
          <FormInput
            required={true}
            label={t("finances.paymentEntry.columns.account_paid_to")}
          >
            <AccountLinkModel
              value={data?.account_paid_to}
              onValueChange={(val) => setData("account_paid_to", val)}
            />
          </FormInput>
          <FormInput
            required={true}
            label={t("finances.paymentEntry.columns.account_paid_from")}
          >
            <AccountLinkModel
              value={data?.account_paid_from}
              onValueChange={(val) => setData("account_paid_from", val)}
            />
          </FormInput>
        </div>
      </FormPageContent>
      <FormPageContent title={"Notes"} value="detail" collapsible>
        <div className="px-1 py-1">
          <FormInput>
            <Textarea
              rows={3}
              value={data.external_note ?? ""}
              onChange={(e) => setData("external_note", e.target.value)}
            />
          </FormInput>
        </div>
      </FormPageContent>
    </>
  );
}
