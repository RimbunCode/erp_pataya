import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/Components/ui/select";

import AssetLinkModel from "@/Pages/Asset/Assets/AssetLinkModel";
import { FormCheckbox } from "@/Components/ui/checkbox";
import FormInput from "@/Components/FormInput";
import FormTable from "@/Components/FormTable";
import { Input } from "@/Components/ui/input";
import ItemVariantLinkModel from "@/Pages/Inventory/Items/ItemVariantLinkModel";
import ItemUnitLinkModel from "@/Pages/Inventory/Items/ItemUnitLinkModel";
import DatetimePicker from "@/Components/DatetimePicker";
import NumberInput from "@/Components/NumberInput";
import { Textarea } from "@/Components/ui/textarea";
import React from "react";
import { cn, generateRandom } from "@/lib/utils";
import { hasPassedApproval } from "./statusUtils";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { useMemo } from "react";
import { router } from "@inertiajs/react";

const TYPES = ["maintenance_task", "repair"];

export default function Form() {
  const { data, setData, disabled } = useFormPage();
  const { t } = useLaravelReactI18n();

  const isRepair = data?.type === "repair";
  const isMaintenanceTask = data?.type === "maintenance_task";
  // Requirement 8: hasPassedApproval() (BUKAN cek literal "approved").
  const approved = hasPassedApproval(data?.status);
  // Requirement 6, spec asset-service-billing: checkbox hanya tersedia kalau
  // Asset terkait sedang berstatus rental (backend expose via has_active_renter,
  // dihitung controller saat show — TIDAK di Asset::$appends, supaya tidak
  // menambah query di setiap listing Asset).
  const canBillToRenter = approved && data?.has_active_renter;

  const consumedItemColumns = useMemo(
    () => [
      {
        name: "item",
        titleTrans: "asset.service.columns.item",
        required: true,
        cell({ data: value, setData, attributes }) {
          return (
            <ItemVariantLinkModel
              value={value}
              onValueChange={(val) => {
                const defaultUnit = val?.default_uom;
                setData({
                  item: val,
                  unit: defaultUnit,
                });
              }}
              {...attributes}
              with={["defaultUom"]}
              filters={{ "item.is_fixed_asset": false }}
            />
          );
        },
      },
      {
        name: "quantity",
        titleTrans: "asset.service.columns.quantity",
        required: true,
        cell({ data: value, setData, attributes }) {
          return (
            <NumberInput
              value={value}
              onValueChange={(val) => setData("quantity", val)}
              {...attributes}
              className={cn(attributes.className, "text-left")}
            />
          );
        },
      },
      {
        name: "unit",
        titleTrans: "asset.service.columns.unit",
        required: true,
        cell({ dataRow, data: value, setData, attributes }) {
          return (
            <ItemUnitLinkModel
              disabled={!dataRow?.item}
              value={value}
              onValueChange={(val) => setData("unit", val)}
              {...attributes}
              filters={{ item_id: dataRow?.item?.item_id }}
            />
          );
        },
      },
    ],
    [],
  );

  return (
    <FormPageContent title={t("asset.service.title")} value="main">
      <div className="grid gap-x-4 gap-y-4 md:grid-cols-2">
        <FormInput
          name="type"
          required={true}
          label={t("asset.service.columns.type")}
        >
          <Select
            value={data?.type}
            onValueChange={(val) => setData("type", val)}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {t(`asset.service.type.${type}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormInput>

        {isRepair && (
          <>
            <FormInput
              name="asset"
              required={true}
              label={t("asset.service.columns.asset_id")}
            >
              <AssetLinkModel
                value={data?.asset}
                onValueChange={(val) => setData("asset", val)}
                // Hanya Asset yang statusnya memenuhi allowedFrom di
                // Asset::setOutOfOrder() (lihat app/Models/Asset/Asset.php) --
                // draft/out_of_order/scrapped/dst tidak akan pernah lolos
                // transisi status saat AssetService ini di-approve.
                filters={{
                  status: {
                    jsonContains: ["active", "issued", "in_maintenance"],
                  },
                }}
              />
            </FormInput>
            <FormInput
              name="failure_date"
              required={true}
              label={t("asset.service.columns.failure_date")}
            >
              <DatetimePicker
                value={data?.failure_date}
                onValueChange={(val) => setData("failure_date", val)}
              />
            </FormInput>
            {/* Requirement 5 AC5, 9 AC7: tampil HANYA JIKA terisi (bukan
                kosong/dash) -- start_date field baru, completion_date field
                existing yang sebelumnya belum pernah dirender di FE. */}
            {data?.start_date && (
              <FormInput
                name="start_date"
                label={t("asset.service.columns.start_date")}
              >
                <Input value={data.start_date} disabled readOnly />
              </FormInput>
            )}
            {data?.completion_date && (
              <FormInput
                name="completion_date"
                label={t("asset.service.columns.completion_date")}
              >
                <Input value={data.completion_date} disabled readOnly />
              </FormInput>
            )}
            <FormCheckbox
              checked={data?.capitalize_repair_cost ?? false}
              onCheckedChange={(val) => setData("capitalize_repair_cost", val)}
              className="pt-4"
            >
              {t("asset.service.columns.capitalize_repair_cost")}
            </FormCheckbox>
            {data?.capitalize_repair_cost && (
              <FormInput
                name="increase_in_asset_life"
                label={t("asset.service.columns.increase_in_asset_life")}
              >
                <NumberInput
                  allowDecimals={false}
                  value={data?.increase_in_asset_life}
                  onValueChange={(val) =>
                    setData("increase_in_asset_life", val)
                  }
                  className="text-left"
                />
              </FormInput>
            )}
          </>
        )}

        {isMaintenanceTask && (
          <FormInput
            name="asset_maintenance_task"
            label={t("asset.maintenance.task.columns.task_name")}
          >
            <Input
              value={data?.assetMaintenanceTask?.task_name ?? ""}
              disabled
              readOnly
            />
          </FormInput>
        )}

        <FormInput
          name="description"
          label={t("asset.service.columns.description")}
          className="col-span-full"
        >
          <Textarea
            rows={3}
            value={data?.description ?? ""}
            onChange={(e) => setData("description", e.target.value)}
          />
        </FormInput>

        {canBillToRenter && (
          <FormCheckbox
            checked={data?.bill_to_renter ?? false}
            disabled={data?.bill_to_renter}
            onCheckedChange={(val) => {
              if (!val) return;
              router.post(route("assetServices.billToRenter", data.id));
            }}
            className="pt-4"
          >
            {t("asset.service.columns.bill_to_renter")}
          </FormCheckbox>
        )}
        {data?.bill_to_renter && (
          <>
            <FormInput
              name="customer"
              label={t("asset.service.columns.customer")}
            >
              <Input value={data?.customer?.name ?? ""} disabled readOnly />
            </FormInput>
            <FormInput
              name="customer_branch"
              label={t("asset.service.columns.customer_branch")}
            >
              <Input
                value={data?.customerBranch?.name ?? ""}
                disabled
                readOnly
              />
            </FormInput>
          </>
        )}
      </div>

      <div className="col-span-full">
        <FormTable
          name="AssetServiceConsumedItems"
          readOnly={disabled}
          columns={consumedItemColumns}
          value={data?.consumedItems}
          onValueChange={(v) => setData("consumedItems", v)}
          mapItem={({ item }) => ({
            ...item,
            id: item.id ?? generateRandom(5),
          })}
        />
      </div>
    </FormPageContent>
  );
}
