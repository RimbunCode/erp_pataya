import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/Components/ui/button";
import FormInput from "@/Components/FormInput";
import { FormPageContent } from "@/Pages/Core/FormPage";
import ItemVariantLinkModel from "@/Pages/Inventory/Items/ItemVariantLinkModel";
import NumberInput from "@/Components/NumberInput";
import { Textarea } from "@/Components/ui/textarea";
import { generateRandom } from "@/lib/utils";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function QuotationItems({ value, onValueChange, readOnly }) {
  const { t } = useLaravelReactI18n();
  const items = value ?? [];

  const updateItem = (index, patch) => {
    const next = items.map((item, i) =>
      i === index ? { ...item, ...patch } : item,
    );
    onValueChange(next);
  };

  const addItem = () => {
    onValueChange([
      ...items,
      {
        id: generateRandom(8),
        quantity: 1,
        price: 0,
      },
    ]);
  };

  const removeItem = (index) => {
    onValueChange(items.filter((_, i) => i !== index));
  };

  return (
    <FormPageContent value="items" title={t("crm.quotation.items")}>
      <div className="flex flex-col gap-y-4">
        {items.map((item, index) => {
          const amount = (item.quantity ?? 0) * (item.price ?? 0);
          return (
            <div
              key={item.id ?? index}
              className="relative flex flex-col gap-y-4 p-4 border rounded-md"
            >
              {!readOnly && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 size-7"
                  onClick={() => removeItem(index)}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
              <div className="grid gap-x-4 gap-y-4 pr-10 md:grid-cols-3">
                <FormInput
                  label={t("crm.quotation.columns.item")}
                  required={true}
                  className="md:col-span-2"
                >
                  <ItemVariantLinkModel
                    placeholder={t("crm.quotation.columns.item.placeholder")}
                    value={item.item}
                    onValueChange={(val) => updateItem(index, { item: val })}
                    disabled={readOnly}
                  />
                </FormInput>
                <FormInput
                  label={t("crm.quotation.columns.quantity")}
                  required={true}
                >
                  <NumberInput
                    decimalScale={2}
                    value={item.quantity}
                    onValueChange={(val) =>
                      updateItem(index, { quantity: val })
                    }
                    readOnly={readOnly}
                  />
                </FormInput>
                <FormInput label={t("crm.quotation.columns.price")}>
                  <NumberInput
                    decimalScale={2}
                    value={item.price}
                    onValueChange={(val) => updateItem(index, { price: val })}
                    readOnly={readOnly}
                  />
                </FormInput>
                <FormInput label={t("crm.quotation.columns.amount")}>
                  <NumberInput decimalScale={2} value={amount} readOnly />
                </FormInput>
                <FormInput
                  label={t("crm.quotation.columns.description")}
                  className="md:col-span-3"
                >
                  <Textarea
                    value={item.description ?? ""}
                    onChange={(e) =>
                      updateItem(index, { description: e.target.value })
                    }
                    disabled={readOnly}
                  />
                </FormInput>
              </div>
            </div>
          );
        })}
        {!readOnly && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={addItem}
          >
            <Plus className="size-4" />
            {t("crm.quotation.add_item")}
          </Button>
        )}
      </div>
    </FormPageContent>
  );
}
