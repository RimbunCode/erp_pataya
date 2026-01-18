import { FormPageContent } from "@/Pages/Core/FormPage";

export default function ItemForm({ getColumn }) {
  return (
    <>
      <FormPageContent value="detail" title={null}>
        <div className="flex flex-col gap-y-4">
          {getColumn("item")}
          {getColumn("description", { rows: 3 })}
          <div className="grid grid-cols-2 gap-4">
            {getColumn("target_warehouse")}
            {getColumn("required_date")}
            {getColumn("quantity")}
            {getColumn("rate")}
            {getColumn("unit")}
          </div>
        </div>
      </FormPageContent>
    </>
  );
}
