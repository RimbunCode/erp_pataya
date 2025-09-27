import { Button } from "@/Components/ui/button";
import { Trash2Icon } from "lucide-react";
import DataTable2 from "@/Pages/Core/DataTable2";
import useDeleteModal from "@/Hooks/useDeleteModal";
import Form from "./Form";

export default function Index() {
  const { deleteItem } = useDeleteModal();
  return (
    <>
      <DataTable2
        actions={({ dataRow }) => {
          if (dataRow.is_default) return null;
          return (
            <Button
              variant="destructive"
              size="icon"
              className="size-8"
              onClick={() => deleteItem("paymentMethods.destroy", dataRow.id)}
            >
              <Trash2Icon />
            </Button>
          );
        }}
        form={<Form />}
        // templateItem={({ dataRow }) => (
        //   <div className="flex items-center justify-between p-4 border-b gap-x-4 border-muted-foreground/25">
        //     <Link
        //       as="button"
        //       href={route("categories.show", dataRow.id)}
        //       className=""
        //     >
        //       <p className="text-base font-medium text-left text-muted-foreground">
        //         {t(`finances.taxes.types.${dataRow.type}`)}
        //       </p>
        //       <p className="text-base font-medium text-left">{dataRow.name}</p>
        //     </Link>

        //     <Button
        //       variant="destructive"
        //       size="icon"
        //       className="size-8"
        //       onClick={() => setIdDelete(dataRow.id)}
        //     >
        //       <Trash2Icon />
        //     </Button>
        //   </div>
        // )}
      />
    </>
  );
}
