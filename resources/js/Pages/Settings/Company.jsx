import { Avatar, AvatarFallback } from "@/Components/ui/avatar";
import { Dialog, DialogTrigger } from "@/Components/ui/dialog";
import { FormPage, FormPageContent, useFormPage } from "../Core/FormPage";
import React, { useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/Components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/Components/ui/tooltip";
import { Trash2Icon, UploadIcon } from "lucide-react";

import { AvatarImage } from "@/Components/ui/avatar";
import { Button } from "@/Components/ui/button";
import { Checkbox } from "@/Components/ui/checkbox";
import CountryLinkModel from "@/Pages/Core/CountryLinkModel";
import CurrencyLinkModel from "@/Pages/Core/CurrencyLinkModel";
import FormInput from "@/Components/FormInput";
import { Input } from "@/Components/ui/input";
import NumberInput from "@/Components/NumberInput";
import SelectComponent from "@/Components/Select";
import { Textarea } from "@/Components/ui/textarea";
import UploadDialog from "../Core/Components/UploadDialog";
import { resolveImageSrc } from "@/lib/utils";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { router, usePage } from "@inertiajs/react";

function Form() {
  const { t } = useLaravelReactI18n();
  const { timezones } = usePage().props;
  const { data, setData } = useFormPage();
  const [newPerPage, setNewPerPage] = useState(null);
  const onUpdatePerPageOptions = (list) => {
    setData(
      "per_page_options",
      [...new Set(list.filter((x) => x))].sort((a, b) => a - b),
    );
  };
  return (
    <>
      <FormPageContent
        value="company_details"
        title={t("core.company.company_details.title")}
      >
        <div className="grid pt-2 gap-x-4 gap-y-4 md:grid-cols-2">
          <FormInput
            name="company_name"
            label={t("core.company.company_details.name")}
            required={true}
          >
            <Input
              value={data.company_name}
              onChange={(e) => setData("company_name", e.target.value)}
            />
          </FormInput>
          <FormInput
            name="short_name"
            label={t("core.company.company_details.short_name")}
            required={true}
          >
            <Input
              value={data.short_name}
              onChange={(e) => setData("short_name", e.target.value)}
            />
          </FormInput>
          <FormInput
            name="email"
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
            name="phone"
            label={t("core.company.company_details.phone")}
            required={true}
          >
            <Input
              value={data.phone}
              onChange={(e) => setData("phone", e.target.value)}
            />
          </FormInput>
          <FormInput
            name="street"
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
            name="city"
            label={t("core.company.company_details.city")}
            required={true}
          >
            <Input
              value={data.city}
              onChange={(e) => setData("city", e.target.value)}
            />
          </FormInput>
          <FormInput
            name="state"
            label={t("core.company.company_details.state")}
            required={true}
          >
            <Input
              value={data.state}
              onChange={(e) => setData("state", e.target.value)}
            />
          </FormInput>
          <FormInput
            name="zip_code"
            label={t("core.company.company_details.zip_code")}
            required={true}
          >
            <Input
              value={data.zip_code}
              onChange={(e) => setData("zip_code", e.target.value)}
            />
          </FormInput>
          <FormInput
            name="country_id"
            label={t("core.company.company_details.country")}
            required={true}
          >
            <CountryLinkModel
              value={data.country_id}
              placeholder={t(
                "core.company.company_details.country.placeholder",
              )}
              onValueChange={(val) => setData("country_id", val)}
            />
          </FormInput>
        </div>
      </FormPageContent>
      <FormPageContent
        value="email_setup"
        title={t("core.company.email_setup.title")}
      >
        <div className="grid pt-2 gap-x-4 gap-y-4 md:grid-cols-3">
          <FormInput
            name="mail_protocol"
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
            name="mail_encryption"
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
            name="mail_host"
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
            name="mail_port"
            label={t("core.company.email_setup.port")}
            required={true}
            className=""
          >
            <NumberInput
              className="text-left"
              allowDecimals={false}
              decimalScale={0}
              value={data.mail_port}
              onValueChange={(val) => setData("mail_port", val)}
            />
          </FormInput>
          <FormInput
            name="mail_username"
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
            name="mail_password"
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
            name="mail_from_address"
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
            name="mail_from_name"
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
            name="default_currency_id"
            label={t("core.company.preferences.default_currency")}
            required={true}
            className=""
          >
            <CurrencyLinkModel
              value={data.default_currency_id}
              placeholder={t(
                "core.company.preferences.default_currency.placeholder",
              )}
              onValueChange={(val) => {
                setData("default_currency_id", val);
              }}
            />
          </FormInput>
          <FormInput
            name="timezone"
            label={t("core.company.preferences.timezone")}
            required={true}
            className=""
          >
            <SelectComponent
              options={timezones}
              value={data.timezone}
              placeholder={t("core.company.preferences.timezone.placeholder")}
              onValueChange={(val) => setData("timezone", val)}
            />
          </FormInput>
          <div className="grid [&>div]:px-3 gap-x-1 grid-cols-[auto_1fr_auto] text-sm [&>div>*]:px-1h max-w-full w-full overflow-x-auto [&>div>*]:h-full [&>div>*]:items-center [&>div>*]:flex [&>div>*]:justify-center [&>div>*]:py-2 [&>div>*:not(:last-child)]:border-0">
            <div className="grid grid-cols-subgrid col-span-full items-center rounded-md bg-muted [&>div]:font-bold [&>div]:text-sm lg:[&>div]:text-base">
              <div className="pr-2! pl-2! justify-start! text-left">No.</div>
              <div className="justify-start! text-left">Rows per Page</div>
              <div className="text-center">Default</div>
            </div>
            {data?.per_page_options &&
              data?.per_page_options.map((item, index) => {
                return (
                  <div
                    key={item}
                    className="grid border-b col-span-full items-center grid-cols-subgrid border-muted-foreground/25 [&>div]:text-sm lg:[&>div]:text-base"
                  >
                    <div className="pr-2! pl-2! justify-start! text-left">
                      {index + 1}
                    </div>
                    <div className="justify-start! text-left">
                      <NumberInput
                        className="text-left"
                        allowDecimals={false}
                        decimalScale={0}
                        value={item}
                        onValueChange={(val) => {
                          const idx = data.per_page_options.findIndex(
                            (x) => x == item,
                          );
                          const options = data.per_page_options;
                          options[idx] = val ?? null;
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
              <div className="pr-2! pl-2! justify-start! text-left">
                {data.per_page_options.length + 1}
              </div>
              <div className="justify-start! text-left">
                <NumberInput
                  className="text-left"
                  allowDecimals={false}
                  decimalScale={0}
                  value={newPerPage}
                  onValueChange={(val) => setNewPerPage(val)}
                  onBlur={() => {
                    if (newPerPage) {
                      onUpdatePerPageOptions([
                        ...data.per_page_options,
                        newPerPage,
                      ]);
                    }
                    setNewPerPage(null);
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
    </>
  );
}
export default function Company({ company }) {
  const { t } = useLaravelReactI18n();
  const [openAttachment, setOpenAttachment] = useState(false);
  const currentPath = window.location.pathname.replace(/\/$/, "");
  const currentQueryString = window.location.search;
  const basePath = `${currentPath}/image`;
  const alias = company.company_name
    .split(" ")
    .slice(0, 2)
    .map((n) => n.charAt(0))
    .join("");
  // useEffect(() => {
  //   axios.get(
  //     "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies.min.json",
  //   ).then('data');
  // })
  const avatar = useMemo(() => {
    if (!company.company_image) return null;
    return (
      <AvatarImage
        src={resolveImageSrc(company.company_image)}
        alt={company.name}
        className=" transition-[filter] duration-300 group-hover:blur-sm object-contain"
      />
    );
  }, [company.company_image]);
  return (
    <FormPage
      name="company"
      title={t("core.company.title")}
      sidebarContent={() => {
        return (
          <Dialog open={openAttachment} onOpenChange={setOpenAttachment}>
            <Avatar className="relative  h-auto border rounded-xl aspect-square w-64 group">
              {avatar}
              <AvatarFallback className="rounded-lg ">
                <p className="w-full font-semibold text-center text-muted-foreground text-9xl  transition-[filter]">
                  {alias}
                </p>
              </AvatarFallback>
              <div className="absolute flex items-center justify-center w-full h-full transition-opacity border opacity-0 cursor-pointer group-hover:opacity-100 bg-background/25 rounded-xl gap-x-4">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DialogTrigger asChild>
                      <Button variant="default" size="icon" type="button">
                        <UploadIcon className="size-5!" />
                      </Button>
                    </DialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent align="center">Upload</TooltipContent>
                </Tooltip>
                {company.company_image && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="destructive"
                        size="icon"
                        type="button"
                        onClick={() => {
                          router.delete(`${basePath}${currentQueryString}`, {
                            reset: ["company", "auth"],
                            preserveScroll: true,
                            preserveState: true,
                          });
                        }}
                      >
                        <Trash2Icon className="size-5!" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent align="center">Remove</TooltipContent>
                  </Tooltip>
                )}
              </div>
            </Avatar>
            <UploadDialog
              open={openAttachment}
              single
              imageOnly
              options={{
                route: `${basePath}${currentQueryString}`,
                reset: ["company", "auth"],
              }}
              onClose={() => {
                setOpenAttachment(false);
              }}
            />
          </Dialog>
        );
      }}
      bottombarContent={false}
    >
      <Form />
    </FormPage>
  );
}
