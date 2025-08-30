import FormBarcodes from "./FormBarcodes";
import FormDetail from "./FormDetail";
import FormStockLevels from "./FormStockLevels";
import { useFormPage } from "@/Pages/Core/FormPage";

export default function FormVariant() {
  const { dataBefore, data, setData } = useFormPage();
  return (
    <>
      <FormDetail
        isVariant
        dataBefore={dataBefore}
        data={data}
        setData={setData}
        item={data.item}
      />
      <FormBarcodes isVariant />
      <FormStockLevels />
    </>
  );
}
