import Form from "./Form";
import LinkModel from "@/Components/LinkModel";
import { forwardRef } from "react";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default forwardRef(function AccountLinkModel(
  { value, onValueChange, placeholder, filters, ...props },
  ref,
) {
  const { t } = useLaravelReactI18n();
  return (
    <LinkModel
      placeholder={placeholder}
      value={value}
      onValueChange={onValueChange}
      model="App\Models\Finances\Account"
      form={<Form />}
      filters={{
        is_disabled: false,
        ...filters,
      }}
      titleDialog={t("finances.account.new")}
      classNameDialog="max-w-(--breakpoint-lg)!"
      {...props}
      ref={ref}
    />
  );
});
