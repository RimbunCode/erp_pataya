import { memo, useMemo } from "react";

import { FormPageContent } from "@/Pages/Core/FormPage";
import FormTable from "@/Components/FormTable";
import Select from "@/Components/Select";
import { convertTemplateLink } from "@/lib/linkModelUtils";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default memo(function FormBarcodes({
  disabled,
  item = null,
  barcodes = [],
  uoms = [],
  onBarcodesChange,
}) {
  const { mappingUoms, selectItemUoms } = useMemo(() => {
    const mappingUoms = Object.fromEntries(uoms.map((u) => [u.id, u]));
    const selectItemUoms = uoms.map((u) => ({
      label: convertTemplateLink(u),
      value: u.id,
    }));
    return { mappingUoms, selectItemUoms };
  }, [uoms]);

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
            <Select
              {...attributes}
              readOnly={!dataRow.barcode}
              value={value?.id}
              onValueChange={(val) => {
                setData("unit", mappingUoms[val]);
              }}
              options={selectItemUoms}
            />
          );
        },
      },
    ],
    [mappingUoms, selectItemUoms],
  );
  return (
    <FormPageContent
      title={t("inventory.item.menu.barcodes")}
      value="itemBarcodes"
      show={item && !(item.attributes && item.attributes.length > 0)}
    >
      <FormTable
        disabled={disabled}
        columns={barcodeColumns}
        value={barcodes ?? []}
        onValueChange={onBarcodesChange}
      />
    </FormPageContent>
  );
});
