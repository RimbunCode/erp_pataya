import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";
import React, { memo, useCallback, useEffect, useMemo, useRef } from "react";
import SelectModel, { loadFromModel } from "@/Components/SelectModel";
import { calculateArray, generateRandom } from "@/lib/utils";
import { allocateDiscount } from "@/lib/discountAllocation";
import {
  EMPTY_DEFAULTS,
  documentItemId,
  taxRowError,
  useDocumentDefaults,
} from "@/lib/documentDefaults";

import AdditionalDiscount from "@/Pages/Finances/Components/AdditionalDiscount";
import BranchLinkModel from "@/Pages/Settings/Branches/BranchLinkModel";
import NumberInput from "@/Components/NumberInput";
import CurrencyLinkModel from "@/Pages/Core/CurrencyLinkModel";
import CustomerLinkModel from "@/Pages/Sales/Customers/CustomerLinkModel";
import DatetimePicker from "@/Components/DatetimePicker";
import { FormCheckbox } from "@/Components/ui/checkbox";
import FormInput from "@/Components/FormInput";
import InputError from "@/Components/InputError";
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

const ASSET_SERVICE_CLASS = "App\\Models\\Asset\\AssetService";
const ASSET_SERVICE_CONSUMED_ITEM_CLASS =
  "App\\Models\\Asset\\AssetServiceConsumedItem";
const ASSET_CLASS = "App\\Models\\Asset\\Asset";

/**
 * Requirement 7.1-7.4, spec asset-service-billing-reference-flow: customer
 * billing diturunkan dari AssetService yang sudah dimuat penuh di
 * `data.referenceable` (header dokumen, hasil create-from-source) — BUKAN
 * lagi dari request `/model` LinkModel per-baris seperti pola lama (lihat
 * memory reference_linkmodel_search_endpoint_constraints: batasan kedalaman
 * `with` 2-segmen itu cuma berlaku di endpoint /model, bukan di
 * Eloquent::load() yang dipakai controller create() untuk mengisi
 * `data.referenceable`) — jadi path ownership (morph) sekarang berlaku utk
 * baris jasa MAUPUN baris part.
 * @param {object|null} assetService
 * @returns {{customer: object, customer_branch: object}|null}
 */
function resolveAssetServiceBillingCustomer(assetService) {
  if (!assetService) return null;
  if (assetService.bill_to_renter) {
    return {
      customer: assetService.customer,
      customer_branch: assetService.customer_branch,
    };
  }
  if (assetService.asset?.ownership_type === "customer") {
    return {
      customer: assetService.asset.ownership,
      customer_branch: assetService.asset.ownership_customer_branch,
    };
  }
  return null;
}

export default memo(function Form() {
  const { t } = useLaravelReactI18n();
  const { data, setData, defaultData, disabled, isCreate, errors } =
    useFormPage(
      {
        date: new Date(),
      },
      { trackDefaultValue: false },
    );
  const pageProps = usePage().props;
  const { default_currency_id } = pageProps.preferences;
  const loadFrom = pageProps.loadFrom;
  const defaults = pageProps.defaults ?? EMPTY_DEFAULTS;
  const {
    applyToNewLine: applyDefaultsToLine,
    applyPaymentTerm,
    resolveForNewLine: resolveLineDefaults,
    markFieldEdited,
    isFieldEdited,
    isTaxRequired,
  } = useDocumentDefaults(defaults, isCreate ? "sales_order" : null, {
    items: data.items,
    setData,
  });
  const paymentDefaultsApplied = useRef(false);
  const headerWarehouseEdited = useRef(false);
  const resolvedTaxItemsByRow = useRef(new Map());

  // Baris hasil konversi dari dokumen sumber (Quotation/WorkOrder/AssetService)
  // tidak diberi default pajak/gudang (Req 2.2).
  const sourceRowIds = useMemo(
    () =>
      new Set(
        isCreate && defaultData?.referenceable_type
          ? (defaultData.items ?? []).map((row) => String(row.id))
          : [],
      ),
    [isCreate, defaultData],
  );
  const isSourceRow = useCallback(
    (rowId) => rowId != null && sourceRowIds.has(String(rowId)),
    [sourceRowIds],
  );
  const applyToNewLine = useCallback(
    (line, item, options) =>
      isSourceRow(line?.id) ? line : applyDefaultsToLine(line, item, options),
    [applyDefaultsToLine, isSourceRow],
  );

  const resolveForNewLine = useCallback(
    (rowId, item, warehouseField) => {
      const itemId = documentItemId(item);
      if (rowId == null || isSourceRow(rowId)) return;
      const rowKey = String(rowId);
      resolvedTaxItemsByRow.current.delete(rowKey);
      if (headerWarehouseEdited.current && warehouseField) {
        markFieldEdited(rowId, warehouseField);
      }
      return resolveLineDefaults(rowId, item, {
        warehouseField,
        onResolved: () =>
          resolvedTaxItemsByRow.current.set(rowKey, String(itemId)),
      });
    },
    [isSourceRow, markFieldEdited, resolveLineDefaults],
  );

  useEffect(() => {
    if (paymentDefaultsApplied.current) return;
    if (data.payment_schedules?.length) {
      paymentDefaultsApplied.current = true;
      return;
    }
    if (defaults.payment_term_template?.items?.length) {
      setData(
        "payment_schedules",
        applyPaymentTerm(data.payment_schedules, data.date ?? new Date()),
      );
      paymentDefaultsApplied.current = true;
    }
  }, [
    applyPaymentTerm,
    data.date,
    data.payment_schedules,
    defaults.payment_term_template,
    setData,
  ]);

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
  // Spec sales-order-asset-in-items-column: satu tabel Items berisi baris ItemVariant
  // (`item`) dan baris Asset (`asset`).
  const rawLines = useMemo(() => {
    return (data.items ?? [])
      .filter((item) => item?.item || item?.asset)
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
          const newLineId = generateRandom(5);
          const newLine = applyToNewLine(
            {
              id: newLineId,
              item: selectedItem,
              unit: selectedUnit,
              quantity: 1,
              source_warehouse: prev?.source_warehouse,
            },
            selectedItem,
            { warehouseField: "source_warehouse" },
          );
          items.push(newLine);
          resolveForNewLine(newLineId, selectedItem, "source_warehouse");
        }
        return { ...prev, items };
      });
    },
    [applyToNewLine, resolveForNewLine, setData],
  );

  // Requirement 4.1, spec asset-service-billing-reference-flow: daftar id
  // ItemVariant dari consumedItems milik AssetService header — dipakai utk
  // filter kolom Item (lihat kolom "item" di bawah). Header `data.referenceable`
  // sudah dimuat penuh lewat controller create() (Eloquent::load(), bukan
  // /model), jadi tidak perlu request tambahan.
  const consumedItemVariantIds =
    data.referenceable_type === ASSET_SERVICE_CLASS
      ? (data.referenceable?.consumed_items ?? [])
          .map((ci) => ci.item?.id)
          .filter(Boolean)
      : [];

  // Model utama (ItemVariant) meng-exclude item aset tetap -- aset tetap hanya
  // dipilih lewat sub model Asset. Filter `or` untuk referensi AssetService
  // (item jasa / consumed item) hanya berlaku untuk ItemVariant.
  // Path relasi `item.is_fixed_asset` (ItemVariant -> Item) sudah dipakai
  // InternalOrders/Form.jsx dan Asset/Services/Form.jsx.
  const itemFilters = {
    ...(data.referenceable_type === ASSET_SERVICE_CLASS
      ? {
          or: {
            "item.category.type": "service",
            id: { in: consumedItemVariantIds },
          },
        }
      : {}),
    "item.is_fixed_asset": false,
  };

  const itemColumns = [
    {
      name: "item",
      titleTrans: "sales.salesOrder.columns.item",
      required: true,
      width: 3,
      cell({ dataRow, setData: setRowData, attributes }) {
        return (
          <ItemVariantLinkModel
            placeholder={t("sales.salesOrder.columns.item.placeholder")}
            fields={["is_stock_item"]}
            disabled={dataRow?.assetServiceLocked}
            value={dataRow.asset ?? dataRow.item}
            filters={itemFilters}
            mainLabel={t("sales.salesOrder.columns.item.group_item")}
            subModels={[
              {
                model: ASSET_CLASS,
                label: t("sales.salesOrder.columns.item.group_asset"),
                group: ["ownership"],
                disabledAddButton: true,
                // Hanya Asset aktif; SO rental hanya menawarkan Asset rentable.
                filters: {
                  status: { jsonContains: ["active"] },
                  ...(data.is_rent ? { is_rentable: true } : {}),
                },
              },
            ]}
            onValueChange={(val) => {
              // Opsi dari sub model Asset: baris asset (tanpa unit & gudang).
              if (val?.thisModel === ASSET_CLASS) {
                const rowPatch = {
                  asset: val,
                  item: null,
                  unit: null,
                  conversion_factor: 1,
                  source_warehouse: null,
                  quantity: 1,
                };
                setRowData({
                  ...rowPatch,
                  ...applyToNewLine({ ...dataRow, ...rowPatch }, null, {}),
                });
                return;
              }
              const defaultUnit = val?.default_uom;
              const rowPatch = {
                asset: null,
                item: val,
                unit: defaultUnit,
                conversion_factor: defaultUnit?.conversion_factor,
                source_warehouse: isFieldEdited(dataRow.id, "source_warehouse")
                  ? dataRow.source_warehouse
                  : (dataRow.source_warehouse ?? data.source_warehouse),
              };
              // Requirement 6, spec asset-service-billing-reference-flow:
              // auto-link baris ke AssetServiceConsumedItem (match persis via
              // item_id) atau ke AssetService langsung (item kategori Jasa),
              // lock Item+Quantity utk baris part (Requirement 5).
              if (data.referenceable_type === ASSET_SERVICE_CLASS) {
                const matched = (data.referenceable?.consumed_items ?? []).find(
                  (ci) => ci.item?.id === val?.id,
                );
                if (matched) {
                  rowPatch.referenceable = {
                    type: ASSET_SERVICE_CONSUMED_ITEM_CLASS,
                    id: matched.id,
                  };
                  rowPatch.quantity = matched.quantity;
                  rowPatch.price = matched.valuation_rate;
                  rowPatch.unit = matched.item_unit;
                  rowPatch.conversion_factor =
                    matched.item_unit?.conversion_factor;
                  rowPatch.assetServiceLocked = true;
                } else {
                  rowPatch.assetServiceLocked = false;
                  if (val?.item?.category?.type === "service") {
                    rowPatch.referenceable = {
                      type: ASSET_SERVICE_CLASS,
                      id: data.referenceable_id,
                    };
                  }
                }
                // setData di sini SENGAJA pakai versi form-level (closure
                // luar), BUKAN setRowData -- customer/customer_branch adalah
                // field header dokumen, bukan field per-baris. WAJIB pakai
                // bentuk fungsi (updater) -- Inertia useForm().setData(obj)
                // dengan argumen objek MENGGANTI SELURUH data form (bukan
                // merge), yang akan menghapus date/referenceable/items dkk.
                const billing = resolveAssetServiceBillingCustomer(
                  data.referenceable,
                );
                if (billing?.customer) {
                  setData((prev) => ({
                    ...prev,
                    customer: billing.customer,
                    customer_branch: billing.customer_branch,
                  }));
                }
              }
              const defaultLine = applyToNewLine(
                { ...dataRow, ...rowPatch },
                val,
                { warehouseField: "source_warehouse" },
              );
              setRowData({
                ...rowPatch,
                tax: defaultLine.tax,
                tax_rate: defaultLine.tax_rate,
                source_warehouse: defaultLine.source_warehouse,
              });
              if (!rowPatch.referenceable) {
                resolveForNewLine(dataRow.id, val, "source_warehouse");
              }
            }}
            {...attributes}
            with={["defaultUom", "item", "item.category"]}
          />
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
            disabled={!dataRow?.item && !dataRow?.asset}
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
            onValueChange={(val) => {
              markFieldEdited(dataRow.id, "source_warehouse");
              setData("source_warehouse", val);
            }}
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
            disabled={
              (!dataRow?.item && !dataRow?.asset) || dataRow?.assetServiceLocked
            }
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
            filters={
              dataRow?.item?.item_id
                ? { item_id: dataRow.item.item_id }
                : undefined
            }
          />
        );
      },
    },
    {
      name: "tax",
      titleTrans: "sales.salesOrder.columns.tax",
      required: true,
      width: 2,
      cell({ data: value, setData, attributes, dataRow }, index) {
        const taxError = taxRowError(errors, index);

        return (
          <div className="flex w-full flex-col">
            <TaxLinkModel
              disabled={!dataRow?.item && !dataRow?.asset}
              placeholder={t("sales.salesOrder.columns.tax.placeholder")}
              value={value}
              onValueChange={(val) => {
                markFieldEdited(dataRow.id, "tax");
                setData("tax", val);
              }}
              {...attributes}
              required={attributes.required && isTaxRequired(dataRow.id)}
              readOnly={
                attributes.readOnly || (dataRow.readOnly && !dataRow.isCustom)
              }
            />
            <InputError message={taxError} className="px-1 text-xs" />
          </div>
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
            disabled={!dataRow?.item && !dataRow?.asset}
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

  // Diskon Tambahan (dokumen) mengubah discount_amount/tax_amount SETIAP baris secara
  // pro-rata, bukan cuma baris yang sedang di-edit -- jadi alokasi dihitung ulang dari
  // seluruh baris lalu diambil hasil untuk baris ke-`index` ini saja.
  // basic_amount TIDAK ditimpa di sini -- kolom itu generated (quantity*price) di server,
  // konsisten dgn App\Services\Finances\DocumentDiscountCalculator::applyToItems() yang
  // menulis discount_amount terpisah, bukan overwrite basic_amount.
  const mapItem = ({ item, dataTable, index }) => {
    const rows = dataTable ?? [];
    const grossAmounts = rows.map((row, i) =>
      i === index
        ? (item.quantity ?? 0) * (item.price ?? 0)
        : (row.quantity ?? 0) * (row.price ?? 0),
    );
    const lines = rows.map((row, i) => ({
      basic_amount: grossAmounts[i],
      tax_rate: i === index ? (item.tax?.rate ?? 0) : (row.tax?.rate ?? 0),
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
      discount_amount:
        Math.round((grossAmounts[index] - (result?.basic_amount ?? 0)) * 100) /
        100,
      tax_amount: result?.tax_amount ?? 0,
    };
  };

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
                headerWarehouseEdited.current = true;
                (data.items ?? []).forEach((item) => {
                  markFieldEdited(item.id, "source_warehouse");
                });
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
            onValueChange={(v, key) => {
              const updatedRow = v.find((item) => item.id === key);
              const rowItemId = documentItemId(updatedRow?.item);
              const hasResolvedTaxForItem =
                rowItemId != null &&
                v.some(
                  (item) =>
                    item.id !== key &&
                    String(documentItemId(item.item)) === String(rowItemId) &&
                    resolvedTaxItemsByRow.current.get(String(item.id)) ===
                      String(rowItemId),
                );
              const skipTaxDefault =
                rowItemId != null &&
                ((key != null && isFieldEdited(key, "tax")) ||
                  resolvedTaxItemsByRow.current.get(String(key)) ===
                    String(rowItemId) ||
                  hasResolvedTaxForItem);
              if (skipTaxDefault && key != null) {
                resolvedTaxItemsByRow.current.set(
                  String(key),
                  String(rowItemId),
                );
              }
              const items =
                key == null
                  ? v
                  : v.map((item) =>
                      item.id === key
                        ? applyToNewLine(item, item.item, {
                            warehouseField: "source_warehouse",
                            skipTaxDefault,
                            skipWarehouseDefault: isFieldEdited(
                              key,
                              "source_warehouse",
                            ),
                          })
                        : item,
                    );
              setData("items", items);
            }}
            asyncAdditionalData={asyncAdditionalData}
            mapItem={mapItem}
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
