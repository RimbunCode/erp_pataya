/* eslint-disable jsdoc/require-jsdoc */
import { FormPage } from "@/Pages/Core/FormPage";
import React from "react";
import { SaveIcon } from "lucide-react";

import { Button } from "@/Components/ui/button";
import { useDraftForm } from "@/Hooks/useDraftForm";
import { useLaravelReactI18n } from "laravel-react-i18n";
import Form from "./Form";

export default function Show({ supplier }) {
  const { t } = useLaravelReactI18n();
  const { data, setData, put, processing, errors, reset, isDirty } =
    useDraftForm("supplier", supplier);
  const route = window.route;
  const onSubmit = (e) => {
    e.preventDefault();

    put(route("suppliers.update", supplier.id));
  };

  return (
    <>
      <FormPage
        disabled={processing}
        title={supplier.name}
        badge={
          isDirty && <span className="text-sm badge warning">Not Save</span>
        }
        controls={
          <Button
            role="save"
            className="!p-2 size-fit h-8"
            onClick={onSubmit}
            disabled={processing}
          >
            <SaveIcon />
            Save
          </Button>
        }
      >
        <Form data={data} setData={setData} />
      </FormPage>
    </>
  );
}
