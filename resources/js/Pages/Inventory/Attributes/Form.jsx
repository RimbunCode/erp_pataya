import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";
import React, { useMemo } from "react";

import { FormCheckbox } from "@/Components/ui/checkbox";
import FormInput from "@/Components/FormInput";
import FormTable from "@/Components/FormTable";
import { Input } from "@/Components/ui/input";
import { Textarea } from "@/Components/ui/textarea";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Form() {
  const { data, setData } = useFormPage();

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
          >
            <Input
              value={data.name}
              onChange={(e) => setData("name", e.target.value)}
            />
          </FormInput>
          <FormInput
            label={t("inventory.attribute.columns.description")}
            className="col-span-full"
          >
            <Textarea
              value={data.description ?? ""}
              onChange={(e) => setData("description", e.target.value)}
            />
          </FormInput>
          <FormCheckbox
            checked={data.is_numeric ?? false}
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
              onValueChange={(val) => {
                setData("values", val);
              }}
            />
          ) : (
            <>
              <FormInput
                required={true}
                label={t("inventory.attribute.columns.range.from")}
              >
                <Input
                  type="number"
                  value={data.from_range ?? 0}
                  onChange={(e) => setData("from_range", e.target.value)}
                />
              </FormInput>
              <FormInput
                required={true}
                label={t("inventory.attribute.columns.range.to")}
              >
                <Input
                  type="number"
                  value={data.to_range ?? 0}
                  onChange={(e) => setData("to_range", e.target.value)}
                />
              </FormInput>
              <FormInput
                required={true}
                label={t("inventory.attribute.columns.range.increment")}
              >
                <Input
                  type="number"
                  min="0"
                  value={data.increment ?? 0}
                  onChange={(e) => setData("increment", e.target.value)}
                />
              </FormInput>
            </>
          )}
        </div>
      </FormPageContent>
    </>
  );
}
