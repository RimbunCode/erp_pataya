import LinkModel from "@/Components/LinkModel";
import { forwardRef } from "react";

export default forwardRef(function AssetLinkModel(
  { value, onValueChange, placeholder, ...props },
  ref,
) {
  return (
    <LinkModel
      placeholder={placeholder}
      value={value}
      onValueChange={onValueChange}
      model="App\Models\Asset\Asset"
      {...props}
      ref={ref}
    />
  );
});
