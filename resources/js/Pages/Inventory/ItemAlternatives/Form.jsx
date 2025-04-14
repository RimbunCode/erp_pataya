import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";

import { FormCheckbox } from "@/Components/ui/checkbox";
import FormInput from "@/Components/FormInput";
import ItemLinkModel from "../Items/ItemLinkModel";
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
            required={true}
            label={t("inventory.itemAlternative.columns.item_code")}
          >
            <ItemLinkModel
              placeholder={t(
                "inventory.itemAlternative.columns.item_code.placeholder",
              )}
              filters={{
                allow_alternative_item: true,
              }}
              value={data.item}
              onValueChange={(val) => setData("item", val)}
            />
          </FormInput>
          <FormInput
            required={true}
            label={t("inventory.itemAlternative.columns.alternative_item_code")}
          >
            <ItemLinkModel
              placeholder={t(
                "inventory.itemAlternative.columns.alternative_item_code.placeholder",
              )}
              filters={{
                ...(data.two_way ? { allow_alternative_item: true } : {}),
                id: {
                  not: data.item?.id,
                },
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
