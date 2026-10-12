import DataTable2 from "@/Pages/Core/DataTable2";
import Form from "./Form";
import Link from "@/Components/Link";

export default function Index() {
  const route = window.route;
  return (
    <DataTable2
      templateItem={({ dataRow }) => (
        <div className="flex items-center justify-between p-4 border-b gap-x-4 border-muted-foreground/25">
          <Link
            as="button"
            href={dataRow.id ? route("items.show", dataRow.id) : ""}
            className=""
          >
            <p className="text-base font-medium text-left">{dataRow.name}</p>
          </Link>
        </div>
      )}
      classNameDialog="max-w-6xl!"
      form={<Form />}
    />
  );
}
