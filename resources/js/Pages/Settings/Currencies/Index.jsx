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
          href={route("currencies.show", dataRow.code)}
          className="items-center block p-4 border-b border-muted-foreground/25"
        >
          <p className="flex items-center gap-3 font-semibold text-left">
            <span className="text-xs font-mono badge secondary">
              {dataRow.code}
            </span>
            {dataRow.name}
            {dataRow.symbol && (
              <span className="text-muted-foreground font-normal">
                ({dataRow.symbol})
              </span>
            )}
          </p>
          {dataRow.number_format && (
            <p className="text-sm text-left text-muted-foreground mt-1">
              {dataRow.number_format}
            </p>
          )}
        </Link>
      )}
      classNameDialog="max-w-4xl!"
      form={<Form />}
    />
  );
}
