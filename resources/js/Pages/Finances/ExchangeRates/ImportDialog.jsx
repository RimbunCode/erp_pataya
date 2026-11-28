import { useState } from "react";
import { router } from "@inertiajs/react";
import { useLaravelReactI18n } from "laravel-react-i18n";

import InputError from "@/Components/InputError";
import { Button } from "@/Components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/Components/ui/dialog";
import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";

/**
 * Dialog impor kurs dari berkas CSV unggahan. Setelah impor, laporan per baris (flash `importReport` dari server)
 * ditampilkan di dalam dialog; baris valid tersimpan walau baris lain galat.
 * @param {object} props
 * @param {number} props.maxMb batas ukuran berkas (MB)
 * @param {string[]} props.columns kolom wajib header CSV
 * @param {() => void} props.onClose
 * @returns {import("react").JSX.Element}
 */
export default function ImportDialog({ maxMb, columns, onClose }) {
  const { t } = useLaravelReactI18n();
  const route = window.route;
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [report, setReport] = useState(null);
  const [processing, setProcessing] = useState(false);

  const submit = () => {
    if (!file) {
      return;
    }
    setError(null);
    setReport(null);
    router.post(
      route("exchangeRates.import"),
      { file },
      {
        forceFormData: true,
        preserveScroll: true,
        onStart: () => setProcessing(true),
        onFinish: () => setProcessing(false),
        onError: (bag) => setError(bag?.file ?? Object.values(bag ?? {})[0]),
        onSuccess: (page) =>
          setReport(page?.props?.flash?.importReport ?? null),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("finances.exchangeRate.page.import_title")}
          </DialogTitle>
          <DialogDescription>
            {t("finances.exchangeRate.page.import_description", {
              columns: (columns ?? []).join(", "),
              max: maxMb,
            })}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="exchange-rate-import-file">
            {t("finances.exchangeRate.page.import_file")}
          </Label>
          <Input
            id="exchange-rate-import-file"
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <InputError message={error} />
        </div>
        {report && (
          <section
            aria-label={t("finances.exchangeRate.page.import_report")}
            className="grid gap-2 text-sm"
          >
            <p className="font-medium">
              {t("finances.exchangeRate.page.import_summary", {
                created: report.created,
                updated: report.updated,
                unchanged: report.unchanged,
                errors: report.errorCount,
              })}
            </p>
            {report.errors?.length > 0 && (
              <ul className="max-h-60 overflow-y-auto rounded-md border p-2">
                {report.errors.map((item, index) => (
                  <li key={`${item.line}-${index}`}>
                    {item.line > 0 && (
                      <>
                        <span className="font-medium">
                          {t("finances.exchangeRate.page.import_line", {
                            line: item.line,
                          })}
                        </span>
                        :{" "}
                      </>
                    )}
                    {item.message}
                  </li>
                ))}
              </ul>
            )}
            {report.omittedErrors > 0 && (
              <p className="text-muted-foreground">
                {t("finances.exchangeRate.page.import_omitted", {
                  count: report.omittedErrors,
                })}
              </p>
            )}
          </section>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t("finances.exchangeRate.page.close")}
          </Button>
          <Button type="button" disabled={processing || !file} onClick={submit}>
            {t("finances.exchangeRate.page.import_submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
