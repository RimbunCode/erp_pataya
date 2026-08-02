import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";
import React, { useCallback, useMemo, useRef } from "react";
import { calculateArray, getDataModel } from "@/lib/utils";

import AccountLinkModel from "@/Pages/Finances/Accounts/AccountLinkModel";
import NumberInput from "@/Components/NumberInput";
import DatetimePicker from "@/Components/DatetimePicker";
import { FormCheckbox } from "@/Components/ui/checkbox";
import FormInput from "@/Components/FormInput";
import FormTable from "@/Components/FormTable";
import ItemUnitLinkModel from "../Items/ItemUnitLinkModel";
import ItemVariantLinkModel from "../Items/ItemVariantLinkModel";
import Select from "@/Components/Select";
import { Textarea } from "@/Components/ui/textarea";
import WarehouseLinkModel from "../Warehouses/WarehouseLinkModel";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";

export default function Form() {
  const defaultValue = useCallback(async () => {
    const account = await getDataModel(
      "App\\Models\\Finances\\Account",
      {
        root_type: "expense",
        account_type: "stock_adjustment",
      },
      {
        limit: 1,
      },
    );
    return {
      date: new Date(),
      difference_account: account,
    };
  }, []);

  const { defaultData, data, setData, disabled } = useFormPage(defaultValue);
  const { currentBranch } = usePage().props.branchSettings;
  const { t } = useLaravelReactI18n();
  const itemsTableRef = useRef();

  const totalAdditionalCost = useMemo(() => {
    return calculateArray(data.additional_costs, "amount", "+");
  }, [data.additional_costs]);

  const totalAmount = useMemo(() => {
    return (
      calculateArray(data.items, "basic_amount", "+") + totalAdditionalCost
    );
  }, [totalAdditionalCost, data.items]);

  const totalQty = useMemo(() => {
    return calculateArray(
      data.items?.map((item) => ({
        ...item,
        quantity:
          item.conversion_factor > 1
            ? item.quantity * item.conversion_factor
            : item.quantity / item.conversion_factor,
      })),
      "quantity",
      "+",
    );
  }, [data.items]);

  const mappingItem = useCallback(
    ({ item, dataTable, index }, totalCost) => {
      if (disabled) return item;
      const basic_amount = item.basic_rate * item.quantity;
      const newItem = {
        ...(item ?? {}),
        basic_amount,
      };
      if (!dataTable) return newItem;
      dataTable[index] = newItem;
      const totalBasicAmount = calculateArray(dataTable, "basic_amount", "+");
      const totalAdditionalCost = calculateArray(
        data.additional_costs,
        "amount",
        "+",
      );

      const qty =
        item.conversion_factor > 1
          ? item.quantity * item.conversion_factor
          : item.quantity / item.conversion_factor;
      const additional_cost =
        totalBasicAmount != 0
          ? (basic_amount / totalBasicAmount) *
            (totalCost ?? totalAdditionalCost)
          : 0;
      const valuation_rate = additional_cost / qty + basic_amount / qty;
      const amount = basic_amount + additional_cost;
      return {
        ...item,
        basic_amount,
        additional_cost,
        amount,
        valuation_rate,
      };
    },
    [disabled, data.additional_costs],
  );

  const itemColumns = useMemo(() => {
    return [
      {
        name: "item",
        titleTrans: "inventory.stockEntry.item_columns.columns.item",
        required: true,
        width: 2,
        cell({ dataRow, setData, attributes, reset }) {
          return (
            <ItemVariantLinkModel
              placeholder={t(
                "inventory.stockEntry.item_columns.columns.item.placeholder",
              )}
              value={dataRow.item}
              onValueChange={(val) => {
                if (!val) {
                  reset();
                  return;
                }
                const defaultUnit = val?.default_uom;
                setData({
                  item: val,
                  unit: defaultUnit,
                  conversion_factor: defaultUnit?.conversion_factor,
                  source_warehouse: data.default_source_warehouse ?? undefined,
                  target_warehouse: data.default_target_warehouse ?? undefined,
                });
              }}
              {...attributes}
              filters={{
                is_stock_item: true,
              }}
              with={["item", "defaultUom"]}
            />
          );
        },
      },
      (data.type == "item_transfer" ||
        data.type == "item_consumption" ||
        data.type == "item_issue") && {
        name: "source_warehouse",
        titleTrans:
          "inventory.stockEntry.item_columns.columns.source_warehouse",
        show: true,
        type: "text",
        width: 2,
        required: true,
        cell({ dataRow, data, setData, attributes }) {
          return (
            <WarehouseLinkModel
              disabled={!dataRow?.item}
              placeholder={t(
                "inventory.stockEntry.item_columns.columns.source_warehouse.placeholder",
              )}
              value={data}
              onValueChange={(val) => setData("source_warehouse", val)}
              filters={{
                branch_id: currentBranch?.is_main_branch
                  ? undefined
                  : currentBranch?.id,
                id: {
                  not: dataRow.target_warehouse?.id,
                },
              }}
              {...attributes}
            />
          );
        },
      },
      (data.type == "item_transfer" || data.type == "item_receipt") && {
        name: "target_warehouse",
        titleTrans:
          "inventory.stockEntry.item_columns.columns.target_warehouse",
        show: true,
        type: "text",
        width: 2,
        required: true,
        cell({ dataRow, data, setData, attributes }) {
          return (
            <WarehouseLinkModel
              disabled={!dataRow?.item}
              placeholder={t(
                "inventory.stockEntry.item_columns.columns.target_warehouse.placeholder",
              )}
              value={data}
              onValueChange={(val) => setData("target_warehouse", val)}
              {...attributes}
              filters={{
                branch_id: currentBranch?.is_main_branch
                  ? undefined
                  : currentBranch?.id,
                id: {
                  not: dataRow.source_warehouse?.id,
                },
              }}
            />
          );
        },
      },
      {
        name: "description",
        titleTrans: "inventory.stockEntry.item_columns.columns.description",
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
        titleTrans: "inventory.stockEntry.item_columns.columns.quantity",
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
              decimalScale={2}
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
        titleTrans: "inventory.stockEntry.item_columns.columns.unit",

        cell({ data, setData, attributes, dataRow }) {
          return (
            <ItemUnitLinkModel
              disabled={!dataRow?.item}
              placeholder={t(
                "inventory.stockEntry.item_columns.columns.unit.placeholder",
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
                item_id: dataRow?.item?.item_id,
              }}
            />
          );
        },
      },
      {
        name: "basic_rate",
        titleTrans: "inventory.stockEntry.item_columns.columns.basic_rate",
        required: data.type == "item_receipt",
        show: true,
        width: 2,
        type: "number",
        cell({ dataRow, setData, attributes }) {
          return (
            <NumberInput
              {...attributes}
              disabled={!dataRow?.item}
              readOnly={data.type != "item_receipt"}
              value={dataRow.basic_rate}
              onValueChange={(val) => setData("basic_rate", val)}
              currencyCode="default"
              decimalScale={2}
            />
          );
        },
      },
      {
        name: "basic_amount",
        titleTrans: "inventory.stockEntry.item_columns.columns.basic_amount",
        disabled: true,
        type: "number",
        cell({ dataRow, attributes }) {
          return (
            <NumberInput
              {...attributes}
              disabled={!dataRow?.item || attributes.disabled}
              value={dataRow.basic_amount}
              currencyCode="default"
              decimalScale={2}
            />
          );
        },
      },
      ...(data?.type == "item_transfer" || data?.type == "item_receipt"
        ? [
            {
              name: "additional_cost",
              titleTrans:
                "inventory.stockEntry.item_columns.columns.additional_cost",
              disabled: true,
              type: "number",
              cell({ dataRow, attributes }) {
                return (
                  <NumberInput
                    {...attributes}
                    disabled={!dataRow?.item || attributes.disabled}
                    value={dataRow.additional_cost}
                    currencyCode="default"
                    decimalScale={2}
                  />
                );
              },
            },
            {
              name: "valuation_rate",
              titleTrans:
                "inventory.stockEntry.item_columns.columns.valuation_rate",
              disabled: true,
              type: "number",
              cell({ dataRow, attributes }) {
                return (
                  <NumberInput
                    {...attributes}
                    disabled={!dataRow?.item || attributes.disabled}
                    value={dataRow.valuation_rate}
                    currencyCode="default"
                    decimalScale={2}
                  />
                );
              },
            },
            {
              name: "amount",
              titleTrans: "inventory.stockEntry.item_columns.columns.amount",
              disabled: true,
              type: "number",
              cell({ dataRow, attributes }) {
                return (
                  <NumberInput
                    {...attributes}
                    disabled={!dataRow?.item || attributes.disabled}
                    value={dataRow.amount}
                    currencyCode="default"
                    decimalScale={2}
                  />
                );
              },
            },
          ]
        : []),
    ];
  }, [data, currentBranch]);

  const additionalCostColumns = useMemo(() => {
    return [
      {
        name: "expense_account",
        required: true,
        titleTrans: "finances.additionalCost.columns.expense_account",
        cell({ data, setData, attributes }) {
          return (
            <AccountLinkModel
              onValueChange={(val) => setData("expense_account", val)}
              value={data}
              filters={{
                account_type: {
                  in: [
                    "tax",
                    "chargeable",
                    "income_account",
                    "expenses_included_in_valuation",
                    "expenses_included_in_asset_valuation",
                  ],
                },
              }}
              {...attributes}
            />
          );
        },
      },
      {
        name: "purpose",
        titleTrans: "finances.additionalCost.columns.purpose",
        type: "text",
        required: true,
        width: 2,
        cell({ data, setData, attributes }) {
          return (
            <Textarea
              rows={1}
              value={data ?? ""}
              onChange={(e) => setData("purpose", e.target.value)}
              {...attributes}
            />
          );
        },
      },
      {
        name: "amount",
        titleTrans: "finances.additionalCost.columns.amount",
        required: true,
        type: "number",
        width: 1,
        cell({ data, setData, attributes }) {
          return (
            <NumberInput
              {...attributes}
              currencyCode="default"
              decimalScale={2}
              value={data}
              onValueChange={(value) => {
                setData("amount", value);
              }}
            />
          );
        },
      },
    ];
  }, []);

  return (
    <>
      <FormPageContent title={t("inventory.stockEntry.detail")} value="detail">
        <div className="grid gap-x-4 gap-y-4 md:grid-cols-2">
          <FormInput
            label={t("inventory.stockEntry.columns.date")}
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
            label={t("inventory.stockEntry.columns.type")}
            required
            name="type"
          >
            <Select
              value={data.type}
              onValueChange={(val) => setData("type", val)}
              placeholder={t("inventory.stockEntry.columns.type.placeholder")}
              optionTrans="inventory.stockEntry.types"
              options={["item_transfer", "item_receipt", "item_issue"]}
            />
          </FormInput>
          {data.type == "item_transfer" && (
            <FormCheckbox
              className="col-start-2"
              label={t("inventory.stockEntry.columns.using_transit")}
              name="using_transit"
              checked={data.using_transit}
              onCheckedChange={(val) => setData("using_transit", val)}
            />
          )}
        </div>
      </FormPageContent>
      <FormPageContent
        value="detail"
        title={t("inventory.stockEntry.accounting")}
      >
        <div className="grid gap-x-4 gap-y-4 md:grid-cols-2 grid-cols-1">
          <FormInput
            name="difference_account"
            required
            label={t("inventory.stockEntry.columns.difference_account")}
          >
            <AccountLinkModel
              value={data.difference_account}
              onValueChange={(val) => setData("difference_account", val)}
              filters={{
                is_group: false,
                root_type: {
                  in: ["liability", "equity", "expense"],
                },
              }}
            />
          </FormInput>
        </div>
      </FormPageContent>
      <FormPageContent title={t("inventory.stockEntry.items")} value="detail">
        <div className="grid gap-x-4 gap-y-4 md:grid-cols-2 ">
          {(data.type == "item_transfer" ||
            data.type == "item_issue" ||
            data.type == "item_consumption") && (
            <FormInput
              name="default_source_warehouse"
              label={t("inventory.stockEntry.columns.default_source_warehouse")}
            >
              <WarehouseLinkModel
                value={data.default_source_warehouse}
                onValueChange={(val) =>
                  setData((prev) => {
                    return {
                      ...prev,
                      default_source_warehouse: val,
                      items: prev.items?.map((item) => {
                        return {
                          ...item,
                          source_warehouse: val,
                        };
                      }),
                    };
                  })
                }
                filters={{
                  branch_id: data.branch_id,
                  id: {
                    not: data.default_target_warehouse?.id,
                  },
                }}
              />
            </FormInput>
          )}
          {(data.type == "item_transfer" || data.type == "item_receipt") && (
            <FormInput
              name="default_target_warehouse"
              label={t("inventory.stockEntry.columns.default_target_warehouse")}
            >
              <WarehouseLinkModel
                value={data.default_target_warehouse}
                onValueChange={(val) =>
                  setData((prev) => {
                    return {
                      ...prev,
                      default_target_warehouse: val,
                      items: prev.items?.map((item) => {
                        return {
                          ...item,
                          target_warehouse: val,
                        };
                      }),
                    };
                  })
                }
                filters={{
                  branch_id: data.branch_id,
                  id: {
                    not: data.default_source_warehouse?.id,
                  },
                }}
              />
            </FormInput>
          )}
          <FormTable
            ref={itemsTableRef}
            className="col-span-full"
            name="StockEntryItems"
            readOnly={disabled}
            columns={itemColumns}
            value={data?.items ?? []}
            onValueChange={(v) => setData("items", v)}
            mapItem={mappingItem}
          />

          <FormInput label={t("inventory.stockEntry.columns.total_quantity")}>
            <NumberInput readOnly decimalScale={2} value={totalQty} />
          </FormInput>
          <FormInput label={t("inventory.stockEntry.columns.total_amount")}>
            <NumberInput readOnly decimalScale={2} value={totalAmount} />
          </FormInput>
        </div>
      </FormPageContent>

      <FormPageContent
        title={t("inventory.stockEntry.columns.notes")}
        value="detail"
        collapsible
        defaultOpen={defaultData?.notes}
      >
        <FormInput name="notes">
          <Textarea
            value={data.notes}
            onChange={(e) => setData("notes", e.target.value)}
          />
        </FormInput>
      </FormPageContent>
      <FormPageContent
        title={t("inventory.stockEntry.additional_costs")}
        value="additional_costs"
        show={
          !(
            data.type == null ||
            data.type == "item_issue" ||
            data.type == "item_consumption"
          )
        }
      >
        <FormTable
          name="StockEntryAdditionalCosts"
          readOnly={disabled}
          columns={additionalCostColumns}
          value={data?.additional_costs ?? []}
          onValueChange={(v) => {
            setData((prev) => {
              const newData = {
                ...prev,
                additional_costs: v,
              };
              return {
                ...newData,
                items: prev.items?.map((item, index) => {
                  return mappingItem(
                    {
                      item,
                      dataTable: newData.items,
                      index,
                    },
                    calculateArray(v, "amount", "+"),
                  );
                }),
              };
            });
          }}
        />
        <div className="grid grid-cols-3 mt-4">
          <FormInput
            label={t("finances.additionalCost.columns.total")}
            name="total"
            className="md:col-start-3 col-start-2 col-span-2"
          >
            <NumberInput
              currencyCode="default"
              decimalScale={2}
              value={totalAdditionalCost}
            />
          </FormInput>
        </div>
      </FormPageContent>
    </>
  );
}
