import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/Components/ui/dialog";
import React, { useState } from "react";

import { Button } from "@/Components/ui/button";
import { Checkbox } from "@/Components/ui/checkbox";
import DatetimePicker from "@/Components/DatetimePicker";
import { Input } from "@/Components/ui/input";
import UserLinkModel from "@/Pages/Users/ManageUsers/UserLinkModel";
import { router } from "@inertiajs/react";
import { useLaravelReactI18n } from "laravel-react-i18n";

function ActivityFormDialog({ assetService, activity, open, onOpenChange }) {
  const { t } = useLaravelReactI18n();
  const [form, setForm] = useState(
    activity ?? { action_date: null, pic: null, description: "" },
  );
  const [saving, setSaving] = useState(false);

  const isEdit = !!activity?.id;

  const submit = () => {
    setSaving(true);
    const payload = {
      action_date: form.action_date,
      pic_id: form.pic?.id ?? null,
      description: form.description,
      is_done: form.is_done ?? false,
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
          <Input
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
        assetService={assetService}
        activity={editingActivity}
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
