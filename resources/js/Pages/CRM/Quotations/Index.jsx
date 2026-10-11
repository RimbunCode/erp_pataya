import { Button } from "@/Components/ui/button";
import DataTable2 from "@/Pages/Core/DataTable2";
import Form from "./Form";
import Link from "@/Components/Link";
import { Trash2Icon } from "lucide-react";
import { convertTemplateLink } from "@/lib/linkModelUtils";

function Index() {
  const route = window.route;
  return (
    <DataTable2
      form={<Form />}
      classNameDialog="max-w-(--breakpoint-lg)!"
      templateItem={({ dataRow, deleteItem }) => (
        <div className="flex items-center justify-between p-4 border-b gap-x-4 border-muted-foreground/25">
          <Link
            as="button"
            href={route("quotations.show", dataRow.id)}
            className="min-w-0 text-left"
          >
            {/* templateLink() model (`:code`), bukan `dataRow.code` mentah --
                lihat komentar sama di Opportunities/Index.jsx. */}
            <p
              className="text-base font-medium truncate"
              dangerouslySetInnerHTML={{
                __html: convertTemplateLink(dataRow, "", true),
              }}
            />
            <p className="text-sm text-muted-foreground truncate">
              {dataRow.customer?.name}
            </p>
            <p className="text-sm text-muted-foreground capitalize">
              {dataRow.status}
            </p>
          </Link>
          <Button
            variant="destructive"
            size="icon"
            className="size-8 shrink-0"
            onClick={() => deleteItem()}
          >
            <Trash2Icon />
          </Button>
        </div>
      )}
    />
  );
}
export default Index;
