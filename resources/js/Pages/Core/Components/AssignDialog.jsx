import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/Components/ui/dialog";
import React, { useEffect, useState } from "react";

import AssignedToFields from "@/Pages/Core/Todos/AssignedToFields";
import { Button } from "@/Components/ui/button";
import { useLaravelReactI18n } from "laravel-react-i18n";

const DEFAULT_VALUE = {
  allocated_to: null,
  type: "task",
  priority: "medium",
  date: null,
  due_date: null,
  reminder_lead_days: [],
  description: null,
};

function AssignDialog({
  initialValue,
  activeAssigneeIds = [],
  onSubmit,
  onClose,
}) {
  const { t } = useLaravelReactI18n();
  const [value, setValue] = useState(initialValue ?? DEFAULT_VALUE);

  useEffect(() => {
    setValue(initialValue ?? DEFAULT_VALUE);
  }, [initialValue]);

  const handleChange = (key, val) =>
    setValue((prev) => ({ ...prev, [key]: val }));

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{t("core.form.assigned_to")}</DialogTitle>
      </DialogHeader>
      <AssignedToFields
        value={value}
        onChange={handleChange}
        layout="grid"
        disableStatus
        excludeAssigneeIds={activeAssigneeIds.filter(
          (id) => id !== value.allocated_to?.id,
        )}
      />
      <DialogFooter>
        <Button variant="secondary" onClick={onClose}>
          {t("core.form.cancel")}
        </Button>
        <Button onClick={() => onSubmit(value)}>{t("core.form.assign")}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

export default AssignDialog;
