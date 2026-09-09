import LinkModel from "@/Components/LinkModel";
import { forwardRef } from "react";

export default forwardRef(function PurchaseInvoiceItemLinkModel(
  { value, onValueChange, placeholder, ...props },
  ref,
) {
  return (
    <LinkModel
      placeholder={placeholder}
      value={value}
      onValueChange={onValueChange}
      model="App\Models\Finances\PurchaseInvoiceItem"
      {...props}
      ref={ref}
    />
  );
});
