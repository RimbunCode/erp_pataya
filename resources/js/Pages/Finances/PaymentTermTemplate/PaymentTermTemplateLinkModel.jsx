import Form from "./Form";
import LinkModel from "@/Components/LinkModel";
import { forwardRef } from "react";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default forwardRef(function PaymentTermTemplateLinkModel(
  { value, onValueChange, with: _with = [], placeholder, ...props },
  ref,
) {
  const { t } = useLaravelReactI18n();
  return (
    <LinkModel
      with={["items", "items.paymentMethod", ..._with]}
      placeholder={placeholder}
      value={value}
      onValueChange={onValueChange}
      model="App\Models\Finances\PaymentTermTemplate"
      titleDialog={t("finances.paymentTermTemplate.new")}
      classNameDialog="max-w-(--breakpoint-lg)!"
      form={<Form />}
      {...props}
      ref={ref}
    />
  );
});
