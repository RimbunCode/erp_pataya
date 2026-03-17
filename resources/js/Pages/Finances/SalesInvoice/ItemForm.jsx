import { FormPageContent } from "@/Pages/Core/FormPage";

export default function ItemForm({ getColumn }) {
  return (
    <>
      <FormPageContent value="detail" title={null}>
        <div className="flex flex-col gap-y-4">
          {getColumn("item")}
          <div className="grid grid-cols-2 gap-4">
            {getColumn("quantity")}
            {getColumn("unit")}
            {getColumn("tax")}
            {getColumn("price")}
          </div>
          {getColumn("description", { rows: 3 })}
        </div>
      </FormPageContent>
    </>
  );
}
