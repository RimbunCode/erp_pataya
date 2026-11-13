import { useState } from "react";
import { Head, router, useForm, usePage } from "@inertiajs/react";
import { TriangleAlert } from "lucide-react";
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
import InputError from "@/Components/InputError";
import { Label } from "@/Components/ui/label";
import { Textarea } from "@/Components/ui/textarea";
import Link from "@/Components/Link";
import AccountLinkModel from "@/Pages/Finances/Accounts/AccountLinkModel";

// Akun grup dan akun nonaktif tidak dapat dipakai sebagai akun default (Requirement 2.3, 8.1); AccountLinkModel
// sudah menyaring akun nonaktif.
const ACCOUNT_FILTERS = { is_group: false };

const STATUS_VARIANT = {
  active: "default",
  draft: "secondary",
  retired: "outline",
};

const accountLabel = (account) =>
  account ? `${account.account_number ?? ""} - ${account.account_name}` : "";

/**
 * Dialog konfirmasi aksi profil (aktifkan, pensiunkan, hapus draft).
 * @param {object} props
 * @param {"activate"|"retire"|"discard"|null} props.action
 * @param {string} props.name
 * @param {() => void} props.onClose
 * @param {(action: string) => void} props.onConfirm
 * @returns {import("react").JSX.Element}
 */
function ConfirmDialog({ action, name, onClose, onConfirm }) {
  const { t } = useLaravelReactI18n();

  return (
    <Dialog open={action !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {action && (
          <>
            <DialogHeader>
              <DialogTitle>
                {t(`finances.postingProfile.confirm.${action}.title`)}
              </DialogTitle>
              <DialogDescription>
                {t(`finances.postingProfile.confirm.${action}.description`, {
                  name,
                })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                {t("finances.postingProfile.confirm.cancel")}
              </Button>
              <Button
                type="button"
                variant={action === "discard" ? "destructive" : "default"}
                onClick={() => onConfirm(action)}
              >
                {t(`finances.postingProfile.confirm.${action}.confirm`)}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Dialog "Buat versi baru" (salin): tanggal berlaku wajib; kontinuitas dengan profil lama diperiksa server saat
 * aktivasi (Requirement 2.4).
 * @param {object} props
 * @param {boolean} props.open
 * @param {string} props.profileId
 * @param {string} props.defaultFrom
 * @param {() => void} props.onClose
 * @returns {import("react").JSX.Element}
 */
function NewVersionDialog({ open, profileId, defaultFrom, onClose }) {
  const { t } = useLaravelReactI18n();
  const route = window.route;
  const form = useForm({
    effective_from: defaultFrom ?? "",
    effective_to: "",
    name: "",
  });

  const submit = (event) => {
    event.preventDefault();
    form.post(route("postingProfiles.newVersion", profileId), {
      preserveScroll: true,
      preserveState: false,
      onSuccess: () => onClose(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>
              {t("finances.postingProfile.new_version.title")}
            </DialogTitle>
            <DialogDescription>
              {t("finances.postingProfile.new_version.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="new-version-from">
              {t("finances.postingProfile.new_version.effective_from")}
            </Label>
            <Input
              id="new-version-from"
              type="date"
              value={form.data.effective_from}
              onChange={(event) =>
                form.setData("effective_from", event.target.value)
              }
            />
            <InputError message={form.errors.effective_from} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-version-to">
              {t("finances.postingProfile.new_version.effective_to")}
            </Label>
            <Input
              id="new-version-to"
              type="date"
              value={form.data.effective_to}
              onChange={(event) =>
                form.setData("effective_to", event.target.value)
              }
            />
            <InputError message={form.errors.effective_to} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-version-name">
              {t("finances.postingProfile.new_version.name")}
            </Label>
            <Input
              id="new-version-name"
              value={form.data.name}
              onChange={(event) => form.setData("name", event.target.value)}
            />
            <InputError message={form.errors.name} />
          </div>
          <InputError message={form.errors.profile} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("finances.postingProfile.new_version.cancel")}
            </Button>
            <Button type="submit" disabled={form.processing}>
              {t("finances.postingProfile.new_version.confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Aturan akun bersyarat, baca-saja (editor adalah Task 12.2).
 * @param {object} props
 * @param {object[]} props.rules
 * @param {{value: string, label: string}[]} props.roles
 * @returns {import("react").JSX.Element}
 */
function RulesTable({ rules, roles }) {
  const { t } = useLaravelReactI18n();
  const any = t("finances.postingProfile.form.any");
  const roleLabel = (value) =>
    roles.find((role) => role.value === value)?.label ?? value;
  const yesNo = (value) =>
    value === null || value === undefined
      ? any
      : t(`finances.postingProfile.form.${value ? "yes" : "no"}`);

  return (
    <section className="grid gap-2" data-testid="rules-section">
      <h2 className="text-base font-semibold">
        {t("finances.postingProfile.rules")}
      </h2>
      <p className="text-sm text-muted-foreground">
        {t("finances.postingProfile.form.rules_read_only")}
      </p>
      {rules.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("finances.postingProfile.form.rules_empty")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                {[
                  "role",
                  "document_type",
                  "variant",
                  "item_type",
                  "is_stock_item",
                  "item_category",
                  "account",
                  "priority",
                ].map((column) => (
                  <th key={column} className="px-3 py-2">
                    {t(`finances.postingProfile.columns.${column}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-t" data-testid="rule-row">
                  <td className="px-3 py-2">{roleLabel(rule.role)}</td>
                  <td className="px-3 py-2">
                    {rule.document_type
                      ? t(
                          `finances.postingParityLog.columns.document_type.options.${rule.document_type}`,
                        )
                      : any}
                  </td>
                  <td className="px-3 py-2">
                    {rule.variant
                      ? t(
                          `finances.postingProfile.columns.variant.options.${rule.variant}`,
                        )
                      : any}
                  </td>
                  <td className="px-3 py-2">{rule.item_type ?? any}</td>
                  <td className="px-3 py-2">{yesNo(rule.is_stock_item)}</td>
                  <td className="px-3 py-2">{rule.category ?? any}</td>
                  <td className="px-3 py-2">{accountLabel(rule.account)}</td>
                  <td className="px-3 py-2">{rule.priority}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/**
 * Form Posting Profile (Finance Fase 2, Requirement 8.1-8.2): detail profil, tabel peran => akun default, peringatan
 * peran wajib belum terpetakan, dan aksi buat versi baru / aktifkan / pensiunkan / hapus draft. Hanya profil `draft`
 * (atau profil baru) yang dapat diubah; profil aktif/pensiun baca-saja karena perubahan dilakukan lewat versi baru.
 * Tidak ada cakupan cabang (profil global).
 * @param {object} props
 * @param {object|null} [props.profile] null untuk profil baru
 * @param {{value: string, label: string, line_sensitive: boolean, master: boolean}[]} [props.roles]
 * @param {{document_type: string, roles: string[]}[]} [props.unmapped]
 * @param {boolean} [props.canWrite]
 * @param {boolean} [props.canActivate]
 * @param {string} [props.defaultFrom]
 * @returns {import("react").JSX.Element}
 */
function FormContent({
  profile = null,
  roles = [],
  unmapped = [],
  canWrite = false,
  canActivate = false,
  defaultFrom = "",
}) {
  const { t } = useLaravelReactI18n();
  const route = window.route;
  const page = usePage();
  const flash = page?.props?.flash ?? {};
  const pageErrors = page?.props?.errors ?? {};

  const isNew = profile === null;
  const isDraft = profile?.status === "draft";
  const editable = canWrite && (isNew || isDraft);

  const [selected, setSelected] = useState(() => profile?.accounts ?? {});
  const [confirmAction, setConfirmAction] = useState(null);
  const [versionOpen, setVersionOpen] = useState(false);

  const form = useForm({
    name: profile?.name ?? "",
    effective_from: profile?.effective_from ?? defaultFrom,
    effective_to: profile?.effective_to ?? "",
    notes: profile?.notes ?? "",
    accounts: Object.fromEntries(
      Object.entries(profile?.accounts ?? {}).map(([role, account]) => [
        role,
        account?.id ?? null,
      ]),
    ),
  });

  const title = isNew
    ? t("finances.postingProfile.new")
    : profile.name || t("finances.postingProfile.name");
  const roleLabel = (value) =>
    roles.find((role) => role.value === value)?.label ?? value;

  const pickAccount = (role, account) => {
    // Pertahanan berlapis: LinkModel memanggil onValueChange(null) sendiri bila nilai awal tidak lolos validasi
    // `thisModel` (nilai tanpa `thisModel`). Nilai awal yang tidak dikenali LinkModel tidak boleh menghapus pemetaan yang sudah tersimpan.
    // Batasan yang disadari: nilai tanpa `thisModel` tidak dapat dikosongkan lewat UI. Controller selalu mengirim
    // `thisModel`, jadi kasus ini hanya terjadi pada data rusak dan lebih aman dipertahankan daripada dihapus.
    const existing = selected[role];
    if (account === null && existing && !existing.thisModel) {
      return;
    }
    setSelected((current) => ({ ...current, [role]: account ?? null }));
    form.setData("accounts", {
      ...form.data.accounts,
      [role]: account?.id ?? null,
    });
  };

  const submit = (event) => {
    event.preventDefault();
    if (isNew) {
      form.post(route("postingProfiles.save"));
    } else {
      form.put(route("postingProfiles.update", profile.id), {
        preserveScroll: true,
      });
    }
  };

  const runAction = (action) => {
    setConfirmAction(null);
    const options = { preserveScroll: true };
    if (action === "activate") {
      router.put(route("postingProfiles.activate", profile.id), {}, options);
    } else if (action === "retire") {
      router.put(route("postingProfiles.retire", profile.id), {}, options);
    } else {
      router.delete(route("postingProfiles.discard", profile.id), options);
    }
  };

  const errorMessage = pageErrors.profile ?? form.errors.profile;
  const retireWarnings = flash.retireWarnings ?? [];

  return (
    <AppLayout>
      <Head title={title} />
      <div className="grid gap-6 pt-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-bold">{title}</h1>
            {profile && (
              <>
                <Badge variant={STATUS_VARIANT[profile.status]}>
                  {t(
                    `finances.postingProfile.columns.status.options.${profile.status}`,
                  )}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {t("finances.postingProfile.columns.version")}{" "}
                  {profile.version}
                </span>
              </>
            )}
          </div>
          {profile && (
            <div className="flex flex-wrap gap-2">
              {canWrite && !isDraft && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setVersionOpen(true)}
                >
                  {t("finances.postingProfile.actions.new_version")}
                </Button>
              )}
              {canActivate && isDraft && (
                <Button
                  type="button"
                  onClick={() => setConfirmAction("activate")}
                >
                  {t("finances.postingProfile.actions.activate")}
                </Button>
              )}
              {canActivate && profile.status === "active" && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConfirmAction("retire")}
                >
                  {t("finances.postingProfile.actions.retire")}
                </Button>
              )}
              {canWrite && isDraft && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setConfirmAction("discard")}
                >
                  {t("finances.postingProfile.actions.discard")}
                </Button>
              )}
            </div>
          )}
        </div>

        {errorMessage && (
          <div
            role="alert"
            data-testid="profile-error"
            className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {errorMessage}
          </div>
        )}

        {retireWarnings.length > 0 && (
          <div
            role="alert"
            data-testid="retire-warnings"
            className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
          >
            <TriangleAlert
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            <div className="grid gap-1">
              <strong>
                {t("finances.postingProfile.retire_warning_title")}
              </strong>
              {retireWarnings.map((message) => (
                <span key={message}>{message}</span>
              ))}
            </div>
          </div>
        )}

        {unmapped.length > 0 && (
          <div
            role="alert"
            data-testid="unmapped-warning"
            className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
          >
            <TriangleAlert
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            <div className="grid gap-1">
              <strong>{t("finances.postingProfile.unmapped.title")}</strong>
              <span className="text-xs">
                {t("finances.postingProfile.unmapped.note")}
              </span>
              {unmapped.map((entry) => (
                <span key={entry.document_type} data-testid="unmapped-item">
                  {t("finances.postingProfile.unmapped.message", {
                    document: t(
                      `finances.postingParityLog.columns.document_type.options.${entry.document_type}`,
                    ),
                    roles: entry.roles.map(roleLabel).join(", "),
                  })}
                </span>
              ))}
            </div>
          </div>
        )}

        {profile && !isDraft && (
          <p
            className="text-sm text-muted-foreground"
            data-testid="read-only-note"
          >
            {t("finances.postingProfile.form.read_only", {
              status: t(
                `finances.postingProfile.columns.status.options.${profile.status}`,
              ),
            })}
          </p>
        )}
        {profile && isDraft && !canWrite && (
          <p className="text-sm text-muted-foreground">
            {t("finances.postingProfile.form.view_only")}
          </p>
        )}

        <form onSubmit={submit} className="grid gap-6">
          <section className="grid gap-4 rounded-md border p-4 md:grid-cols-2">
            <h2 className="text-base font-semibold md:col-span-2">
              {t("finances.postingProfile.form.general")}
            </h2>
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="profile-name">
                {t("finances.postingProfile.columns.name")}
              </Label>
              <Input
                id="profile-name"
                value={form.data.name}
                disabled={!editable}
                onChange={(event) => form.setData("name", event.target.value)}
              />
              <InputError message={form.errors.name} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="profile-from">
                {t("finances.postingProfile.columns.effective_from")}
              </Label>
              <Input
                id="profile-from"
                type="date"
                value={form.data.effective_from}
                disabled={!editable}
                onChange={(event) =>
                  form.setData("effective_from", event.target.value)
                }
              />
              <InputError message={form.errors.effective_from} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="profile-to">
                {t("finances.postingProfile.columns.effective_to")}
              </Label>
              <Input
                id="profile-to"
                type="date"
                value={form.data.effective_to}
                disabled={!editable}
                onChange={(event) =>
                  form.setData("effective_to", event.target.value)
                }
              />
              <InputError message={form.errors.effective_to} />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="profile-notes">
                {t("finances.postingProfile.columns.notes")}
              </Label>
              <Textarea
                id="profile-notes"
                value={form.data.notes}
                disabled={!editable}
                onChange={(event) => form.setData("notes", event.target.value)}
              />
              <InputError message={form.errors.notes} />
            </div>
          </section>

          <section className="grid gap-2" data-testid="roles-section">
            <h2 className="text-base font-semibold">
              {t("finances.postingProfile.accounts")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("finances.postingProfile.form.roles_description")}
            </p>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-2">
                      {t("finances.postingProfile.columns.role")}
                    </th>
                    <th className="px-3 py-2">
                      {t("finances.postingProfile.columns.account")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((role) => {
                    const account = selected[role.value] ?? null;

                    return (
                      <tr
                        key={role.value}
                        className="border-t align-top"
                        data-testid="role-row"
                        data-role={role.value}
                      >
                        <th
                          scope="row"
                          className="px-3 py-2 text-left font-normal"
                        >
                          <div>{role.label}</div>
                          {role.master && (
                            <div className="text-xs text-muted-foreground">
                              {t(
                                "finances.postingProfile.form.role_master_hint",
                              )}
                            </div>
                          )}
                          {role.line_sensitive && (
                            <div className="text-xs text-muted-foreground">
                              {t(
                                "finances.postingProfile.form.role_line_sensitive_hint",
                              )}
                            </div>
                          )}
                        </th>
                        <td className="px-3 py-2">
                          {editable ? (
                            <AccountLinkModel
                              value={account}
                              filters={ACCOUNT_FILTERS}
                              placeholder={t(
                                "finances.postingProfile.form.account_placeholder",
                              )}
                              onValueChange={(next) =>
                                pickAccount(role.value, next)
                              }
                            />
                          ) : account ? (
                            accountLabel(account)
                          ) : (
                            <span className="text-muted-foreground">
                              {t("finances.postingProfile.form.unmapped_cell")}
                            </span>
                          )}
                          <InputError
                            message={form.errors[`accounts.${role.value}`]}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <div className="flex flex-wrap gap-2">
            {editable && (
              <Button type="submit" disabled={form.processing}>
                {isNew
                  ? t("finances.postingProfile.form.create")
                  : t("finances.postingProfile.form.save")}
              </Button>
            )}
            <Button type="button" variant="outline" asChild>
              <Link href={route("postingProfiles.index")}>
                {t("finances.postingProfile.form.back")}
              </Link>
            </Button>
          </div>
        </form>

        {profile && <RulesTable rules={profile.rules ?? []} roles={roles} />}
      </div>

      <ConfirmDialog
        action={confirmAction}
        name={profile?.name ?? ""}
        onClose={() => setConfirmAction(null)}
        onConfirm={runAction}
      />
      {profile && (
        <NewVersionDialog
          open={versionOpen}
          profileId={profile.id}
          defaultFrom={defaultFrom}
          onClose={() => setVersionOpen(false)}
        />
      )}
    </AppLayout>
  );
}

/**
 * Remount saat profil berganti (mis. setelah "Buat versi baru"): Inertia mempertahankan state komponen antar
 * kunjungan ke halaman yang sama, sehingga tanpa key form profil baru akan memuat data profil lama.
 * @param {object} props props halaman
 * @returns {import("react").JSX.Element}
 */
export default function Form(props) {
  const { profile } = props;
  // Status/versi/rentang ikut key: setelah aktivasi atau pensiun tampilan baca-saja dibangun ulang dari data segar.
  const key = profile
    ? `${profile.id}:${profile.status}:${profile.effective_from}:${profile.effective_to ?? ""}`
    : "new";

  return <FormContent key={key} {...props} />;
}
