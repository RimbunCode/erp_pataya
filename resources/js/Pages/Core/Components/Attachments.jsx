import { Deferred, router, usePage } from "@inertiajs/react";
import { Dialog, DialogTrigger } from "@/Components/ui/dialog";
import { FileTextIcon, Paperclip, Plus, X } from "lucide-react";
import React, { memo, useCallback, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/Components/ui/tooltip";

import { Button } from "@/Components/ui/button";
import Link from "@/Components/Link";
import LoadingIcon from "@/Components/LoadingIcon";
import UploadDialog from "./UploadDialog";
import { cn } from "@/lib/utils";
import { useFormPage } from "@/Pages/Core/FormPage";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default memo(function Attachments() {
  const route = window.route;
  const { t } = useLaravelReactI18n();
  // Sidebar bisa dirender di luar FormPageContext → context bisa undefined,
  // fallback ke edit-mode (isCreate falsy).
  const { isCreate, data, setData } = useFormPage() ?? {};
  const propAttachments = usePage().props.attachments;
  const bufferedFiles = data?.files ?? [];
  const attachments = isCreate
    ? bufferedFiles.map((f, i) => ({
        id: f.id ?? i,
        name: f.name || f.file?.name,
      }))
    : propAttachments;
  const [openAttachment, setOpenAttachment] = useState(false);

  const removeFile = useCallback(
    (id) => {
      if (isCreate) {
        setData(
          "files",
          (data?.files ?? []).filter((f) => (f.id ?? null) !== id),
        );
        return;
      }
      const currentPath = window.location.pathname.replace(/\/$/, "");
      const currentQueryString = window.location.search;
      const basePath = `${currentPath}/file`;
      router.delete(`${basePath}/${id}${currentQueryString}`, {
        reset: ["attachments"],
        preserveScroll: true,
        preserveState: true,
        replace: true,
      });
    },
    [isCreate, data, setData],
  );

  const attachmentList = (
    <ul
      className={cn(
        "ml-3.5 w-[calc(100%-calc(var(--spacing,0.25rem)*3.5))] flex min-w-0 translate-x-px flex-col gap-1 border-l border-sidebar-border pl-2.5 py-0.5 pr-3.5",
      )}
    >
      {attachments &&
        attachments.map(({ id, name }) => (
          <li key={id}>
            <div
              className={cn(
                "w-full flex h-6 min-w-0 -translate-x-px items-center gap-2  rounded-md px-2 text-sidebar-foreground outline-none  [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-sidebar-accent-foreground",
                "text-base",
              )}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center flex-1 overflow-hidden gap-x-2">
                    <Link href={route("files.preview", id)}>
                      <FileTextIcon className="size-5" />{" "}
                    </Link>
                    <a
                      target="_blank"
                      rel="noreferrer"
                      href={route("files.preview", id)}
                      className="hover:underline truncate"
                    >
                      <p className="text-sm truncate">{name}</p>
                    </a>
                  </div>
                </TooltipTrigger>
                <TooltipContent align="start">{name}</TooltipContent>
              </Tooltip>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full p-0!"
                onClick={() => {
                  removeFile(id);
                }}
              >
                <X />
              </Button>
            </div>
          </li>
        ))}
    </ul>
  );

  return (
    <>
      <div className="flex w-full items-center gap-2 rounded-md py-2 text-left outline-none  [&>svg]:size-4 [&>svg]:shrink-0 h-8 text-base ">
        <Paperclip />
        <span className="flex-1">{t("core.form.attachments")}</span>

        <Dialog open={openAttachment} onOpenChange={setOpenAttachment}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              className="rounded-full p-0!"
              size="icon"
              type="button"
            >
              <Plus />
            </Button>
          </DialogTrigger>
          <UploadDialog
            open={openAttachment}
            onBuffer={
              isCreate
                ? (items) =>
                    setData("files", [...(data?.files ?? []), ...items])
                : null
            }
            onClose={() => {
              setOpenAttachment(false);
            }}
          />
        </Dialog>
      </div>
      {/* Saat create, data dari buffer lokal — tak ada server-deferred,
          jadi jangan bungkus Deferred (yang akan tampilkan loading selamanya). */}
      {isCreate ? (
        attachmentList
      ) : (
        <Deferred
          data={["attachments"]}
          fallback={
            <div className="mb-3 first:mt-2 ms-6">
              <div className="text-base! font-normal text-foreground flex gap-x-4">
                <LoadingIcon className="size-4" />
                <span>{t("core.form.loading")} ...</span>
              </div>
            </div>
          }
        >
          {attachmentList}
        </Deferred>
      )}
    </>
  );
});
