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
import React, { useEffect, useState } from "react";
import { router, usePage } from "@inertiajs/react";

import FormInput from "@/Components/FormInput";
import PasswordInput from "@/Components/PasswordInput";
import useDeleteModal from "@/Hooks/useDeleteModal";
import { useLaravelReactI18n } from "laravel-react-i18n";

function DeleteDialog() {
  const route = window.route;
  const { t } = useLaravelReactI18n();
  const { translateKey } = usePage().props;
  const {
    isOpen: isOpenDeleteDialog,
    close: closeDeleteDialog,
    route: deleteRoute,
    id: deleteId,
    attributes: deleteAttributes,
  } = useDeleteModal();
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!isOpenDeleteDialog) {
      setPassword("");
    }
  }, [isOpenDeleteDialog]);

  const onDelete = (e) => {
    e.preventDefault();

    if (!deleteRoute || deleteId == null) {
      return;
    }

    const payload = deleteAttributes?.usePasswordConfirmation
      ? { password }
      : {};

    router.delete(route(deleteRoute, deleteId), {
      data: payload,
      onSuccess: () => {
        closeDeleteDialog();
      },
    });
  };

  function handleKeyDown(e) {
    if (e.key === "Escape") {
      closeDeleteDialog();
    }
  }

  const dialogForm = (
    <form onSubmit={onDelete}>
      <AlertDialogHeader>
        <AlertDialogTitle>{t(`${translateKey}.delete`)}</AlertDialogTitle>
        <AlertDialogDescription>
          {t(`${translateKey}.delete.description`)}
        </AlertDialogDescription>
      </AlertDialogHeader>
      {deleteAttributes?.usePasswordConfirmation && (
        <FormInput
          required
          label={t("auth.your_password")}
          className="mt-2 mb-4"
        >
          <PasswordInput value={password} onValueChange={setPassword} />
        </FormInput>
      )}
      <AlertDialogFooter>
        <AlertDialogCancel onClick={closeDeleteDialog}>
          {t("core.form.leave.cancel")}
        </AlertDialogCancel>
        <AlertDialogAction type="submit">
          {t(`${translateKey}.delete.confirm`)}
        </AlertDialogAction>
      </AlertDialogFooter>
    </form>
  );

  return (
    <AlertDialog
      open={isOpenDeleteDialog}
      onOpenChange={(v) => {
        if (!v) {
          closeDeleteDialog();
        }
      }}
    >
      <AlertDialogContent
        forceAsDialog
        align="center"
        onKeyDown={handleKeyDown}
      >
        {dialogForm}
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default DeleteDialog;
