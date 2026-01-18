import LinkModel from "@/Components/LinkModel";
import { forwardRef } from "react";

export default forwardRef(function SalesOrderLinkModel(
  { value, onValueChange, placeholder, ...props },
  ref,
) {
  return (
    <LinkModel
      placeholder={placeholder}
      value={value}
      onValueChange={onValueChange}
      model="App\Models\Sales\SalesOrder"
      disabledAddButton={true}
      {...props}
      ref={ref}
    />
  );
});
