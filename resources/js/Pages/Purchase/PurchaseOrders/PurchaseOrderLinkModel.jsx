import Form from "./Form";
import LinkModel from "@/Components/LinkModel";
import { forwardRef } from "react";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default forwardRef(function PurchaseOrderLinkModel(
  { value, onValueChange, placeholder, ...props },
  ref,
) {
  const { t } = useLaravelReactI18n();
  return (
    <LinkModel
      placeholder={placeholder}
      value={value}
      onValueChange={onValueChange}
      model="App\Models\Purchase\PurchaseOrder"
      titleDialog={t("purchase.purchaseOrder.new")}
      classNameDialog="max-w-4xl"
      form={<Form />}
      {...props}
      ref={ref}
    />
  );
});
