import { Button } from "@/Components/ui/button";
import DataTable2 from "@/Pages/Core/DataTable2";
import Form from "./Form";
import Link from "@/Components/Link";
import { Trash2Icon } from "lucide-react";

export default function Index() {
  const route = window.route;
  return (
    <>
      <DataTable2
        form={<Form />}
        classNameDialog="max-w-screen-2xl"
        templateItem={({ dataRow, deleteItem }) => (
          <div className="flex items-center justify-between p-4 border-b gap-x-4 border-muted-foreground/25">
            <Link
              as="button"
              href={route("paymentEntries.show", dataRow.id)}
              className=""
            >
              <p className="text-base font-medium text-left">{dataRow.code}</p>
              {dataRow.date && (
                <p className="text-sm text-left text-muted-foreground">
                  {dataRow.date}
                </p>
              )}
            </Link>

            <Button
              variant="destructive"
              size="icon"
              className="size-8"
              onClick={() => deleteItem()}
            >
              <Trash2Icon />
            </Button>
          </div>
        )}
      />
    </>
  );
}
