import React, { useEffect, useMemo, useState } from "react";
import { Loader2Icon } from "lucide-react";
import { useEditor } from "@grapesjs/react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function formatRelativeTime(lastSavedAt) {
  if (!lastSavedAt) {
    return "";
  }

  const diffMs = Date.now() - lastSavedAt.getTime();
  const diffSeconds = Math.max(0, Math.floor(diffMs / 1000));

  if (diffSeconds < 60) {
    return "baru saja";
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes}m lalu`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  return `${diffHours}j lalu`;
}

function SaveStatusBadge() {
  const editor = useEditor();
  const [status, setStatus] = useState("idle");
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setTick((current) => current + 1);
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const onDirty = () => {
      setStatus((current) => (current === "saving" ? current : "dirty"));
    };

    const onSaving = () => {
      setStatus("saving");
    };

    const onSaved = () => {
      setStatus("saved");
      setLastSavedAt(new Date());
    };

    const onSaveSuccess = () => {
      toast.success("Template berhasil disimpan.");
      onSaved();
    };

    const onSaveError = (error) => {
      const message =
        typeof error === "string"
          ? error
          : error?.message || "Terjadi kesalahan saat menyimpan template.";

      setStatus("error");
      toast.error(message);
    };

    editor.on("update", onDirty);
    editor.on("template:save-start", onSaving);
    editor.on("template:save-finish", onSaved);
    editor.on("template:save-success", onSaveSuccess);
    editor.on("template:save-error", onSaveError);
    editor.on("storage:end:store", onSaved);

    return () => {
      editor.off("update", onDirty);
      editor.off("template:save-start", onSaving);
      editor.off("template:save-finish", onSaved);
      editor.off("template:save-success", onSaveSuccess);
      editor.off("template:save-error", onSaveError);
      editor.off("storage:end:store", onSaved);
    };
  }, [editor]);

  const viewModel = useMemo(() => {
    if (status === "saving") {
      return {
        label: "Saving...",
        className: "primary",
        icon: <Loader2Icon className="size-3 animate-spin" />,
      };
    }

    if (status === "dirty") {
      return {
        label: "Not Saved",
        className: "warning",
        icon: null,
      };
    }

    if (status === "error") {
      return {
        label: "Save Error",
        className: "error",
        icon: null,
      };
    }

    if (status === "saved" || lastSavedAt) {
      return {
        label: `Saved ${formatRelativeTime(lastSavedAt)}`.trim(),
        className: "success",
        icon: null,
      };
    }

    return {
      label: "Ready",
      className: "secondary",
      icon: null,
    };
  }, [lastSavedAt, status]);

  return (
    <span className={cn("badge", viewModel.className)}>
      {viewModel.icon}
      <span>{viewModel.label}</span>
    </span>
  );
}

export default SaveStatusBadge;
