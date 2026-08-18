import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/Components/ui/select";

import AssetLinkModel from "@/Pages/Asset/Assets/AssetLinkModel";
import AssetLocationLinkModel from "@/Pages/Asset/Locations/AssetLocationLinkModel";
import DatetimePicker from "@/Components/DatetimePicker";
import FormInput from "@/Components/FormInput";
import FormTable from "@/Components/FormTable";
import React from "react";
import UserLinkModel from "@/Pages/Users/ManageUsers/UserLinkModel";
import { generateRandom } from "@/lib/utils";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { useMemo } from "react";

const PURPOSES = ["issue", "receipt", "transfer", "transfer_and_issue"];

export default function Form() {
  const { data, setData, disabled } = useFormPage();
  const { t } = useLaravelReactI18n();

  const needsSource = ["receipt", "transfer", "transfer_and_issue"].includes(
    data?.purpose,
  );
  const needsTarget = ["issue", "transfer", "transfer_and_issue"].includes(
    data?.purpose,
  );

  const itemColumns = useMemo(() => {
    return [
      {
        name: "asset",
        titleTrans: "asset.movement.columns.asset_id",
        required: true,
        width: 2,
        cell({ data: value, setData, attributes }) {
          return (
            <AssetLinkModel
              value={value}
              onValueChange={(val) => setData("asset", val)}
              {...attributes}
            />
          );
        },
      },
      {
        name: "source_location",
        titleTrans: "asset.movement.columns.source_location_id",
        required: needsSource,
        cell({ data: value, setData, attributes }) {
          return (
            <AssetLocationLinkModel
              value={value}
              onValueChange={(val) => setData("source_location", val)}
              {...attributes}
            />
          );
        },
      },
      {
        name: "target_location",
        titleTrans: "asset.movement.columns.target_location_id",
        required: needsTarget,
        cell({ data: value, setData, attributes }) {
          return (
            <AssetLocationLinkModel
              value={value}
              onValueChange={(val) => setData("target_location", val)}
              {...attributes}
            />
          );
        },
      },
      {
        name: "to_custodian",
        titleTrans: "asset.movement.columns.to_custodian_id",
        cell({ data: value, setData, attributes }) {
          return (
            <UserLinkModel
              value={value}
              onValueChange={(val) => setData("to_custodian", val)}
              {...attributes}
            />
          );
        },
      },
    ];
  }, [needsSource, needsTarget]);

  return (
    <FormPageContent title={t("asset.movement.title")} value="main">
      <div className="grid gap-x-4 gap-y-4 md:grid-cols-2">
        <FormInput
          name="purpose"
          required={true}
          label={t("asset.movement.columns.purpose")}
        >
          <Select
            value={data?.purpose}
            onValueChange={(val) => setData("purpose", val)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PURPOSES.map((purpose) => (
                <SelectItem key={purpose} value={purpose}>
                  {t(`asset.movement.purpose.${purpose}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormInput>
        <FormInput
          name="transaction_date"
          required={true}
          label={t("asset.movement.columns.transaction_date")}
        >
          <DatetimePicker
            type="date"
            value={data?.transaction_date}
            onValueChange={(val) => setData("transaction_date", val)}
          />
        </FormInput>
      </div>
      <div className="col-span-full">
        <FormTable
          name="AssetMovementItems"
          readOnly={disabled}
          columns={itemColumns}
          value={data?.items}
          onValueChange={(v) => setData("items", v)}
          mapItem={({ item }) => ({
            ...item,
            id: item.id ?? generateRandom(5),
          })}
        />
      </div>
    </FormPageContent>
  );
}
