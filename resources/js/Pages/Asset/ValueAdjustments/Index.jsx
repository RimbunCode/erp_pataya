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
        <div className="flex items-center justify-between p-4 border-b gap-x-4 border-muted-foreground/25">
          <Link
            as="button"
            href={route("assetValueAdjustments.show", dataRow.id)}
            className=""
          >
            <p className="text-base font-medium text-left text-muted-foreground">
              {dataRow.code}
            </p>
            <p className="text-base font-medium text-left">
              {dataRow.new_asset_value}
            </p>
          </Link>
          <div className="flex flex-wrap gap-1 justify-end">
            {(dataRow.status ?? []).map((status) => (
              <span
                key={status}
                className="px-2 py-1 text-xs rounded bg-muted text-muted-foreground"
              >
                {t(`status.${status}`)}
              </span>
            ))}
          </div>
        </div>
      )}
      form={<Form />}
    />
  );
}
