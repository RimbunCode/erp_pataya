import {
  FormPageContent,
  FormPageContentTitle,
  useFormPage,
} from "@/Pages/Core/FormPage";

import AccountLinkModel from "../Accounts/AccountLinkModel";
import CurrencyInput from "@/Components/CurrencyInput";
import CurrencyLinkModel from "@/Pages/Core/CurrencyLinkModel";
import CustomerLinkModel from "@/Pages/Sales/Customers/CustomerLinkModel";
import DatetimePicker from "@/Components/DatetimePicker";
import FormInput from "@/Components/FormInput";
import LinkModel from "@/Components/LinkModel";
import PaymentMethodLinkModel from "../PaymentMethods/PaymentMethodLinkModel";
import React from "react";
import Select from "@/Components/Select";
import SupplierLinkModel from "@/Pages/Purchase/Suppliers/SupplierLinkModel";
import { Textarea } from "@/Components/ui/textarea";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Form() {
  const { data, setData } = useFormPage(
    {
      date: new Date(),
    },
    {
      trackDefaultValue: false,
      notUseWhenCreate: true,
    },
  );
  const { t } = useLaravelReactI18n();

  return (
    <>
      <FormPageContent value="detail">
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
            label={t("finances.paymentEntry.columns.payment_type")}
          >
            <Select
              optionTrans="finances.paymentEntry.columns.payment_type.options"
              options={["receive", "pay", "internal_transfer"]}
              value={data.payment_type}
              onValueChange={(val) => {
                setData((prev) => ({
                  ...prev,
                  payment_type: val,
                  party_type: val
                    ? val === "receive"
                      ? "customer"
                      : val === "pay"
                        ? "supplier"
                        : null
                    : null,
                  payment_method:
                    prev.payment_type != val ? null : prev.payment_method,
                }));
              }}
            />
          </FormInput>
          {data?.payment_type && data?.payment_type !== "internal_transfer" && (
            <FormInput
              className="col-start-1"
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
          )}
        </div>
      </FormPageContent>
      {data?.payment_type && data?.payment_type !== "internal_transfer" && (
        <FormPageContent value="detail">
          <FormPageContentTitle>
            {t(
              "finances.paymentEntry." +
                (data?.payment_type === "receive"
                  ? "payment_from"
                  : "payment_to"),
            )}
          </FormPageContentTitle>
          <div className="grid gap-x-4 gap-y-4 md:grid-cols-2 [&>div]:grid [&>div]:gap-y-4 [&>div]:grid-cols-1 [&>div]:content-start">
            <div>
              <FormInput
                name="party_type"
                required
                label={t("finances.paymentEntry.columns.party_type")}
              >
                <Select
                  placeholder={t(
                    "finances.paymentEntry.columns.party_type.placeholder",
                  )}
                  optionTrans="finances.paymentEntry.columns.party_type.options"
                  options={["customer", "supplier"]}
                  value={data.party_type}
                  onValueChange={(val) => {
                    setData("party_type", val);
                  }}
                />
              </FormInput>
              {data.party_type && (
                <FormInput
                  required={true}
                  disabled={!data.party_type || !data.paymentable}
                  readOnly
                  label={t(
                    "finances.paymentEntry.columns.party_type.options." +
                      data.party_type,
                  )}
                >
                  {data.party_type === "customer" ? (
                    <CustomerLinkModel
                      value={data.partyable}
                      onValueChange={(val) => setData("partyable", val)}
                    />
                  ) : (
                    <SupplierLinkModel
                      value={data.partyable}
                      onValueChange={(val) => setData("partyable", val)}
                    />
                  )}
                </FormInput>
              )}
            </div>
            <div>
              <FormInput
                required={true}
                label={t("finances.paymentEntry.columns.paymentable")}
                name="reference_to"
                className="col-start-1"
              >
                <LinkModel
                  disabled={!data.party_type}
                  className="pointer-events-auto"
                  value={data.paymentable}
                  filters={{
                    status: {
                      jsonContains: ["unpaid", "partially_paid", "returned"],
                    },
                    ...((data.party_type === "customer" &&
                      data.payment_type === "receive") ||
                    (data.party_type === "supplier" &&
                      data.payment_type === "pay")
                      ? {
                          return_against_id: null,
                        }
                      : {
                          return_against_id: {
                            not: null,
                          },
                        }),
                  }}
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
                    "paymentSchedules",
                    "paymentSchedules.paymentTerm",
                    "paymentSchedules.paymentMethod",
                    ...(data.party_type === "customer"
                      ? ["customer", "debitAccount"]
                      : data.party_type === "supplier"
                        ? ["supplier", "creditAccount"]
                        : []),
                  ]}
                  onValueChange={(val) => {
                    setData((prev) => {
                      return {
                        ...prev,
                        paymentable: val,
                        currency: val?.currency,
                        exchange_rate: val?.exchange_rate ?? 1,
                        partyable: val?.[prev.party_type] ?? null,
                        [data.party_type === "supplier"
                          ? "account_paid_to"
                          : "account_paid_from"]:
                          val?.[
                            data.party_type === "supplier"
                              ? "credit_account"
                              : "debit_account"
                          ],
                      };
                    });
                  }}
                />
              </FormInput>
            </div>
          </div>
        </FormPageContent>
      )}
      <FormPageContent
        title={t("finances.paymentEntry.accounts")}
        value="detail"
      >
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
      <FormPageContent title={t("finances.paymentEntry.amount")} value="detail">
        <div className="grid md:grid-cols-2  gap-x-3 gap-y-4">
          {data?.payment_type && data?.payment_type !== "internal_transfer" && (
            <>
              <FormInput
                readOnly
                disabled={!data.paymentable}
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
                readOnly
                disabled={!data.paymentable}
                label={t("finances.paymentEntry.columns.exchange_rate")}
              >
                <CurrencyInput
                  disabled={!data.currency}
                  className="text-left"
                  value={data.exchange_rate}
                  onValueChange={(val) => setData("exchange_rate", val)}
                />
              </FormInput>
            </>
          )}
          <FormInput
            required={true}
            className="col-start-1"
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
      <FormPageContent
        title={t("finances.paymentEntry.columns.notes")}
        value="detail"
        collapsible
        defaultOpen={data.notes}
      >
        <Textarea
          rows={3}
          value={data.notes ?? ""}
          onChange={(e) => setData("notes", e.target.value)}
        />
      </FormPageContent>
    </>
  );
}
