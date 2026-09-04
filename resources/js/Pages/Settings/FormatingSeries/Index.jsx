import DataTable2 from "@/Pages/Core/DataTable2";
import Link from "@/Components/Link";
import React from "react";

export default function Index() {
  const route = window.route;
  return (
    <DataTable2
      templateItem={({ dataRow }) => (
        <Link
          as="button"
          href={route("formatingSeries.show", dataRow.id)}
          className="items-center block p-4 border-b border-muted-foreground/25"
        >
          <p className="flex items-center gap-3 font-semibold text-left">
            {dataRow.name}
            {dataRow.model && (
              <span className="text-xs font-mono badge secondary">
                {dataRow.model}
              </span>
            )}
          </p>
          {dataRow.format && (
            <p className="mt-1 text-sm text-left text-muted-foreground">
              {dataRow.format}
            </p>
          )}
        </Link>
      )}
    />
  );
}
