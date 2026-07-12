import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/Components/ui/button";
import DatetimePicker from "@/Components/DatetimePicker";
import FormInput from "@/Components/FormInput";
import { FormPageContent } from "@/Pages/Core/FormPage";
import { Input } from "@/Components/ui/input";
import Select from "@/Components/Select";
import { Textarea } from "@/Components/ui/textarea";
import UserLinkModel from "@/Pages/Users/ManageUsers/UserLinkModel";
import { generateRandom } from "@/lib/utils";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function LeadActivities({ value, onValueChange, readOnly }) {
  const { t } = useLaravelReactI18n();
  const activities = value ?? [];

  const updateActivity = (index, patch) => {
    const next = activities.map((activity, i) =>
      i === index ? { ...activity, ...patch } : activity,
    );
    onValueChange(next);
  };

  const addActivity = () => {
    onValueChange([
      ...activities,
      {
        id: generateRandom(8),
        type: "task",
        status: "open",
      },
    ]);
  };

  const removeActivity = (index) => {
    onValueChange(activities.filter((_, i) => i !== index));
  };

  return (
    <FormPageContent value="activity" title={t("crm.lead_activity.title")}>
      <div className="flex flex-col gap-y-4">
        {activities.map((activity, index) => (
          <div
            key={activity.id ?? index}
            className="relative flex flex-col gap-y-4 p-4 border rounded-md"
          >
            {!readOnly && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 size-7"
                onClick={() => removeActivity(index)}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
            <div className="grid gap-x-4 gap-y-4 pr-10 md:grid-cols-3">
              <FormInput
                label={t("crm.lead_activity.columns.type")}
                required={true}
              >
                <Select
                  value={activity.type}
                  onValueChange={(val) => updateActivity(index, { type: val })}
                  placeholder={t("crm.lead_activity.columns.type.placeholder")}
                  optionTrans="crm.lead_activity.columns.type.options"
                  defaultValue="task"
                  options={["task", "call", "meeting", "email"]}
                  disabled={readOnly}
                />
              </FormInput>
              <FormInput
                label={t("crm.lead_activity.columns.subject")}
                required={true}
                className="md:col-span-2"
              >
                <Input
                  value={activity.subject ?? ""}
                  onChange={(e) =>
                    updateActivity(index, { subject: e.target.value })
                  }
                  disabled={readOnly}
                />
              </FormInput>
              <FormInput label={t("crm.lead_activity.columns.scheduled_at")}>
                <DatetimePicker
                  type="datetime"
                  value={activity.scheduled_at}
                  onValueChange={(val) =>
                    updateActivity(index, { scheduled_at: val })
                  }
                  disabled={readOnly}
                />
              </FormInput>
              <FormInput
                label={t("crm.lead_activity.columns.status")}
                required={true}
              >
                <Select
                  value={activity.status}
                  onValueChange={(val) =>
                    updateActivity(index, { status: val })
                  }
                  placeholder={t(
                    "crm.lead_activity.columns.status.placeholder",
                  )}
                  optionTrans="crm.lead_activity.columns.status.options"
                  defaultValue="open"
                  options={["open", "closed"]}
                  disabled={readOnly}
                />
              </FormInput>
              <FormInput label={t("crm.lead_activity.columns.assigned_to")}>
                <UserLinkModel
                  value={activity.assigned_to}
                  onValueChange={(val) =>
                    updateActivity(index, { assigned_to: val })
                  }
                  placeholder={t(
                    "crm.lead_activity.columns.assigned_to.placeholder",
                  )}
                  disabled={readOnly}
                />
              </FormInput>
              <FormInput
                label={t("crm.lead_activity.columns.description")}
                className="md:col-span-3"
              >
                <Textarea
                  value={activity.description ?? ""}
                  onChange={(e) =>
                    updateActivity(index, { description: e.target.value })
                  }
                  disabled={readOnly}
                />
              </FormInput>
            </div>
          </div>
        ))}
        {!readOnly && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={addActivity}
          >
            <Plus className="size-4" />
            {t("crm.lead_activity.add")}
          </Button>
        )}
      </div>
    </FormPageContent>
  );
}
