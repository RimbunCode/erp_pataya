import { Avatar, AvatarFallback, AvatarImage } from "@/Components/ui/avatar";
import { Dialog, DialogTrigger } from "@/Components/ui/dialog";
import React, { useMemo, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/Components/ui/tooltip";
import { Trash2, UploadIcon } from "lucide-react";

import { Button } from "@/Components/ui/button";
import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import UploadDialog from "@/Pages/Core/Components/UploadDialog";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Show({ user }) {
  const { t } = useLaravelReactI18n();
  const [openAttachment, setOpenAttachment] = useState(false);
  const alias = user.name
    .split(" ")
    .slice(0, 2)
    .map((n) => n.charAt(0))
    .join("");

  const avatar = useMemo(() => {
    if (!user.image) return null;
    return (
      <AvatarImage
        src={
          route("files.preview", user.image) +
          `?v=${new Date(user.updated_at).getTime()}`
        }
        alt={user.name}
        className=" transition-[filter] group-hover:blur-sm"
      />
    );
  }, [user.image]);
  return (
    <FormPage
      name="user"
      title={user?.name ?? t("user.user.new")}
      sidebarContent={(defaultComp) => (
        <>
          <Dialog open={openAttachment} onOpenChange={setOpenAttachment}>
            <Avatar className="relative w-full h-auto border rounded-xl aspect-square max-w-64 group">
              {avatar}
              <AvatarFallback className="rounded-lg">
                <p className="w-full font-semibold text-center text-muted-foreground text-9xl transition-[filter]">
                  {alias}
                </p>
              </AvatarFallback>
              <div className="absolute flex items-center justify-center w-full h-full transition-opacity border opacity-0 cursor-pointer group-hover:opacity-100 bg-background/25 rounded-xl gap-x-4">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DialogTrigger asChild>
                      <Button variant="default" size="icon">
                        <UploadIcon className="size-5!" />
                      </Button>
                    </DialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent align="center">Upload</TooltipContent>
                </Tooltip>
                {user.image && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="destructive" size="icon">
                        <Trash2 className="size-5!" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent align="center">Remove</TooltipContent>
                  </Tooltip>
                )}
              </div>
            </Avatar>
            <UploadDialog
              open={openAttachment}
              imageOnly
              options={{
                route: route(route().current(), route().params) + "/image",
                reset: ["user", "auth"],
              }}
              onClose={() => {
                setOpenAttachment(false);
              }}
            />
          </Dialog>
          {defaultComp}
        </>
      )}
    >
      <Form />
    </FormPage>
  );
}
