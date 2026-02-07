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
            label={t("finances.paymentEntry.columns.paymentable")}
            name="reference_to"
            className="col-start-2"
          >
            <LinkModel
              className="pointer-events-auto"
              value={data.paymentable}
              model={
                data.party_type === "customer"
                  ? "App\\Models\\Finances\\SalesInvoice"
                  : data.party_type === "supplier"
                    ? "App\\Models\\Finances\\PurchaseInvoice"
                    : null
              }
              disabledAddButton={true}
              with={[
                "currency",
                ...(data.party_type === "customer"
                  ? ["customer", "currency"]
                  : data.party_type === "supplier"
                    ? ["supplier", "currency"]
                    : []),
              ]}
              onValueChange={(val) => {
                setData((prev) => ({
                  ...prev,
                  paymentable: val,
                  currency: val?.currency,
                  exchange_rate: val?.exchange_rate ?? undefined,
                  partyable: val[data.party_type] ?? null,
                }));
              }}
            />
          </FormInput>
          <FormInput name="party_type" required>
            <Select
              placeholder={t(
                "finances.paymentEntry.columns.party_type.placeholder",
              )}
              optionTrans="finances.paymentEntry.columns.party_type.options"
              options={["customer", "supplier"]}
              value={data.party_type}
              onValueChange={(val) => {
                setData({
                  party_type: val,
                });
              }}
            />
          </FormInput>
          {data.payment_type && (
            <FormInput
              required={true}
              disabled={!data.payment_type}
              label={t("finances.paymentEntry.columns.partyable")}
            >
              {data.party_type === "customer" ? (
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
          <FormInput label={t("finances.paymentEntry.columns.exchange_rate")}>
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
              with={["defaultAccount"]}
              value={data.payment_method}
              onValueChange={(val) => {
                setData((prev) => ({
                  ...prev,
                  payment_method: val,
                  [data.payment_type === "receive"
                    ? "account_paid_to"
                    : "account_paid_from"]: val?.default_account,
                }));
              }}
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
            label={t("finances.paymentEntry.columns.account_paid_from")}
          >
            <AccountLinkModel
              filters={
                data.payment_type === "receive"
                  ? { root_type: "asset", account_type: "receivable" }
                  : data.payment_type === "pay"
                    ? { root_type: "asset", is_group: false }
                    : {}
              }
              value={data?.account_paid_from}
              onValueChange={(val) => setData("account_paid_from", val)}
            />
          </FormInput>
          <FormInput
            required={true}
            label={t("finances.paymentEntry.columns.account_paid_to")}
          >
            <AccountLinkModel
              filters={
                data.payment_type === "receive"
                  ? { root_type: "asset", is_group: false }
                  : data.payment_type === "pay"
                    ? { root_type: "liability", account_type: "payable" }
                    : {}
              }
              value={data?.account_paid_to}
              onValueChange={(val) => setData("account_paid_to", val)}
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
