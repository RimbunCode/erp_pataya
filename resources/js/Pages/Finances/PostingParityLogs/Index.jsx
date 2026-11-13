import { useState } from "react";
import { Head, router, useForm, usePage } from "@inertiajs/react";
import { useLaravelReactI18n } from "laravel-react-i18n";

import AppLayout from "@/Layouts/AppLayout";
import { Badge } from "@/Components/ui/badge";
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

const SELECT_CLASS =
  "h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs";

const STATUS_VARIANT = {
  match: "default",
  rounding: "secondary",
  config_diff: "secondary",
  mismatch: "destructive",
  engine_error: "destructive",
};

/**
 * Dialog konfirmasi eksplisit saat memilih mode `on`: engine menjadi penulis jurnal. Tombol aktifkan baru terbuka
 * setelah kotak persetujuan dicentang; server juga menolak `on` tanpa `confirmed` (Requirement 6.8).
 * @param {object} props
 * @param {string|null} props.documentType jenis dokumen yang akan diaktifkan, null bila tertutup
 * @param {() => void} props.onClose
 * @param {(documentType: string) => void} props.onConfirm
 * @returns {import("react").JSX.Element}
 */
function ConfirmOnDialog({ documentType, onClose, onConfirm }) {
  const { t } = useLaravelReactI18n();
  const [checked, setChecked] = useState(false);
  const label = documentType
    ? t(
        `finances.postingParityLog.columns.document_type.options.${documentType}`,
      )
    : "";

  const close = () => {
    setChecked(false);
    onClose();
  };

  return (
    <Dialog
      open={documentType !== null}
      onOpenChange={(open) => !open && close()}
    >
      <DialogContent>
        {documentType && (
          <>
            <DialogHeader>
              <DialogTitle>
                {t("finances.postingParityLog.mode.confirm.title", {
                  document_type: label,
                })}
              </DialogTitle>
              <DialogDescription>
                {t("finances.postingParityLog.mode.confirm.description")}
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-start gap-2">
              <input
                id="confirm-mode-on"
                type="checkbox"
                className="mt-1 size-4"
                checked={checked}
                onChange={(event) => setChecked(event.target.checked)}
              />
              <Label htmlFor="confirm-mode-on" className="font-normal">
                {t("finances.postingParityLog.mode.confirm.checkbox")}
              </Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>
                {t("finances.postingParityLog.mode.confirm.cancel")}
              </Button>
              <Button
                type="button"
                disabled={!checked}
                onClick={() => {
                  setChecked(false);
                  onConfirm(documentType);
                }}
              >
                {t("finances.postingParityLog.mode.confirm.confirm")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Halaman Parity Log dan kontrol mode engine (Finance Fase 2, Requirement 8.3): filter jenis dokumen/status/tanggal
 * dan perubahan mode off/shadow/on per jenis dokumen. Kontrol ubah mode hanya dirender bagi pengguna ber-izin
 * `switch_posting_mode` (`canSwitchMode`); server tetap menolak tanpa izin. Memilih `on` meminta konfirmasi.
 * @param {object} props
 * @param {object} [props.logs] paginator Laravel
 * @param {{document_type: string, status: string, date_from: string, date_to: string}} [props.filters]
 * @param {string[]} [props.documentTypes]
 * @param {string[]} [props.statuses]
 * @param {Record<string, string>} [props.modes]
 * @param {string[]} [props.modeOptions]
 * @param {boolean} [props.canSwitchMode]
 * @returns {import("react").JSX.Element}
 */
export default function Index({
  logs = { data: [], total: 0 },
  filters = {},
  documentTypes = [],
  statuses = [],
  modes = {},
  modeOptions = ["off", "shadow", "on"],
  canSwitchMode = false,
}) {
  const { t, currentLocale } = useLaravelReactI18n();
  const route = window.route;
  const pageErrors = Object.values(usePage()?.props?.errors ?? {});
  const [confirmType, setConfirmType] = useState(null);
  const [openDiff, setOpenDiff] = useState(null);
  const filterForm = useForm({
    document_type: filters.document_type ?? "",
    status: filters.status ?? "",
    date_from: filters.date_from ?? "",
    date_to: filters.date_to ?? "",
  });

  const title = t("finances.postingParityLog.title");
  const docLabel = (type) =>
    t(`finances.postingParityLog.columns.document_type.options.${type}`);

  const applyFilters = (event) => {
    event.preventDefault();
    const query = Object.fromEntries(
      Object.entries(filterForm.data).filter(([, value]) => value !== ""),
    );
    router.get(route("postingParityLogs.index"), query, {
      preserveState: true,
      preserveScroll: true,
    });
  };

  const resetFilters = () => {
    filterForm.setData({
      document_type: "",
      status: "",
      date_from: "",
      date_to: "",
    });
    router.get(
      route("postingParityLogs.index"),
      {},
      { preserveState: true, preserveScroll: true },
    );
  };

  const switchMode = (type, mode, confirmed = false) => {
    router.put(
      route("postingParityLogs.switchMode", type),
      confirmed ? { mode, confirmed: true } : { mode },
      { preserveScroll: true },
    );
  };

  const chooseMode = (type, mode) => {
    if (mode === (modes[type] ?? "off")) {
      return;
    }
    if (mode === "on") {
      setConfirmType(type);

      return;
    }
    switchMode(type, mode);
  };

  const formatDate = (value) => {
    if (!value) {
      return "";
    }
    try {
      return new Date(value).toLocaleString(currentLocale?.());
    } catch {
      return value;
    }
  };

  return (
    <AppLayout>
      <Head title={title} />
      <div className="grid gap-6 pt-4">
        <h1 className="text-xl font-bold">{title}</h1>

        {pageErrors.length > 0 && (
          <div
            role="alert"
            data-testid="page-errors"
            className="grid gap-1 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {pageErrors.map((message) => (
              <span key={message}>{message}</span>
            ))}
          </div>
        )}

        <section
          className="grid gap-3 rounded-md border p-4"
          data-testid="mode-section"
        >
          <div className="grid gap-1">
            <h2 className="text-base font-semibold">
              {t("finances.postingParityLog.mode.title")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("finances.postingParityLog.mode.description")}
            </p>
            {!canSwitchMode && (
              <p className="text-xs text-muted-foreground">
                {t("finances.postingParityLog.mode.read_only")}
              </p>
            )}
          </div>
          <ul className="grid gap-2">
            {documentTypes.map((type) => {
              const current = modes[type] ?? "off";

              return (
                <li
                  key={type}
                  className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 first:border-t-0 first:pt-0"
                  data-testid="mode-row"
                  data-document-type={type}
                >
                  <span className="text-sm font-medium">{docLabel(type)}</span>
                  {canSwitchMode ? (
                    <div
                      role="group"
                      aria-label={t("finances.postingParityLog.mode.change", {
                        document_type: docLabel(type),
                      })}
                      className="flex gap-1"
                    >
                      {modeOptions.map((mode) => (
                        <Button
                          key={mode}
                          type="button"
                          size="sm"
                          variant={current === mode ? "default" : "outline"}
                          aria-pressed={current === mode}
                          onClick={() => chooseMode(type, mode)}
                        >
                          {t(`finances.postingParityLog.mode.options.${mode}`)}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <Badge variant={current === "on" ? "default" : "secondary"}>
                      {t(`finances.postingParityLog.mode.options.${current}`)}
                    </Badge>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <form
          onSubmit={applyFilters}
          className="flex flex-wrap items-end gap-3 rounded-md border p-4"
          data-testid="filter-form"
        >
          <div className="grid gap-2">
            <Label htmlFor="filter-document-type">
              {t("finances.postingParityLog.filters.document_type")}
            </Label>
            <select
              id="filter-document-type"
              className={SELECT_CLASS}
              value={filterForm.data.document_type}
              onChange={(event) =>
                filterForm.setData("document_type", event.target.value)
              }
            >
              <option value="">
                {t("finances.postingParityLog.filters.all")}
              </option>
              {documentTypes.map((type) => (
                <option key={type} value={type}>
                  {docLabel(type)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="filter-status">
              {t("finances.postingParityLog.filters.status")}
            </Label>
            <select
              id="filter-status"
              className={SELECT_CLASS}
              value={filterForm.data.status}
              onChange={(event) =>
                filterForm.setData("status", event.target.value)
              }
            >
              <option value="">
                {t("finances.postingParityLog.filters.all")}
              </option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {t(
                    `finances.postingParityLog.columns.status.options.${status}`,
                  )}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="filter-date-from">
              {t("finances.postingParityLog.filters.date_from")}
            </Label>
            <Input
              id="filter-date-from"
              type="date"
              className="w-40"
              value={filterForm.data.date_from}
              onChange={(event) =>
                filterForm.setData("date_from", event.target.value)
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="filter-date-to">
              {t("finances.postingParityLog.filters.date_to")}
            </Label>
            <Input
              id="filter-date-to"
              type="date"
              className="w-40"
              value={filterForm.data.date_to}
              onChange={(event) =>
                filterForm.setData("date_to", event.target.value)
              }
            />
          </div>
          <Button type="submit">
            {t("finances.postingParityLog.filters.apply")}
          </Button>
          <Button type="button" variant="outline" onClick={resetFilters}>
            {t("finances.postingParityLog.filters.reset")}
          </Button>
        </form>

        <section className="grid gap-2">
          <p className="text-sm text-muted-foreground">
            {t("finances.postingParityLog.list.total", {
              count: logs.total ?? logs.data.length,
            })}
          </p>
          {logs.data.length === 0 ? (
            <p
              className="text-sm text-muted-foreground"
              data-testid="empty-state"
            >
              {t("finances.postingParityLog.list.empty")}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-2">
                      {t("finances.postingParityLog.columns.document_type")}
                    </th>
                    <th className="px-3 py-2">
                      {t("finances.postingParityLog.columns.status")}
                    </th>
                    <th className="px-3 py-2">
                      {t("finances.postingParityLog.columns.source_type")}
                    </th>
                    <th className="px-3 py-2">
                      {t("finances.postingParityLog.columns.source_id")}
                    </th>
                    <th className="px-3 py-2">
                      {t("finances.postingParityLog.columns.created_at")}
                    </th>
                    <th className="px-3 py-2">
                      <span className="sr-only">
                        {t("finances.postingParityLog.columns.diff")}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {logs.data.map((log) => {
                    const hasDiff =
                      log.diff && Object.keys(log.diff).length > 0;

                    return (
                      <tr
                        key={log.id}
                        className="border-t align-top"
                        data-testid="parity-log"
                      >
                        <td className="px-3 py-2">
                          {docLabel(log.document_type)}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={STATUS_VARIANT[log.status]}>
                            {t(
                              `finances.postingParityLog.columns.status.options.${log.status}`,
                            )}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">{log.source_type}</td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {log.source_id}
                        </td>
                        <td className="px-3 py-2">
                          {formatDate(log.created_at)}
                        </td>
                        <td className="px-3 py-2">
                          {hasDiff && (
                            <div className="grid gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setOpenDiff(
                                    openDiff === log.id ? null : log.id,
                                  )
                                }
                              >
                                {openDiff === log.id
                                  ? t(
                                      "finances.postingParityLog.list.hide_diff",
                                    )
                                  : t(
                                      "finances.postingParityLog.list.show_diff",
                                    )}
                              </Button>
                              {openDiff === log.id && (
                                <pre className="max-w-xl overflow-x-auto rounded bg-muted p-2 text-xs">
                                  {JSON.stringify(log.diff, null, 2)}
                                </pre>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {(logs.prev_page_url || logs.next_page_url) && (
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!logs.prev_page_url}
                aria-label={t("finances.postingParityLog.list.previous")}
                onClick={() => router.get(logs.prev_page_url)}
              >
                &laquo;
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!logs.next_page_url}
                aria-label={t("finances.postingParityLog.list.next")}
                onClick={() => router.get(logs.next_page_url)}
              >
                &raquo;
              </Button>
            </div>
          )}
        </section>
      </div>

      <ConfirmOnDialog
        documentType={confirmType}
        onClose={() => setConfirmType(null)}
        onConfirm={(type) => {
          setConfirmType(null);
          switchMode(type, "on", true);
        }}
      />
    </AppLayout>
  );
}
