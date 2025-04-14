import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";
import { memo, useMemo } from "react";

import FormTable from "@/Components/FormTable";
import UnitLinkModel from "../Units/UnitLinkModel";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default memo(function FormBarcodes() {
  const { data, setData } = useFormPage();
  const { t } = useLaravelReactI18n();

  const barcodeColumns = useMemo(
    () => [
      {
        name: "barcode",
        titleTrans: "inventory.item.columns.barcodes.columns.barcode",
        required: true,
      },
      {
        name: "unit",
        titleTrans: "inventory.item.columns.barcodes.columns.unit",
        required: true,
        cell({ dataRow, attributes }) {
          return <UnitLinkModel value={dataRow} {...attributes} />;
        },
      },
    ],
    [],
  );
  return (
    <FormPageContent title={t("inventory.item.menu.barcodes")} value="barcodes">
      <FormTable
        columns={barcodeColumns}
        value={data.barcodes ?? []}
        onValueChange={(val) => {
          setData("barcodes", val);
        }}
      />
    </FormPageContent>
  );
});
