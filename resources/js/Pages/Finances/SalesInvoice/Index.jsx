import DataTable2 from "@/Pages/Core/DataTable2";
import Form from "./Form";
import Link from "@/Components/Link";
import React from "react";

export default function Index() {
  const route = window.route;
  return (
    <DataTable2
      templateItem={({ dataRow }) => (
        <div className="flex items-center justify-between p-4 border-b gap-x-4 border-muted-foreground/25">
          <Link
            as="button"
            href={route("salesInvoices.show", dataRow.id)}
            className=""
          >
            <p className="text-base font-medium text-left">{dataRow.code}</p>
            {dataRow.customer_name && (
              <p className="text-sm text-left text-muted-foreground">
                {dataRow.customer_name}
              </p>
            )}
          </Link>
        </div>
      )}
      classNameDialog="max-w-(--breakpoint-2xl)!"
      form={<Form />}
    />
  );
}
