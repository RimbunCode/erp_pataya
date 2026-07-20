import React, { useCallback, useEffect, useRef, useState } from "react";

import CategoryLinkModel from "../Categories/CategoryLinkModel";
import { FormCheckbox } from "@/Components/ui/checkbox";
import FormInput from "@/Components/FormInput";
import { FormPageContent } from "@/Pages/Core/FormPage";
import { Input } from "@/Components/ui/input";
import { Textarea } from "@/Components/ui/textarea";
import UnitLinkModel from "../Units/UnitLinkModel";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function FormDetail({
  dataBefore: _dataBefore,
  data,
  setData,
  isVariant,
  item,
}) {
  const { t } = useLaravelReactI18n();
  const commitTimersRef = useRef({});
  const [codeValue, setCodeValue] = useState(data.code);
  const [nameValue, setNameValue] = useState(
    isVariant ? item?.name : data?.name,
  );
  const [descriptionValue, setDescriptionValue] = useState(
    data?.description ?? item?.description ?? "",
  );

  useEffect(() => {
    setCodeValue(data.code);
  }, [data.code, isVariant]);
  useEffect(() => {
    setNameValue(isVariant ? item?.name : data?.name);
  }, [data?.name, isVariant, item?.name]);
  useEffect(() => {
    setDescriptionValue(data?.description ?? item?.description ?? "");
  }, [data?.description, item?.description]);

  const commitField = useCallback(
    (field, value) => {
      if (commitTimersRef.current[field]) {
        clearTimeout(commitTimersRef.current[field]);
      }
      commitTimersRef.current[field] = setTimeout(() => {
        setData(field, value);
      }, 120);
    },
    [setData],
  );

  const flushField = useCallback(
    (field, value) => {
      if (commitTimersRef.current[field]) {
        clearTimeout(commitTimersRef.current[field]);
        delete commitTimersRef.current[field];
      }
      setData(field, value);
    },
    [setData],
  );

  useEffect(() => {
    return () => {
      Object.values(commitTimersRef.current).forEach((timerId) => {
        clearTimeout(timerId);
      });
    };
  }, []);

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
            value={codeValue ?? ""}
            name="code"
            onChange={(e) => {
              const nextValue = e.target.value;
              setCodeValue(nextValue);
              commitField("code", nextValue);
            }}
            onBlur={() => flushField("code", codeValue ?? "")}
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
            value={nameValue ?? ""}
            onChange={(e) => {
              const nextValue = e.target.value;
              setNameValue(nextValue);
              commitField("name", nextValue);
            }}
            onBlur={() => flushField("name", nameValue ?? "")}
          />
        </FormInput>
        <FormInput required={true} label={t("inventory.item.columns.category")}>
          <CategoryLinkModel
            placeholder={t("inventory.item.columns.category.placeholder")}
            disabled={isVariant}
            value={isVariant ? item.category : data.category}
            onValueChange={(val) =>
              setData((prev) => {
                const updated = { ...prev, category: val };
                if (
                  val?.default_unit &&
                  prev.default_unit !== val?.default_unit
                ) {
                  updated.default_unit = val?.default_unit;
                }
                return updated;
              })
            }
            with={["defaultUnit"]}
            fields={["defaultUnit.group"]}
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
          value={descriptionValue}
          onChange={(e) => {
            const nextValue = e.target.value;
            setDescriptionValue(nextValue);
            commitField("description", nextValue);
          }}
          onBlur={() => flushField("description", descriptionValue)}
        />
      </FormInput>
    </FormPageContent>
  );
}
