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
import { convertTemplateLink } from "@/lib/linkModelUtils";

const approverTypeOptions = ["role", "user"];

function ApproverSummaryText({ approvers }) {
  const { t } = useLaravelReactI18n();
  if (!approvers || approvers.length === 0)
    return <span className="text-muted-foreground text-xs">—</span>;

  return (
    <div className="px-2 py-1 text-xs leading-snug grid grid-cols-[auto_minmax(0,1fr)] w-full">
      {approvers?.map((approver) => {
        return (
          <div
            key={approver.id}
            className="grid col-span-full grid-cols-subgrid gap-x-2"
          >
            <span>
              {t(
                `core.approvalScheme.steps.columns.approver_type.options.${approver.approver_type}`,
              )}
            </span>
            <span>: {convertTemplateLink(approver.approver)}</span>
          </div>
        );
      })}
    </div>
  );
}

function NestedApproverFormTable({ value, onChange, disabled, readOnly }) {
  const { t } = useLaravelReactI18n();

  const nestedColumns = useMemo(
    () => [
      {
        name: "approver_type",
        titleTrans: "core.approvalScheme.steps.columns.approver_type",
        required: true,
        cell({ data, setData, attributes }) {
          return (
            <Select
              value={data}
              onValueChange={(val) =>
                setData({ approver_type: val, approver: null })
              }
              optionTrans="core.approvalScheme.steps.columns.approver_type.options"
              options={approverTypeOptions}
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
                dataRow?.approver_type === "role"
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
    ],
    [],
  );

  return (
    <FormTable
      name="ApprovalSchemeNestedApprovers"
      label={t("core.approvalScheme.steps.columns.approvers")}
      className="mt-2"
      columns={nestedColumns}
      value={value}
      onValueChange={onChange}
      disabled={disabled}
      readOnly={readOnly}
    />
  );
}

function StepFormDialog({
  getColumn,
  data: data,
  setData: setData,
  disabled,
  readOnly,
}) {
  const { t } = useLaravelReactI18n();
  return (
    <div className="p-4 grid grid-cols-1 gap-y-3">
      <FormCheckbox
        checked={data.is_advanced}
        onCheckedChange={(val) => setData("is_advanced", val)}
        label={t("core.approvalScheme.steps.columns.is_advanced")}
      />
      {data?.is_advanced ? (
        <NestedApproverFormTable
          value={data?.approvers ?? []}
          onChange={(val) => setData("approvers", val)}
          disabled={disabled}
          readOnly={readOnly}
        />
      ) : (
        <div className="grid grid-cols-2 gap-x-4 pt-2">
          {getColumn("approver_type")}
          {getColumn("approver")}
        </div>
      )}
    </div>
  );
}

function Form() {
  const { t } = useLaravelReactI18n();
  const { data, setData } = useFormPage();

  const stepColumns = useMemo(() => {
    return [
      {
        name: "is_advanced",
        titleTrans: "core.approvalScheme.steps.columns.is_advanced",
        cell({ data: isAdvanced, setData, dataRow, attributes }) {
          return (
            <div className="flex justify-center w-full h-full items-center">
              <FormCheckbox
                checked={!!isAdvanced}
                onCheckedChange={(val) =>
                  setData({
                    is_advanced: val,
                    approver_type: val ? null : dataRow?.approver_type,
                    approver: val ? null : dataRow?.approver,
                    approvers: val ? (dataRow?.approvers ?? []) : [],
                  })
                }
                {...attributes}
              />
            </div>
          );
        },
      },
      {
        name: "approver_type",
        titleTrans: "core.approvalScheme.steps.columns.approver_type",
        required: true,
        cell({ data, setData, dataRow, attributes }) {
          if (dataRow?.is_advanced) {
            return (
              <span className="px-2 text-xs text-muted-foreground w-full">
                {t("core.approvalScheme.steps.columns.is_advanced_label")}
              </span>
            );
          }
          return (
            <Select
              value={data}
              onValueChange={(val) =>
                setData({ approver_type: val, approver: null })
              }
              optionTrans="core.approvalScheme.steps.columns.approver_type.options"
              options={approverTypeOptions}
              {...attributes}
              required={!dataRow?.is_advanced && attributes.required}
            />
          );
        },
      },
      {
        name: "approver",
        titleTrans: "core.approvalScheme.steps.columns.approver",
        required: true,
        cell({ dataRow, data, setData, attributes }) {
          if (dataRow?.is_advanced) {
            return <ApproverSummaryText approvers={dataRow?.approvers} />;
          }
          return (
            <LinkModel
              disabled={!dataRow?.approver_type}
              model={
                dataRow?.approver_type === "role"
                  ? "App\\Models\\User\\Role"
                  : "App\\Models\\User\\User"
              }
              value={data}
              onValueChange={(val) => setData("approver", val)}
              disabledAddButton
              {...attributes}
              required={!dataRow?.is_advanced && attributes.required}
            />
          );
        },
      },
    ];
  }, [t]);

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
          form={<StepFormDialog />}
        />
      </FormPageContent>
    </>
  );
}

export default Form;
