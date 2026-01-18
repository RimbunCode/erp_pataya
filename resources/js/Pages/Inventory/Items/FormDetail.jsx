import CategoryLinkModel from "../Categories/CategoryLinkModel";
import { FormCheckbox } from "@/Components/ui/checkbox";
import FormInput from "@/Components/FormInput";
import { FormPageContent } from "@/Pages/Core/FormPage";
import { Input } from "@/Components/ui/input";
import React from "react";
import { Textarea } from "@/Components/ui/textarea";
import UnitLinkModel from "../Units/UnitLinkModel";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function FormDetail({
  dataBefore,
  data,
  setData,
  isVariant,
  item,
}) {
  const { t } = useLaravelReactI18n();
  return (
    <FormPageContent title={t("inventory.item.menu.details")} value="detail">
      <div className="columns-xs space-y-4 [&>div]:break-inside-avoid">
        <FormCheckbox
          checked={
            isVariant ? (data.is_disabled ?? "indeterminate") : data.is_disabled
          }
          onCheckedChange={(val) => {
            if (isVariant) {
              setData(
                "is_disabled",
                data.is_disabled === false
                  ? null
                  : data.is_disabled == null
                    ? true
                    : false,
              );
              return;
            }
            setData("is_disabled", val);
          }}
          label={t("inventory.item.columns.is_disabled.parse.true")}
        />
        <FormCheckbox
          checked={
            isVariant
              ? (data.allow_alternative_item ?? "indeterminate")
              : data.allow_alternative_item
          }
          onCheckedChange={(val) => {
            if (isVariant) {
              setData(
                "allow_alternative_item",
                data.allow_alternative_item === false
                  ? null
                  : data.allow_alternative_item == null
                    ? true
                    : false,
              );
              return;
            }
            setData("allow_alternative_item", val);
          }}
          label={t("inventory.item.columns.allow_alternative_item")}
        />
      </div>
      <div className="mt-4 space-y-4 gap-x-8 columns-xs [&>div]:break-inside-avoid">
        <FormInput
          required={true}
          label={t(`inventory.item.columns.${isVariant ? "sku" : "code"}`)}
          className=""
        >
          <Input
            disabled={isVariant}
            value={isVariant ? data.sku : data.code}
            name="code"
            onChange={(e) => setData("code", e.target.value)}
          />
        </FormInput>
        <FormInput
          required={true}
          label={t("inventory.item.columns.name")}
          className=""
        >
          <Input
            disabled={isVariant}
            name="name"
            value={isVariant ? item.name : data.name}
            onChange={(e) => setData("name", e.target.value)}
          />
        </FormInput>
        <FormInput required={true} label={t("inventory.item.columns.category")}>
          <CategoryLinkModel
            placeholder={t("inventory.item.columns.category.placeholder")}
            disabled={isVariant}
            value={isVariant ? item.category : data.category}
            onValueChange={(val) => setData("category", val)}
            filters={
              !isVariant && data.have_transations
                ? {
                    type: {
                      in: ["stock", "vehicle"],
                    },
                  }
                : null
            }
          />
        </FormInput>

        <FormInput
          required={true}
          label={t("inventory.item.columns.default_unit")}
        >
          <UnitLinkModel
            readOnly={isVariant ? item.have_transations : data.have_transations}
            placeholder={t("inventory.item.columns.default_unit.placeholder")}
            disabled={isVariant}
            value={isVariant ? item.default_unit : data.default_unit}
            onValueChange={(val) => setData("default_unit", val)}
          />
        </FormInput>
      </div>
      <FormInput
        label={t("inventory.item.columns.description")}
        className="mt-4"
      >
        <Textarea
          name="description"
          value={data?.description ?? item?.description ?? ""}
          onChange={(e) => setData("description", e.target.value)}
        />
      </FormInput>
    </FormPageContent>
  );
}
