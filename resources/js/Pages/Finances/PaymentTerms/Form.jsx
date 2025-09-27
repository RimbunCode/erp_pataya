import {
  FormPageContent,
  FormPageContentTitle,
  useFormPage,
} from "@/Pages/Core/FormPage";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import FormInput from "@/Components/FormInput";
import { Input } from "@/Components/ui/input";
import React from "react";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { Textarea } from "@/Components/ui/textarea";
import PaymentMethodLinkModel from "../PaymentMethods/PaymentMethodLinkModel";
import CurrencyInput from "@/Components/CurrencyInput";

export default function Form() {
  const { data, setData } = useFormPage();
  const { t } = useLaravelReactI18n();

  return (
    <>
      <FormPageContent title={null} value="detail">
        <FormPageContentTitle></FormPageContentTitle>
        <div className="grid md:grid-cols-2  gap-x-3 gap-y-4">
          <FormInput
            required={true}
            label={t("finances.paymentTerm.columns.name")}
          >
            <Input
              value={data?.name ?? ""}
              onChange={(e) => setData("name", e.target.value)}
            />
          </FormInput>
          <FormInput
            required={true}
            label={t("finances.paymentTerm.columns.invoice_portion")}
          >
            <CurrencyInput
              className="text-left"
              value={data?.invoice_portion ?? ""}
              onValueChange={(value) => setData("invoice_portion", value)}
              decimalsLimit={2}
              suffix="%"
              min={0}
              max={100}
            />
          </FormInput>
          <FormInput
            required={true}
            label={t("finances.paymentTerm.columns.due_date_based_on")}
          >
            <Select
              value={data.due_date_based_on}
              onValueChange={(val) => setData("due_date_based_on", val)}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t(
                    "finances.paymentTerm.columns.due_date_based_on.placeholder",
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="days_after_invoice_date">
                  {t(
                    "finances.paymentTerm.columns.due_date_based_on.options.days_after_invoice_date",
                  )}
                </SelectItem>
                <SelectItem value="weeks_after_invoice_week">
                  {t(
                    "finances.paymentTerm.columns.due_date_based_on.options.weeks_after_invoice_week",
                  )}
                </SelectItem>
                <SelectItem value="months_after_invoice_month">
                  {t(
                    "finances.paymentTerm.columns.due_date_based_on.options.months_after_invoice_month",
                  )}
                </SelectItem>
              </SelectContent>
            </Select>
          </FormInput>
          <FormInput
            required={true}
            disabled={!data.due_date_based_on}
            label={t(
              "finances.paymentTerm.columns.credit" +
                (data.due_date_based_on == "days_after_invoice_date"
                  ? "_days"
                  : data.due_date_based_on == "weeks_after_invoice_week"
                    ? "_weeks"
                    : "_months"),
            )}
          >
            <CurrencyInput
              className="text-left"
              decimalsLimit={0}
              placeholder="0"
              value={data?.credit_period ?? ""}
              onValueChange={(value) => {
                setData("credit_period", value);
              }}
            />
          </FormInput>{" "}
          <FormInput
            required={false}
            label={t("finances.paymentTerm.columns.payment_method")}
          >
            <PaymentMethodLinkModel
              value={data.payment_method}
              onValueChange={(val) => setData("payment_method", val)}
              placeholder={t(
                "finances.paymentTerm.columns.payment_method.placeholder",
              )}
            />
          </FormInput>
        </div>
      </FormPageContent>
      <FormPageContent
        title={t("finances.paymentTerm.discount_settings")}
        value="detail"
      >
        <div className="grid md:grid-cols-2  gap-x-3 gap-y-4">
          <FormInput label={t("finances.paymentTerm.columns.discount_type")}>
            <Select
              value={data.discount_type}
              onValueChange={(val) => setData("discount_type", val)}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t(
                    "finances.paymentTerm.columns.discount_type.placeholder",
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">
                  {t(
                    "finances.paymentTerm.columns.discount_type.options.percentage",
                  )}
                </SelectItem>
                <SelectItem value="amount">
                  {t(
                    "finances.paymentTerm.columns.discount_type.options.amount",
                  )}
                </SelectItem>
              </SelectContent>
            </Select>
          </FormInput>
          {data.discount_type && (
            <FormInput
              label={t("finances.paymentTerm.columns.discount")}
              required={true}
            >
              <CurrencyInput
                className="text-left"
                value={data.discount}
                onValueChange={(value) => setData("discount", value)}
                decimalsLimit={2}
                suffix={data.discount_type == "percentage" ? "%" : ""}
                min={0}
                max={100}
              />
            </FormInput>
          )}
        </div>
      </FormPageContent>
      <FormPageContent
        title={t("finances.paymentTerm.columns.description")}
        value="detail"
      >
        <Textarea
          value={data?.description ?? ""}
          onChange={(e) => setData("description", e.target.value)}
        />
      </FormPageContent>
    </>
  );
}
