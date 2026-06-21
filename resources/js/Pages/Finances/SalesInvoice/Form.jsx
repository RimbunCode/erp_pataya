import {
  FormPageContent,
  FormPageContentTitle,
  useFormPage,
} from "@/Pages/Core/FormPage";
import React, { useCallback, useMemo } from "react";
import { calculateArray, generateRandom, getDataModel } from "@/lib/utils";

import AccountLinkModel from "../Accounts/AccountLinkModel";
import AdditionalDiscount from "../Components/AdditionalDiscount";
import BranchLinkModel from "@/Pages/Settings/Branches/BranchLinkModel";
import NumberInput from "@/Components/NumberInput";
import CurrencyLinkModel from "@/Pages/Core/CurrencyLinkModel";
import CustomerLinkModel from "@/Pages/Sales/Customers/CustomerLinkModel";
import DatetimePicker from "@/Components/DatetimePicker";
import { FormCheckbox } from "@/Components/ui/checkbox";
import FormInput from "@/Components/FormInput";
import FormTable from "@/Components/FormTable";
import ItemForm from "./ItemForm";
import ItemUnitLinkModel from "@/Pages/Inventory/Items/ItemUnitLinkModel";
import ItemVariantLinkModel from "@/Pages/Inventory/Items/ItemVariantLinkModel";
import PaymentSchedule from "../Components/PaymentSchedule";
import SalesInvoiceLinkModel from "./SalesInvoiceLinkModel";
import SalesOrderLinkModel from "@/Pages/Sales/SalesOrders/SalesOrderLinkModel";
import TaxLinkModel from "@/Pages/Finances/Taxes/TaxLinkModel";
import { Textarea } from "@/Components/ui/textarea";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";

export default function Form() {
  const { t } = useLaravelReactI18n();
  const defaultValue = useCallback(async () => {
    const accounts = await getDataModel("App\\Models\\Finances\\Account", {
      root_type: {
        in: ["income", "asset"],
      },
      account_type: {
        in: ["income_account", "receivable"],
      },
      is_contra: false,
    });
    const incomeAccount = accounts.filter(
      (x) => x.account_type == "income_account",
    )[0];
    const debitAccount = accounts.filter(
      (x) => x.account_type == "receivable",
    )[0];
    return {
      date: new Date(),
      income_account: incomeAccount,
      debit_account: debitAccount,
    };
  }, []);
  const { data, setData, disabled } = useFormPage(defaultValue, {
    notUseWhenCreate: true,
  });
  const { default_currency_id } = usePage().props.preferences;
  const getContraIncomeAccount = (isContra) => {
    getDataModel(
      "App\\Models\\Finances\\Account",
      {
        root_type: "income",
        account_type: "income_account",
        is_contra: isContra,
      },
      { limit: 1 },
    ).then((res) => {
      console.log(res);
      setData((prev) => ({
        ...prev,
        income_account: res,
      }));
    });
  };
  const net_amount = useMemo(() => {
    return calculateArray(data.items, "basic_amount", "+");
  }, [data.items]);

  const tax_amount = useMemo(() => {
    return calculateArray(data.items, "tax_amount", "+");
  }, [data.items]);

  const amount = useMemo(() => {
    return net_amount + tax_amount - (data?.discount_amount ?? 0);
  }, [net_amount, tax_amount, data.discount_amount]);
  const itemColumns = useMemo(() => {
    return [
      {
        name: "item",
        titleTrans: "finances.salesInvoice.columns.item",
        required: true,
        width: 2,
        cell({ dataRow, setData, attributes }) {
          return (
            <ItemVariantLinkModel
              placeholder={t("finances.salesInvoice.columns.item.placeholder")}
              value={dataRow.item}
              onValueChange={(val) => {
                const defaultUnit = val?.default_uom;
                setData({
                  item: val,
                  unit: defaultUnit,
                  conversion_factor: defaultUnit?.conversion_factor,
                  source_warehouse: data.source_warehouse,
                });
              }}
              {...attributes}
              filters={{
                category: {
                  type: {
                    in: ["service", "stock"],
                  },
                },
              }}
              with={["defaultUom", "item"]}
            />
          );
        },
      },
      {
        name: "description",
        titleTrans: "finances.salesInvoice.columns.description",
        show: false,
        type: "text",
        width: 2,
        cell({ dataRow, data, setData, attributes }) {
          return (
            <Textarea
              disabled={!dataRow?.item}
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
        titleTrans: "finances.salesInvoice.columns.quantity",
        required: true,
        type: "number",
        width: 1,
        cell({ dataRow, data, setData, attributes }) {
          return (
            <NumberInput
              {...attributes}
              disabled={!dataRow?.item}
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
        titleTrans: "finances.salesInvoice.columns.unit",
        required: true,
        cell({ data, setData, attributes, dataRow }) {
          return (
            <ItemUnitLinkModel
              disabled={!dataRow?.item}
              placeholder={t("finances.salesInvoice.columns.unit.placeholder")}
              value={data}
              onValueChange={(val) =>
                setData({
                  unit: val,
                  conversion_factor: val?.conversion_factor,
                })
              }
              {...attributes}
              filters={{
                item_id: dataRow?.item?.item_id,
              }}
            />
          );
        },
      },
      {
        name: "tax",
        titleTrans: "finances.salesInvoice.columns.tax",
        required: true,
        width: 1,
        cell({ data, setData, attributes, dataRow }) {
          return (
            <TaxLinkModel
              disabled={!dataRow?.item}
              placeholder={t("finances.salesInvoice.columns.tax.placeholder")}
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
        name: "price",
        titleTrans: "finances.salesInvoice.columns.price",
        required: true,
        width: 1,
        cell({ data: price, setData, attributes, dataRow }) {
          return (
            <NumberInput
              decimalScale={2}
              currencyCode={data?.currency?.code}
              disabled={!dataRow?.item}
              value={price}
              onValueChange={(val) => {
                setData("price", val);
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
      <FormPageContent value="detail" title={t("finances.salesInvoice.detail")}>
        <div className="grid gap-x-4 gap-y-4 md:grid-cols-2 [&>div]:grid [&>div]:gap-y-4 [&>div]:grid-cols-1 [&>div]:content-start">
          <div>
            <FormInput
              name="date"
              label={t("finances.salesInvoice.columns.date")}
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
              label={t("finances.salesInvoice.columns.sales_order")}
              required
              disabled={data.is_return && !data.sales_order}
              readOnly={data.is_return}
              name="sales_order"
            >
              <SalesOrderLinkModel
                filters={{
                  date: {
                    "<=": data?.date ?? new Date().toISOString(),
                  },
                  status: {
                    jsonContains: ["to_bill"],
                  },
                }}
                placeholder={t(
                  "finances.salesInvoice.columns.sales_order.placeholder",
                )}
                with={[
                  "items",
                  "customer",
                  "customer_branch",
                  "currency",
                  "items.item",
                  "items.tax",
                  "items.unit",
                  "paymentSchedules",
                  "paymentSchedules.paymentMethod",
                ]}
                // Kolom harga (gated visibleFor) yang form butuh dari SO + items.
                fields={[
                  "amount",
                  "items.price",
                  "items.basic_amount",
                  "items.tax_rate",
                  "items.tax_amount",
                ]}
                value={data.sales_order}
                onValueChange={(val) => {
                  setData((prev) => {
                    return {
                      ...prev,
                      id: generateRandom(5),
                      sales_order: val,
                      customer: val?.customer,
                      customer_branch: val?.customer_branch,
                      currency: val?.currency,
                      items: val?.items?.map((item) => {
                        return {
                          ...item,
                          id: generateRandom(8),
                          sales_order_item_id: item.id,
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
              label={t("finances.salesInvoice.currency")}
              name="currency"
              readOnly
              disabled={!data.sales_order}
            >
              <CurrencyLinkModel
                placeholder={t("finances.salesInvoice.currency.placeholder")}
                value={data.currency}
                onValueChange={(val) => {
                  setData("currency", val);
                }}
              />
            </FormInput>

            <FormInput
              label={t("finances.salesInvoice.exchange_rate")}
              name="exchange_rate"
              readOnly
            >
              <NumberInput
                disabled={
                  !(
                    data?.currency?.code &&
                    data?.currency?.code !== default_currency_id
                  )
                }
                className="text-left"
                decimalScale={2}
                value={data.exchange_rate}
                onValueChange={(value) => {
                  setData("exchange_rate", value);
                }}
              />
            </FormInput>
          </div>
          <div>
            <FormCheckbox
              className="mt-8 mb-3"
              label={t("finances.salesInvoice.columns.is_return")}
              checked={data.is_return}
              onCheckedChange={(val) => {
                getContraIncomeAccount(val);
                setData((prev) => ({
                  ...prev,
                  is_return: val,
                  sales_order: undefined,
                  customer: undefined,
                  customer_branch: undefined,
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
                label={t("finances.salesInvoice.columns.return_against")}
                name="return_against"
                required
              >
                <SalesInvoiceLinkModel
                  filters={{
                    date: {
                      "<=": data?.date ?? new Date().toISOString(),
                    },
                    status: {
                      jsonContains: ["unpaid", "partially_paid", "paid"],
                    },
                  }}
                  with={[
                    "customer",
                    "customerBranch",
                    "salesOrder",
                    "debitAccount",
                    "currency",
                    "items",
                    "items.item",
                    "items.tax",
                    "items.unit",
                  ]}
                  fields={[
                    "items.price",
                    "items.basic_amount",
                    "items.tax_rate",
                    "items.tax_amount",
                  ]}
                  value={data.return_against}
                  onValueChange={(val) => {
                    setData((prev) => ({
                      ...prev,
                      return_against: val,
                      sales_order: val?.sales_order,
                      customer: val?.customer,
                      customer_branch: val?.customer_branch,
                      currency: val?.currency,
                      exchange_rate: val?.exchange_rate,
                      debit_account: val?.debit_account ?? prev.debit_account,
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
              label={t("finances.salesInvoice.customer")}
              required={true}
              name="customer"
              readOnly
              disabled={!data.sales_order}
            >
              <CustomerLinkModel
                with={["branches"]}
                value={data.customer}
                onValueChange={(val) => {
                  if (val?.branches?.length <= 1) {
                    setData("customer_branch", val.branches?.[0]);
                  }
                  setData("customer", val);
                }}
              />
            </FormInput>

            <FormInput
              label={t("finances.salesInvoice.branch")}
              required
              name="customer_branch"
              readOnly
            >
              <BranchLinkModel
                disabled={!data.customer}
                value={data.customer_branch}
                onValueChange={(val) => setData("customer_branch", val)}
                disabledNavigation={true}
                filters={{
                  branchable_type: "App\\Models\\Sales\\Customer",
                  branchable_id: data.customer?.id ?? null,
                }}
              />
            </FormInput>
          </div>
        </div>
      </FormPageContent>
      <FormPageContent
        value="detail"
        title={t("finances.salesInvoice.columns.accounts")}
      >
        <div className="grid gap-4  grid-cols-2">
          <FormInput
            label={t("finances.salesInvoice.columns.income_account")}
            name="income_account"
            required
          >
            <AccountLinkModel
              filters={{
                root_type: "income",
                account_type: "income_account",
                is_contra: !!data?.is_return,
                is_group: false,
              }}
              placeholder={t(
                "finances.salesInvoice.columns.accounts.placeholder",
              )}
              value={data.income_account}
              onValueChange={(val) => {
                setData("income_account", val);
              }}
            />
          </FormInput>
          <FormInput
            label={t("finances.salesInvoice.columns.debit_account")}
            name="debit_account"
            required
          >
            <AccountLinkModel
              filters={{
                root_type: "asset",
                is_group: false,
              }}
              placeholder={t(
                "finances.salesInvoice.columns.accounts.placeholder",
              )}
              value={data.debit_account}
              onValueChange={(val) => {
                setData("debit_account", val);
              }}
            />
          </FormInput>
        </div>
      </FormPageContent>
      <FormPageContent value="detail" title={t("finances.salesInvoice.items")}>
        <FormPageContentTitle className="flex items-center justify-between gap-x-4">
          {t("finances.salesInvoice.items")}
        </FormPageContentTitle>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <FormTable
            name="SalesInvoiceItems"
            className="col-start-1 col-span-2"
            form={<ItemForm />}
            disabled={true}
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
                label={`${t("finances.salesInvoice.columns.basic_amount")} (${default_currency_id.toUpperCase()})`}
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
            label={`${t("finances.salesInvoice.columns.basic_amount")} (${(data?.currency?.code ?? default_currency_id).toUpperCase()})`}
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
                label={`${t("finances.salesInvoice.columns.tax_amount")} (${default_currency_id.toUpperCase()})`}
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
            label={`${t("finances.salesInvoice.columns.tax_amount")} (${(data?.currency?.code ?? default_currency_id).toUpperCase()})`}
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
                label={`${t("finances.salesInvoice.columns.total")} (${default_currency_id.toUpperCase()})`}
              >
                <NumberInput
                  className="text-right"
                  decimalScale={2}
                  value={(net_amount + tax_amount) * (data?.exchange_rate ?? 1)}
                  currencyCode="default"
                ></NumberInput>
              </FormInput>
            )}
          <FormInput
            readOnly
            label={`${t("finances.salesInvoice.columns.total")} (${(data?.currency?.code ?? default_currency_id).toUpperCase()})`}
            className="col-start-2"
          >
            <NumberInput
              className="text-right"
              decimalScale={2}
              value={net_amount + tax_amount}
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
        title={t("finances.salesInvoice.columns.external_note")}
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
