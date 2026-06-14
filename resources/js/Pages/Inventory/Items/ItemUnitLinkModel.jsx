import LinkModel from "@/Components/LinkModel";
import { forwardRef } from "react";

export default forwardRef(function ItemUnitLinkModel(
  { value, onValueChange, placeholder, ...props },
  ref,
) {
  return (
    <LinkModel
      placeholder={placeholder}
      value={value}
      onValueChange={onValueChange}
      model="App\Models\Inventory\ItemUnit"
      with={["unit"]}
      // titleDialog={t("inventory.unit.new")}
      // form={<Form />}
      // keywords={["group", "name", "code"]}
      {...props}
      ref={ref}
    />
  );
});
