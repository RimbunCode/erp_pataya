import LinkModel from "@/Components/LinkModel";
import { forwardRef } from "react";

export default forwardRef(function SalesOrderItemLinkModel(
  { value, onValueChange, placeholder, ...props },
  ref,
) {
  return (
    <LinkModel
      placeholder={placeholder}
      value={value}
      onValueChange={onValueChange}
      model="App\Models\Sales\SalesOrderItem"
      disabledAddButton={true}
      {...props}
      ref={ref}
    />
  );
});
