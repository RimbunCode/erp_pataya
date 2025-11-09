import LinkModel from "@/Components/LinkModel";
import { forwardRef } from "react";

export default forwardRef(function AccountLinkModel(
  { value, onValueChange, placeholder, ...props },
  ref,
) {
  return (
    <LinkModel
      placeholder={placeholder}
      value={value}
      onValueChange={onValueChange}
      model="App\Models\Finances\Account"
      disabledAddButton={true}
      {...props}
      ref={ref}
    />
  );
});
