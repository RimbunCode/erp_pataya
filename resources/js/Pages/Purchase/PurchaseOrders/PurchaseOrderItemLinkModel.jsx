import LinkModel from "@/Components/LinkModel";
import { forwardRef } from "react";

export default forwardRef(function PurchaseOrderItemLinkModel(
  { value, onValueChange, placeholder, ...props },
  ref,
) {
  return (
    <LinkModel
      placeholder={placeholder}
      value={value}
      onValueChange={onValueChange}
      model="App\Models\Purchase\PurchaseOrderItem"
      disabledAddButton={true}
      {...props}
      ref={ref}
    />
  );
});
