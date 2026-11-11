import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/Components/ui/dialog";

import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import InputError from "@/Components/InputError";
import { Label } from "@/Components/ui/label";
import { Textarea } from "@/Components/ui/textarea";
import { useForm } from "@inertiajs/react";
import { useLaravelReactI18n } from "laravel-react-i18n";

function today() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Dialog Balik (reverse) jurnal (Requirement 11.2): meminta tanggal dan alasan,
 * lalu `POST journals.reverse`. Kesalahan server (periode tertutup, jurnal
 * sudah dibalik) muncul sebagai pesan validasi pada field `date` / `reverse`.
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {{id: string, code: string}} props.journal
 * @returns {import("react").JSX.Element}
 */
export default function ReverseJournalDialog({ open, onOpenChange, journal }) {
  const { t } = useLaravelReactI18n();
  const route = window.route;
  const form = useForm({ date: today(), reason: "" });

  const submit = (event) => {
    event.preventDefault();
    form.post(route("journals.reverse", journal.id), {
      preserveScroll: true,
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t("finances.journal.reverse.title")}</DialogTitle>
            <DialogDescription>
              {t("finances.journal.reverse.description", {
                code: journal.code,
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="journal-reverse-date">
              {t("finances.journal.reverse.date")}
            </Label>
            <Input
              id="journal-reverse-date"
              type="date"
              value={form.data.date}
              onChange={(event) => form.setData("date", event.target.value)}
            />
            <InputError message={form.errors.date} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="journal-reverse-reason">
              {t("finances.journal.reverse.reason")}
            </Label>
            <Textarea
              id="journal-reverse-reason"
              value={form.data.reason}
              placeholder={t("finances.journal.reverse.reason_placeholder")}
              onChange={(event) => form.setData("reason", event.target.value)}
            />
            <InputError message={form.errors.reason} />
          </div>

          <InputError message={form.errors.reverse} role="alert" />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("finances.journal.reverse.cancel")}
            </Button>
            <Button type="submit" disabled={form.processing}>
              {t("finances.journal.reverse.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
