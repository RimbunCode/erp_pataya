import Form from "@/Pages/Settings/NumberCard/Form";
import LinkModel from "@/Components/LinkModel";
import { forwardRef } from "react";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default forwardRef(function NumberCardLinkModel(
  { value, onValueChange, placeholder, ...props },
  ref,
) {
  const { t } = useLaravelReactI18n();
  return (
    <LinkModel
      placeholder={placeholder}
      value={value}
      onValueChange={onValueChange}
      model="App\Models\Core\NumberCard"
      titleDialog={t("settings.number_card.new")}
      classNameDialog="max-w-(--breakpoint-md)"
      form={<Form />}
      {...props}
      ref={ref}
    />
  );
});
