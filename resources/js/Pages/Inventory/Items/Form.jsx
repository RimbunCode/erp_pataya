/* eslint-disable jsdoc/require-jsdoc */
import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/Components/ui/select";

import FormInput from "@/Components/FormInput";
import FormUnit from "@/Pages/Inventory/Units/Form";
import { Input } from "@/Components/ui/input";
import LinkModel from "@/Components/LinkModel";
import React from "react";
import { Textarea } from "@/Components/ui/textarea";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Form() {
  const { data, setData } = useFormPage();
  const { t } = useLaravelReactI18n();

  return (
    <>
      <FormPageContent title="Details" value="detail">
        <div className="space-y-4 gap-x-8 columns-xs [&>div]:break-inside-avoid">
          <FormInput
            required={true}
            label={t("inventory.item.columns.code")}
            className=""
          >
            <Input
              value={data.code}
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
              name="name"
              value={data.name}
              onChange={(e) => setData("name", e.target.value)}
            />
          </FormInput>
          <FormInput
            required={true}
            label={t("inventory.item.columns.category")}
          >
            <LinkModel
              placeholder={t("inventory.item.columns.category.placeholder")}
              model="App\Models\Inventory\Category"
              value={data.category}
              onValueChange={(val) => setData("category", val)}
            />
          </FormInput>

          <FormInput
            required={true}
            label={t("inventory.item.columns.default_unit")}
          >
            <LinkModel
              placeholder={t("inventory.item.columns.default_unit.placeholder")}
              model="App\Models\Inventory\Unit"
              value={data.default_unit}
              onValueChange={(val) => setData("default_unit", val)}
              titleDialog="Create a new Unit"
              form={<FormUnit />}
            />
          </FormInput>
          <FormInput
            required={true}
            label={t("inventory.item.columns.is_disabled")}
          >
            <Select>
              <SelectTrigger>
                <SelectValue
                  placeholder={t(
                    "inventory.item.columns.is_disabled.placeholder",
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="false">
                  {t("inventory.item.columns.is_disabled.parse.false")}
                </SelectItem>
                <SelectItem value="true">
                  {t("inventory.item.columns.is_disabled.parse.true")}
                </SelectItem>
              </SelectContent>
            </Select>
          </FormInput>
        </div>
        <FormInput
          label={t("inventory.item.columns.description")}
          className="mt-4"
        >
          <Textarea
            name="description"
            value={data.description}
            onChange={(e) => setData("description", e.target.value)}
          />
        </FormInput>
      </FormPageContent>
    </>
  );
}
