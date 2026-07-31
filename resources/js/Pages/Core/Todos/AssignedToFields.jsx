import AssignableLinkModel from "@/Pages/Users/ManageUsers/AssignableLinkModel";
import DatetimePicker from "@/Components/DatetimePicker";
import FormInput from "@/Components/FormInput";
import MultiSelect from "@/Components/MultiSelect";
import React from "react";
import Select from "@/Components/Select";
import TiptapEditor from "@/Components/TiptapEditor";
import { useLaravelReactI18n } from "laravel-react-i18n";

const TYPE_OPTIONS = ["task", "event", "meeting", "deadline"];
const PRIORITY_OPTIONS = ["low", "medium", "high"];
const STATUS_OPTIONS = ["open", "closed", "canceled"];
const LEAD_DAY_OPTIONS = [1, 3, 7, 14, 30];

function AssignedToFields({
  value,
  onChange,
  layout = "grid",
  excludeAssigneeIds = [],
  disableStatus = false,
}) {
  const { t } = useLaravelReactI18n();
  const containerClass =
    layout === "grid" ? "grid gap-4 md:grid-cols-2" : "flex flex-col gap-4";

  return (
    <div className={containerClass}>
      <div className="flex flex-col gap-4">
        <FormInput
          label={t("core.todo.columns.type")}
          name="type"
          required
          ignoreDisabled
        >
          <Select
            value={value.type}
            onValueChange={(val) => onChange("type", val)}
            options={TYPE_OPTIONS}
            optionTrans="core.todo.type.options"
          />
        </FormInput>

        <FormInput
          label={t("core.todo.columns.allocated_to")}
          name="allocated_to"
          description={t("core.todo.hints.allocated_to_self")}
          ignoreDisabled
        >
          <AssignableLinkModel
            value={value.allocated_to}
            onValueChange={(val) => onChange("allocated_to", val)}
            filters={
              excludeAssigneeIds.length > 0
                ? { id: { notIn: excludeAssigneeIds } }
                : undefined
            }
          />
        </FormInput>

        <FormInput
          label={t("core.todo.columns.priority")}
          name="priority"
          required
          ignoreDisabled
        >
          <Select
            value={value.priority}
            onValueChange={(val) => onChange("priority", val)}
            options={PRIORITY_OPTIONS}
            optionTrans="core.todo.priority.options"
          />
        </FormInput>

        <FormInput
          label={t("core.todo.columns.status")}
          name="status"
          required
          ignoreDisabled
        >
          <Select
            value={disableStatus ? "open" : value.status}
            onValueChange={
              disableStatus ? undefined : (val) => onChange("status", val)
            }
            options={STATUS_OPTIONS}
            optionTrans="status"
            disabled={disableStatus}
          />
        </FormInput>
      </div>

      <div className="flex flex-col gap-4">
        <FormInput
          label={t("core.todo.columns.date")}
          name="date"
          ignoreDisabled
        >
          <DatetimePicker
            type="date"
            value={value.date}
            onValueChange={(val) => onChange("date", val)}
          />
        </FormInput>

        <FormInput
          label={t("core.todo.columns.due_date")}
          name="due_date"
          ignoreDisabled
        >
          <DatetimePicker
            type="datetime"
            value={value.due_date}
            onValueChange={(val) => onChange("due_date", val)}
          />
        </FormInput>

        <FormInput
          label={t("core.todo.columns.reminder_lead_days")}
          name="reminder_lead_days"
          description={t("core.todo.hints.reminder_lead_days")}
          ignoreDisabled
        >
          <MultiSelect
            value={value.reminder_lead_days}
            onValueChange={(val) => onChange("reminder_lead_days", val)}
            options={LEAD_DAY_OPTIONS}
            optionTrans="core.todo.lead_days.options"
          />
        </FormInput>
      </div>

      <FormInput
        label={t("core.todo.columns.description")}
        name="description"
        className={layout === "grid" ? "md:col-span-2" : undefined}
        ignoreDisabled
      >
        <TiptapEditor
          value={value.description}
          onValueChange={(_json, html) => onChange("description", html)}
        />
      </FormInput>
    </div>
  );
}

export default AssignedToFields;
