import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";
import React, { useMemo } from "react";

import { FormCheckbox } from "@/Components/ui/checkbox";
import FormInput from "@/Components/FormInput";
import FormTable from "@/Components/FormTable";
import { Input } from "@/Components/ui/input";
import NumberInput from "@/Components/NumberInput";
import { Textarea } from "@/Components/ui/textarea";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Form() {
  const { data, setData, dataBefore } = useFormPage();

  const { t } = useLaravelReactI18n();

  /**
   * @typedef {import('@/Components/FormTable').ColumnProps} ColumnProps
   * @type {ColumnProps[]}
   */
  const valuesColumns = useMemo(
    () => [
      {
        name: "value",
        titleTrans: "inventory.attribute.columns.value",
        required: true,
      },
    ],
    [],
  );
  return (
    <>
      <FormPageContent title={null} value="detail">
        <div className="grid gap-x-3 gap-y-4 lg:grid-cols-3">
          <FormInput
            required={true}
            label={t("inventory.attribute.columns.name")}
            className="col-span-full"
            name="name"
          >
            <Input
              value={data.name}
              onChange={(e) => setData("name", e.target.value)}
            />
          </FormInput>
          <FormInput
            label={t("inventory.attribute.columns.description")}
            className="col-span-full"
            name="description"
          >
            <Textarea
              value={data.description ?? ""}
              onChange={(e) => setData("description", e.target.value)}
            />
          </FormInput>
          <FormCheckbox
            checked={data.is_numeric ?? false}
            valueBefore={dataBefore?.is_numeric}
            onCheckedChange={(val) => {
              setData("is_numeric", val);
            }}
            label={t("inventory.attribute.columns.is_numeric")}
            className="col-span-full"
          />
          {!data.is_numeric ? (
            <FormTable
              name="AttributeValues"
              label={t("inventory.attribute.columns.values")}
              className="col-span-full"
              columns={valuesColumns}
              value={data.values ?? []}
              valueBefore={dataBefore?.values}
              onValueChange={(val) => {
                setData("values", val);
              }}
            />
          ) : (
            <>
              <FormInput
                required={true}
                label={t("inventory.attribute.columns.range.from")}
                name="from_range"
              >
                <NumberInput
                  className="text-left"
                  value={data.from_range ?? 0}
                  onValueChange={(val) => setData("from_range", val)}
                />
              </FormInput>
              <FormInput
                required={true}
                label={t("inventory.attribute.columns.range.to")}
                name="to_range"
              >
                <NumberInput
                  className="text-left"
                  value={data.to_range ?? 0}
                  onValueChange={(val) => setData("to_range", val)}
                />
              </FormInput>
              <FormInput
                required={true}
                label={t("inventory.attribute.columns.range.increment")}
                name="increment"
              >
                <NumberInput
                  className="text-left"
                  min={0}
                  value={data.increment ?? 0}
                  onValueChange={(val) => setData("increment", val)}
                />
              </FormInput>
            </>
          )}
        </div>
      </FormPageContent>
    </>
  );
}
