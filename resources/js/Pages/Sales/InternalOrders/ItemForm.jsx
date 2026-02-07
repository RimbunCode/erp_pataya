import { FormPageContent } from "@/Pages/Core/FormPage";

export default function ItemForm({ getColumn }) {
  return (
    <>
      <FormPageContent value="detail" title={null}>
        <div className="flex flex-col gap-y-4">
          {getColumn("item")}
          {getColumn("unit")}
          {getColumn("quantity")}
          {getColumn("source_warehouse")}
          {getColumn("description", { rows: 3 })}
        </div>
      </FormPageContent>
    </>
  );
}
