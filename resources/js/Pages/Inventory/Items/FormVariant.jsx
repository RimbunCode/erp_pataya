import FormBarcodes from "./FormBarcodes";
import FormDetail from "./FormDetail";
import FormStockLevels from "./FormStockLevels";
import { useFormPage } from "@/Pages/Core/FormPage";
import { useCallback } from "react";

export default function FormVariant() {
  const { dataBefore, data, setData } = useFormPage();
  const handleBarcodesChange = useCallback(
    (val) => {
      setData("barcodes", val);
    },
    [setData],
  );
  return (
    <>
      <FormDetail
        isVariant
        dataBefore={dataBefore}
        data={data}
        setData={setData}
        item={data.item}
      />
      <FormBarcodes
        isVariant
        item={data.item}
        barcodes={data.barcodes ?? []}
        onBarcodesChange={handleBarcodesChange}
      />
      <FormStockLevels />
    </>
  );
}
