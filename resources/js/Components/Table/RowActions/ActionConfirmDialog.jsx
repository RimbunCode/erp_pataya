import { useEffect, useState } from "react";
import { useLaravelReactI18n } from "laravel-react-i18n";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/Components/ui/alert-dialog";
import { Button } from "@/Components/ui/button";
import FormInput from "@/Components/FormInput";
import PasswordInput from "@/Components/PasswordInput";

/**
 * Dialog konfirmasi untuk aksi baris/bulk.
 * Tombol konfirmasi adalah `Button` biasa (bukan `AlertDialogAction`) agar dialog
 * tidak menutup otomatis; parent yang mengatur `open` setelah request selesai.
 * @param {{
 *   open: boolean,
 *   title: string,
 *   description?: string,
 *   confirmLabel?: string,
 *   destructive?: boolean,
 *   requirePassword?: boolean,
 *   errors?: Record<string, string>,
 *   processing?: boolean,
 *   onConfirm: (password: string) => void,
 *   onOpenChange: (open: boolean) => void,
 * }} props
 */
export default function ActionConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  destructive = false,
  requirePassword = false,
  errors = {},
  processing = false,
  onConfirm,
  onOpenChange,
}) {
  const { t } = useLaravelReactI18n();
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!open) {
      setPassword("");
    }
  }, [open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm(password);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent forceAsDialog align="center">
        <form onSubmit={handleSubmit}>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            {description && (
              <AlertDialogDescription>{description}</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          {requirePassword && (
            <FormInput
              required
              label={t("auth.your_password")}
              className="mt-2 mb-4"
              error={errors.password}
            >
              <PasswordInput value={password} onValueChange={setPassword} />
            </FormInput>
          )}
          {(errors.delete || errors.ids) && (
            <div
              role="alert"
              className="mt-2 mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {errors.delete && <p>{errors.delete}</p>}
              {errors.ids && <p>{errors.ids}</p>}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>
              {t("core.datatable.cancel")}
            </AlertDialogCancel>
            <Button
              type="submit"
              variant={destructive ? "destructive" : "primary"}
              size="lg"
              className="p-2 md:size-fit"
              disabled={processing}
            >
              {confirmLabel ?? t("core.datatable.confirm")}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
