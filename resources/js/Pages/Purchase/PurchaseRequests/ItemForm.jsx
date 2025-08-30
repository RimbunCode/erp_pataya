import { FormPageContent } from "@/Pages/Core/FormPage";

export default function ItemForm({ getColumn }) {
  return (
    <>
      <FormPageContent value="detail" title={null}>
        <div className="flex flex-col gap-y-4">
          {getColumn("item")}
          {getColumn("description", { rows: 3 })}
          <div className="flex [&>*]:flex-1 gap-x-4">
            {getColumn("quantity")}

            {getColumn("unit")}
          </div>
        </div>
      </FormPageContent>
    </>
  );
}
