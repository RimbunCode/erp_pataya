import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";
import React, { useCallback, useEffect } from "react";
import SelectModel, { loadFromModel } from "@/Components/SelectModel";
import { calculateArray, generateRandom } from "@/lib/utils";
import { allocateDiscount } from "@/lib/discountAllocation";

import AdditionalDiscount from "@/Pages/Finances/Components/AdditionalDiscount";
import NumberInput from "@/Components/NumberInput";
import CurrencyLinkModel from "@/Pages/Core/CurrencyLinkModel";
import DatetimePicker from "@/Components/DatetimePicker";
import FormInput from "@/Components/FormInput";
import FormTable from "@/Components/FormTable";
import ItemBarcode from "@/Pages/Inventory/Items/ItemBarcode";
import ItemForm from "./ItemForm";
import ItemUnitLinkModel from "@/Pages/Inventory/Items/ItemUnitLinkModel";
import ItemVariantLinkModel from "@/Pages/Inventory/Items/ItemVariantLinkModel";
import PaymentSchedule from "@/Pages/Finances/Components/PaymentSchedule";
import SupplierLinkModel from "../Suppliers/SupplierLinkModel";
import TaxLinkModel from "@/Pages/Finances/Taxes/TaxLinkModel";
import { Textarea } from "@/Components/ui/textarea";
import WarehouseLinkModel from "@/Pages/Inventory/Warehouses/WarehouseLinkModel";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { useMemo } from "react";
import { usePage } from "@inertiajs/react";

function Form() {
  const { t } = useLaravelReactI18n();
  const { data, setData, defaultData, disabled, dataBefore } = useFormPage(
    {
      date: new Date(),
    },
    { trackDefaultValue: false },
  );
  const loadFrom = usePage().props.loadFrom;
  const { default_currency_id } = usePage().props.preferences;

  // Dihitung langsung dari quantity*rate mentah + alokasi diskon saat ini --
  // BUKAN dari calculateArray(data.items, "basic_amount", "+"). Alasan: field
  // basic_amount/tax_amount di data.items hanya di-refresh oleh mapItem milik
  // FormTable, dan mapItem itu cuma jalan ulang saat referensi array `items`
  // berubah (lihat FormTable.jsx useEffect di applyMapItem) -- bukan saat
  // discount_on/discount_rate/discount_amount berubah sendirian. Kalau header
  // ikut bergantung ke data.items.basic_amount, Total jadi tidak reaktif saat
  // user mengetik diskon tanpa menyentuh baris item. Menghitung ulang di sini
  // membuat header selalu reaktif terlepas dari kapan mapItem terakhir jalan.
  // Basis MENTAH (sebelum diskon) -- dipakai AdditionalDiscount untuk menghitung
  // discount_amount dari discount_rate. Wajib terpisah dari net_amount/tax_amount
  // di bawah (yang sudah hasil alokasi) karena kalau basis diskon ikut memakai
  // angka yang sudah terpotong, discount_rate 10% akan memotong basis yang sudah
  // menyusut di setiap render -- basis "menyusut" terus tiap kali user mengetik.
  const rawLines = useMemo(() => {
    return (data.items ?? [])
      .filter((item) => item?.item)
      .map((item) => ({
        basic_amount: (item.quantity ?? 0) * (item.rate ?? 0),
        tax_rate: item.tax?.rate ?? 0,
      }));
  }, [data.items]);

  const rawNetAmount = useMemo(() => {
    return calculateArray(rawLines, "basic_amount", "+");
  }, [rawLines]);

  const rawTaxAmount = useMemo(() => {
    return rawLines.reduce(
      (sum, line) => sum + (line.basic_amount * line.tax_rate) / 100,
      0,
    );
  }, [rawLines]);

  const allocatedLines = useMemo(() => {
    return allocateDiscount(
      rawLines,
      data.discount_on,
      data.discount_rate ?? 0,
      data.discount_amount ?? 0,
      data.latestDiscountKey ?? "discount_rate",
    );
  }, [
    rawLines,
    data.discount_on,
    data.discount_rate,
    data.discount_amount,
    data.latestDiscountKey,
  ]);

  const net_amount = useMemo(() => {
    return calculateArray(allocatedLines, "basic_amount", "+");
  }, [allocatedLines]);

  const tax_amount = useMemo(() => {
    return calculateArray(allocatedLines, "tax_amount", "+");
  }, [allocatedLines]);

  const amount = useMemo(() => {
    return net_amount + tax_amount;
  }, [net_amount, tax_amount]);

  const mergeItems = useCallback(
    ({ items, model }) => {
      setData((prev) => {
        const oldItems = prev.items ?? [];

        // Buat Map untuk lookup cepat
        const itemMap = new Map(
          oldItems.map((item) => [
            `${item.referenceable_type}_${item.referenceable_id}`,
            item,
          ]),
        );

        items.forEach((item) => {
          const key = `${model}_${item.id}`;
          const newItem = {
            // ...item,
            id: generateRandom(5),
            item: item.item,
            target_warehouse: item.target_warehouse,
            description: item.description,
            required_date: prev.required_date,
            quantity: item.unordered_quantity,
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
      const result = await loadFromModel(
        loadFrom?.model,
        loadFrom?.id,
        loadFrom?.select,
        t,
      );
      if (result) mergeItems(result);
    };
    fetchData().catch(console.error);
  }, [loadFrom, mergeItems, t]);

  const handleBarcodeSelect = useCallback(
    (selected) => {
      const selectedItem = selected?.item ?? selected;
      const selectedUnit = selected?.unit ?? selected?.default_unit;
      if (!selectedItem || !selectedUnit) return;

      setData((prev) => {
        const items = [...(prev?.items ?? [])];
        const idx = items.findIndex(
          (row) =>
            row?.item?.id === selectedItem?.id &&
            row?.unit?.id === selectedUnit?.id,
        );
        if (idx >= 0) {
          const currentQty = items[idx]?.quantity ?? 0;
          items[idx] = { ...items[idx], quantity: currentQty + 1 };
        } else {
          items.push({
            id: generateRandom(5),
            item: selectedItem,
            unit: selectedUnit,
            quantity: 1,
            required_date: prev?.required_date,

            target_warehouse: prev?.target_warehouse,
          });
        }
        return { ...prev, items };
      });
    },
    [setData],
  );
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
              placeholder={t("purchase.purchaseOrder.columns.item.placeholder")}
              value={dataRow?.item}
              onValueChange={(val) => {
                const defaultUnit = val?.default_uom;
                setData({
                  item: val,
                  unit: defaultUnit,
                  conversion_factor: defaultUnit?.conversion_factor,
                  required_date: data.required_date,
                  target_warehouse: data.target_warehouse,
                });
              }}
              {...attributes}
              with={["defaultUom", "item"]}
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
        titleTrans: "purchase.purchaseOrder.columns.unit",
        cell({ data, setData, attributes, dataRow }) {
          return (
            <ItemUnitLinkModel
              disabled={!dataRow?.item}
              placeholder={t("purchase.purchaseOrder.columns.unit.placeholder")}
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
            <NumberInput
              disabled={!dataRow?.item}
              currencyCode={data?.currency?.code}
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
  }, [data, t]);
  return (
    <>
      <FormPageContent
        value="detail"
        title={t("purchase.purchaseOrder.detail")}
      >
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
              name="supplier"
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
              <NumberInput
                disabled={!data.currency}
                className="text-left"
                currencyCode={data.currency}
                enableExchangeRate
                onExchangeRate={(result) => {
                  if (result) {
                    setData("exchange_rate", result.rate);
                  }
                }}
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
                  columnAlias: {
                    unordered_quantity: "required_quantity",
                  },
                  filters: {
                    status: "submitted",
                  },
                  selects: {
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
                  columns: ["code", "date", "status"],
                  filters: {
                    status: "submitted",
                  },
                  selects: {
                    items: {
                      filters: {
                        status: "submitted",
                      },
                      columns: [
                        "purchase_request",
                        "item",
                        "quantity",
                        "unordered_quantity",
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
          <FormInput name="barcode" label={t("core.form.input_barcode.label")}>
            <ItemBarcode
              with={["item", "unit"]}
              onSelect={handleBarcodeSelect}
            />
          </FormInput>
          <FormInput
            label={t("purchase.purchaseOrder.columns.target_warehouse")}
            name="target_warehouse"
          >
            <WarehouseLinkModel
              placeholder={t(
                "purchase.purchaseOrder.columns.target_warehouse.placeholder",
              )}
              value={data.target_warehouse}
              onValueChange={(val) => {
                setData((prev) => {
                  if (!prev.items || prev.items?.length <= 0)
                    return {
                      ...prev,
                      target_warehouse: val,
                    };
                  const newItems = prev.items.map((item) => {
                    return {
                      ...item,
                      target_warehouse: val,
                    };
                  });
                  return {
                    ...prev,
                    items: newItems,
                    target_warehouse: val,
                  };
                });
              }}
            />
          </FormInput>
          <div className="col-span-full">
            <FormTable
              name="PurchaseOrderItems"
              readOnly={disabled}
              columns={itemColumns}
              value={data?.items}
              valueBefore={dataBefore?.items}
              onValueChange={(v) => setData("items", v)}
              form={<ItemForm />}
              mapItem={({ item, dataTable, index }) => {
                // Diskon dokumen (Diskon Tambahan) mengubah basic_amount/tax_amount
                // SETIAP baris secara pro-rata, bukan cuma baris yang sedang di-edit --
                // jadi alokasi dihitung ulang dari seluruh dataTable tiap kali salah
                // satu baris berubah, lalu diambil hasil untuk baris ke-`index` ini saja.
                const rows = dataTable ?? [];
                const lines = rows.map((row, i) => ({
                  basic_amount:
                    i === index
                      ? (item.quantity ?? 0) * (item.rate ?? 0)
                      : (row.quantity ?? 0) * (row.rate ?? 0),
                  tax_rate:
                    i === index ? (item.tax?.rate ?? 0) : (row.tax?.rate ?? 0),
                }));
                const allocated = allocateDiscount(
                  lines,
                  data.discount_on,
                  data.discount_rate ?? 0,
                  data.discount_amount ?? 0,
                  data.latestDiscountKey ?? "discount_rate",
                );
                const result = allocated[index] ?? allocated[0];
                return {
                  ...item,
                  basic_amount: result?.basic_amount ?? 0,
                  tax_amount: result?.tax_amount ?? 0,
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
            label={`${t("purchase.purchaseOrder.columns.basic_amount")} (${(data?.currency?.code ?? default_currency_id).toUpperCase()})`}
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
                label={`${t("purchase.purchaseOrder.columns.tax_amount")} (${default_currency_id.toUpperCase()})`}
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
            label={`${t("purchase.purchaseOrder.columns.tax_amount")} (${(data?.currency?.code ?? default_currency_id).toUpperCase()})`}
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
                label={`${t("purchase.purchaseOrder.columns.total")} (${default_currency_id.toUpperCase()})`}
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
            label={`${t("purchase.purchaseOrder.columns.total")} (${(data?.currency?.code ?? default_currency_id).toUpperCase()})`}
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
        rawNetAmount={rawNetAmount}
        rawTaxAmount={rawTaxAmount}
      />

      <FormPageContent
        value="detail"
        title={t("purchase.purchaseOrder.columns.external_note")}
        collapsible
        defaultOpen={defaultData?.external_note}
      >
        <div className="px-1 py-1">
          <FormInput name="external_note">
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
          value?.forEach((item) => {
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

export default Form;
