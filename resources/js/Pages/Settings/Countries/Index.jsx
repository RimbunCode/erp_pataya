import DataTable2 from "@/Pages/Core/DataTable2";
import Form from "./Form";
import Link from "@/Components/Link";

export default function Index() {
  const route = window.route;

  return (
    <DataTable2
      templateItem={({ dataRow }) => (
        <Link
          as="button"
          href={route("countries.show", dataRow.code)}
          className="items-center block p-4 border-b border-muted-foreground/25"
        >
          <p className="flex items-center gap-3 font-semibold text-left">
            {dataRow.url_flag && (
              <img
                src={dataRow.url_flag}
                alt={dataRow.code}
                className="w-6 h-4 object-cover rounded-sm shrink-0"
              />
            )}
            <span className="text-xs font-mono badge secondary">
              {dataRow.code}
            </span>
            {dataRow.name}
          </p>
          {dataRow.lang_code && (
            <p className="text-sm text-left text-muted-foreground mt-1">
              {dataRow.lang_code}
            </p>
          )}
        </Link>
      )}
      classNameDialog="max-w-lg!"
      form={<Form />}
    />
  );
}
