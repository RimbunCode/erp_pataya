import LinkModel from "@/Components/LinkModel";
import { forwardRef } from "react";

export default forwardRef(function SalesInvoiceLinkModel(
  { value, onValueChange, placeholder, ...props },
  ref,
) {
  return (
    <LinkModel
      placeholder={placeholder}
      value={value}
      onValueChange={onValueChange}
      model="App\Models\Finances\SalesInvoice"
      disabledAddButton={true}
      {...props}
      ref={ref}
    />
  );
});
