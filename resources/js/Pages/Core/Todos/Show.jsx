import { FormPage } from "@/Pages/Core/FormPage";
import Form from "./Form";
import Link from "@/Components/Link";
import React from "react";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";

export default function Show({ todo, defaultData }) {
  const route = window.route;
  const { t } = useLaravelReactI18n();
  const { referenceLabel, referenceRoute } = usePage().props;

  return (
    <FormPage
      isCreate={!todo}
      ignoreDraft={defaultData}
      name="todo"
      defaultValues={defaultData}
    >
      <Form />

      {todo?.reference_type && (
        <div className="px-4 pb-6 pt-2">
          <h3 className="mb-3 text-sm font-semibold">
            {t("core.todo.columns.reference")}
          </h3>
          {referenceRoute && referenceLabel ? (
            <Link
              href={route(referenceRoute, todo.reference_id)}
              className="hover:underline text-sm"
            >
              {referenceLabel}
            </Link>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("core.todo.reference_deleted")}
            </p>
          )}
        </div>
      )}
    </FormPage>
  );
}
