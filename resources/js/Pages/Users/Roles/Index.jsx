import { cn, getLocaleDate } from "@/lib/utils";
import { useMemo, useRef } from "react";

import DataTable from "@/Pages/Core/DataTable";
import Link from "@/Components/Link";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

export default function Index({ data, sort, show, lang }) {
  const route = window.route;
  const tableRef = useRef();
  const columns = useMemo(
    () => [
      {
        name: "name",
        title: "Name",
        searchType: "text",
        sortable: true,
        resizeable: true,
        cell: ({ dataRow }) => (
          <Link
            className="hover:underline"
            href={route("roles.show", dataRow.id)}
          >
            {dataRow.name}
          </Link>
        ),
      },
      {
        name: "is_disabled",
        width: "fit",
        title: "Status",
        sortable: true,
        searchType: "boolean",
        parse: {
          true: "Disabled",
          false: "Enabled",
        },
        cell: ({ dataRow, valueCell }) => {
          return (
            <button
              className={cn(
                dataRow.is_disabled ? "error" : "primary",
                "capitalize badge w-fit",
              )}
              type="button"
              onClick={() => {
                tableRef.current.addFilter(
                  "is_disabled",
                  "eq",
                  dataRow.is_disabled,
                );
              }}
            >
              {valueCell}
            </button>
          );
        },
      },
      {
        name: "created_at",
        title: "Created at",
        searchType: "date",
        width: "fit",
        sortable: true,
        cell: ({ dataRow }) => {
          return (
            <span>
              {format(new TZDate(dataRow.created_at, "UTC"), "PPPp", {
                locale: getLocaleDate(lang),
              })}
            </span>
          );
        },
      },
    ],
    [lang],
  );
  return (
    <DataTable
      ref={tableRef}
      title="Manage Users"
      buttonAdd={{
        title: "Add Role",
        onClick: () => {
          // setOpenNewUser(true);
        },
      }}
      data={data}
      defaultSort={sort}
      defaultShow={show}
      columns={columns}
    />
  );
}
