import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";

import { FormCheckbox } from "@/Components/ui/checkbox";
import FormInput from "@/Components/FormInput";
import ItemVariantLinkModel from "../Items/ItemVariantLinkModel";
import React from "react";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Form() {
  const { data, setData } = useFormPage();
  const { t } = useLaravelReactI18n();

  return (
    <>
      <FormPageContent title={null} value="detail">
        <div className="grid gap-x-3 gap-y-4">
          <FormCheckbox
            checked={data.two_way}
            onCheckedChange={(val) => setData("two_way", val)}
            label={t("inventory.itemAlternative.columns.two_way")}
          />
          <FormInput
            name="item"
            required={true}
            label={t("inventory.itemAlternative.columns.item")}
          >
            <ItemVariantLinkModel
              placeholder={t(
                "inventory.itemAlternative.columns.item.placeholder",
              )}
              filters={{
                or: {
                  allow_alternative_item: true,
                  item: { allow_alternative_item: true },
                },
              }}
              value={data.item}
              onValueChange={(val) => setData("item", val)}
            />
          </FormInput>
          <FormInput
            name="alternative"
            required={true}
            label={t("inventory.itemAlternative.columns.alternative")}
          >
            <ItemVariantLinkModel
              placeholder={t(
                "inventory.itemAlternative.columns.alternative.placeholder",
              )}
              filters={{
                ...(data.two_way
                  ? {
                      or: {
                        allow_alternative_item: true,
                        item: { allow_alternative_item: true },
                      },
                    }
                  : {}),
                id: {
                  not: data.item?.id,
                },
                category_id: data.item?.category_id,
              }}
              value={data.alternative}
              onValueChange={(val) => setData("alternative", val)}
            />
          </FormInput>
        </div>
      </FormPageContent>
    </>
  );
}
