import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";
import { memo, useMemo } from "react";

import FormTable from "@/Components/FormTable";
import React from "react";
import UnitLinkModel from "../Units/UnitLinkModel";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";

export default memo(function FormBarcodes({ disabled, isVariant = false }) {
  const { data, setData } = useFormPage();
  const item = usePage().props.item;
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
        cell({ dataRow, data: value, setData, attributes }) {
          return (
            <UnitLinkModel
              {...attributes}
              readOnly={!dataRow.barcode}
              value={value}
              onValueChange={(val) => {
                setData("unit", val);
              }}
              filters={{
                group: isVariant
                  ? item?.default_unit?.group
                  : data?.default_unit?.group,
              }}
              defaultValueForm={{
                group: isVariant
                  ? item?.default_unit?.group
                  : data?.default_unit?.group,
              }}
            />
          );
        },
      },
    ],
    [isVariant, data, item],
  );
  return (
    <FormPageContent
      title={t("inventory.item.menu.barcodes")}
      value="barcodes"
      show={item && !(item.attributes && item.attributes.length > 0)}
    >
      <FormTable
        disabled={disabled}
        columns={barcodeColumns}
        value={data.barcodes ?? []}
        onValueChange={(val) => {
          setData("barcodes", val);
        }}
      />
    </FormPageContent>
  );
});
