import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";

import { Button } from "@/Components/ui/button";
import { FormCheckbox } from "@/Components/ui/checkbox";
import FormInput from "@/Components/FormInput";
import { Input } from "@/Components/ui/input";
import Link from "@/Components/Link";
import PermissionLinkModel from "../PermissionLinkModel";
import React from "react";
import { generateRandom } from "@/lib/utils";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Form() {
  const route = window.route;
  const { data, setData } = useFormPage();
  const { t } = useLaravelReactI18n();
  return (
    <>
      <FormPageContent title={null} value="detail">
        <div className="grid gap-x-3 gap-y-4">
          <FormInput
            required={true}
            label={t("core.printTemplate.columns.model")}
          >
            <PermissionLinkModel
              required={true}
              placeholder={t("core.printTemplate.columns.model.placeholder")}
              value={data.permission}
              onValueChange={(val) =>
                setData((prev) => ({
                  ...prev,
                  permission: val,
                  model: val?.model,
                  name: val
                    ? `${val.name}_${generateRandom(5).toLowerCase()}`
                    : "",
                }))
              }
              filters={{
                is_submitable: true,
              }}
            />
          </FormInput>
          <FormInput
            required={true}
            label={t("core.printTemplate.columns.name")}
          >
            <Input
              value={data?.name ?? ""}
              onChange={(e) => setData("name", e.target.value)}
            />
          </FormInput>
          <FormCheckbox
            checked={data.is_default}
            onCheckedChange={(val) => setData("is_default", val)}
            label={t("core.printTemplate.columns.is_default")}
          />
          {data.id && (
            <Button type="button" asChild className="h-8 w-fit">
              <Link href={route("printTemplates.editor", data.id)}>
                {t("core.printTemplate.open_editor")}
              </Link>
            </Button>
          )}
        </div>
      </FormPageContent>
    </>
  );
}
