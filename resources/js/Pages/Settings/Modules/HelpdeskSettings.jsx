import React from "react";
import FormInput from "@/Components/FormInput";
import NumberInput from "@/Components/NumberInput";
import Select from "@/Components/Select";
import ModuleSettingsPage from "./ModuleSettingsPage";
import { useLaravelReactI18n } from "laravel-react-i18n";

// Sama dengan `in:` pada TicketRequest dan opsi pada form Tiket.
const TYPE_OPTIONS = ["bug_problem", "task", "question", "other"];
const PRIORITY_OPTIONS = ["low", "medium", "high", "critical"];

export default function HelpdeskSettings({ setting = {}, canWrite = true }) {
  const { t } = useLaravelReactI18n();
  const tabs = [
    {
      value: "default",
      title: "helpdesk.setting.default.title",
      label: t("helpdesk.setting.default.title"),
    },
  ];

  return (
    <ModuleSettingsPage
      name="helpdesk"
      title={t("helpdesk.setting.title")}
      setting={setting}
      canWrite={canWrite}
      tabs={tabs}
    >
      {({ data, setData, disabled }) => {
        const invalidOption =
          (data.default_type && !TYPE_OPTIONS.includes(data.default_type)) ||
          (data.default_priority &&
            !PRIORITY_OPTIONS.includes(data.default_priority));

        return (
          <div
            className="grid max-w-xl gap-4"
            data-testid="helpdesk-settings-defaults"
          >
            <p className="text-sm text-muted-foreground">
              {t("helpdesk.setting.default_help")}
            </p>
            <FormInput
              name="default_type"
              label={t("helpdesk.setting.default_type")}
            >
              <Select
                disabled={disabled}
                value={data.default_type ?? null}
                onValueChange={(value) =>
                  setData("default_type", value || null)
                }
                options={TYPE_OPTIONS}
                optionTrans="helpdesk.ticket.type.options"
              />
            </FormInput>
            <FormInput
              name="default_priority"
              label={t("helpdesk.setting.default_priority")}
            >
              <Select
                disabled={disabled}
                value={data.default_priority ?? null}
                onValueChange={(value) =>
                  setData("default_priority", value || null)
                }
                options={PRIORITY_OPTIONS}
                optionTrans="helpdesk.ticket.priority.options"
              />
            </FormInput>
            {invalidOption && (
              <p
                role="alert"
                className="text-sm text-amber-700 dark:text-amber-300"
              >
                {t("helpdesk.setting.option_unavailable")}
              </p>
            )}
            <FormInput
              name="default_due_days"
              label={t("helpdesk.setting.default_due_days")}
            >
              <NumberInput
                disabled={disabled}
                value={data.default_due_days ?? ""}
                decimalScale={0}
                min={0}
                className="text-left"
                onValueChange={(value) => setData("default_due_days", value)}
              />
            </FormInput>
            <p className="-mt-3 text-sm text-muted-foreground">
              {t("helpdesk.setting.default_due_days_help")}
            </p>
          </div>
        );
      }}
    </ModuleSettingsPage>
  );
}
