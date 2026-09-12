import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/Components/ui/dialog";
import { FileTextIcon, Paperclip, Plus, X } from "lucide-react";
import React, { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/Components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/Components/ui/tooltip";

import BadgeStatus from "@/Components/BadgeStatus";
import { Button } from "@/Components/ui/button";
import DatetimePicker from "@/Components/DatetimePicker";
import { FormPageContent } from "@/Pages/Core/FormPage";
import Link from "@/Components/Link";
import { Textarea } from "@/Components/ui/textarea";
import { TZDate } from "@date-fns/tz";
import UploadDialog from "@/Pages/Core/Components/UploadDialog";
import UserLinkModel from "@/Pages/Users/ManageUsers/UserLinkModel";
import { format } from "date-fns";
import { getLocaleDate } from "@/lib/utils";
import { router, usePage } from "@inertiajs/react";
import { useLaravelReactI18n } from "laravel-react-i18n";

/**
 * Format `action_date` (string UTC dari backend) jadi tanggal+jam lokal
 * terbaca -- pola sama Comments.jsx/ApprovalActedByDetail (FormPage.jsx):
 * `format(new TZDate(value, "UTC"), "PPPp", { locale })`.
 * @param {string|null} value
 * @param {string} [lang]
 * @returns {string}
 */
function formatActionDate(value, lang) {
  if (!value) return "";
  return format(new TZDate(value, "UTC"), "PPPp", {
    locale: getLocaleDate(lang),
  });
}

// Requirement 6 AC2 (spec asset-service-progress-workflow): 5 status
// ticket-like -- NEW dihapus, CLOSED dikecualikan, DONE->COMPLETED.
const ACTIVITY_STATUSES = [
  "in_progress",
  "resolved",
  "waiting",
  "on_hold",
  "completed",
];

/**
 * Label field kecil dengan tanda wajib -- BUKAN `@/Components/FormInput`:
 * FormInput terikat ke FormPageMetaContext form UTAMA (AssetService) via
 * `useFormPageMeta()` -- `useCanUpdate(name)`-nya cek permission field pada
 * model AssetService, dan `errors` fallback-nya baca `form.errors` dari
 * `useDraftForm(AssetService)`, BUKAN dari response `router.post/put` ke
 * endpoint activity yang terpisah. Field activity di sini (action_date,
 * status, dst) tidak ada pada AssetService sama sekali, jadi field-level
 * permission & error mapping FormInput akan nyasar/tidak pernah terisi kalau
 * dipaksakan dipakai di sini.
 * @param root0
 * @param root0.children
 * @param root0.required
 */
function ActivityFieldLabel({ children, required }) {
  return (
    <p className="text-sm font-medium">
      {children} {required && <span className="text-red-500">*</span>}
    </p>
  );
}

/**
 * Requirement 12 AC1 (tasks.md): named export -- dipakai ConfirmWorkflowDialog.jsx
 * (Option Hold, Requirement 3) selain dipakai lokal di sini (Tambah Aktivitas
 * biasa, tombol Complete).
 * @param root0
 * @param root0.assetService
 * @param root0.activity
 * @param root0.prefillStatus
 * @param root0.onSavedCallback
 * @param root0.open
 * @param root0.onOpenChange
 */
export function ActivityFormDialog({
  assetService,
  activity,
  prefillStatus,
  onSavedCallback,
  open,
  onOpenChange,
}) {
  const { t } = useLaravelReactI18n();
  // Requirement 6 AC6/AC8 (revisi): activities() relation (backend) sudah
  // orderBy action_date ASC, id ASC -- .at(-1) = action_date TERBESAR, BUKAN
  // "activity yang barusan disimpan". prefillStatus (Hold="on_hold",
  // Complete="completed") override default ini kalau di-pass.
  const lastActivityStatus = assetService?.activities?.at(-1)?.status ?? null;
  const defaultForm = () => ({
    action_date: new Date(), // Requirement 6 AC5: selalu now() saat create
    pic: null,
    description: "",
    status: prefillStatus ?? lastActivityStatus,
    files: [],
  });
  const [form, setForm] = useState(activity ?? defaultForm());
  // ActivityFormDialog selalu mounted (dialog cuma disembunyikan via prop
  // `open`, bukan di-unmount) -- useState initializer di atas cuma jalan
  // sekali saat mount pertama. Tanpa effect ini, ganti activity yang diedit
  // (atau pindah Add<->Edit) tidak pernah re-sync form ke data yang baru --
  // field selalu kosong/basi. Sengaja BUKAN pakai `key` di parent (itu
  // unmount+remount <Dialog>, bentrok dengan animasi transisi Radix --
  // TimeoutError "Transition aborted" muncul di console saat dicoba).
  //
  // Dependency `activity?.id` (bukan `activity`) SENGAJA -- attach/hapus
  // lampiran mode edit memicu reload prop (activity dapat reference baru
  // tiap kali walau field lain sama persis). Kalau effect ini trigger ulang
  // di setiap reload, perubahan description/dll yang sedang diketik user
  // (belum sempat Simpan) akan ketimpa balik ke nilai lama tiap kali attach
  // file -- effect ini HARUS hanya reset saat activity yang diedit benar2
  // BERGANTI (ganti id, atau pindah Add<->Edit), bukan tiap reload activity
  // yang sama.
  useEffect(() => {
    setForm(activity ?? defaultForm());
  }, [activity?.id]);
  const [saving, setSaving] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const route = window.route;

  const isEdit = !!activity?.id;
  // Create: buffer lokal (form.files). Edit: live dari activity.files, di-refresh
  // server tiap add/remove (bukan bagian payload Simpan).
  const attachments = isEdit ? (activity?.files ?? []) : (form.files ?? []);

  const handleBuffer = (items) => {
    setForm((f) => ({ ...f, files: [...(f.files ?? []), ...items] }));
  };

  const removeAttachment = (fileId) => {
    if (!isEdit) {
      setForm((f) => ({
        ...f,
        files: (f.files ?? []).filter((x) => x.id !== fileId),
      }));
      return;
    }
    router.delete(
      route("assetServices.activities.removeFile", [activity.id, fileId]),
      { preserveScroll: true },
    );
  };

  const submit = () => {
    setSaving(true);
    const payload = {
      action_date: form.action_date,
      pic_id: form.pic?.id ?? null,
      description: form.description,
      status: form.status,
      ...(!isEdit &&
        form.files?.length > 0 && {
          filesId: form.files.map((f) => f.id).filter(Boolean),
        }),
    };

    const url = isEdit
      ? route("assetServices.activities.update", activity.id)
      : route("assetServices.activities.store", assetService.id);
    const method = isEdit ? "put" : "post";

    router[method](url, payload, {
      // Dialog HANYA ditutup kalau request sukses -- kalau validasi backend
      // menolak (mis. AC8/AC9/AC10), dialog tetap terbuka menampilkan error
      // supaya user bisa perbaiki input, bukan hilang begitu saja.
      onSuccess: () => {
        onSavedCallback?.();
        onOpenChange(false);
      },
      onFinish: () => {
        setSaving(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? t("asset.service.activity.edit")
              : t("asset.service.activity.add")}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-y-4">
          <div className="grid grid-cols-2 gap-x-3">
            <div className="flex flex-col gap-y-1.5">
              <ActivityFieldLabel required>
                {t("asset.service.activity.action_date")}
              </ActivityFieldLabel>
              <DatetimePicker
                value={form.action_date}
                onValueChange={(val) => setForm({ ...form, action_date: val })}
              />
            </div>
            <div className="flex flex-col gap-y-1.5">
              <ActivityFieldLabel required>
                {t("asset.service.activity.status")}
              </ActivityFieldLabel>
              <Select
                value={form.status ?? undefined}
                onValueChange={(val) => setForm({ ...form, status: val })}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={t("asset.service.activity.status")}
                  />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {t(`status.${status}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-y-1.5">
            <ActivityFieldLabel>
              {t("asset.service.activity.pic")}
            </ActivityFieldLabel>
            <UserLinkModel
              value={form.pic}
              onValueChange={(val) => setForm({ ...form, pic: val })}
              placeholder={t("asset.service.activity.pic")}
            />
          </div>
          <div className="flex flex-col gap-y-1.5">
            <ActivityFieldLabel required>
              {t("asset.service.activity.description")}
            </ActivityFieldLabel>
            <Textarea
              rows={3}
              value={form.description ?? ""}
              placeholder={t("asset.service.activity.description")}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </div>

          <div className="flex flex-col gap-y-2 pt-2 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-x-2 text-sm font-medium">
                <Paperclip className="size-4" />
                {t("asset.service.activity.attachments")}
              </div>
              <Dialog open={attachOpen} onOpenChange={setAttachOpen}>
                <DialogTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                  >
                    <Plus />
                  </Button>
                </DialogTrigger>
                <UploadDialog
                  onClose={() => setAttachOpen(false)}
                  onBuffer={isEdit ? null : handleBuffer}
                  options={
                    isEdit
                      ? {
                          route: route(
                            "assetServices.activities.addFile",
                            activity.id,
                          ),
                        }
                      : undefined
                  }
                />
              </Dialog>
            </div>
            <ul className="flex flex-col gap-y-1">
              {attachments.map((file) => (
                <li
                  key={file.id}
                  className="flex items-center justify-between gap-x-2 text-sm"
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link
                        href={route("files.preview", file.id)}
                        className="flex items-center flex-1 min-w-0 gap-x-2 hover:underline"
                      >
                        <FileTextIcon className="size-4 shrink-0" />
                        <span className="truncate">{file.name}</span>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent align="start">{file.name}</TooltipContent>
                  </Tooltip>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="rounded-full p-0!"
                    onClick={() => removeAttachment(file.id)}
                  >
                    <X className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <DialogFooter>
          <Button disabled={saving} onClick={submit}>
            {t("asset.service.activity.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ServiceActivityLog({ assetService }) {
  const { t } = useLaravelReactI18n();
  const lang = usePage().props?.lang;
  const [editingActivity, setEditingActivity] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);

  const activities = assetService.activities ?? [];
  // Selama status masih NEED_CONFIRMATION, alur kerja belum dipilih lewat
  // ConfirmWorkflowDialog (Hold/PR/PO/Mulai Pekerjaan) -- tambah aktivitas
  // manual/Tandai Selesai belum relevan di titik ini.
  const needsConfirmation = (assetService?.status ?? []).includes(
    "need_confirmation",
  );
  // Requirement 6 AC8: urutan backend sudah action_date ASC, id ASC --
  // .at(-1) = activity dengan action_date TERBESAR.
  const lastActivity = activities.at(-1);
  // Requirement 7 AC1 (revisi): tampil kecuali activity terakhir sudah
  // completed, atau belum ada activity sama sekali (Requirement 9 AC3
  // menjamin ini praktis tidak terjadi begitu status lewat NEED_CONFIRMATION
  // -- guard tetap dipertahankan sebagai defensive check).
  const showComplete =
    !needsConfirmation && !!lastActivity && lastActivity.status !== "completed";

  const openEdit = (activity) => {
    setEditingActivity(activity);
    setDialogOpen(true);
  };

  const openAdd = () => {
    setEditingActivity(null);
    setDialogOpen(true);
  };

  const openComplete = () => {
    setEditingActivity(null);
    setCompleteOpen(true);
  };

  const activeActivity = editingActivity
    ? (activities.find((a) => a.id === editingActivity.id) ?? editingActivity)
    : null;

  return (
    <FormPageContent
      title={t("asset.service.activity.tab_title")}
      value="activities"
    >
      <div className="flex flex-col gap-y-3">
        <div className="flex items-center justify-between">
          <p className="text-base font-medium">
            {t("asset.service.activity.title")}
          </p>
          <div className="flex items-center gap-x-2">
            {showComplete && (
              <Button size="sm" onClick={openComplete}>
                {t("asset.service.activity.mark_complete")}
              </Button>
            )}
            {!needsConfirmation && (
              <Button size="sm" variant="outline" onClick={openAdd}>
                {t("asset.service.activity.add")}
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-y-3">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="flex flex-col gap-y-2 p-4 border rounded-lg cursor-pointer transition-all hover:border-foreground/40 hover:shadow-sm"
              onClick={() => openEdit(activity)}
            >
              <div className="flex items-center justify-between gap-x-3">
                <p className="text-sm font-medium text-muted-foreground">
                  {activity.pic?.name ?? t("asset.service.activity.no_pic")}
                  {" — "}
                  {formatActionDate(activity.action_date, lang)}
                </p>
                {activity.status && (
                  <BadgeStatus
                    status={activity.status}
                    className="shrink-0 text-sm px-3 py-1"
                  />
                )}
              </div>
              <p className="text-sm">{activity.description}</p>
              {activity.files?.length > 0 && (
                <div className="flex items-center gap-x-1 text-xs text-muted-foreground">
                  <Paperclip className="size-3.5" />
                  {activity.files.length}
                </div>
              )}
            </div>
          ))}
          {activities.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {needsConfirmation
                ? t("asset.service.activity.awaiting_confirmation")
                : t("asset.service.activity.empty")}
            </p>
          )}
        </div>
      </div>

      <ActivityFormDialog
        // key berbasis id activity yang sedang di-edit -- ActivityFormDialog
        // selalu mounted (dialog cuma disembunyikan via prop `open`, bukan
        // di-unmount), dan useState(activity ?? {...}) di dalamnya cuma jalan
        // sekali saat mount pertama. Tanpa key ini, ganti activity yang
        // diedit (atau pindah dari Add ke Edit) TIDAK memicu re-init form --
        // field selalu kosong. Key berubah -> React remount -> form terisi
        // ulang dari activity yang benar.
        key={editingActivity?.id ?? "new"}
        assetService={assetService}
        // Ambil ulang dari activities (bukan snapshot editingActivity) supaya
        // attach/hapus lampiran mode edit (efek langsung, back() reload) ikut
        // ter-refresh di dialog yang masih terbuka.
        activity={activeActivity}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
      {/* Requirement 7 AC2/AC3: tombol Complete reuse ActivityFormDialog yang
          SAMA (prefillStatus="completed"), BUKAN dialog konfirmasi terpisah
          seperti desain awal (CompleteConfirmDialog, dihapus) -- submit
          sukses -> panggil endpoint complete() existing. */}
      <ActivityFormDialog
        key="complete"
        assetService={assetService}
        activity={null}
        prefillStatus="completed"
        onSavedCallback={() =>
          router.post(route("assetServices.complete", assetService.id))
        }
        open={completeOpen}
        onOpenChange={setCompleteOpen}
      />
    </FormPageContent>
  );
}
