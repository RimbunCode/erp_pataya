import Form from "./Form";
import LinkModel from "@/Components/LinkModel";
import { forwardRef } from "react";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default forwardRef(function ItemVariantLinkModel(
  { value, onValueChange, placeholder, ...props },
  ref,
) {
  const { t } = useLaravelReactI18n();
  return (
    <LinkModel
      placeholder={placeholder}
      value={value}
      onValueChange={onValueChange}
      model="App\Models\Inventory\ItemVariant"
      titleDialog={t("inventory.item.new")}
      classNameDialog="max-w-6xl"
      form={<Form />}
      as="item:item_id"
      {...props}
      ref={ref}
    />
  );
});
