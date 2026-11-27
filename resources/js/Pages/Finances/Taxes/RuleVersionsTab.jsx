import { useState } from "react";
import { router, usePage } from "@inertiajs/react";
import { useLaravelReactI18n } from "laravel-react-i18n";

import InputError from "@/Components/InputError";
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
import { Textarea } from "@/Components/ui/textarea";
import { FormPageContent } from "@/Pages/Core/FormPage";

const STATUS_VARIANT = {
  active: "default",
  draft: "secondary",
  retired: "outline",
};

const ROUNDING_MODES = ["per_line", "per_document"];

const FIELDS = [
  "effective_from",
  "effective_to",
  "rate",
  "dpp_numerator",
  "dpp_denominator",
  "rounding_mode",
  "output_role",
  "input_role",
  "notes",
];

/**
 * Nilai awal form versi. Versi baru memakai nilai versi terbaru sebagai titik awal (tanggal berlaku dikosongkan
 * agar diisi pengguna); faktor DPP awal berasal dari server (`ruleVersionDefaults`), bukan dari konstanta klien.
 * @param {object|null} source versi yang diubah, atau versi terbaru untuk versi baru
 * @param {object} defaults `ruleVersionDefaults` dari server
 * @param {boolean} isEdit
 * @param {number|string} [taxRate] tarif master pajak, dipakai bila belum ada versi
 * @returns {Record<string, string>}
 */
export function initialVersionValues(source, defaults, isEdit, taxRate) {
  const text = (value) =>
    value === null || value === undefined ? "" : String(value);

  return {
    effective_from: isEdit ? text(source?.effective_from) : "",
    effective_to: isEdit ? text(source?.effective_to) : "",
    rate: text(source?.rate ?? taxRate),
    dpp_numerator: text(source?.dpp_numerator ?? defaults?.dpp_numerator),
    dpp_denominator: text(source?.dpp_denominator ?? defaults?.dpp_denominator),
    rounding_mode: text(source?.rounding_mode ?? defaults?.rounding_mode),
    output_role: text(source?.output_role ?? defaults?.output_role),
    input_role: text(source?.input_role ?? defaults?.input_role),
    notes: isEdit ? text(source?.notes) : "",
  };
}

function Field({ id, label, error, children }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      <InputError message={error} />
    </div>
  );
}

/**
 * Dialog buat/ubah draft versi. Tidak memakai elemen `<form>`: halaman Pajak sudah berada di dalam form, dan
 * event submit dari portal akan naik ke form itu. Nilai tidak masuk ke data form Pajak.
 * @param {object} props
 * @param {string} props.taxId
 * @param {object|null} props.version versi yang diubah; null untuk versi baru
 * @param {Record<string, string>} props.initial
 * @param {() => void} props.onClose
 * @returns {import("react").JSX.Element}
 */
function VersionDialog({ taxId, version, initial, onClose }) {
  const { t } = useLaravelReactI18n();
  const route = window.route;
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [processing, setProcessing] = useState(false);
  const set = (name) => (event) =>
    setValues((previous) => ({ ...previous, [name]: event.target.value }));

  const submit = () => {
    const options = {
      preserveScroll: true,
      onStart: () => setProcessing(true),
      onFinish: () => setProcessing(false),
      onError: (bag) => setErrors(bag ?? {}),
      onSuccess: () => onClose(),
    };
    const payload = Object.fromEntries(
      FIELDS.map((name) => [name, values[name]]),
    );

    if (version) {
      router.put(
        route("taxRuleVersions.updateDraft", [taxId, version.id]),
        payload,
        options,
      );
    } else {
      router.post(route("taxRuleVersions.save", taxId), payload, options);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {version
              ? t("finances.taxRuleVersion.tab.form.edit_title", {
                  version: version.version,
                })
              : t("finances.taxRuleVersion.tab.form.new_title")}
          </DialogTitle>
          <DialogDescription>
            {t("finances.taxRuleVersion.tab.dpp_hint")}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="rule-version-from"
            label={t("finances.taxRuleVersion.columns.effective_from")}
            error={errors.effective_from}
          >
            <Input
              id="rule-version-from"
              type="date"
              value={values.effective_from}
              onChange={set("effective_from")}
            />
          </Field>
          <Field
            id="rule-version-to"
            label={t("finances.taxRuleVersion.columns.effective_to")}
            error={errors.effective_to}
          >
            <Input
              id="rule-version-to"
              type="date"
              value={values.effective_to}
              onChange={set("effective_to")}
            />
          </Field>
          <Field
            id="rule-version-rate"
            label={t("finances.taxRuleVersion.columns.rate")}
            error={errors.rate}
          >
            <Input
              id="rule-version-rate"
              type="number"
              min="0"
              max="100"
              step="any"
              value={values.rate}
              onChange={set("rate")}
            />
          </Field>
          <Field
            id="rule-version-rounding"
            label={t("finances.taxRuleVersion.columns.rounding_mode")}
            error={errors.rounding_mode}
          >
            <select
              id="rule-version-rounding"
              className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              value={values.rounding_mode}
              onChange={set("rounding_mode")}
            >
              {ROUNDING_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {t(
                    `finances.taxRuleVersion.columns.rounding_mode.options.${mode}`,
                  )}
                </option>
              ))}
            </select>
          </Field>
          <Field
            id="rule-version-numerator"
            label={t("finances.taxRuleVersion.columns.dpp_numerator")}
            error={errors.dpp_numerator}
          >
            <Input
              id="rule-version-numerator"
              type="number"
              min="1"
              max="65535"
              step="1"
              value={values.dpp_numerator}
              onChange={set("dpp_numerator")}
            />
          </Field>
          <Field
            id="rule-version-denominator"
            label={t("finances.taxRuleVersion.columns.dpp_denominator")}
            error={errors.dpp_denominator}
          >
            <Input
              id="rule-version-denominator"
              type="number"
              min="1"
              max="65535"
              step="1"
              value={values.dpp_denominator}
              onChange={set("dpp_denominator")}
            />
          </Field>
          <Field
            id="rule-version-output-role"
            label={t("finances.taxRuleVersion.columns.output_role")}
            error={errors.output_role}
          >
            <Input
              id="rule-version-output-role"
              value={values.output_role}
              onChange={set("output_role")}
            />
          </Field>
          <Field
            id="rule-version-input-role"
            label={t("finances.taxRuleVersion.columns.input_role")}
            error={errors.input_role}
          >
            <Input
              id="rule-version-input-role"
              value={values.input_role}
              onChange={set("input_role")}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field
              id="rule-version-notes"
              label={t("finances.taxRuleVersion.columns.notes")}
              error={errors.notes}
            >
              <Textarea
                id="rule-version-notes"
                value={values.notes}
                onChange={set("notes")}
              />
            </Field>
          </div>
        </div>
        <InputError message={errors.version} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t("finances.taxRuleVersion.tab.form.cancel")}
          </Button>
          <Button type="button" disabled={processing} onClick={submit}>
            {t("finances.taxRuleVersion.tab.form.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Konfirmasi aktivasi, pensiun, atau hapus draft. Galat domain (tumpang-tindih, faktor DPP terkunci) ditampilkan
 * di dalam dialog.
 * @param {object} props
 * @param {{action: "activate"|"retire"|"discard", version: object}|null} props.pending
 * @param {string} props.taxId
 * @param {() => void} props.onClose
 * @returns {import("react").JSX.Element}
 */
function ConfirmDialog({ pending, taxId, onClose }) {
  const { t } = useLaravelReactI18n();
  const route = window.route;
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);
  const { action, version } = pending;

  const confirm = () => {
    const url = route(
      action === "discard"
        ? "taxRuleVersions.discard"
        : `taxRuleVersions.${action}`,
      [taxId, version.id],
    );
    const options = {
      preserveScroll: true,
      onStart: () => setProcessing(true),
      onFinish: () => setProcessing(false),
      onError: (bag) => setError(bag?.version ?? Object.values(bag ?? {})[0]),
      onSuccess: () => onClose(),
    };

    if (action === "discard") {
      router.delete(url, options);
    } else {
      router.put(url, {}, options);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t(`finances.taxRuleVersion.tab.confirm.${action}.title`)}
          </DialogTitle>
          <DialogDescription>
            {t(`finances.taxRuleVersion.tab.confirm.${action}.description`, {
              version: version.version,
            })}
          </DialogDescription>
        </DialogHeader>
        <InputError message={error} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t("finances.taxRuleVersion.tab.confirm.cancel")}
          </Button>
          <Button
            type="button"
            variant={action === "discard" ? "destructive" : "default"}
            disabled={processing}
            onClick={confirm}
          >
            {t(`finances.taxRuleVersion.tab.confirm.${action}.confirm`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Tab "Versi Aturan" pada halaman master Pajak (Finance Fase 3, Requirement 2 dan 10.1): daftar versi, buat draft,
 * ubah draft, aktifkan, pensiunkan, dan hapus draft. Daftar dan izin berasal dari server (`ruleVersions`,
 * `canManageRuleVersions`); tombol aksi hanya tampil untuk pemegang izin, dan server tetap menegakkannya. Seluruh
 * aksi dikirim lewat route terpisah, tidak lewat data form Pajak.
 * @param {object} props
 * @param {string} props.taxId
 * @param {number|string} [props.taxRate] tarif master pajak (nilai awal bila belum ada versi)
 * @returns {import("react").JSX.Element|null}
 */
export default function RuleVersionsTab({ taxId, taxRate }) {
  const { t } = useLaravelReactI18n();
  const props = usePage().props;
  const versions = props.ruleVersions ?? [];
  const canManage = Boolean(props.canManageRuleVersions);
  const defaults = props.ruleVersionDefaults ?? {};
  const [dialog, setDialog] = useState(null);
  const [pending, setPending] = useState(null);

  if (!props.canViewRuleVersions) {
    return null;
  }

  const hasActive = versions.some((version) => version.status === "active");
  const closeDialog = () => setDialog(null);

  return (
    <FormPageContent
      title={t("finances.taxRuleVersion.tab.title")}
      value="ruleVersions"
    >
      <div className="grid gap-3">
        {!hasActive && (
          <p
            role="status"
            className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
          >
            {t("finances.taxRuleVersion.tab.no_active")}
          </p>
        )}
        {canManage && (
          <div>
            <Button
              type="button"
              size="sm"
              onClick={() =>
                setDialog({
                  version: null,
                  initial: initialVersionValues(
                    versions[0] ?? null,
                    defaults,
                    false,
                    taxRate,
                  ),
                })
              }
            >
              {t("finances.taxRuleVersion.tab.add")}
            </Button>
          </div>
        )}
        {versions.length === 0 ? (
          <p role="status" className="text-sm text-muted-foreground">
            {t("finances.taxRuleVersion.tab.empty")}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm" data-testid="rule-versions">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th scope="col" className="px-3 py-2">
                    {t("finances.taxRuleVersion.columns.version")}
                  </th>
                  <th scope="col" className="px-3 py-2">
                    {t("finances.taxRuleVersion.columns.status")}
                  </th>
                  <th scope="col" className="px-3 py-2">
                    {t("finances.taxRuleVersion.columns.effective_from")}
                  </th>
                  <th scope="col" className="px-3 py-2">
                    {t("finances.taxRuleVersion.columns.effective_to")}
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    {t("finances.taxRuleVersion.columns.rate")}
                  </th>
                  <th scope="col" className="px-3 py-2">
                    {t("finances.taxRuleVersion.columns.dpp_factor")}
                  </th>
                  <th scope="col" className="px-3 py-2">
                    {t("finances.taxRuleVersion.columns.rounding_mode")}
                  </th>
                  <th scope="col" className="px-3 py-2">
                    {t("finances.taxRuleVersion.tab.created_by")}
                  </th>
                  {canManage && <th scope="col" className="px-3 py-2" />}
                </tr>
              </thead>
              <tbody>
                {versions.map((version) => (
                  <tr
                    key={version.id}
                    data-testid="rule-version-row"
                    className="border-t"
                  >
                    <td className="px-3 py-2">{version.version}</td>
                    <td className="px-3 py-2">
                      <Badge
                        variant={STATUS_VARIANT[version.status] ?? "secondary"}
                      >
                        {t(
                          `finances.taxRuleVersion.columns.status.options.${version.status}`,
                        )}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">{version.effective_from}</td>
                    <td className="px-3 py-2">
                      {version.effective_to ??
                        t("finances.taxRuleVersion.open_ended")}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {version.rate}
                    </td>
                    <td className="px-3 py-2">
                      {version.dpp_numerator}/{version.dpp_denominator}
                    </td>
                    <td className="px-3 py-2">
                      {t(
                        `finances.taxRuleVersion.columns.rounding_mode.options.${version.rounding_mode}`,
                      )}
                    </td>
                    <td className="px-3 py-2">{version.created_by ?? ""}</td>
                    {canManage && (
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap justify-end gap-2">
                          {version.status === "draft" && (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setDialog({
                                    version,
                                    initial: initialVersionValues(
                                      version,
                                      defaults,
                                      true,
                                      taxRate,
                                    ),
                                  })
                                }
                              >
                                {t("finances.taxRuleVersion.tab.actions.edit")}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() =>
                                  setPending({ action: "activate", version })
                                }
                              >
                                {t(
                                  "finances.taxRuleVersion.tab.actions.activate",
                                )}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                onClick={() =>
                                  setPending({ action: "discard", version })
                                }
                              >
                                {t(
                                  "finances.taxRuleVersion.tab.actions.discard",
                                )}
                              </Button>
                            </>
                          )}
                          {version.status === "active" && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setPending({ action: "retire", version })
                              }
                            >
                              {t("finances.taxRuleVersion.tab.actions.retire")}
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {t("finances.taxRuleVersion.tab.read_only_notes")}
        </p>
      </div>
      {dialog && (
        <VersionDialog
          key={dialog.version?.id ?? "new"}
          taxId={taxId}
          version={dialog.version}
          initial={dialog.initial}
          onClose={closeDialog}
        />
      )}
      {pending && (
        <ConfirmDialog
          key={`${pending.action}-${pending.version.id}`}
          pending={pending}
          taxId={taxId}
          onClose={() => setPending(null)}
        />
      )}
    </FormPageContent>
  );
}
