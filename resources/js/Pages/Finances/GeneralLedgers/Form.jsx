import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";

import AccountLinkModel from "../Accounts/AccountLinkModel";

import DatetimePicker from "@/Components/DatetimePicker";
import FormInput from "@/Components/FormInput";

import NumberInput from "@/Components/NumberInput";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Form() {
  const { t } = useLaravelReactI18n();
  const { data } = useFormPage();

  return (
    <FormPageContent value="detail" title={t("finances.generalLedger.detail")}>
      <div className="grid gap-x-4 gap-y-4 md:grid-cols-2">
        <FormInput
          name="account"
          label={t("finances.generalLedger.columns.account")}
        >
          <AccountLinkModel value={data?.account} readOnly disabledAddButton />
        </FormInput>
        <FormInput
          name="against_account"
          label={t("finances.generalLedger.columns.against_account")}
        >
          <AccountLinkModel
            value={data?.against_account}
            readOnly
            disabledAddButton
          />
        </FormInput>
        {/* <FormInput
          name="branch"
          label={t("finances.generalLedger.columns.branch")}
        >
          <BranchLinkModel value={data?.branch} readOnly disabledAddButton />
        </FormInput> */}
        <FormInput
          name="debit"
          label={t("finances.generalLedger.columns.debit")}
        >
          <NumberInput value={data?.debit} readOnly decimalScale={2} />
        </FormInput>
        <FormInput
          name="credit"
          label={t("finances.generalLedger.columns.credit")}
        >
          <NumberInput value={data?.credit} readOnly decimalScale={2} />
        </FormInput>
        <FormInput
          name="created_at"
          label={t("finances.generalLedger.columns.created_at")}
        >
          <DatetimePicker type="datetime" value={data?.created_at} readOnly />
        </FormInput>
      </div>
    </FormPageContent>
  );
}
