/* eslint-disable jsdoc/require-jsdoc */
import FormInput from "@/Components/FormInput";
import { Button } from "@/Components/ui/button";
import { Checkbox } from "@/Components/ui/checkbox";
import { Input } from "@/Components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/Components/ui/select";
import { Textarea } from "@/Components/ui/textarea";
import { useDraftForm } from "@/Hooks/useDraftForm";
import {
  FormPage,
  FormPageContent,
  FormPageContentTitle,
} from "@/Pages/Core/FormPage";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { SaveIcon } from "lucide-react";
import { useEffect } from "react";

export default function Show({ branch, countries }) {
  const route = window.route;
  const { t } = useLaravelReactI18n();
  const { data, setData, put, processing, errors, isDirty } = useDraftForm(
    "branch",
    branch,
  );
  const onSubmit = (e) => {
    e.preventDefault();

    put(route("branches.update", branch.id));
  };
  return (
    <FormPage
      errors={errors}
      title={branch.name}
      disabled={processing || branch.is_main_branch}
      onSubmit={(e) => {
        e.preventDefault();
        if (branch.is_main_branch) return;
        onSubmit(e);
      }}
      badge={
        <>
          {branch.is_main_branch && (
            <span className="text-sm badge primary">
              {t("core.branch.columns.is_main_branch")}
            </span>
          )}
          {isDirty && <span className="text-sm badge warning">Not Saved</span>}
        </>
      }
      controls={
        !branch.is_main_branch && (
          <Button
            type="submit"
            className="!p-2 size-fit h-8"
            disabled={processing}
          >
            <SaveIcon />
            Save
          </Button>
        )
      }
    >
      <FormPageContent
        title={t("core.branch.branch_detail")}
        value="branch_detail"
      >
        <div className="grid pt-2 gap-x-8 gap-y-4 md:grid-cols-3">
          <FormInput
            label={t("core.branch.columns.name")}
            required={true}
            name="name"
          >
            <Input
              value={data.name}
              onChange={(e) => setData("name", e.target.value)}
            />
          </FormInput>
          <FormInput label={t("core.branch.columns.email")} required={true}>
            <Input
              type="email"
              value={data.email}
              onChange={(e) => setData("email", e.target.value)}
            />
          </FormInput>
          <FormInput label={t("core.branch.columns.phone")} required={true}>
            <Input
              value={data.phone}
              onChange={(e) => setData("phone", e.target.value)}
            />
          </FormInput>
          <FormInput
            label={t("core.branch.columns.is_disabled")}
            required={true}
          >
            <Select
              value={data.is_disabled ? "0" : "1"}
              onValueChange={(v) => setData("is_disabled", v === "0")}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t("core.branch.columns.is_disabled.placeholder")}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">
                  {t("core.branch.columns.is_disabled.options.active")}
                </SelectItem>
                <SelectItem value="0">
                  {t("core.branch.columns.is_disabled.options.disabled")}
                </SelectItem>
              </SelectContent>
            </Select>
          </FormInput>
        </div>
      </FormPageContent>
      <FormPageContent
        title={t(
          branch.branchable_type
            ? "core.branch.columns.shipping_address"
            : "core.branch.columns.address",
        )}
        value="branch_detail"
      >
        <div className="grid pt-2 gap-x-8 gap-y-4 md:grid-cols-3">
          <FormInput
            label={t("core.branch.columns.street")}
            required={true}
            className="col-span-full"
          >
            <Textarea
              value={data.shipping_street}
              onChange={(e) => setData("shipping_street", e.target.value)}
            />
          </FormInput>
          <FormInput label={t("core.branch.columns.city")} required={true}>
            <Input
              value={data.shipping_city}
              onChange={(e) => setData("shipping_city", e.target.value)}
            />
          </FormInput>
          <FormInput label={t("core.branch.columns.state")} required={true}>
            <Input
              value={data.shipping_state}
              onChange={(e) => setData("shipping_state", e.target.value)}
            />
          </FormInput>
          <FormInput label={t("core.branch.columns.zip_code")} required={true}>
            <Input
              value={data.shipping_zip_code}
              onChange={(e) => setData("shipping_zip_code", e.target.value)}
            />
          </FormInput>
          <FormInput label={t("core.branch.columns.country")} required={true}>
            <Select
              value={data.shipping_country_id}
              onValueChange={(v) => setData("shipping_country_id", v)}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t("core.branch.columns.country.placeholder")}
                />
              </SelectTrigger>
              <SelectContent>
                {countries &&
                  countries?.map((country) => (
                    <SelectItem key={country.code} value={country.code}>
                      {country.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </FormInput>
        </div>
      </FormPageContent>
      {branch.branchable_type && (
        <FormPageContent
          title={t("core.branch.columns.billing_address")}
          value="branch_detail"
        >
          <FormPageContentTitle className="flex items-center justify-between">
            <h1 className="flex-1">
              {t("core.branch.columns.billing_address")}
            </h1>
            <Select
              value={data.billing_address}
              onValueChange={(val) => setData("billing_address", val)}
            >
              <SelectTrigger className="!w-fit">
                <SelectValue
                  placeholder={t(
                    "core.branch.columns.billing_address.placeholder",
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="same_main">
                  {t("core.branch.columns.billing_address.options.same_main")}
                </SelectItem>
                <SelectItem value="same_shipping">
                  {t(
                    "core.branch.columns.billing_address.options.same_shipping",
                  )}
                </SelectItem>
                <SelectItem value="separate">
                  {t("core.branch.columns.billing_address.options.separate")}
                </SelectItem>
              </SelectContent>
            </Select>
          </FormPageContentTitle>
          <div className="grid pt-2 gap-x-8 gap-y-4 md:grid-cols-3">
            <FormInput
              label={t("core.branch.columns.street")}
              required={true}
              className="col-span-full"
            >
              <Textarea
                value={data.billing_street}
                onChange={(e) => setData("billing_street", e.target.value)}
              />
            </FormInput>
            <FormInput label={t("core.branch.columns.city")} required={true}>
              <Input
                value={data.billing_city}
                onChange={(e) => setData("billing_city", e.target.value)}
              />
            </FormInput>
            <FormInput label={t("core.branch.columns.state")} required={true}>
              <Input
                value={data.billing_state}
                onChange={(e) => setData("billing_state", e.target.value)}
              />
            </FormInput>
            <FormInput
              label={t("core.branch.columns.zip_code")}
              required={true}
            >
              <Input
                value={data.billing_zip_code}
                onChange={(e) => setData("billing_zip_code", e.target.value)}
              />
            </FormInput>
            <FormInput label={t("core.branch.columns.country")} required={true}>
              <Select
                value={data.billing_country_id}
                onValueChange={(v) => setData("billing_country_id", v)}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={t("core.branch.columns.country.placeholder")}
                  />
                </SelectTrigger>
                <SelectContent>
                  {countries &&
                    countries?.map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        {country.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </FormInput>
          </div>
        </FormPageContent>
      )}
    </FormPage>
  );
}
