import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";
import React, { useCallback, useEffect } from "react";
import SelectModel, { loadFromModel } from "@/Components/SelectModel";
import { calculateArray, generateRandom } from "@/lib/utils";

import CurrencyInput from "@/Components/CurrencyInput";
import CurrencyLinkModel from "@/Pages/Core/CurrencyLinkModel";
import DatetimePicker from "@/Components/DatetimePicker";
import FormInput from "@/Components/FormInput";
import FormTable from "@/Components/FormTable";
import ItemForm from "./ItemForm";
import ItemVariantLinkModel from "@/Pages/Inventory/Items/ItemVariantLinkModel";
import PaymentSchedule from "@/Pages/Finances/Components/PaymentSchedule";
import Select from "@/Components/Select";
import SupplierLinkModel from "../Suppliers/SupplierLinkModel";
import TaxLinkModel from "@/Pages/Finances/Taxes/TaxLinkModel";
import { Textarea } from "@/Components/ui/textarea";
import UnitLinkModel from "@/Pages/Inventory/Units/UnitLinkModel";
import WarehouseLinkModel from "@/Pages/Inventory/Warehouses/WarehouseLinkModel";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { useMemo } from "react";
import { usePage } from "@inertiajs/react";

function Form() {
  const { t } = useLaravelReactI18n();
  const { data, setData, defaultData, disabled } = useFormPage();
  const loadFrom = usePage().props.loadFrom;
  const { default_currency_id } = usePage().props.preferences;

  const basic_amount = useMemo(() => {
    return calculateArray(data.items, "basic_amount", "+");
  }, [data.items]);

  const tax_amount = useMemo(() => {
    return calculateArray(data.items, "tax_amount", "+");
  }, [data.items]);

  const amount = useMemo(() => {
    return basic_amount + tax_amount;
  }, [basic_amount, tax_amount]);

  useEffect(() => {
    console.log(data);
  }, [data]);
  const setDiscount = useCallback(
    (key, value) => {
      setData((prev) => {
        let discount_on = prev.discount_on;
        let discount_rate = prev.discount_rate ?? 0;
        let discount_amount = prev.discount_amount ?? 0;
        const basic_amount = calculateArray(prev.items, "basic_amount", "+");
        const tax_amount = calculateArray(prev.items, "tax_amount", "+");
        if (key == "discount_on") {
          discount_on = value;
        }
        const total =
          discount_on == "grand_total"
            ? basic_amount + tax_amount
            : discount_on == "net_total"
              ? basic_amount
              : 0;
        if (key == "discount_rate") {
          discount_rate = value;
          discount_amount = (total * discount_rate) / 100;
        }
        if (key == "discount_amount") {
          discount_amount = value;
          discount_rate = (discount_amount * 100) / total;
        }
        if (key == "discount_on") {
          discount_amount = (total * discount_rate) / 100;
        }
        return {
          ...prev,
          discount_on,
          discount_rate,
          discount_amount,
        };
      });
    },
    [data],
  );
  const mergeItems = useCallback(
    (value, model) => {
      setData((prev) => {
        const oldItems = prev.items ?? [];

        // Buat Map untuk lookup cepat
        const itemMap = new Map(
          oldItems.map((item) => [
            `${item.referenceable_type}_${item.referenceable_id}`,
            item,
          ]),
        );

        value.forEach((item) => {
          const key = `${model}_${item.id}`;
          const newItem = {
            // ...item,
            id: generateRandom(5),
            item: item.item,
            target_warehouse: item.target_warehouse,
            description: item.description,
            required_date: prev.required_date,
            quantity: item.remaining_quantity,
            unit: item.unit,
            referenceable_type: model,
            referenceable_id: item.id,
          };
          if (newItem.quantity <= 0) {
            itemMap.delete(key);
          }
          if (itemMap.has(key)) {
            // update quantity sesuai newItem
            itemMap.set(key, {
              ...itemMap.get(key),
              ...newItem,
            });
          } else {
            // tambah item baru
            itemMap.set(key, newItem);
          }
        });

        return {
          ...prev,
          items: Array.from(itemMap.values()),
        };
      });
    },
    [setData],
  );
  useEffect(() => {
    if (!loadFrom) return;
    const fetchData = async () => {
      const data = await loadFromModel(
        loadFrom?.model,
        loadFrom?.id,
        loadFrom?.select,
      );
      console.log(data);
      mergeItems(data.value, data.model);
    };
    fetchData().catch(console.error);
  }, [loadFrom, mergeItems]);
  const itemColumns = useMemo(() => {
    return [
      {
        name: "item",
        titleTrans: "purchase.purchaseOrder.columns.item",
        required: true,
        width: 3,
        cell({ dataRow, setData, attributes }) {
          return (
            <ItemVariantLinkModel
              filters={{
                is_stock_item: true,
              }}
              placeholder={t("purchase.purchaseOrder.columns.item.placeholder")}
              value={dataRow?.item}
              onValueChange={(val) => {
                setData({
                  item: val,
                  unit: val?.default_unit,
                  required_date: data.required_date,
                });
              }}
              {...attributes}
              with={["defaultUnit", "item"]}
            />
          );
        },
      },
      {
        name: "target_warehouse",
        titleTrans: "purchase.purchaseOrder.columns.target_warehouse",
        required: true,
        type: "text",
        width: 2,
        cell({ dataRow, data, setData, attributes }) {
          return (
            <WarehouseLinkModel
              disabled={!dataRow?.item}
              rows={1}
              value={data ?? ""}
              onValueChange={(val) => setData("target_warehouse", val)}
              {...attributes}
            />
          );
        },
      },
      {
        name: "description",
        titleTrans: "purchase.purchaseOrder.columns.description",
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
        name: "required_date",
        titleTrans: "purchase.purchaseOrder.columns.required_date",
        type: "date",
        width: 1,
        cell({ dataRow, data, setData, attributes }) {
          return (
            <DatetimePicker
              {...attributes}
              disabled={!dataRow?.item}
              value={data}
              onValueChange={(value) => {
                setData("required_date", value);
              }}
            />
          );
        },
      },
      {
        name: "quantity",
        titleTrans: "purchase.purchaseOrder.columns.quantity",
        required: true,
        type: "number",
        width: 1,
        cell({ dataRow, data, setData, attributes }) {
          return (
            <CurrencyInput
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
        titleTrans: "purchase.purchaseOrder.columns.unit",
        cell({ data, setData, attributes, dataRow }) {
          return (
            <UnitLinkModel
              disabled={!dataRow?.item}
              placeholder={t("purchase.purchaseOrder.columns.unit.placeholder")}
              value={data}
              onValueChange={(val) => setData("unit", val)}
              {...attributes}
              filters={{
                group: dataRow?.item?.default_unit?.group,
              }}
            />
          );
        },
      },
      {
        name: "tax",
        titleTrans: "purchase.purchaseOrder.columns.tax",
        required: true,
        cell({ data: value, setData, attributes, dataRow }) {
          return (
            <TaxLinkModel
              disabled={!dataRow?.item}
              currencyCode={data?.currency?.code}
              placeholder={t("purchase.purchaseOrder.columns.tax.placeholder")}
              decimalScale={2}
              value={value}
              onValueChange={(val) =>
                setData({
                  tax: val,
                  tax_rate: val?.rate ?? 0,
                })
              }
              {...attributes}
              filters={{
                group: dataRow?.item?.default_tax?.group,
              }}
            />
          );
        },
      },
      {
        name: "rate",
        titleTrans: "purchase.purchaseOrder.columns.rate",
        required: true,
        cell({ data: value, setData, attributes, dataRow }) {
          return (
            <CurrencyInput
              disabled={!dataRow?.item}
              currencyCode={data?.currency?.code}
              placeholder={t("purchase.purchaseOrder.columns.rate.placeholder")}
              decimalScale={2}
              value={value}
              onValueChange={(val) => setData("rate", val)}
              {...attributes}
              filters={{
                group: dataRow?.item?.default_rate?.group,
              }}
            />
          );
        },
      },
    ];
  }, [data.required_date, t]);
  return (
    <>
      <FormPageContent value="detail">
        <div className="flex flex-col gap-y-4">
          <div className="grid gap-x-4 gap-y-4 md:grid-cols-2">
            <FormInput
              label={t("purchase.purchaseOrder.columns.date")}
              required
              name="date"
            >
              <DatetimePicker
                type="datetime"
                value={data.date}
                onValueChange={(val) => setData("date", val)}
              />
            </FormInput>
            <FormInput
              label={t("purchase.purchaseOrder.columns.required_date")}
              required
              name="required_date"
            >
              <DatetimePicker
                type="datetime"
                value={data.required_date}
                onValueChange={(val) => {
                  setData((prev) => {
                    const items = data?.items?.map((item) => {
                      return {
                        ...item,
                        required_date: val,
                      };
                    });

                    return {
                      ...prev,
                      required_date: val,
                      items,
                    };
                  });
                }}
              />
            </FormInput>
            <FormInput
              label={t("purchase.purchaseOrder.columns.supplier")}
              required
            >
              <SupplierLinkModel
                value={data.supplier}
                onValueChange={(val) => setData("supplier", val)}
              />
            </FormInput>
          </div>
        </div>
      </FormPageContent>
      <FormPageContent
        value="detail"
        title={t("purchase.purchaseOrder.columns.currency")}
      >
        <div className="grid grid-cols-2 gap-x-4">
          <FormInput
            className="col-start-1"
            label={t("purchase.purchaseOrder.columns.currency")}
            name="currency"
          >
            <CurrencyLinkModel
              placeholder={t(
                "purchase.purchaseOrder.columns.currency.placeholder",
              )}
              value={data.currency}
              onValueChange={(val) => {
                setData("currency", val);
              }}
              className="h-8"
            />
          </FormInput>

          {data.currency && data.currency.code != default_currency_id && (
            <FormInput
              description={`1 ${data.currency.code.toUpperCase()} = [?] ${default_currency_id.toUpperCase()}`}
              label={t("purchase.purchaseOrder.columns.exchange_rate")}
              name="exchange_rate"
            >
              <CurrencyInput
                disabled={!data.currency}
                className="text-left"
                currencyCode="default"
                decimalScale={2}
                value={data.exchange_rate}
                onValueChange={(value) => {
                  setData("exchange_rate", value);
                }}
              />
            </FormInput>
          )}
        </div>
      </FormPageContent>
      <FormPageContent
        value="detail"
        title={t("purchase.purchaseOrder.items")}
        actions={
          !data.submitted_at && (
            <SelectModel
              from={{
                "App\\Models\\Service\\WorkOrder": {
                  columns: ["code", "date"],
                  filters: {
                    status: "submitted",
                  },
                  select: {
                    items: {
                      filters: {
                        status: "submitted",
                      },
                      columns: [
                        "work_order",
                        "item",
                        "quantity",
                        "required_quantity",
                        "unit",
                      ],
                    },
                  },
                },
                "App\\Models\\Purchase\\PurchaseRequest": {
                  columns: ["code", "date"],
                  filters: {
                    status: "submitted",
                  },
                  select: {
                    items: {
                      filters: {
                        status: "submitted",
                      },
                      columns: [
                        "purchase_request",
                        "item",
                        "quantity",
                        "remaining_quantity",
                        "unit",
                      ],
                    },
                  },
                },
              }}
              label={t("purchase.purchaseOrder.import_items")}
              className="w-fit"
              variant="secondary"
              size="sm"
              onSelected={mergeItems}
            />
          )
        }
      >
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <div className="col-span-full">
            <FormTable
              readOnly={disabled}
              columns={itemColumns}
              value={data?.items}
              onValueChange={(v) => setData("items", v)}
              form={<ItemForm />}
              mapItem={({ item }) => {
                const amount = item.quantity * item.rate;
                const rateAmount = (amount * (item.tax?.rate ?? 0)) / 100;
                return {
                  ...item,
                  tax_amount: rateAmount,
                  basic_amount: amount,
                };
              }}
            />
          </div>
          {data?.currency?.code &&
            data?.currency?.code !== default_currency_id && (
              <FormInput
                readOnly
                label={`${t("purchase.purchaseOrder.columns.basic_amount")} (${default_currency_id.toUpperCase()})`}
              >
                <CurrencyInput
                  className="text-right"
                  value={basic_amount * (data?.exchange_rate ?? 1)}
                  currencyCode="default"
                ></CurrencyInput>
              </FormInput>
            )}
          <FormInput
            readOnly
            label={`${t("purchase.purchaseOrder.columns.basic_amount")} (${(data?.currency?.code ?? default_currency_id).toUpperCase()})`}
            className="col-start-2"
          >
            <CurrencyInput
              decimalScale={2}
              className="text-right"
              value={basic_amount}
              currencyCode={data?.currency?.code ?? "default"}
            ></CurrencyInput>
          </FormInput>
          {data?.currency?.code &&
            data?.currency?.code !== default_currency_id && (
              <FormInput
                readOnly
                label={`${t("purchase.purchaseOrder.columns.tax_amount")} (${default_currency_id.toUpperCase()})`}
              >
                <CurrencyInput
                  className="text-right"
                  value={tax_amount * (data?.exchange_rate ?? 1)}
                  currencyCode="default"
                ></CurrencyInput>
              </FormInput>
            )}
          <FormInput
            readOnly
            label={`${t("purchase.purchaseOrder.columns.tax_amount")} (${(data?.currency?.code ?? default_currency_id).toUpperCase()})`}
            className="col-start-2"
          >
            <CurrencyInput
              decimalScale={2}
              className="text-right"
              value={tax_amount}
              currencyCode={data?.currency?.code ?? "default"}
            ></CurrencyInput>
          </FormInput>
          {data?.currency?.code &&
            data?.currency?.code !== default_currency_id && (
              <FormInput
                readOnly
                label={`${t("purchase.purchaseOrder.columns.total")} (${default_currency_id.toUpperCase()})`}
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
            label={`${t("purchase.purchaseOrder.columns.total")} (${(data?.currency?.code ?? default_currency_id).toUpperCase()})`}
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
      <FormPageContent
        value="detail"
        title={t("purchase.purchaseOrder.columns.additional_discount")}
        collapsible
        defaultOpen
      >
        <div className="grid gap-x-4 gap-y-4 md:grid-cols-2">
          <FormInput label={t("purchase.purchaseOrder.columns.discount_on")}>
            <Select
              value={data.discount_on}
              onValueChange={(val) => setDiscount("discount_on", val)}
              placeholder={t(
                "purchase.purchaseOrder.columns.discount_on.placeholder",
              )}
              optionTrans="purchase.purchaseOrder.columns.discount_on.options"
              options={["net_total", "grand_total"]}
            />
          </FormInput>
          <FormInput
            disabled={!data?.discount_on}
            label={`${t("purchase.purchaseOrder.columns.additional_discount_rate")}`}
          >
            <CurrencyInput
              className="text-right"
              value={data.discount_rate}
              onValueChange={(val) => setDiscount("discount_rate", val)}
              suffix="%"
            ></CurrencyInput>
          </FormInput>

          <FormInput
            className="col-start-2"
            disabled={!data?.discount_on}
            label={`${t("purchase.purchaseOrder.columns.additional_discount_amount")}`}
          >
            <CurrencyInput
              className="text-right "
              decimalScale={2}
              value={data.discount_amount}
              onValueChange={(val) => setDiscount("discount_amount", val)}
              currencyCode={data?.currency?.code ?? "default"}
            ></CurrencyInput>
          </FormInput>
        </div>
      </FormPageContent>

      <FormPageContent
        value="detail"
        title={t("purchase.purchaseOrder.columns.external_note")}
        collapsible
        defaultOpen={defaultData?.external_note}
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
          console.log(value);
          data.payment_schedules.map((item) => {});
          // const payment_amount = amount * (item?.invoice_portion / 100);
          // return {
          //   ...item,
          //   payment_amount,
          //   outstanding_amount: payment_amount,
          // };
        }}
        date={data?.date}
        currencyCode={data?.currency?.code}
      />
    </>
  );
}

export default Form;
