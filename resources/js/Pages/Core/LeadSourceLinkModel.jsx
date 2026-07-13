import LinkModel from "@/Components/LinkModel";
import { forwardRef } from "react";

export default forwardRef(function LeadSourceLinkModel(
  { value, onValueChange, placeholder, ...props },
  ref,
) {
  return (
    <LinkModel
      placeholder={placeholder}
      value={value}
      onValueChange={onValueChange}
      model="App\Models\CRM\LeadSource"
      disabledNavigation
      disabledAddButton
      cache
      cacheStorage="sessionStorage"
      {...props}
      ref={ref}
    />
  );
});
