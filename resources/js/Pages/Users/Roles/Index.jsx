import DataTable2 from "@/Pages/Core/DataTable2";
import Form from "./Form";
import Link from "@/Components/Link";
import { cn } from "@/lib/utils";

export default function Index() {
  const route = window.route;
  return (
    <DataTable2
      classNameDialog="max-w-(--breakpoint-2xl)!"
      form={<Form />}
      templateItem={({ dataRow }) => (
        <Link
          as="button"
          href={route("roles.show", dataRow.id)}
          className="flex items-center p-4 border-b gap-x-4 border-muted-foreground/25"
        >
          <p className="text-base font-medium text-left">{dataRow.name}</p>
          <p
            className={cn(
              dataRow.is_disabled ? "error" : "primary",
              "text-left badge",
            )}
          >
            {dataRow.is_disabled ? "Disabled" : "Enabled"}
          </p>
        </Link>
      )}
    />
  );
}
