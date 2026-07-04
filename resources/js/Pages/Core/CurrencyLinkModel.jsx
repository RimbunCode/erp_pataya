import LinkModel from "@/Components/LinkModel";
import { forwardRef } from "react";

export default forwardRef(function CurrencyLinkModel(
  { value, onValueChange, placeholder, ...props },
  ref,
) {
  return (
    <LinkModel
      placeholder={placeholder}
      value={value}
      onValueChange={onValueChange}
      model="App\Models\Core\Currency"
      as="currency:code"
      disabledAddButton
      cache
      cacheStorage="sessionStorage"
      {...props}
      ref={ref}
    />
  );
});
