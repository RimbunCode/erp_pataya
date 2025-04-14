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
import { useLaravelReactI18n } from "laravel-react-i18n";

export default memo(function Attachments() {
  const route = window.route;
  const { t } = useLaravelReactI18n();
  const attachments = usePage().props.attachments;
  const [openAttachment, setOpenAttachment] = useState(false);

  const removeFile = useCallback((id) => {
    router.delete(route(route().current(), route().params) + `/file/${id}`, {
      reset: ["attachments"],
      preserveScroll: true,
      preserveState: true,
      replace: true,
    });
  }, []);
  return (
    <>
      <div className="flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left outline-none  [&>svg]:size-4 [&>svg]:shrink-0 h-8 text-base ">
        <Paperclip />
        <span className="flex-1">{t("core.form.attachments")}</span>

        <Dialog open={openAttachment} onOpenChange={setOpenAttachment}>
          <DialogTrigger
            asChild
            className="group-data-[disabled=true]/form:hidden"
          >
            <Button
              variant="ghost"
              className="rounded-full !p-0"
              size="icon"
              type="button"
            >
              <Plus />
            </Button>
          </DialogTrigger>
          <UploadDialog
            open={openAttachment}
            onClose={() => {
              setOpenAttachment(false);
            }}
          />
        </Dialog>
      </div>
      <Deferred
        data={["attachments"]}
        fallback={
          <div className="mb-3 first:mt-2 ms-6">
            <div className="!text-base font-normal text-foreground flex gap-x-4">
              <LoadingIcon className="size-4" />
              <span>{t("core.form.loading")} ...</span>
            </div>
          </div>
        }
      >
        <ul
          className={cn(
            "ml-3.5 w-full flex min-w-0 translate-x-px flex-col gap-1 border-l border-sidebar-border pl-2.5 py-0.5 pr-3.5",
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
                          className="hover:underline"
                        >
                          <p className="text-sm truncate ">{name}</p>
                        </a>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent align="start">{name}</TooltipContent>
                  </Tooltip>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full !p-0 group-data-[disabled=true]/form:hidden"
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
      </Deferred>
    </>
  );
});
