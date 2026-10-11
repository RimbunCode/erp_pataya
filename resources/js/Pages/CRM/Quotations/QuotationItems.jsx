import FormTable from "@/Components/FormTable";
import { FormPageContent } from "@/Pages/Core/FormPage";
import { Input } from "@/Components/ui/input";
import ItemUnitLinkModel from "@/Pages/Inventory/Items/ItemUnitLinkModel";
import ItemVariantLinkModel from "@/Pages/Inventory/Items/ItemVariantLinkModel";
import NumberInput from "@/Components/NumberInput";
import { Textarea } from "@/Components/ui/textarea";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { useMemo } from "react";

/**
 * Menyusun definisi kolom tabel item menurut jenis Quotation (AC9.4).
 * Kolom bernilai `false` dibuang oleh FormTable (`.filter((col) => col)`).
 * @param {string} type
 * @param {(key: string) => string} t
 */
export function buildQuotationItemColumns(type, t) {
  const isSparePart = type === "spare_part";
  const isNewUnit = type === "new_unit";
  const isRental = type === "rental";
  const priceTitle = t(`crm.quotation.columns.price.by_type.${type}`);
  const remarkTitle = t(`crm.quotation.columns.remark.by_type.${type}`);

  return [
    isSparePart && {
      name: "item_code",
      titleTrans: "crm.quotation.columns.part_no",
      show: true,
      width: 2,
      cell({ dataRow, attributes }) {
        return (
          <Input
            {...attributes}
            value={dataRow?.item?.item_code ?? ""}
            readOnly
            disabled={!dataRow?.item}
          />
        );
      },
    },
    {
      name: "item",
      titleTrans: "crm.quotation.columns.item",
      required: true,
      width: 3,
      cell({ dataRow, setData, attributes }) {
        return (
          <ItemVariantLinkModel
            placeholder={t("crm.quotation.columns.item.placeholder")}
            value={dataRow.item}
            fields={["item_code", "description"]}
            with={["defaultUom"]}
            onValueChange={(val) => {
              // Nilai awal disalin dari master, lalu menjadi milik dokumen
              // (pola P3): mengubah master tidak mengubah penawaran.
              setData({
                item: val,
                description: val?.description ?? "",
                item_unit: val?.default_uom,
              });
            }}
            {...attributes}
          />
        );
      },
    },
    {
      name: "description",
      titleTrans: "crm.quotation.columns.description",
      show: true,
      width: 3,
      cell({ dataRow, data: value, setData, attributes }) {
        return (
          <Textarea
            rows={3}
            disabled={!dataRow?.item}
            value={value ?? ""}
            onChange={(e) => setData("description", e.target.value)}
            {...attributes}
          />
        );
      },
    },
    {
      name: "quantity",
      titleTrans: "crm.quotation.columns.quantity",
      required: true,
      type: "number",
      width: 1,
      cell({ dataRow, data: value, setData, attributes }) {
        return (
          <NumberInput
            decimalScale={2}
            disabled={!dataRow?.item}
            value={value}
            onValueChange={(val) => setData("quantity", val)}
            {...attributes}
          />
        );
      },
    },
    !isNewUnit && {
      name: "item_unit",
      titleTrans: "crm.quotation.columns.unit",
      show: true,
      width: 2,
      cell({ dataRow, data: value, setData, attributes }) {
        return (
          <ItemUnitLinkModel
            disabled={!dataRow?.item}
            placeholder={t("crm.quotation.columns.unit.placeholder")}
            value={value}
            onValueChange={(val) => setData("item_unit", val)}
            filters={{ item_id: dataRow?.item?.item_id }}
            {...attributes}
          />
        );
      },
    },
    {
      name: "price",
      title: priceTitle,
      show: true,
      width: 2,
      cell({ dataRow, data: value, setData, attributes }) {
        return (
          <NumberInput
            decimalScale={2}
            disabled={!dataRow?.item}
            value={value}
            onValueChange={(val) => setData("price", val)}
            {...attributes}
          />
        );
      },
    },
    !isRental && {
      name: "remark",
      title: remarkTitle,
      show: true,
      width: 2,
      cell({ dataRow, data: value, setData, attributes }) {
        return (
          <Input
            disabled={!dataRow?.item}
            value={value ?? ""}
            onChange={(e) => setData("remark", e.target.value)}
            {...attributes}
          />
        );
      },
    },
    !isRental && {
      name: "amount",
      titleTrans: "crm.quotation.columns.amount",
      show: true,
      width: 2,
      cell({ dataRow, attributes }) {
        return (
          <NumberInput
            decimalScale={2}
            {...attributes}
            value={(dataRow?.quantity ?? 0) * (dataRow?.price ?? 0)}
            readOnly
          />
        );
      },
    },
  ];
}

export default function QuotationItems({
  value,
  onValueChange,
  readOnly,
  type = "spare_part",
}) {
  const { t } = useLaravelReactI18n();
  const columns = useMemo(() => buildQuotationItemColumns(type, t), [type, t]);

  return (
    <FormPageContent value="items" title={t("crm.quotation.items")}>
      <FormTable
        // `name` menjadi kunci penyimpanan preferensi kolom di localStorage.
        // WAJIB menyertakan jenis, kalau tidak preferensi kolom satu jenis
        // menyembunyikan kolom jenis lain (AC9.6).
        name={`quotation-items-${type}`}
        className="col-span-full"
        classNameDialog="max-w-(--breakpoint-lg)! w-full!"
        readOnly={readOnly}
        columns={columns}
        defaultValueRow={{ quantity: 1, price: 0 }}
        value={value ?? []}
        onValueChange={onValueChange}
      />
    </FormPageContent>
  );
}
