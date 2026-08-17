import LinkModel from "@/Components/LinkModel";
import { forwardRef } from "react";

export default forwardRef(function AssetServiceLinkModel(
  { value, onValueChange, placeholder, ...props },
  ref,
) {
  return (
    <LinkModel
      placeholder={placeholder}
      value={value}
      onValueChange={onValueChange}
      model="App\Models\Asset\AssetService"
      disabledAddButton={true}
      filters={{ status: { jsonContains: ["approved"] } }}
      {...props}
      ref={ref}
    />
  );
});
