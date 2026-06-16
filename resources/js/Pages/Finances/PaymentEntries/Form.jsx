import { Alert, AlertIcon, AlertTitle } from "@/Components/ui/alert";
import {
  FormPageContent,
  FormPageContentTitle,
  useFormPage,
} from "@/Pages/Core/FormPage";
import React, { useCallback } from "react";

import AccountLinkModel from "../Accounts/AccountLinkModel";
import { Button } from "@/Components/ui/button";
import NumberInput from "@/Components/NumberInput";
import CurrencyLinkModel from "@/Pages/Core/CurrencyLinkModel";
import CustomerLinkModel from "@/Pages/Sales/Customers/CustomerLinkModel";
import DatetimePicker from "@/Components/DatetimePicker";
import FormInput from "@/Components/FormInput";
import FormTable from "@/Components/FormTable";
import LinkModel from "@/Components/LinkModel";
import PaymentMethodLinkModel from "../PaymentMethods/PaymentMethodLinkModel";
import { RiCheckboxCircleLine } from "@remixicon/react";
import Select from "@/Components/Select";
import SupplierLinkModel from "@/Pages/Purchase/Suppliers/SupplierLinkModel";
import { Textarea } from "@/Components/ui/textarea";
import { toast } from "sonner";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Form() {
  const { data, defaultData, setData } = useFormPage(
    {
      date: new Date(),
    },
    {
      trackDefaultValue: false,
      notUseWhenCreate: true,
    },
  );
  const { t } = useLaravelReactI18n();
  const paymentEntryScheduleColumns = [
    {
      name: "due_date",
      titleTrans: "finances.paymentSchedule.columns.due_date",
      required: true,
      cell({ data, attributes }) {
        return <DatetimePicker type="datetime" value={data} {...attributes} />;
      },
    },
    {
      name: "description",
      titleTrans: "finances.paymentSchedule.columns.description",
      show: false,
      type: "text",
      width: 2,
      cell({ dataRow, data, attributes }) {
        return (
          <Textarea
            disabled={!dataRow?.item}
            rows={1}
            value={data ?? ""}
            {...attributes}
          />
        );
      },
    },
    {
      name: "outstanding_amount",
      titleTrans: "finances.paymentSchedule.columns.outstanding_amount",
      required: true,
      readOnly: true,
      width: 1,
      cell({ dataRow, data, attributes }) {
        return (
          <NumberInput
            disabled={!dataRow.invoice_portion}
            decimalScale={2}
            currencyCode={data?.currency?.code}
            value={data}
            {...attributes}
          />
        );
      },
    },
    {
      name: "payment_method",
      titleTrans: "finances.paymentSchedule.columns.payment_method",
      width: 1,
      cell({ data, attributes }) {
        return (
          <PaymentMethodLinkModel
            value={data}
            placeholder={t(
              "finances.paymentTerm.columns.payment_method.placeholder",
            )}
            {...attributes}
          />
        );
      },
    },
    {
      name: "discount_type",
      titleTrans: "finances.paymentSchedule.columns.discount_type",
      width: 1,
      cell({ data, attributes }) {
        return (
          <Select
            value={data}
            {...attributes}
            placeholder={t(
              "finances.paymentSchedule.columns.discount_type.placeholder",
            )}
            optionTrans="finances.paymentSchedule.columns.discount_type.options"
            options={["percentage", "amount"]}
          />
        );
      },
    },
    {
      name: "discount_date",
      titleTrans: "finances.paymentSchedule.columns.discount_date",
      width: 1,
      cell({ data, attributes }) {
        return <DatetimePicker type="datetime" value={data} {...attributes} />;
      },
    },
    {
      name: "discount",
      titleTrans: "finances.paymentSchedule.columns.discount",
      width: 1,
      cell({ data: discount, dataRow, attributes }) {
        return (
          <NumberInput
            className="text-left"
            value={discount}
            currencyCode={
              dataRow.discount_type == "percentage"
                ? undefined
                : data?.currency?.code
            }
            decimalScale={2}
            suffix={dataRow.discount_type == "percentage" ? "%" : ""}
            min={dataRow.discount_type == "percentage" && 0}
            max={dataRow.discount_type == "percentage" && 100}
            {...attributes}
          />
        );
      },
    },
  ];
  const getAmountPayment = useCallback((paymentSchedules) => {
    let amount = 0;
    paymentSchedules.forEach((paymentSchedule, idx) => {
      if (
        paymentSchedule.outstanding_amount <= 0 ||
        (idx > 0 && new Date() < new Date(paymentSchedule.due_date))
      ) {
        return;
      }

      amount += paymentSchedule.outstanding_amount;
    });
    return amount;
  }, []);
  const selectPayment = useCallback(
    (index) => {
      if (index < 0) return;
      setData((prev) => {
        let amount = 0;
        if (index === 0) {
          amount =
            prev?.paymentable?.payment_schedules[index]?.outstanding_amount;
        } else {
          for (let i = 0; i <= index; i++) {
            amount +=
              prev?.paymentable?.payment_schedules[i]?.outstanding_amount;
          }
        }
        const paymentMethod =
          prev?.paymentable?.payment_schedules[index]?.payment_method;
        const account = paymentMethod?.default_account;
        const keyAccount =
          prev.party_type === "supplier"
            ? "account_paid_from"
            : "account_paid_to";
        return {
          ...prev,
          paid_amount: amount,
          payment_method: paymentMethod,
          [keyAccount]: account ?? prev?.[keyAccount],
        };
      });
      toast.custom((toastId) => (
        <Alert
          variant="success"
          icon="success"
          onClose={() => toast.dismiss(toastId)}
        >
          <AlertIcon>
            <RiCheckboxCircleLine />
          </AlertIcon>
          <AlertTitle>
            {t("finances.paymentTermTemplate.alert.success")}
          </AlertTitle>
        </Alert>
      ));
    },
    [setData],
  );
  const paymentEntryScheduleActions = useCallback(
    ({ row, index }) => {
      if (defaultData?.submitted_at) return null;
      return (
        <Button
          disabled={row?.outstanding_amount <= 0}
          size="sm"
          className="h-8 mr-4"
          onClick={() => selectPayment(index)}
          type="button"
        >
          {t("finances.paymentSchedule.select")}
        </Button>
      );
    },
    [selectPayment, defaultData?.submitted_at],
  );
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
                  setData((prev) => {
                    const keyAccount =
                      data.payment_type === "receive"
                        ? "account_paid_to"
                        : "account_paid_from";
                    return {
                      ...prev,
                      payment_method: val,
                      [keyAccount]: val?.default_account ?? prev?.[keyAccount],
                    };
                  });
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
                    "paymentSchedules.paymentMethod",
                    "paymentSchedules.paymentMethod.defaultAccount",
                    ...(data.party_type === "customer"
                      ? ["customer", "debitAccount"]
                      : data.party_type === "supplier"
                        ? ["supplier", "creditAccount"]
                        : []),
                  ]}
                  onValueChange={(val) => {
                    setData((prev) => {
                      const paymentSchedules = val?.payment_schedules ?? [];
                      const amount = getAmountPayment(paymentSchedules ?? []);
                      const paymentMethod =
                        paymentSchedules?.[0]?.payment_method;
                      const account = paymentMethod?.default_account;
                      const keyDefaultAccountPayment =
                        prev.party_type === "supplier"
                          ? "account_paid_from"
                          : "account_paid_to";
                      return {
                        ...prev,
                        paymentable: val,
                        currency: val?.currency,
                        exchange_rate: val?.exchange_rate ?? 1,
                        partyable: val?.[prev.party_type] ?? null,
                        paid_amount: amount,
                        payment_method: paymentMethod,
                        [prev.party_type === "supplier"
                          ? "account_paid_to"
                          : "account_paid_from"]:
                          val?.[
                            prev.party_type === "supplier"
                              ? "credit_account"
                              : "debit_account"
                          ],
                        [keyDefaultAccountPayment]:
                          account ?? prev?.[keyDefaultAccountPayment],
                      };
                    });
                  }}
                />
              </FormInput>
            </div>
            {data?.paymentable && (
              <div className="col-span-full">
                <FormTable
                  name="paymentEntrySchedules"
                  className="col-start-1 col-span-2"
                  readOnly={true}
                  columns={paymentEntryScheduleColumns}
                  value={data?.paymentable.payment_schedules}
                  actions={paymentEntryScheduleActions}
                />
              </div>
            )}
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
                <NumberInput
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
            <NumberInput
              className="text-left"
              decimalScale={2}
              currencyCode={data?.currency?.code}
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
