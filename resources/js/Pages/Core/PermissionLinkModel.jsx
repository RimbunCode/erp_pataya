import LinkModel from "@/Components/LinkModel";
import { forwardRef } from "react";

export default forwardRef(function PermissionLinkModel(
  { value, onValueChange, placeholder, fields, ...props },
  ref,
) {
  return (
    <LinkModel
      placeholder={placeholder}
      value={value}
      onValueChange={onValueChange}
      model="App\Models\User\Permission"
      disabledAddButton={true}
      disabledNavigation={true}
      fields={[
        "model",
        "permissions",
        "is_submitable",
        "allow_only_creator",
        ...(fields ?? []),
      ]}
      // cache
      // cacheStorage="sessionStorage"
      {...props}
      ref={ref}
    />
  );
});
