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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/Components/ui/tooltip";

import { Button } from "@/Components/ui/button";
import { Checkbox } from "@/Components/ui/checkbox";
import DatetimePicker from "@/Components/DatetimePicker";
import Link from "@/Components/Link";
import { Textarea } from "@/Components/ui/textarea";
import UploadDialog from "@/Pages/Core/Components/UploadDialog";
import UserLinkModel from "@/Pages/Users/ManageUsers/UserLinkModel";
import { router } from "@inertiajs/react";
import { useLaravelReactI18n } from "laravel-react-i18n";

function ActivityFormDialog({ assetService, activity, open, onOpenChange }) {
  const { t } = useLaravelReactI18n();
  const [form, setForm] = useState(
    activity ?? { action_date: null, pic: null, description: "", files: [] },
  );
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
    setForm(
      activity ?? { action_date: null, pic: null, description: "", files: [] },
    );
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
      is_done: form.is_done ?? false,
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
      onFinish: () => {
        setSaving(false);
        onOpenChange(false);
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
        <div className="flex flex-col gap-y-3">
          <DatetimePicker
            value={form.action_date}
            onValueChange={(val) => setForm({ ...form, action_date: val })}
          />
          <UserLinkModel
            value={form.pic}
            onValueChange={(val) => setForm({ ...form, pic: val })}
            placeholder={t("asset.service.activity.pic")}
          />
          <Textarea
            rows={3}
            value={form.description ?? ""}
            placeholder={t("asset.service.activity.description")}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <label className="flex items-center gap-x-2 text-sm">
            <Checkbox
              checked={form.is_done ?? false}
              onCheckedChange={(val) => setForm({ ...form, is_done: val })}
            />
            {t("asset.service.activity.is_done")}
          </label>

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

function CompleteConfirmDialog({ assetService, open, onOpenChange }) {
  const { t } = useLaravelReactI18n();
  const [loading, setLoading] = useState(false);

  const confirm = () => {
    setLoading(true);
    router.post(
      route("assetServices.complete", assetService.id),
      {},
      { onFinish: () => setLoading(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("asset.service.activity.confirm_complete")}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t("asset.service.activity.confirm_complete_description")}
        </p>
        <DialogFooter>
          <Button disabled={loading} onClick={confirm}>
            {t("asset.service.activity.confirm_complete_action")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ServiceActivityLog({ assetService }) {
  const { t } = useLaravelReactI18n();
  const [editingActivity, setEditingActivity] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const activities = assetService.activities ?? [];
  const allDone = activities.length > 0 && activities.every((a) => a.is_done);

  const toggleDone = (activity) => {
    router.put(route("assetServices.activities.update", activity.id), {
      action_date: activity.action_date,
      pic_id: activity.pic?.id ?? null,
      description: activity.description,
      is_done: !activity.is_done,
    });
  };

  const openEdit = (activity) => {
    setEditingActivity(activity);
    setDialogOpen(true);
  };

  const openAdd = () => {
    setEditingActivity(null);
    setDialogOpen(true);
  };

  return (
    <div className="flex flex-col gap-y-3 p-4 border-t">
      <div className="flex items-center justify-between">
        <p className="text-base font-medium">
          {t("asset.service.activity.title")}
        </p>
        <Button size="sm" variant="outline" onClick={openAdd}>
          {t("asset.service.activity.add")}
        </Button>
      </div>

      <div className="flex flex-col gap-y-2">
        {activities.map((activity) => (
          <div
            key={activity.id}
            className="flex items-center gap-x-3 p-3 border rounded cursor-pointer"
            onClick={() => openEdit(activity)}
          >
            <Checkbox
              checked={activity.is_done ?? false}
              onCheckedChange={() => toggleDone(activity)}
              onClick={(e) => e.stopPropagation()}
            />
            <div className="flex-1">
              <p className="text-sm font-medium">{activity.description}</p>
              <p className="text-xs text-muted-foreground">
                {activity.pic?.name} — {activity.action_date}
              </p>
            </div>
            {activity.files?.length > 0 && (
              <div className="flex items-center gap-x-1 text-xs text-muted-foreground shrink-0">
                <Paperclip className="size-3.5" />
                {activity.files.length}
              </div>
            )}
          </div>
        ))}
        {activities.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {t("asset.service.activity.empty")}
          </p>
        )}
      </div>

      {allDone && (
        <Button onClick={() => setConfirmOpen(true)}>
          {t("asset.service.activity.mark_complete")}
        </Button>
      )}

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
        activity={
          editingActivity
            ? (activities.find((a) => a.id === editingActivity.id) ??
              editingActivity)
            : null
        }
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
      <CompleteConfirmDialog
        assetService={assetService}
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
      />
    </div>
  );
}
