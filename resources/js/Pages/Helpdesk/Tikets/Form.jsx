import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";

import DatetimePicker from "@/Components/DatetimePicker";
import FormInput from "@/Components/FormInput";
import { Input } from "@/Components/ui/input";
import React from "react";
import Select from "@/Components/Select";
import { Slider } from "@/Components/ui/slider";
import TiptapEditor from "@/Components/TiptapEditor";
import UserLinkModel from "@/Pages/Users/ManageUsers/UserLinkModel";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";

const TYPE_OPTIONS = ["bug_problem", "task", "question", "other"];
const PRIORITY_OPTIONS = ["low", "medium", "high", "critical"];
const STATUS_OPTIONS = ["new", "in_progress", "on_hold", "resolved", "done"];

function Form() {
  const { t } = useLaravelReactI18n();
  const { data, setData } = useFormPage({
    type: "task",
    priority: "medium",
    status: "new",
    progress: 0,
    start_date: new Date(),
  });
  const ticket = usePage().props.ticket;
  const imageUploadUrl = ticket
    ? window.route("tickets.addFile", ticket.id)
    : null;

  return (
    <>
      <FormPageContent value="detail" title={t("helpdesk.ticket.columns.type")}>
        <div className="grid gap-x-4 gap-y-4 md:grid-cols-2">
          <div className="flex flex-col gap-y-4">
            <FormInput label={t("helpdesk.ticket.columns.type")} name="type">
              <Select
                value={data.type}
                onValueChange={(val) => setData("type", val)}
                options={TYPE_OPTIONS}
                optionTrans="helpdesk.ticket.type.options"
              />
            </FormInput>
            <FormInput
              label={t("helpdesk.ticket.columns.priority")}
              name="priority"
            >
              <Select
                value={data.priority}
                onValueChange={(val) => setData("priority", val)}
                options={PRIORITY_OPTIONS}
                optionTrans="helpdesk.ticket.priority.options"
              />
            </FormInput>
            <FormInput
              label={t("helpdesk.ticket.columns.status")}
              name="status"
            >
              <Select
                value={data.status}
                onValueChange={(val) => setData("status", val)}
                options={STATUS_OPTIONS}
                optionTrans="helpdesk.ticket.status.options"
              />
            </FormInput>
            <FormInput
              label={`${t("helpdesk.ticket.columns.progress")} (${data.progress ?? 0}%)`}
              name="progress"
            >
              <Slider
                value={[data.progress ?? 0]}
                onValueChange={([v]) => setData("progress", v)}
                min={0}
                max={100}
                step={5}
                className="mt-2"
              />
            </FormInput>
          </div>
          <div className="flex flex-col gap-y-4">
            <FormInput
              label={t("helpdesk.ticket.columns.assign_to")}
              name="assign_to"
            >
              <UserLinkModel
                value={data.assign_to}
                onValueChange={(val) => setData("assign_to", val)}
              />
            </FormInput>
            <FormInput
              label={t("helpdesk.ticket.columns.start_date")}
              name="start_date"
            >
              <DatetimePicker
                type="datetime"
                value={data.start_date}
                onValueChange={(val) => setData("start_date", val)}
              />
            </FormInput>
            <FormInput
              label={t("helpdesk.ticket.columns.due_date")}
              name="due_date"
            >
              <DatetimePicker
                type="datetime"
                value={data.due_date}
                onValueChange={(val) => setData("due_date", val)}
              />
            </FormInput>
            <FormInput
              label={t("helpdesk.ticket.columns.end_date")}
              name="end_date"
            >
              <DatetimePicker
                type="datetime"
                value={data.end_date}
                onValueChange={(val) => setData("end_date", val)}
              />
            </FormInput>
          </div>
        </div>
      </FormPageContent>
      <FormPageContent
        value="subject"
        title={t("helpdesk.ticket.columns.subject")}
      >
        <FormInput
          label={t("helpdesk.ticket.columns.subject")}
          name="subject"
          required
        >
          <Input
            type="text"
            value={data.subject ?? ""}
            onChange={(e) => setData("subject", e.target.value)}
          />
        </FormInput>
      </FormPageContent>
      <FormPageContent
        value="content"
        title={t("helpdesk.ticket.columns.content")}
      >
        <FormInput label={t("helpdesk.ticket.columns.content")} name="content">
          <TiptapEditor
            value={data.content}
            onValueChange={(json, html) => setData("content", html)}
            imageUploadUrl={imageUploadUrl}
          />
        </FormInput>
      </FormPageContent>
    </>
  );
}

export default Form;
