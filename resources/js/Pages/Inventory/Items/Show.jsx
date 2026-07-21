import { Avatar, AvatarFallback, AvatarImage } from "@/Components/ui/avatar";
import { Dialog, DialogTrigger } from "@/Components/ui/dialog";
import { FormPage, useFormPage } from "@/Pages/Core/FormPage";
import React, { useMemo, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/Components/ui/tooltip";
import { Trash2, UploadIcon } from "lucide-react";

import { Button } from "@/Components/ui/button";
import Form from "./Form";
import UploadDialog from "@/Pages/Core/Components/UploadDialog";
import { resolveImageSrc } from "@/lib/utils";
import { router } from "@inertiajs/react";
import { useLaravelReactI18n } from "laravel-react-i18n";

function ItemImageUploader({ item }) {
  const { t } = useLaravelReactI18n();
  const { isCreate, data, setData } = useFormPage();
  const [openAttachment, setOpenAttachment] = useState(false);
  const currentPath = window.location.pathname.replace(/\/$/, "");
  const currentQueryString = window.location.search;
  const basePath = `${currentPath}/image`;
  const bufferedImage = data?.image?.[0] ?? null;
  const imageId = isCreate ? null : item?.image;
  const alias = (item?.code ?? item?.name ?? "")
    .split(" ")
    .slice(0, 2)
    .map((n) => n.charAt(0))
    .join("");

  const avatar = useMemo(() => {
    if (!imageId) return null;
    return <AvatarImage src={resolveImageSrc(imageId)} alt={item?.name} />;
  }, [imageId, item?.name]);

  const hasImage = isCreate ? !!bufferedImage : !!imageId;

  return (
    <Dialog open={openAttachment} onOpenChange={setOpenAttachment}>
      <Avatar className="relative w-full h-auto border rounded-xl aspect-square max-w-64 group">
        {avatar}
        <AvatarFallback className="rounded-lg">
          {isCreate && bufferedImage ? (
            <p className="w-full px-4 text-sm text-center break-all text-muted-foreground">
              {bufferedImage.name}
            </p>
          ) : (
            <p className="w-full font-semibold text-center text-muted-foreground text-9xl">
              {alias}
            </p>
          )}
        </AvatarFallback>
        <div className="absolute flex items-center justify-center w-full h-full transition-opacity border opacity-0 cursor-pointer group-hover:opacity-100 bg-background/25 rounded-xl gap-x-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <DialogTrigger asChild>
                <Button variant="default" size="icon" type="button">
                  <UploadIcon className="size-5!" />
                </Button>
              </DialogTrigger>
            </TooltipTrigger>
            <TooltipContent align="center">
              {t("inventory.item.columns.image.upload")}
            </TooltipContent>
          </Tooltip>
          {hasImage && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="destructive"
                  size="icon"
                  type="button"
                  onClick={() => {
                    if (isCreate) {
                      setData("image", []);
                      return;
                    }
                    router.delete(`${basePath}${currentQueryString}`, {
                      reset: ["item"],
                      preserveScroll: true,
                      preserveState: true,
                    });
                  }}
                >
                  <Trash2 className="size-5!" />
                </Button>
              </TooltipTrigger>
              <TooltipContent align="center">
                {t("inventory.item.columns.image.remove")}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </Avatar>
      <UploadDialog
        open={openAttachment}
        single
        imageOnly
        onBuffer={isCreate ? (items) => setData("image", items) : null}
        options={
          isCreate
            ? undefined
            : {
                route: `${basePath}${currentQueryString}`,
                reset: ["item"],
              }
        }
        onClose={() => setOpenAttachment(false)}
      />
    </Dialog>
  );
}

export default function Show({ item }) {
  return (
    <FormPage
      isCreate={!item}
      name="item"
      sidebarContent={(defaultComp) => (
        <>
          <ItemImageUploader item={item} />
          {defaultComp}
        </>
      )}
    >
      <Form />
    </FormPage>
  );
}
