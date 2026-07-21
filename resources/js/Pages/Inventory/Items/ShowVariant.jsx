import { Avatar, AvatarFallback, AvatarImage } from "@/Components/ui/avatar";
import { Dialog, DialogTrigger } from "@/Components/ui/dialog";
import { FormPage } from "@/Pages/Core/FormPage";
import React, { useMemo, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/Components/ui/tooltip";
import { Trash2, UploadIcon } from "lucide-react";

import { Button } from "@/Components/ui/button";
import FormVariant from "./FormVariant";
import Link from "@/Components/Link";
import UploadDialog from "@/Pages/Core/Components/UploadDialog";
import { resolveImageSrc } from "@/lib/utils";
import { router } from "@inertiajs/react";
import { useLaravelReactI18n } from "laravel-react-i18n";

function ItemVariantImageUploader({ itemVariant }) {
  const { t } = useLaravelReactI18n();
  const [openAttachment, setOpenAttachment] = useState(false);
  const currentPath = window.location.pathname.replace(/\/$/, "");
  const currentQueryString = window.location.search;
  const basePath = `${currentPath}/image`;
  const imageId = itemVariant?.image;
  const alias = (itemVariant?.code ?? "")
    .split(" ")
    .slice(0, 2)
    .map((n) => n.charAt(0))
    .join("");

  const avatar = useMemo(() => {
    if (!imageId) return null;
    return (
      <AvatarImage src={resolveImageSrc(imageId)} alt={itemVariant?.code} />
    );
  }, [imageId, itemVariant?.code]);

  return (
    <Dialog open={openAttachment} onOpenChange={setOpenAttachment}>
      <Avatar className="relative w-full h-auto border rounded-xl aspect-square max-w-64 group">
        {avatar}
        <AvatarFallback className="rounded-lg">
          <p className="w-full font-semibold text-center text-muted-foreground text-9xl">
            {alias}
          </p>
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
          {imageId && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="destructive"
                  size="icon"
                  type="button"
                  onClick={() => {
                    router.delete(`${basePath}${currentQueryString}`, {
                      reset: ["itemVariant"],
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
        options={{
          route: `${basePath}${currentQueryString}`,
          reset: ["itemVariant"],
        }}
        onClose={() => setOpenAttachment(false)}
      />
    </Dialog>
  );
}

export default function ShowVariant({ itemVariant }) {
  const { t } = useLaravelReactI18n();
  const route = window.route;
  return (
    <FormPage
      isCreate={!itemVariant}
      title={itemVariant.code}
      name="itemVariant"
      deleteable={false}
      sidebarContent={(defaultComp) => (
        <>
          <ItemVariantImageUploader itemVariant={itemVariant} />
          {defaultComp}
        </>
      )}
      badge={
        <>
          {itemVariant.format_variant && (
            <span className="text-sm badge primary">
              {`${t("inventory.itemVariant.variant_of")} `}
              <Link
                className="ml-1 hover:underline"
                href={route("items.show", itemVariant.item.id)}
              >
                {itemVariant.item.code}
              </Link>
            </span>
          )}
        </>
      }
    >
      <FormVariant />
    </FormPage>
  );
}
