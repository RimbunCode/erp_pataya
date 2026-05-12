import FormBarcodes from "./FormBarcodes";
import FormDetail from "./FormDetail";
import FormStockLevels from "./FormStockLevels";
import { useCallback } from "react";
import { useFormPage } from "@/Pages/Core/FormPage";

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
        uoms={data.uoms ?? []}
        barcodes={data.barcodes ?? []}
        onBarcodesChange={handleBarcodesChange}
      />
      <FormStockLevels />
    </>
  );
}
