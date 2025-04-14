import LinkModel from "@/Components/LinkModel";
import { forwardRef } from "react";

export default forwardRef(function CountryLinkModel(
  { value, onValueChange, placeholder, ...props },
  ref,
) {
  return (
    <LinkModel
      placeholder={placeholder}
      value={value}
      onValueChange={onValueChange}
      model="App\Models\Core\Country"
      disabledNavigation
      disabledAddButton
      {...props}
      ref={ref}
    />
  );
});
