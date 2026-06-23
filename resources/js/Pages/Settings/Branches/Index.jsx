import DataTable2 from "@/Pages/Core/DataTable2";
import Form from "./Form";
import Link from "@/Components/Link";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Index() {
  const route = window.route;
  const { t } = useLaravelReactI18n();
  return (
    <DataTable2
      templateItem={({ dataRow }) => (
        <Link
          as="button"
          href={route("branches.show", dataRow.id)}
          className="items-center block p-4 border-b border-muted-foreground/25"
        >
          <p className="flex items-center font-semibold text-left">
            {dataRow.name}
            {dataRow.is_main_branch && (
              <span className="py-1 ml-4 text-xs badge primary">
                {t("core.branch.columns.is_main_branch")}
              </span>
            )}
          </p>
          <p className="text-sm text-left text-muted-foreground">
            {dataRow.shipping_street}, {dataRow.shipping_city},{" "}
            {dataRow.shipping_state}, {dataRow.shipping_zip_code},{" "}
            {dataRow.shipping_country?.name}
          </p>
        </Link>
      )}
      classNameDialog="max-w-4xl!"
      form={<Form />}
    />
  );
}
