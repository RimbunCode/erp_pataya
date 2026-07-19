import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";

import AssignableLinkModel from "@/Pages/Users/ManageUsers/AssignableLinkModel";
import DatetimePicker from "@/Components/DatetimePicker";
import FormInput from "@/Components/FormInput";
import React from "react";
import Select from "@/Components/Select";
import TiptapEditor from "@/Components/TiptapEditor";
import { useLaravelReactI18n } from "laravel-react-i18n";

const PRIORITY_OPTIONS = ["low", "medium", "high"];
const STATUS_OPTIONS = ["open", "closed", "canceled"];

function Form() {
  const { t } = useLaravelReactI18n();
  const { data, setData } = useFormPage({
    priority: "medium",
    status: "open",
  });

  return (
    <>
      <FormPageContent value="detail">
        <div className="grid gap-4 md:grid-cols-2">
          {/* Kolom kiri: Assignee, Priority, Status */}
          <div className="flex flex-col gap-4">
            <FormInput
              label={t("core.todo.columns.allocated_to")}
              name="allocated_to"
              required
            >
              <AssignableLinkModel
                value={data.allocated_to}
                onValueChange={(val) => setData("allocated_to", val)}
              />
            </FormInput>

            <FormInput
              label={t("core.todo.columns.priority")}
              name="priority"
              required
            >
              <Select
                value={data.priority}
                onValueChange={(val) => setData("priority", val)}
                options={PRIORITY_OPTIONS}
                optionTrans="core.todo.priority.options"
              />
            </FormInput>

            <FormInput
              label={t("core.todo.columns.status")}
              name="status"
              required
            >
              <Select
                value={data.status}
                onValueChange={(val) => setData("status", val)}
                options={STATUS_OPTIONS}
                optionTrans="status"
              />
            </FormInput>
          </div>

          {/* Kolom kanan: Date, Due Date */}
          <div className="flex flex-col gap-4">
            <FormInput label={t("core.todo.columns.date")} name="date">
              <DatetimePicker
                type="date"
                value={data.date}
                onValueChange={(val) => setData("date", val)}
              />
            </FormInput>

            <FormInput label={t("core.todo.columns.due_date")} name="due_date">
              <DatetimePicker
                type="datetime"
                value={data.due_date}
                onValueChange={(val) => setData("due_date", val)}
              />
            </FormInput>
          </div>
        </div>
      </FormPageContent>

      <FormPageContent value="detail">
        <FormInput
          label={t("core.todo.columns.description")}
          name="description"
        >
          <TiptapEditor
            value={data.description}
            onValueChange={(_json, html) => setData("description", html)}
          />
        </FormInput>
      </FormPageContent>
    </>
  );
}

export default Form;
