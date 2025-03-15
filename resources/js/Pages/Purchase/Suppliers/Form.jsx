/* eslint-disable jsdoc/require-jsdoc */
import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/Components/ui/select";

import Combobox from "@/Components/Combobox";
import { CommandItem } from "@/Components/ui/command";
import FormInput from "@/Components/FormInput";
import { Input } from "@/Components/ui/input";
import React from "react";
import { Textarea } from "@/Components/ui/textarea";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";

export default function Form() {
  const { data, setData } = useFormPage();
  const { countries } = usePage().props;
  const { t } = useLaravelReactI18n();
  return (
    <>
      <FormPageContent
        title={t("purchase.supplier.supplier_detail")}
        value="supplier_detail"
      >
        <FormInput
          label={t("purchase.supplier.columns.name")}
          required={true}
          name="name"
          placeholder="PT Pataya Sarana Niaga"
        >
          <Input
            value={data?.name ?? ""}
            onChange={(e) => setData("name", e.target.value)}
          />
        </FormInput>
        <div className="grid pt-2 gap-x-8 gap-y-4 md:grid-cols-3">
          <FormInput
            label={t("purchase.supplier.columns.email")}
            required={true}
          >
            <Input
              type="email"
              value={data?.email ?? ""}
              onChange={(e) => setData("email", e.target.value)}
            />
          </FormInput>
          <FormInput
            label={t("purchase.supplier.columns.phone")}
            required={true}
          >
            <Input
              value={data?.phone ?? ""}
              onChange={(e) => setData("phone", e.target.value)}
            />
          </FormInput>
          <FormInput
            label={t("purchase.supplier.columns.is_disabled")}
            required={true}
          >
            <Select
              value={data?.is_disabled ? "0" : "1"}
              onValueChange={(v) => setData("is_disabled", v === "0")}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t(
                    "purchase.supplier.columns.is_disabled.placeholder",
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">
                  {t("purchase.supplier.columns.is_disabled.options.active")}
                </SelectItem>
                <SelectItem value="0">
                  {t("purchase.supplier.columns.is_disabled.options.disabled")}
                </SelectItem>
              </SelectContent>
            </Select>
          </FormInput>
        </div>
        <FormInput label={t("purchase.supplier.columns.banks")} required={true}>
          <Input
            value={data?.banks ?? ""}
            onChange={(e) => setData("banks", e.target.value)}
          />
        </FormInput>
      </FormPageContent>
      <FormPageContent
        title={t("purchase.supplier.address")}
        value="supplier_detail"
      >
        <FormInput
          label={t("purchase.supplier.columns.street")}
          required={true}
          className="col-span-full"
        >
          <Textarea
            value={data?.street ?? ""}
            onChange={(e) => setData("street", e.target.value)}
          />
        </FormInput>

        <div className="grid pt-2 gap-x-8 gap-y-4 md:grid-cols-3">
          <FormInput
            label={t("purchase.supplier.columns.city")}
            required={true}
          >
            <Input
              value={data?.city ?? ""}
              onChange={(e) => setData("city", e.target.value)}
            />
          </FormInput>
          <FormInput
            label={t("purchase.supplier.columns.province")}
            required={true}
          >
            <Input
              value={data?.province ?? ""}
              onChange={(e) => setData("province", e.target.value)}
            />
          </FormInput>
          <FormInput
            label={t("purchase.supplier.columns.zip_code")}
            required={true}
          >
            <Input
              value={data?.zip_code ?? ""}
              onChange={(e) => setData("zip_code", e.target.value)}
            />
          </FormInput>

          <FormInput
            label={t("purchase.supplier.columns.country")}
            required={true}
          >
            <Combobox
              options={countries}
              value={data?.country_id}
              placeholder={t("purchase.supplier.columns.country.placeholder")}
              templateTrigger={(country_code) => {
                const country = countries?.find((c) => c.code === country_code);
                return <span>{country?.name}</span>;
              }}
              templateItem={(country) => {
                return (
                  <CommandItem
                    key={country.code}
                    value={`${country.name} ${country.code}`}
                    keywords={[country.code, country.name]}
                    onSelect={() => {
                      setData("billing_country_id", country.code);
                    }}
                    className="block px-4 "
                  >
                    {country.name}
                  </CommandItem>
                );
              }}
            />
          </FormInput>
        </div>
      </FormPageContent>
    </>
  );
}
