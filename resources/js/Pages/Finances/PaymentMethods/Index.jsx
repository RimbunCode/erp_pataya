import DataTable2 from "@/Pages/Core/DataTable2";
import Form from "./Form";

export default function Index() {
  return (
    <>
      <DataTable2
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
