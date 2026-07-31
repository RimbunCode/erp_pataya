import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";

import AssignableLinkModel from "@/Pages/Users/ManageUsers/AssignableLinkModel";
import DatetimePicker from "@/Components/DatetimePicker";
import FormInput from "@/Components/FormInput";
import { Input } from "@/Components/ui/input";
import React from "react";
import Select from "@/Components/Select";
import { Slider } from "@/Components/ui/slider";
import TiptapEditor from "@/Components/TiptapEditor";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";

const TYPE_OPTIONS = ["bug_problem", "task", "question", "other"];
const PRIORITY_OPTIONS = ["low", "medium", "high", "critical"];
const STATUS_OPTIONS = ["new", "in_progress", "on_hold", "resolved", "done"];

function Form() {
  const { t } = useLaravelReactI18n();
  const { data, setData, defaultData } = useFormPage({
    type: "task",
    priority: "medium",
    status: "new",
    progress: 0,
  });
  const ticket = usePage().props.ticket;
  const imageUploadUrl = ticket
    ? window.route("tickets.addFile", ticket.id)
    : null;

  return (
    <>
      {/* Grup 1: Informasi Tiket */}
      <FormPageContent value="detail">
        <div className="grid gap-4 md:grid-cols-2">
          {/* Kolom kiri: Tipe, Prioritas, Status, Progress */}
          <div className="flex flex-col gap-4">
            <FormInput
              label={t("helpdesk.ticket.columns.type")}
              name="type"
              required
            >
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
              required
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
              required
            >
              <Select
                value={data.status}
                onValueChange={(val) => {
                  setData({
                    ...data,
                    status: val,
                    progress:
                      val === "done" && (data.progress ?? 0) < 100
                        ? 100
                        : (data.progress ?? 0),
                  });
                }}
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

          {/* Kolom kanan: Assign To, Start Date, Due Date */}
          <div className="flex flex-col gap-4">
            <FormInput
              label={t("helpdesk.ticket.columns.assign_to")}
              name="assign_to"
              required
            >
              <AssignableLinkModel
                value={data.assign_to}
                onValueChange={(val) => setData("assign_to", val)}
              />
            </FormInput>

            <FormInput
              label={t("helpdesk.ticket.columns.start_date")}
              name="start_date"
              required
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
          </div>
        </div>
      </FormPageContent>

      {/* Grup 2: Subjek & Konten (digabung) */}
      {!defaultData && (
        <FormPageContent value="detail">
          <div className="flex flex-col gap-4">
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

            <FormInput
              label={t("helpdesk.ticket.columns.content")}
              name="content"
            >
              <TiptapEditor
                value={data.content_json ?? data.content}
                onValueChange={(json, html) => {
                  setData("content", html);
                  setData("content_json", json);
                }}
                imageUploadUrl={imageUploadUrl}
              />
            </FormInput>
          </div>
        </FormPageContent>
      )}
    </>
  );
}

export default Form;
