import Form from "@/Pages/Settings/Chart/Form";
import LinkModel from "@/Components/LinkModel";
import { forwardRef } from "react";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default forwardRef(function ChartLinkModel(
  { value, onValueChange, placeholder, ...props },
  ref,
) {
  const { t } = useLaravelReactI18n();
  return (
    <LinkModel
      placeholder={placeholder}
      value={value}
      onValueChange={onValueChange}
      model="App\Models\Core\Chart"
      titleDialog={t("settings.chart.new")}
      classNameDialog="max-w-(--breakpoint-md)"
      form={<Form />}
      // Feedback user: ChartBlock/ChartDisplay render icon + deskripsi +
      // filter tersimpan — kolom ini di luar templateLink (":chart_name"),
      // harus diminta eksplisit (lihat Chart::$configColumns).
      fields={["icon", "description", "filters"]}
      {...props}
      ref={ref}
    />
  );
});
