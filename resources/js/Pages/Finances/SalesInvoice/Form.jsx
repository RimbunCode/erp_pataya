import {
  FormPageContent,
  FormPageContentTitle,
  useFormPage,
} from "@/Pages/Core/FormPage";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  calculateArray,
  calculateDurationDays,
  calculateRentalAmount,
  generateRandom,
  getDataModel,
} from "@/lib/utils";
import { allocateDiscount } from "@/lib/discountAllocation";
import {
  EMPTY_DEFAULTS,
  taxRowError,
  useDocumentDefaults,
} from "@/lib/documentDefaults";

import AccountLinkModel from "../Accounts/AccountLinkModel";
import AdditionalDiscount from "../Components/AdditionalDiscount";
import BranchLinkModel from "@/Pages/Settings/Branches/BranchLinkModel";
import NumberInput from "@/Components/NumberInput";
import CurrencyLinkModel from "@/Pages/Core/CurrencyLinkModel";
import CustomerLinkModel from "@/Pages/Sales/Customers/CustomerLinkModel";
import DatetimePicker from "@/Components/DatetimePicker";
import { FormCheckbox } from "@/Components/ui/checkbox";
import FormInput from "@/Components/FormInput";
import InputError from "@/Components/InputError";
import FormTable from "@/Components/FormTable";
import ItemForm from "./ItemForm";
import ItemUnitLinkModel from "@/Pages/Inventory/Items/ItemUnitLinkModel";
import SalesOrderItemLinkModel from "@/Pages/Sales/SalesOrders/SalesOrderItemLinkModel";
import PaymentSchedule from "../Components/PaymentSchedule";
import SalesInvoiceLinkModel from "./SalesInvoiceLinkModel";
import SalesOrderLinkModel from "@/Pages/Sales/SalesOrders/SalesOrderLinkModel";
import TaxLinkModel from "@/Pages/Finances/Taxes/TaxLinkModel";
import { Textarea } from "@/Components/ui/textarea";
import usePermission from "@/Hooks/usePermission";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";

// Replika App\Services\Finances\SalesInvoiceService::DPP_FACTOR (PPN Nilai
// Lain: DPP = 11/12 x basic_amount, tarif efektif 11% dari PPN 12%).
const DPP_FACTOR = 11 / 12;
const ASSET_CLASS = "App\\Models\\Asset\\Asset";
const ITEM_VARIANT_CLASS = "App\\Models\\Inventory\\ItemVariant";

export default function Form() {
  const { t } = useLaravelReactI18n();
  // Baris di luar dokumen sumber (sub model ItemVariant/Asset) butuh izin khusus.
  const canOffSource = usePermission("App\\Models\\Finances\\SalesInvoice").can(
    "manage_off_source_items",
  );
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
  const { data, setData, disabled, dataBefore, isCreate, errors } = useFormPage(
    defaultValue,
    {
      notUseWhenCreate: true,
    },
  );
  const pageProps = usePage().props;
  const { default_currency_id } = pageProps.preferences;
  const defaults = pageProps.defaults ?? EMPTY_DEFAULTS;
  const {
    applyToNewLine,
    applyPaymentTerm,
    resolveForNewLine,
    markFieldEdited,
    isTaxRequired,
  } = useDocumentDefaults(defaults, isCreate ? "sales_invoice" : null, {
    items: data.items,
    setData,
  });
  const paymentDefaultsApplied = useRef(false);

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
  // basic_amount adalah generated column KOTOR (quantity * price), belum dikurangi
  // diskon dokumen -- net_amount (label "Jumlah Dasar") harus mengurangi
  // discount_amount per item (ditulis backend saat create/update, lihat
  // DocumentDiscountCalculator::applyDiscountColumnToItems()). Item hasil
  // carry-over dari SalesOrder (mode create) belum punya discount_amount --
  // default 0 sampai backend menghitung ulang saat disimpan.
  // `items` berisi baris SO, ItemVariant bebas, dan Asset (satu sales_invoice_items).
  const allItems = useMemo(() => data.items ?? [], [data.items]);

  const net_amount = useMemo(() => {
    return allItems.reduce(
      (sum, item) =>
        sum + ((item?.basic_amount ?? 0) - (item?.discount_amount ?? 0)),
      0,
    );
  }, [allItems]);

  const dpp_amount = useMemo(() => {
    return calculateArray(allItems, "dpp_amount", "+");
  }, [allItems]);

  const tax_amount = useMemo(() => {
    return calculateArray(allItems, "tax_amount", "+");
  }, [allItems]);

  const amount = useMemo(() => {
    return net_amount + tax_amount - (data?.discount_amount ?? 0);
  }, [net_amount, tax_amount, data.discount_amount]);

  // Rental: kalkulasi ulang price item yang masih "running" (belum dikembalikan)
  // saat tanggal cut-off billing diubah user. Item berstatus "completed" tidak
  // ikut dihitung ulang -- durasinya tetap dari shipped_date ke tanggal retur aktual.
  useEffect(() => {
    if (!data.sales_order?.is_rent || !data.rental_cutoff_date) return;

    const recalculateRentalRows = (rows) =>
      rows.map((item) => {
        if (
          item.rental_status !== "running" ||
          !item.rental_shipped_date ||
          !item.rental_monthly_rate
        ) {
          return item;
        }

        const durationDays = calculateDurationDays(
          item.rental_shipped_date,
          data.rental_cutoff_date,
        );

        return {
          ...item,
          price: calculateRentalAmount(item.rental_monthly_rate, durationDays),
          rental_duration_days: durationDays,
        };
      });

    setData((prev) => ({
      ...prev,
      items: recalculateRentalRows(prev.items ?? []),
    }));
  }, [data.rental_cutoff_date]);

  // Satu tabel Items (spec delivery-note-sales-invoice-off-source-items): kolom item
  // memakai LinkModel multi-model -- utama = baris SO, sub model = ItemVariant dan
  // Asset bebas (di luar SO). Template link dan navigasi mengikuti jenis baris.
  const itemColumns = useMemo(() => {
    // Baris punya sumber SO, atau ItemVariant/Asset bebas.
    const hasSource = (dataRow) =>
      !!(dataRow?.sales_order_item || dataRow?.item || dataRow?.asset);
    // Baris Asset: dari baris SO ber-asset_id, atau Asset bebas.
    const isAssetRow = (dataRow) =>
      !!(
        dataRow?.asset ??
        dataRow?.asset_id ??
        dataRow?.sales_order_item?.asset ??
        dataRow?.sales_order_item?.asset_id
      );

    return [
      {
        name: "item",
        titleTrans: "finances.salesInvoice.columns.item",
        required: true,
        width: 2,
        cell({ dataRow, setData, attributes }) {
          const assetRow = isAssetRow(dataRow);
          const freeRow = !dataRow.sales_order_item;
          return (
            <SalesOrderItemLinkModel
              placeholder={t("finances.salesInvoice.columns.item.placeholder")}
              value={
                freeRow
                  ? (dataRow.asset ?? dataRow.item ?? null)
                  : dataRow.sales_order_item
              }
              disabled={!data.sales_order}
              mainLabel={t("finances.salesInvoice.columns.item.group_source")}
              subModels={
                !canOffSource
                  ? undefined
                  : [
                      {
                        model: ITEM_VARIANT_CLASS,
                        label: t(
                          "finances.salesInvoice.columns.item.group_item",
                        ),
                        filters: { "item.is_fixed_asset": false },
                        with: ["defaultUom", "item"],
                        disabledAddButton: true,
                      },
                      {
                        model: ASSET_CLASS,
                        label: t(
                          "finances.salesInvoice.columns.item.group_asset",
                        ),
                        group: ["ownership"],
                        filters: { status: { jsonContains: ["active"] } },
                        disabledAddButton: true,
                      },
                    ]
              }
              onValueChange={(val) => {
                // Opsi Asset bebas: dijual, tanpa unit.
                if (val?.thisModel === ASSET_CLASS) {
                  setData({
                    sales_order_item: null,
                    item: null,
                    asset: val,
                    asset_id: val.id,
                    unit: null,
                    conversion_factor: 1,
                    quantity: 1,
                    price: undefined,
                    tax: applyToNewLine(dataRow, null).tax,
                    description: undefined,
                  });
                  return;
                }
                // Opsi ItemVariant bebas.
                if (val?.thisModel === ITEM_VARIANT_CLASS) {
                  const rowPatch = {
                    sales_order_item: null,
                    item: val,
                    asset: null,
                    asset_id: null,
                    unit: val.default_uom,
                    conversion_factor: val.default_uom?.conversion_factor ?? 1,
                    quantity: 1,
                    price: undefined,
                    description: undefined,
                  };
                  const defaultLine = applyToNewLine(
                    { ...dataRow, ...rowPatch },
                    val,
                  );
                  setData({
                    ...rowPatch,
                    tax: defaultLine.tax,
                    tax_rate: defaultLine.tax_rate,
                  });
                  resolveForNewLine(dataRow.id, val);
                  return;
                }
                // Opsi baris SO.
                setData({
                  sales_order_item: val,
                  item: val?.item ?? null,
                  asset: val?.asset ?? null,
                  asset_id: val?.asset_id ?? null,
                  unit: val?.asset_id ? null : val?.unit,
                  conversion_factor: val?.asset_id ? 1 : val?.conversion_factor,
                  quantity: val?.unbilled_quantity,
                  price: val?.price,
                  tax: val?.tax,
                  description: val?.description,
                });
              }}
              {...attributes}
              as={assetRow ? "asset:asset_id" : "item:item.item_id"}
              canNavigation={
                assetRow
                  ? "App\\Models\\Asset\\Asset"
                  : "App\\Models\\Inventory\\Item"
              }
              filters={{
                sales_order_id: data.sales_order?.id ?? null,
              }}
              with={["item", "asset", "unit", "tax"]}
              fields={[
                "asset_id",
                "unbilled_quantity",
                "price",
                "description",
                "conversion_factor",
              ]}
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
              disabled={!hasSource(dataRow)}
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
              disabled={!hasSource(dataRow)}
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
              disabled={!hasSource(dataRow) || isAssetRow(dataRow)}
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
                item_id:
                  dataRow?.sales_order_item?.item?.item_id ??
                  dataRow?.item?.item_id,
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
        cell({ data, setData, attributes, dataRow }, index) {
          const taxError = taxRowError(errors, index);

          return (
            <div className="flex w-full flex-col">
              <TaxLinkModel
                disabled={!hasSource(dataRow)}
                placeholder={t("finances.salesInvoice.columns.tax.placeholder")}
                value={data}
                onValueChange={(val) => {
                  markFieldEdited(dataRow.id, "tax");
                  setData("tax", val);
                }}
                {...attributes}
                required={attributes.required && isTaxRequired(dataRow.id)}
              />
              <InputError message={taxError} className="px-1 text-xs" />
            </div>
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
              disabled={!hasSource(dataRow)}
              value={price}
              onValueChange={(val) => {
                setData("price", val);
              }}
              {...attributes}
            />
          );
        },
      },
      {
        name: "gross_amount",
        titleTrans: "finances.salesInvoice.columns.gross_amount",
        readOnly: true,
        show: true,
        width: 1,
        cell({ dataRow, attributes }) {
          return (
            <NumberInput
              {...attributes}
              readOnly
              decimalScale={2}
              currencyCode={data?.currency?.code ?? "default"}
              value={(dataRow?.quantity ?? 0) * (dataRow?.price ?? 0)}
            />
          );
        },
      },
      {
        name: "dpp_amount",
        titleTrans: "finances.salesInvoice.columns.dpp_amount",
        readOnly: true,
        show: true,
        width: 1,
        cell({ data: dppAmount, attributes }) {
          return (
            <NumberInput
              {...attributes}
              readOnly
              decimalScale={2}
              currencyCode={data?.currency?.code ?? "default"}
              value={dppAmount ?? 0}
            />
          );
        },
      },
    ];
  }, [
    applyToNewLine,
    canOffSource,
    data,
    errors,
    isTaxRequired,
    markFieldEdited,
    resolveForNewLine,
    t,
  ]);

  // basic_amount TIDAK ditimpa di sini -- generated (quantity*price) di server.
  // tax_amount dihitung dari basis DPP Nilai Lain SETELAH dikurangi discount_amount,
  // konsisten dgn DocumentDiscountCalculator::applyDiscountColumnToItems().
  // SalesInvoiceItem tidak punya kolom amount (beda dari PurchaseInvoiceItem), jadi
  // tidak diisi di sini. Alokasi diskon memakai seluruh baris tabel (`dataTable`).
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
      DPP_FACTOR,
    );
    const result = allocated[index] ?? allocated[0];
    return {
      ...item,
      discount_amount:
        Math.round((grossAmounts[index] - (result?.basic_amount ?? 0)) * 100) /
        100,
      dpp_amount: (result?.basic_amount ?? 0) * DPP_FACTOR,
      tax_amount: result?.tax_amount ?? 0,
    };
  };

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
                  "customerBranch",
                  "currency",
                  "items.item",
                  "items.asset",
                  "items.tax",
                  "items.unit",
                  "items.asset_id",
                  "paymentSchedules",
                  "paymentSchedules.paymentMethod",
                ]}
                fields={[
                  "amount",
                  "discount_on",
                  "discount_rate",
                  "discount_amount",
                  "exchange_rate",
                  "external_note",
                  "is_rent",
                  "items.unit",
                  "items.tax",
                  "items.quantity",
                  "items.unbilled_quantity",
                  "items.description",
                  "items.price",
                  "items.basic_amount",
                  "items.tax_rate",
                  "items.tax_amount",
                  "items.conversion_factor",
                ]}
                value={data.sales_order}
                onValueChange={(val) => {
                  const salesOrderRows = val?.items?.map((item) => {
                    return {
                      ...item,
                      id: generateRandom(8),
                      sales_order_item: { id: item.id, ...item },
                      quantity: item.unbilled_quantity ?? item.quantity,
                      amount: item.basic_amount + item.tax_amount,
                    };
                  });
                  setData((prev) => {
                    return {
                      ...prev,
                      id: generateRandom(5),
                      sales_order: val,
                      customer: val?.customer,
                      customer_branch: val?.customer_branch,
                      currency: val?.currency,
                      items: salesOrderRows ?? [],
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
            {data.sales_order?.is_rent && (
              <FormInput
                name="rental_cutoff_date"
                label={t("finances.salesInvoice.columns.rental_cutoff_date")}
              >
                <DatetimePicker
                  type="datetime"
                  value={data?.rental_cutoff_date ?? new Date()}
                  onValueChange={(val) => {
                    setData("rental_cutoff_date", val);
                  }}
                />
              </FormInput>
            )}
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

            {data?.currency?.code &&
              data.currency.code !== default_currency_id && (
                <FormInput
                  label={t("finances.salesInvoice.exchange_rate")}
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
              label={t("finances.salesInvoice.columns.is_return")}
              checked={data.is_return}
              valueBefore={dataBefore?.is_return}
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
                    "items.asset",
                    "items.tax",
                    "items.unit",
                  ]}
                  fields={[
                    "items.asset_id",
                    "items.price",
                    "items.basic_amount",
                    "items.tax_rate",
                    "items.tax_amount",
                  ]}
                  value={data.return_against}
                  onValueChange={(val) => {
                    const returnRows = val?.items?.map((item) => {
                      return {
                        ...item,
                        id: generateRandom(8),
                        return_against_item_id: item.id,
                      };
                    });
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
                      items: returnRows ?? [],
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
                fields={["branches.is_main_branch"]}
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
            columns={itemColumns}
            value={data?.items ?? []}
            valueBefore={dataBefore?.items}
            onValueChange={(v) => setData("items", v)}
            mapItem={mapItem}
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
                label={`${t("finances.salesInvoice.columns.dpp_amount")} (${default_currency_id.toUpperCase()})`}
              >
                <NumberInput
                  className="text-right"
                  decimalScale={2}
                  value={dpp_amount * (data?.exchange_rate ?? 1)}
                  currencyCode="default"
                ></NumberInput>
              </FormInput>
            )}
          <FormInput
            readOnly
            label={`${t("finances.salesInvoice.columns.dpp_amount")} (${(data?.currency?.code ?? default_currency_id).toUpperCase()})`}
            className="col-start-2"
          >
            <NumberInput
              decimalScale={2}
              className="text-right"
              value={dpp_amount}
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
