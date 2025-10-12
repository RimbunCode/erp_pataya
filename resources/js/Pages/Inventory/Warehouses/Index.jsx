import { Button } from "@/Components/ui/button";
import DataTable2 from "@/Pages/Core/DataTable2";
import Form from "./Form";
import Link from "@/Components/Link";
import { Trash2Icon } from "lucide-react";
import useDeleteModal from "@/Hooks/useDeleteModal";

export default function Index() {
  const route = window.route;
  const { deleteItem } = useDeleteModal();
  return (
    <DataTable2
      templateItem={({ dataRow }) => (
        <div className="flex items-center justify-between p-4 border-b gap-x-4 border-muted-foreground/25">
          <Link
            as="button"
            href={route("warehouses.show", dataRow.id)}
            className=""
          >
            <p className="text-base font-medium text-left text-muted-foreground">
              {dataRow.branch_name}
            </p>
            <p className="text-base font-medium text-left">
              ({dataRow.code}) {dataRow.name}
            </p>
          </Link>
          <Button
            variant="destructive"
            size="icon"
            className="size-8"
            onClick={() => deleteItem("warehouses.destroy", dataRow.id)}
          >
            <Trash2Icon />
          </Button>
        </div>
      )}
      classNameDialog="max-w-lg"
      form={<Form />}
    />
  );
}
