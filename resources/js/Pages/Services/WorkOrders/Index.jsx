import DataTable2 from "@/Pages/Core/DataTable2";
import Form from "./Form";
import Link from "@/Components/Link";
import React from "react";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Index() {
  const route = window.route;
  const { t } = useLaravelReactI18n();

  return (
    <DataTable2
      classNameDialog="max-w-(--breakpoint-2xl)!"
      form={<Form />}
      templateItem={({ dataRow }) => (
        <div className="flex items-center justify-between p-4 border-b gap-x-4 border-muted-foreground/25">
          <Link
            as="button"
            href={route("workOrders.show", dataRow.id)}
            className=""
          >
            <p className="text-base font-medium text-left text-muted-foreground">
              {t(`service.workOrder.types.${dataRow.type}`)}
            </p>
            <p className="text-base font-medium text-left">{dataRow.name}</p>
          </Link>
        </div>
      )}
    />
  );
}
