import { FormPage, FormPageContent } from "../Core/FormPage";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/Components/ui/select";

import { Button } from "@/Components/ui/button";
import { Checkbox } from "@/Components/ui/checkbox";
import Combobox from "@/Components/Combobox";
import { CommandItem } from "@/Components/ui/command";
import FormInput from "@/Components/FormInput";
import { Input } from "@/Components/ui/input";
import React from "react";
import { SaveIcon } from "lucide-react";
import { Textarea } from "@/Components/ui/textarea";
import { useDraftForm } from "@/Hooks/useDraftForm";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Company({ preferences, currencies, countries }) {
  const route = window.route;
  const { t } = useLaravelReactI18n();
  const { data, setData, post, processing, errors, isDirty } = useDraftForm(
    "company_details",
    preferences,
  );
  const onSubmit = (e) => {
    e.preventDefault();

    post(route("company.index"));
  };
  // useEffect(() => {
  //   axios.get(
  //     "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies.min.json",
  //   ).then('data');
  // })
  const onUpdatePerPageOptions = (list) => {
    setData(
      "per_page_options",
      [...new Set(list.filter((x) => x))].sort((a, b) => a - b),
    );
  };
  return (
    <FormPage
      errors={errors}
      disabled={processing}
      title={t("core.company.title")}
      onSubmit={onSubmit}
      badge={
        isDirty && (
          <span className="text-sm badge warning">
            {t("core.form.not_saved")}
          </span>
        )
      }
      controls={
        <Button
          type="submit"
          role="save"
          className="!p-2 size-fit h-8"
          disabled={processing}
        >
          <SaveIcon />
          {t("core.form.save")}
        </Button>
      }
      sidebarContent={false}
      bottombarContent={false}
    >
      <FormPageContent
        value="company_details"
        title={t("core.company.company_details.title")}
      >
        <div className="grid pt-2 gap-x-8 gap-y-4 md:grid-cols-3">
          <FormInput
            label={t("core.company.company_details.name")}
            required={true}
          >
            <Input
              value={data.company_name}
              onChange={(e) => setData("company_name", e.target.value)}
            />
          </FormInput>
          <FormInput
            label={t("core.company.company_details.email")}
            required={true}
          >
            <Input
              type="email"
              value={data.email}
              onChange={(e) => setData("email", e.target.value)}
            />
          </FormInput>
          <FormInput
            label={t("core.company.company_details.phone")}
            required={true}
          >
            <Input
              value={data.phone}
              onChange={(e) => setData("phone", e.target.value)}
            />
          </FormInput>
          <FormInput
            label={t("core.company.company_details.street")}
            required={true}
            className="col-span-full"
          >
            <Textarea
              value={data.street}
              onChange={(e) => setData("street", e.target.value)}
            />
          </FormInput>
          <FormInput
            label={t("core.company.company_details.city")}
            required={true}
          >
            <Input
              value={data.city}
              onChange={(e) => setData("city", e.target.value)}
            />
          </FormInput>
          <FormInput
            label={t("core.company.company_details.state")}
            required={true}
          >
            <Input
              value={data.state}
              onChange={(e) => setData("state", e.target.value)}
            />
          </FormInput>
          <FormInput
            label={t("core.company.company_details.zip_code")}
            required={true}
          >
            <Input
              value={data.zip_code}
              onChange={(e) => setData("zip_code", e.target.value)}
            />
          </FormInput>
          <FormInput
            label={t("core.company.company_details.country")}
            required={true}
          >
            <Combobox
              options={countries}
              value={data.country_id}
              placeholder={t(
                "core.company.company_details.country.placeholder",
              )}
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
                      setData("shipping_country_id", country.code);
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
      <FormPageContent
        value="email_setup"
        title={t("core.company.email_setup.title")}
      >
        <div className="grid pt-2 gap-x-8 gap-y-4 md:grid-cols-3">
          <FormInput
            label={t("core.company.email_setup.protocol")}
            required={true}
            className=""
          >
            <Select
              value={data.mail_protocol}
              onValueChange={(val) => setData("mail_protocol", val)}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t(
                    "core.company.email_setup.protocol.placeholder",
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="smtp">SMTP</SelectItem>
              </SelectContent>
            </Select>
          </FormInput>
          <FormInput
            label={t("core.company.email_setup.encryption")}
            required={true}
            className=""
          >
            <Input
              value={data.mail_encryption}
              onChange={(e) => setData("mail_encryption", e.target.value)}
            />
          </FormInput>
          <FormInput
            label={t("core.company.email_setup.host")}
            required={true}
            className=""
          >
            <Input
              value={data.mail_host}
              onChange={(e) => setData("mail_host", e.target.value)}
            />
          </FormInput>
          <FormInput
            label={t("core.company.email_setup.port")}
            required={true}
            className=""
          >
            <Input
              type="number"
              value={data.mail_port}
              onChange={(e) => setData("mail_port", e.target.value)}
            />
          </FormInput>
          <FormInput
            label={t("core.company.email_setup.username")}
            required={true}
            className=""
          >
            <Input
              value={data.mail_username}
              onChange={(e) => setData("mail_username", e.target.value)}
            />
          </FormInput>
          <FormInput
            label={t("core.company.email_setup.password")}
            required={true}
            className=""
          >
            <Input
              value={data.mail_password}
              onChange={(e) => setData("mail_password", e.target.value)}
            />
          </FormInput>
          <FormInput
            label={t("core.company.email_setup.from_address")}
            required={true}
            className=""
          >
            <Input
              value={data.mail_from_address}
              onChange={(e) => setData("mail_from_address", e.target.value)}
            />
          </FormInput>
          <FormInput
            label={t("core.company.email_setup.from_name")}
            required={true}
            className=""
          >
            <Input
              value={data.mail_from_name}
              onChange={(e) => setData("mail_from_name", e.target.value)}
            />
          </FormInput>
        </div>
      </FormPageContent>
      <FormPageContent
        value="preferences"
        title={t("core.company.preferences.title")}
      >
        <div className="flex flex-col w-full max-w-lg gap-y-4">
          <FormInput
            label={t("core.company.preferences.default_currency")}
            required={true}
            className=""
          >
            <Combobox
              options={currencies}
              value={data.default_currency_id}
              placeholder={t(
                "core.company.preferences.default_currency.placeholder",
              )}
              templateTrigger={(currency_code) => {
                const currency = currencies.find(
                  (c) => c.code === currency_code,
                );
                return (
                  <span>
                    {currency.name}{" "}
                    <span className="uppercase">({currency.code})</span>
                  </span>
                );
              }}
              templateItem={(currency) => {
                return (
                  <CommandItem
                    key={currency.code}
                    value={`${currency.name} ${currency.code}`}
                    keywords={[currency.code, currency.name]}
                    onSelect={() => {
                      setData("default_currency_id", currency.code);
                    }}
                    className="block px-4 "
                  >
                    {currency.name}{" "}
                    <span className="uppercase">({currency.code})</span>
                  </CommandItem>
                );
              }}
            />
          </FormInput>
          <div className="grid [&>div]:px-3 gap-x-1 grid-cols-[auto_1fr_auto] text-sm [&>div>*]:px-1h max-w-full w-full overflow-x-auto [&>div>*]:h-full [&>div>*]:items-center [&>div>*]:flex [&>div>*]:justify-center [&>div>*]:py-2 [&>div>*:not(:last-child)]:border-0">
            <div className="grid grid-cols-subgrid col-span-full items-center rounded-md bg-muted [&>div]:font-bold [&>div]:text-sm lg:[&>div]:text-base">
              <div className="!pr-2 !pl-2 !justify-start text-left">No.</div>
              <div className="!justify-start text-left">Rows per Page</div>
              <div className="text-center">Default</div>
            </div>
            {data?.per_page_options &&
              data?.per_page_options.map((item, index) => {
                return (
                  <div
                    key={item}
                    className="grid border-b col-span-full items-center grid-cols-subgrid border-muted-foreground/25 [&>div]:text-sm lg:[&>div]:text-base"
                  >
                    <div className="!pr-2 !pl-2 !justify-start text-left">
                      {index + 1}
                    </div>
                    <div className="!justify-start text-left">
                      <Input
                        type="number"
                        defaultValue={item}
                        onBlur={(e) => {
                          const index = data.per_page_options.findIndex(
                            (x) => x == item,
                          );
                          const options = data.per_page_options;
                          options[index] = e.target.value
                            ? Number(e.target.value)
                            : null;
                          onUpdatePerPageOptions(options);
                        }}
                      />
                    </div>
                    <div className="text-center">
                      <Checkbox
                        checked={item == data?.num_per_page}
                        onCheckedChange={() => {
                          setData("num_per_page", item);
                        }}
                      />
                    </div>
                  </div>
                );
              })}

            <div className="grid border-b col-span-full items-center grid-cols-subgrid border-muted-foreground/25 [&>div]:text-sm lg:[&>div]:text-base">
              <div className="!pr-2 !pl-2 !justify-start text-left">
                {data.per_page_options.length + 1}
              </div>
              <div className="!justify-start text-left">
                <Input
                  type="number"
                  onBlur={(e) => {
                    onUpdatePerPageOptions([
                      ...data.per_page_options,
                      Number(e.target.value),
                    ]);
                    e.target.value = null;
                  }}
                />
              </div>
              <div className="text-center">
                <Checkbox disabled />
              </div>
            </div>
          </div>
        </div>
      </FormPageContent>
    </FormPage>
  );
}
