import {
  FormPageContent,
  FormPageContentTitle,
  useFormPage,
} from "@/Pages/Core/FormPage";
import React, { useCallback, useMemo } from "react";
import { calculateArray, generateRandom, getDataModel } from "@/lib/utils";

import AccountLinkModel from "../Accounts/AccountLinkModel";
import AdditionalDiscount from "../Components/AdditionalDiscount";
import NumberInput from "@/Components/NumberInput";
import CurrencyLinkModel from "@/Pages/Core/CurrencyLinkModel";
import DatetimePicker from "@/Components/DatetimePicker";
import { FormCheckbox } from "@/Components/ui/checkbox";
import FormInput from "@/Components/FormInput";
import FormTable from "@/Components/FormTable";
import ItemForm from "./ItemForm";
import ItemUnitLinkModel from "@/Pages/Inventory/Items/ItemUnitLinkModel";
import PurchaseOrderItemLinkModel from "@/Pages/Purchase/PurchaseOrders/PurchaseOrderItemLinkModel";
import PaymentSchedule from "../Components/PaymentSchedule";
import PurchaseInvoiceLinkModel from "../PurchaseInvoice/PurchaseInvoiceLinkModel";
import PurchaseOrderLinkModel from "@/Pages/Purchase/PurchaseOrders/PurchaseOrderLinkModel";
import SupplierLinkModel from "@/Pages/Purchase/Suppliers/SupplierLinkModel";
import TaxLinkModel from "@/Pages/Finances/Taxes/TaxLinkModel";
import { Textarea } from "@/Components/ui/textarea";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";

export default function Form() {
  const defaultValue = useCallback(async () => {
    const accounts = await getDataModel("App\\Models\\Finances\\Account", {
      root_type: "liability",
      account_type: {
        in: ["stock_received_but_not_billed", "payable"],
      },
      is_contra: false,
    });
    const expenseHeadAccount = accounts.filter(
      (x) => x.account_type == "stock_received_but_not_billed",
    )[0];
    const creditAccount = accounts.filter(
      (x) => x.account_type == "payable",
    )[0];
    return {
      date: new Date(),
      expense_head_account: expenseHeadAccount,
      credit_account: creditAccount,
    };
  }, []);
  const { t } = useLaravelReactI18n();
  const { data, setData, disabled } = useFormPage(defaultValue, {
    notUseWhenCreate: true,
  });

  const { default_currency_id } = usePage().props.preferences;
  const amount = useMemo(() => {
    return calculateArray(data.items, "amount", "+");
  }, [data.items]);

  const net_amount = useMemo(() => {
    return calculateArray(data.items, "basic_amount", "+");
  }, [data.items]);

  const tax_amount = useMemo(() => {
    return calculateArray(data.items, "tax_amount", "+");
  }, [data.items]);

  const itemColumns = useMemo(() => {
    return [
      {
        name: "purchase_order_item",
        titleTrans: "finances.purchaseInvoice.columns.item",
        required: true,
        width: 2,
        cell({ dataRow, setData, attributes }) {
          return (
            <PurchaseOrderItemLinkModel
              placeholder={t(
                "finances.purchaseInvoice.columns.item.placeholder",
              )}
              value={dataRow.purchase_order_item ?? null}
              disabled={!data.purchase_order}
              onValueChange={(val) => {
                setData({
                  purchase_order_item: val,
                  unit: val?.unit,
                  conversion_factor: val?.conversion_factor,
                  quantity: val?.unbilled_quantity,
                  rate: val?.rate,
                  tax: val?.tax,
                  description: val?.description,
                });
              }}
              {...attributes}
              as="item:item.item_id"
              canNavigation="App\Models\Inventory\Item"
              filters={{
                purchase_order_id: data.purchase_order?.id ?? null,
                unbilled_quantity: { ">": 0 },
              }}
              with={["item", "unit", "tax"]}
              fields={[
                "unbilled_quantity",
                "rate",
                "description",
                "conversion_factor",
              ]}
            />
          );
        },
      },
      {
        name: "description",
        titleTrans: "finances.purchaseInvoice.columns.description",
        show: false,
        type: "text",
        width: 2,
        cell({ dataRow, data, setData, attributes }) {
          return (
            <Textarea
              disabled={!dataRow?.purchase_order_item}
              rows={1}
              value={data ?? ""}
              onChange={(e) => setData("description", e.target.value)}
              {...attributes}
            />
          );
        },
      },
      {
        name: "quantity",
        titleTrans: "finances.purchaseInvoice.columns.quantity",
        required: true,
        type: "number",
        width: 1,
        cell({ dataRow, data, setData, attributes }) {
          return (
            <NumberInput
              {...attributes}
              disabled={!dataRow?.purchase_order_item}
              readOnly={
                attributes.readOnly || (dataRow.readOnly && !dataRow.isCustom)
              }
              value={data}
              onValueChange={(value) => {
                setData("quantity", value);
              }}
            />
          );
        },
      },
      {
        name: "unit",
        titleTrans: "finances.purchaseInvoice.columns.unit",
        required: true,
        cell({ data, setData, attributes, dataRow }) {
          return (
            <ItemUnitLinkModel
              disabled={!dataRow?.purchase_order_item}
              placeholder={t(
                "finances.purchaseInvoice.columns.unit.placeholder",
              )}
              value={data}
              onValueChange={(val) =>
                setData({
                  unit: val,
                  conversion_factor: val?.conversion_factor,
                })
              }
              {...attributes}
              filters={{
                item_id: dataRow?.purchase_order_item?.item?.item_id,
              }}
            />
          );
        },
      },
      {
        name: "tax",
        titleTrans: "finances.purchaseInvoice.columns.tax",
        required: true,
        width: 1,
        cell({ data, setData, attributes, dataRow }) {
          return (
            <TaxLinkModel
              disabled={!dataRow?.purchase_order_item}
              placeholder={t(
                "finances.purchaseInvoice.columns.tax.placeholder",
              )}
              value={data}
              onValueChange={(val) => {
                setData("tax", val);
              }}
              {...attributes}
            />
          );
        },
      },
      {
        name: "rate",
        titleTrans: "finances.purchaseInvoice.columns.rate",
        required: true,
        width: 1,
        cell({ data: rate, setData, attributes, dataRow }) {
          return (
            <NumberInput
              decimalScale={2}
              currencyCode={data?.currency?.code}
              disabled={!dataRow?.purchase_order_item}
              value={rate}
              onValueChange={(val) => {
                setData("rate", val);
              }}
              {...attributes}
            />
          );
        },
      },
    ];
  }, [data]);

  return (
    <>
      <FormPageContent
        value="detail"
        title={t("finances.purchaseInvoice.detail")}
      >
        <div className="grid gap-x-4 gap-y-4 md:grid-cols-2 [&>div]:grid [&>div]:gap-y-4 [&>div]:grid-cols-1 [&>div]:content-start">
          <div>
            <FormInput
              name="date"
              label={t("finances.purchaseInvoice.columns.date")}
              required
            >
              <DatetimePicker
                type="datetime"
                value={data?.date}
                onValueChange={(val) => {
                  setData("date", val);
                }}
              />
            </FormInput>
            <FormInput
              label={t("finances.purchaseInvoice.columns.purchase_order")}
              required
              disabled={data.is_return && !data.purchase_order}
              readOnly={data.is_return}
              name="purchase_order"
            >
              <PurchaseOrderLinkModel
                disabledAddButton
                // filters={{
                //   status: {
                //     in: ["to_receive"],
                //   },
                // }}
                placeholder={t(
                  "finances.purchaseInvoice.columns.purchase_order.placeholder",
                )}
                with={[
                  "items",
                  "supplier",
                  "currency",
                  "items.item",
                  "items.tax",
                  "items.unit",
                  "paymentSchedules",
                  "paymentSchedules.paymentMethod",
                ]}
                fields={[
                  "amount",
                  "items.rate",
                  "items.basic_amount",
                  "items.tax_rate",
                  "items.tax_amount",
                  "items.amount",
                  "items.unbilled_quantity",
                  "items.description",
                  "items.conversion_factor",
                  "items.unit",
                  "items.tax",
                ]}
                value={data.purchase_order}
                onValueChange={(val) => {
                  setData((prev) => {
                    return {
                      ...prev,
                      purchase_order: val,
                      supplier: val?.supplier,
                      currency: val?.currency,
                      items: val?.items?.map((item) => {
                        return {
                          id: generateRandom(8),
                          purchase_order_item: item,
                          purchase_order_item_id: item.id,
                          unit: item.unit,
                          tax: item.tax,
                          quantity: item.unbilled_quantity ?? 0,
                          rate: item.rate,
                          description: item.description,
                          conversion_factor: item.conversion_factor,
                          amount: item.basic_amount + item.tax_amount,
                        };
                      }),
                      payment_schedules:
                        val?.payment_schedules?.map((paymentSchedule) => {
                          return {
                            ...paymentSchedule,
                            id: generateRandom(8),
                          };
                        }) ?? [],
                      amount: val?.amount,
                      discount_on: val?.discount_on,
                      discount_rate: val?.discount_rate,
                      discount_amount: val?.discount_amount,
                      exchange_rate: val?.exchange_rate,
                      external_note: val?.external_note,
                    };
                  });
                }}
              />
            </FormInput>

            <FormInput
              className="col-start-1"
              label={t("finances.purchaseInvoice.currency")}
              name="currency"
              readOnly
              disabled={!data.purchase_order}
            >
              <CurrencyLinkModel
                placeholder={t("finances.purchaseInvoice.currency.placeholder")}
                value={data.currency}
                onValueChange={(val) => {
                  setData("currency", val);
                }}
              />
            </FormInput>

            {data?.currency?.code &&
              data.currency.code !== default_currency_id && (
                <FormInput
                  label={t("finances.purchaseInvoice.exchange_rate")}
                  name="exchange_rate"
                  readOnly
                >
                  <NumberInput
                    className="text-left"
                    decimalScale={2}
                    value={data.exchange_rate}
                    onValueChange={(value) => {
                      setData("exchange_rate", value);
                    }}
                  />
                </FormInput>
              )}
          </div>
          <div>
            <FormCheckbox
              className="mt-8 mb-3"
              label={t("finances.purchaseInvoice.columns.is_return")}
              checked={data.is_return}
              onCheckedChange={(val) => {
                setData((prev) => ({
                  ...prev,
                  is_return: val,
                  purchase_order: undefined,
                  supplier: undefined,
                  currency: undefined,
                  items: [],
                  payment_schedules: [],
                  amount: 0,
                  discount_on: undefined,
                  discount_rate: undefined,
                  discount_amount: undefined,
                  exchange_rate: undefined,
                  external_note: undefined,
                  return_against: undefined,
                }));
              }}
            />
            {data.is_return && (
              <FormInput
                label={t("finances.purchaseInvoice.columns.return_against")}
                name="return_against"
                required
              >
                <PurchaseInvoiceLinkModel
                  filters={{
                    date: {
                      "<=": data?.date ?? new Date().toISOString(),
                    },
                    status: {
                      jsonContains: ["unpaid", "partially_paid", "paid"],
                    },
                  }}
                  with={[
                    "supplier",
                    "purchaseOrder",
                    "creditAccount",
                    "expenseHeadAccount",
                    "currency",
                    "items",
                    "items.item",
                    "items.tax",
                    "items.unit",
                  ]}
                  fields={[
                    "items.rate",
                    "items.basic_amount",
                    "items.tax_rate",
                    "items.tax_amount",
                    "items.amount",
                  ]}
                  value={data.return_against}
                  onValueChange={(val) => {
                    setData((prev) => ({
                      ...prev,
                      return_against: val,
                      purchase_order: val?.purchase_order,
                      supplier: val?.supplier,
                      currency: val?.currency,
                      exchange_rate: val?.exchange_rate,
                      credit_account:
                        val?.credit_account ?? prev.credit_account,
                      expense_head_account:
                        val?.expense_head_account ?? prev.expense_head_account,
                      discount_on: val?.discount_on,
                      discount_rate: val?.discount_rate,
                      discount_amount: val?.discount_amount,
                      items: val?.items?.map((item) => {
                        return {
                          ...item,
                          id: generateRandom(8),
                          return_against_item_id: item.id,
                        };
                      }),
                    }));
                  }}
                />
              </FormInput>
            )}
            <FormInput
              className="col-start-1"
              label={t("finances.purchaseInvoice.supplier")}
              required={true}
              name="supplier"
              readOnly
              disabled={!data.purchase_order}
            >
              <SupplierLinkModel with={["branches"]} value={data.supplier} />
            </FormInput>
          </div>
        </div>
      </FormPageContent>
      <FormPageContent
        value="detail"
        title={t("finances.purchaseInvoice.columns.accounts")}
      >
        <div className="grid gap-4  grid-cols-2">
          <FormInput
            label={t("finances.purchaseInvoice.columns.expense_head_account")}
            name="expense_head_account"
            required
          >
            <AccountLinkModel
              filters={{
                root_type: "liability",
                account_type: "stock_received_but_not_billed",
                is_group: false,
              }}
              placeholder={t(
                "finances.purchaseInvoice.columns.accounts.placeholder",
              )}
              value={data.expense_head_account}
              onValueChange={(val) => {
                setData("expense_head_account", val);
              }}
            />
          </FormInput>
          <FormInput
            label={t("finances.purchaseInvoice.columns.credit_account")}
            name="credit_account"
            required
          >
            <AccountLinkModel
              filters={{
                root_type: "liability",
                account_type: "payable",
                is_group: false,
              }}
              placeholder={t(
                "finances.purchaseInvoice.columns.accounts.placeholder",
              )}
              value={data.credit_account}
              onValueChange={(val) => {
                setData("credit_account", val);
              }}
            />
          </FormInput>
        </div>
      </FormPageContent>
      <FormPageContent
        value="detail"
        title={t("finances.purchaseInvoice.items")}
      >
        <FormPageContentTitle className="flex items-center justify-between gap-x-4">
          {t("finances.purchaseInvoice.items")}
        </FormPageContentTitle>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <FormTable
            name="PurchaseInvoiceItems"
            className="col-start-1 col-span-2"
            form={<ItemForm />}
            columns={itemColumns}
            value={data?.items ?? []}
            onValueChange={(v) => setData("items", v)}
            mapItem={({ item }) => {
              const amount = item.quantity * item.price;
              const rateAmount = (amount * (item.tax?.rate ?? 0)) / 100;
              return {
                ...item,
                tax_amount: rateAmount,
                basic_amount: amount,
                amount: amount + rateAmount,
              };
            }}
          />
          {data?.currency?.code &&
            data?.currency?.code !== default_currency_id && (
              <FormInput
                readOnly
                label={`${t("finances.purchaseInvoice.columns.basic_amount")} (${default_currency_id.toUpperCase()})`}
              >
                <NumberInput
                  className="text-right"
                  decimalScale={2}
                  value={net_amount * (data?.exchange_rate ?? 1)}
                  currencyCode="default"
                ></NumberInput>
              </FormInput>
            )}
          <FormInput
            readOnly
            label={`${t("finances.purchaseInvoice.columns.basic_amount")} (${(data?.currency?.code ?? default_currency_id).toUpperCase()})`}
            className="col-start-2"
          >
            <NumberInput
              decimalScale={2}
              className="text-right"
              value={net_amount}
              currencyCode={data?.currency?.code ?? "default"}
            ></NumberInput>
          </FormInput>
          {data?.currency?.code &&
            data?.currency?.code !== default_currency_id && (
              <FormInput
                readOnly
                label={`${t("finances.purchaseInvoice.columns.tax_amount")} (${default_currency_id.toUpperCase()})`}
              >
                <NumberInput
                  className="text-right"
                  decimalScale={2}
                  value={tax_amount * (data?.exchange_rate ?? 1)}
                  currencyCode="default"
                ></NumberInput>
              </FormInput>
            )}
          <FormInput
            readOnly
            label={`${t("finances.purchaseInvoice.columns.tax_amount")} (${(data?.currency?.code ?? default_currency_id).toUpperCase()})`}
            className="col-start-2"
          >
            <NumberInput
              decimalScale={2}
              className="text-right"
              value={tax_amount}
              currencyCode={data?.currency?.code ?? "default"}
            ></NumberInput>
          </FormInput>
          {data?.currency?.code &&
            data?.currency?.code !== default_currency_id && (
              <FormInput
                readOnly
                label={`${t("finances.purchaseInvoice.columns.total")} (${default_currency_id.toUpperCase()})`}
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
            label={`${t("finances.purchaseInvoice.columns.total")} (${(data?.currency?.code ?? default_currency_id).toUpperCase()})`}
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
      <AdditionalDiscount
        data={data}
        setData={setData}
        netAmount={net_amount}
        taxAmount={tax_amount}
      />
      <FormPageContent
        value="detail"
        title={t("finances.purchaseInvoice.columns.external_note")}
        collapsible
      >
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
      <PaymentSchedule
        readOnly={disabled}
        value={data?.payment_schedules ?? []}
        onValueChange={(v) => setData("payment_schedules", v)}
        additionalData={(value) => {
          const result = {};
          value.forEach((item) => {
            const payment_amount = (amount * item?.invoice_portion) / 100;

            result[item.id] = {
              payment_amount,
              outstanding_amount: payment_amount,
            };
          });

          return result;
        }}
        date={data?.date}
        currencyCode={data?.currency?.code}
      />
    </>
  );
}
