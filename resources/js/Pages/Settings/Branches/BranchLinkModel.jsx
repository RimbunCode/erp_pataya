import Form from "./Form";
import LinkModel from "@/Components/LinkModel";
import { forwardRef } from "react";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default forwardRef(function BranchLinkModel(
  { value, onValueChange, placeholder, ...props },
  ref,
) {
  const { t } = useLaravelReactI18n();
  return (
    <LinkModel
      placeholder={placeholder}
      value={value}
      onValueChange={onValueChange}
      model="App\Models\Core\Branch"
      titleDialog={t("core.branch.new")}
      classNameDialog="max-w-screen-md"
      form={<Form />}
      {...props}
      ref={ref}
    />
  );
});
