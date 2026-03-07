import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";

import { FormCheckbox } from "@/Components/ui/checkbox";
import FormInput from "@/Components/FormInput";
import FormTable from "@/Components/FormTable";
import { Input } from "@/Components/ui/input";
import LinkModel from "@/Components/LinkModel";
import PermissionLinkModel from "@/Pages/Core/PermissionLinkModel";
import Select from "@/Components/Select";
import { generateRandom } from "@/lib/utils";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { useMemo } from "react";

function Form() {
  const { t } = useLaravelReactI18n();
  const { data, setData } = useFormPage();

  const stepColumns = useMemo(() => {
    return [
      {
        name: "approver_type",
        titleTrans: "core.approvalScheme.steps.columns.approver_type",
        required: true,
        cell({ data, setData, attributes }) {
          return (
            <Select
              value={data}
              onValueChange={(val) => {
                console.log(val);
                setData({
                  approver_type: val,
                  ...(data != val ? { approver: null } : {}),
                });
              }}
              optionTrans="core.approvalScheme.steps.columns.approver_type.options"
              options={["role", "user"]}
              {...attributes}
            />
          );
        },
      },
      {
        name: "approver",
        titleTrans: "core.approvalScheme.steps.columns.approver",
        required: true,
        cell({ dataRow, data, setData, attributes }) {
          return (
            <LinkModel
              disabled={!dataRow?.approver_type}
              model={
                dataRow?.approver_type == "role"
                  ? "App\\Models\\User\\Role"
                  : "App\\Models\\User\\User"
              }
              value={data}
              onValueChange={(val) => setData("approver", val)}
              disabledAddButton
              {...attributes}
            />
          );
        },
      },
    ];
  }, []);

  return (
    <>
      <FormPageContent value="detail">
        <div className="grid gap-x-3 gap-y-4">
          {!data.is_letter_head && (
            <FormInput
              required={true}
              label={t("core.approvalScheme.columns.model")}
            >
              <PermissionLinkModel
                required={true}
                placeholder={t("core.approvalScheme.columns.model.placeholder")}
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
          )}
          <FormInput
            required={true}
            label={t("core.approvalScheme.columns.name")}
          >
            <Input
              value={data?.name ?? ""}
              onValueChange={(e) => setData("name", e)}
            />
          </FormInput>
          <FormCheckbox
            checked={data.is_active}
            onCheckedChange={(val) => setData("is_active", val)}
            label={t("core.approvalScheme.columns.is_active")}
          />
        </div>
      </FormPageContent>
      <FormPageContent
        value="detail"
        title={t("core.approvalScheme.columns.steps")}
      >
        <FormTable
          name="ApprovalSchemeSteps"
          columns={stepColumns}
          value={data.steps}
          onValueChange={(val) => setData("steps", val)}
        />
      </FormPageContent>
    </>
  );
}

export default Form;
