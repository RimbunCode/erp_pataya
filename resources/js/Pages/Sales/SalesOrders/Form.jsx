import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";
import React, { memo, useCallback, useEffect, useMemo } from "react";
import SelectModel, { loadFromModel } from "@/Components/SelectModel";
import { calculateArray, generateRandom } from "@/lib/utils";
import { allocateDiscount } from "@/lib/discountAllocation";

import AdditionalDiscount from "@/Pages/Finances/Components/AdditionalDiscount";
import AssetServiceLinkModel from "@/Pages/Asset/Services/AssetServiceLinkModel";
import AssetServiceConsumedItemLinkModel from "@/Pages/Asset/Services/AssetServiceConsumedItemLinkModel";
import BranchLinkModel from "@/Pages/Settings/Branches/BranchLinkModel";
import NumberInput from "@/Components/NumberInput";
import CurrencyLinkModel from "@/Pages/Core/CurrencyLinkModel";
import CustomerLinkModel from "@/Pages/Sales/Customers/CustomerLinkModel";
import DatetimePicker from "@/Components/DatetimePicker";
import { FormCheckbox } from "@/Components/ui/checkbox";
import FormInput from "@/Components/FormInput";
import FormTable from "@/Components/FormTable";
import ItemBarcode from "@/Pages/Inventory/Items/ItemBarcode";
import ItemForm from "./ItemForm";
import ItemUnitLinkModel from "@/Pages/Inventory/Items/ItemUnitLinkModel";
import ItemVariantLinkModel from "@/Pages/Inventory/Items/ItemVariantLinkModel";
import LinkModel from "@/Components/LinkModel";
import PaymentSchedule from "@/Pages/Finances/Components/PaymentSchedule";
import SalesOrderLinkModel from "./SalesOrderLinkModel";
import TaxLinkModel from "@/Pages/Finances/Taxes/TaxLinkModel";
import { Textarea } from "@/Components/ui/textarea";
import WarehouseLinkModel from "@/Pages/Inventory/Warehouses/WarehouseLinkModel";
import axios from "axios";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";

export default memo(function Form() {
  const { t } = useLaravelReactI18n();
  const { data, setData, defaultData, disabled } = useFormPage(
    {
      date: new Date(),
    },
    { trackDefaultValue: false },
  );
  const { default_currency_id } = usePage().props.preferences;
  const loadFrom = usePage().props.loadFrom;

  const asyncAdditionalData = useCallback(async (value, idChanges) => {
    return await axios.post(window.route("itemVariants.info"), {
      data: value,
      idChanges,
    });
  }, []);

  // Dihitung langsung dari quantity*price mentah + alokasi diskon saat ini --
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
        basic_amount: (item.quantity ?? 0) * (item.price ?? 0),
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

  // net_amount/tax_amount sudah hasil alokasi diskon -- Total tinggal jumlah
  // langsung, tidak dikurangi discount_amount lagi (itu bug lama: DPP/pajak
  // dibiarkan beku, hanya Total yang dipotong lump-sum).
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
            description: item.description,
            quantity: item.quantity, // sudah ter-alias dari remaining_quantity (columnAlias)
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
            source_warehouse: prev?.source_warehouse,
          });
        }
        return { ...prev, items };
      });
    },
    [setData],
  );

  const itemColumns = [
    {
      name: "item",
      titleTrans: "sales.salesOrder.columns.item",
      required: true,
      width: 3,
      cell({ dataRow, setData, attributes }) {
        return (
          <ItemVariantLinkModel
            placeholder={t("sales.salesOrder.columns.item.placeholder")}
            fields={["is_stock_item"]}
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
            with={["defaultUom", "item"]}
          />
        );
      },
    },
    {
      name: "referenceable",
      titleTrans: "sales.salesOrder.columns.referenceable_asset_service",
      show: false,
      width: 3,
      cell({ _dataRow, data: value, setData, attributes }) {
        // Requirement 4, spec asset-service-billing: opsional, TIDAK
        // mempengaruhi baris ItemVariant biasa (default null/kosong).
        const type = value?.type;
        return (
          <div className="flex w-full gap-x-1">
            {type === "App\\Models\\Asset\\AssetServiceConsumedItem" ? (
              <AssetServiceConsumedItemLinkModel
                value={value?.id ? { id: value.id } : null}
                onValueChange={(val) =>
                  setData("referenceable", val ? { type, id: val.id } : null)
                }
                {...attributes}
              />
            ) : (
              <AssetServiceLinkModel
                value={value?.id ? { id: value.id } : null}
                onValueChange={(val) =>
                  setData(
                    "referenceable",
                    val
                      ? { type: "App\\Models\\Asset\\AssetService", id: val.id }
                      : null,
                  )
                }
                {...attributes}
              />
            )}
          </div>
        );
      },
    },
    {
      name: "description",
      titleTrans: "sales.salesOrder.columns.description",
      show: false,
      type: "text",
      width: 2,
      cell({ dataRow, data: value, setData, attributes }) {
        return (
          <Textarea
            disabled={!dataRow?.item}
            rows={1}
            value={value ?? ""}
            onChange={(e) => setData("description", e.target.value)}
            {...attributes}
            readOnly={true}
          />
        );
      },
    },
    {
      name: "source_warehouse",
      titleTrans: "sales.salesOrder.columns.source_warehouse",
      show: true,
      type: "text",
      width: 3,
      required: true,
      cell({ dataRow, data: value, setData, attributes }) {
        return (
          <WarehouseLinkModel
            disabled={!dataRow?.item || !dataRow?.item?.is_stock_item}
            placeholder={t(
              "sales.salesOrder.columns.source_warehouse.placeholder",
            )}
            value={value}
            onValueChange={(val) => setData("source_warehouse", val)}
            {...attributes}
          />
        );
      },
    },
    {
      name: "available_quantity",
      titleTrans: "sales.salesOrder.columns.available_quantity",
      required: true,
      type: "number",
      width: 1,
      cell({ additionalData, dataRow, attributes }) {
        return (
          <NumberInput
            {...attributes}
            disabled={!dataRow?.item || !dataRow?.item?.is_stock_item}
            readOnly={true}
            value={
              dataRow?.item?.is_stock_item
                ? (additionalData?.available_stock ?? 0)
                : "∞"
            }
          />
        );
      },
    },
    {
      name: "quantity",
      titleTrans: "sales.salesOrder.columns.quantity",
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
      titleTrans: "sales.salesOrder.columns.unit",
      width: 2,
      cell({ data, setData, attributes, dataRow }) {
        return (
          <ItemUnitLinkModel
            disabled={!dataRow?.item}
            placeholder={t("sales.salesOrder.columns.unit.placeholder")}
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
      titleTrans: "sales.salesOrder.columns.tax",
      width: 2,
      cell({ data: value, setData, attributes, dataRow }) {
        return (
          <TaxLinkModel
            disabled={!dataRow?.item}
            placeholder={t("sales.salesOrder.columns.tax.placeholder")}
            value={value}
            onValueChange={(val) => {
              setData("tax", val);
            }}
            {...attributes}
            readOnly={
              attributes.readOnly || (dataRow.readOnly && !dataRow.isCustom)
            }
          />
        );
      },
    },
    {
      name: "price",
      titleTrans: "sales.salesOrder.columns.price",
      required: true,
      width: 2,
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
            readOnly={attributes.readOnly || !!data.submitted_at}
          />
        );
      },
    },
  ];

  return (
    <>
      <FormPageContent value="detail" title={t("sales.salesOrder.detail")}>
        <div className="grid gap-x-4 gap-y-4 md:grid-cols-2">
          <FormInput
            name="date"
            label={t("sales.salesOrder.columns.date")}
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
          {data.referenceable && (
            <FormInput
              name="date"
              className="pointer-events-auto!"
              label={t("sales.salesOrder.columns.reference_to")}
              readOnly
            >
              <LinkModel
                disabledAddButton
                model={data.referenceable_type}
                value={data.referenceable}
              />
            </FormInput>
          )}
          <FormCheckbox
            checked={data.is_rent}
            onCheckedChange={(val) => setData("is_rent", val)}
            className="pt-4"
          >
            {t("sales.salesOrder.for_rent")}
          </FormCheckbox>

          {data.is_rent && (
            <FormInput
              required
              label={t("sales.salesOrder.rent_date")}
              name="rent_date"
            >
              <DatetimePicker
                type="daterange"
                value={data.rent_date}
                onValueChange={(range) => setData("rent_date", range)}
              />
            </FormInput>
          )}

          <FormInput
            className="col-start-1"
            label={t("sales.salesOrder.customer")}
            required={true}
            name="customer"
          >
            <CustomerLinkModel
              disabled={data.for_internal}
              with={["branches"]}
              fields={["branches.is_main_branch"]}
              value={data.for_internal ? "" : data.customer}
              onValueChange={(val) => {
                if (val?.branches?.length <= 1) {
                  setData("customer_branch", val.branches?.[0]);
                }
                setData("customer", val);
              }}
            />
          </FormInput>

          <FormInput
            label={t("sales.salesOrder.branch")}
            required
            name="customer_branch"
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
          <FormInput
            className="col-start-1"
            label={t("sales.salesOrder.currency")}
            name="currency"
          >
            <CurrencyLinkModel
              placeholder={t("sales.salesOrder.currency.placeholder")}
              value={data.currency}
              onValueChange={(val) => {
                setData("currency", val);
              }}
            />
          </FormInput>

          {data?.currency?.code &&
            data.currency.code !== default_currency_id && (
              <FormInput
                label={t("sales.salesOrder.exchange_rate")}
                name="exchange_rate"
              >
                <NumberInput
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
          <FormInput
            className="col-span-2 col-start-1"
            label={t("sales.salesOrder.columns.reference_so")}
            name="reference_so"
          >
            <SalesOrderLinkModel
              placeholder={t(
                "sales.salesOrder.columns.reference_so.placeholder",
              )}
              value={data.reference_so}
              onValueChange={(val) => {
                setData("reference_so", val);
              }}
            />
          </FormInput>
        </div>
      </FormPageContent>
      <FormPageContent
        value="detail"
        title={t("sales.salesOrder.items")}
        actions={
          !data.submitted_at && (
            <SelectModel
              from={{
                "App\\Models\\Service\\WorkOrder": {
                  columns: ["code", "date"],
                  columnAlias: {
                    quantity: "remaining_quantity",
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
                        "remaining_quantity",
                        "unit",
                      ],
                    },
                  },
                },
              }}
              label={t("purchase.purchaseRequest.import_items")}
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
            label={t("sales.salesOrder.columns.source_warehouse")}
            name="source_warehouse"
          >
            <WarehouseLinkModel
              placeholder={t(
                "sales.salesOrder.columns.source_warehouse.placeholder",
              )}
              value={data.source_warehouse}
              onValueChange={(val) => {
                setData((prev) => {
                  if (!prev.items || prev.items?.length <= 0)
                    return {
                      ...prev,
                      source_warehouse: val,
                    };
                  const newItems = prev.items.map((item) => {
                    return {
                      ...item,
                      source_warehouse: val?.item?.is_stock_item ? val : null,
                    };
                  });
                  return {
                    ...prev,
                    items: newItems,
                    source_warehouse: val,
                  };
                });
              }}
            />
          </FormInput>
          <FormTable
            name="SalesOrderItems"
            form={<ItemForm />}
            className="col-start-1 col-span-full"
            classNameDialog="max-w-(--breakpoint-lg)! w-full!"
            readOnly={disabled}
            columns={itemColumns}
            value={data?.items ?? []}
            onValueChange={(v) => {
              setData("items", v);
            }}
            asyncAdditionalData={asyncAdditionalData}
            mapItem={({ item, dataTable, index }) => {
              // Diskon dokumen (Diskon Tambahan) mengubah basic_amount/tax_amount
              // SETIAP baris secara pro-rata, bukan cuma baris yang sedang di-edit --
              // jadi alokasi dihitung ulang dari seluruh dataTable tiap kali salah
              // satu baris berubah, lalu diambil hasil untuk baris ke-`index` ini saja.
              const rows = dataTable ?? [];
              const lines = rows.map((row, i) => ({
                basic_amount:
                  i === index
                    ? (item.quantity ?? 0) * (item.price ?? 0)
                    : (row.quantity ?? 0) * (row.price ?? 0),
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
          {data?.currency?.code &&
            data?.currency?.code !== default_currency_id && (
              <FormInput
                readOnly
                label={`${t("sales.salesOrder.columns.net_total")} (${default_currency_id.toUpperCase()})`}
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
            label={`${t("sales.salesOrder.columns.net_total")} (${(data?.currency?.code ?? default_currency_id).toUpperCase()})`}
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
                label={`${t("sales.salesOrder.columns.tax_amount")} (${default_currency_id.toUpperCase()})`}
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
            label={`${t("sales.salesOrder.columns.tax_amount")} (${(data?.currency?.code ?? default_currency_id).toUpperCase()})`}
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
                label={`${t("sales.salesOrder.columns.grand_total")} (${default_currency_id.toUpperCase()})`}
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
            label={`${t("sales.salesOrder.columns.grand_total")} (${(data?.currency?.code ?? default_currency_id).toUpperCase()})`}
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
        rawNetAmount={rawNetAmount}
        rawTaxAmount={rawTaxAmount}
      />

      <FormPageContent
        value="detail"
        title={t("sales.salesOrder.columns.external_note")}
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
});
