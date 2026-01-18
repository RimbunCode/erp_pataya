import { FormPage } from "@/Pages/Core/FormPage";
import FormVariant from "./FormVariant";
import Link from "@/Components/Link";
import React from "react";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function ShowVariant({ itemVariant }) {
  const { t } = useLaravelReactI18n();
  const route = window.route;
  return (
    <FormPage
      title={itemVariant.sku}
      name="itemVariant"
      badge={
        <>
          {itemVariant.format_variant && (
            <span className="text-sm badge primary">
              {`${t("inventory.item.variant_of")} `}
              <Link
                className="ml-1 hover:underline"
                href={route("items.show", itemVariant.item.id)}
              >
                {itemVariant.item.code}
              </Link>
            </span>
          )}
        </>
      }
    >
      <FormVariant />
    </FormPage>
  );
}
