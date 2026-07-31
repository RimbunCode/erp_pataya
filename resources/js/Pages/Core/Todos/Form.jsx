import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/Components/ui/alert-dialog";
import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";
import React, { useEffect, useState } from "react";

import AssignedToFields from "./AssignedToFields";
import { useLaravelReactI18n } from "laravel-react-i18n";

function Form() {
  const route = window.route;
  const { t } = useLaravelReactI18n();
  const { data, setData, errors, form } = useFormPage({
    type: "task",
    priority: "medium",
    status: "open",
    reminder_lead_days: [],
  });
  const [confirmReassignOpen, setConfirmReassignOpen] = useState(false);

  // Server menolak allocated_to kosong dengan pesan konfirmasi khusus
  // (lihat TodoService::update) — dibedakan dari error validasi biasa
  // dengan mencocokkan teks pesan, karena ValidationException tidak
  // membawa kode error terstruktur.
  useEffect(() => {
    if (errors?.allocated_to === t("core.todo.confirm.reassign_to_self")) {
      setConfirmReassignOpen(true);
    }
  }, [errors?.allocated_to, t]);

  const handleConfirmReassign = () => {
    setConfirmReassignOpen(false);
    form.transform((payload) => ({ ...payload, confirm_reassign: true }));
    form.put(route("todos.update", data.id));
  };

  return (
    <FormPageContent value="detail">
      <AssignedToFields value={data} onChange={setData} layout="grid" />

      <AlertDialog
        open={confirmReassignOpen}
        onOpenChange={setConfirmReassignOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("core.todo.confirm.reassign_to_self")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("core.todo.confirm.reassign_to_self_description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("core.form.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReassign}>
              {t("core.form.submit")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </FormPageContent>
  );
}

export default Form;
