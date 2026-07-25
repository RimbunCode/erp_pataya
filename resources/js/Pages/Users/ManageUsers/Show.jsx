import { Avatar, AvatarFallback, AvatarImage } from "@/Components/ui/avatar";
import { Dialog, DialogTrigger } from "@/Components/ui/dialog";
import { FormPage, FormPageDialog } from "@/Pages/Core/FormPage";
import React, { useMemo, useRef, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/Components/ui/tooltip";
import { Link2, Trash2, UploadIcon } from "lucide-react";

import { Button } from "@/Components/ui/button";
import Form from "./Form";
import FormChangePassword from "./FormChangePassword";
import UploadDialog from "@/Pages/Core/Components/UploadDialog";
import { cn, resolveImageSrc } from "@/lib/utils";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { router, usePage } from "@inertiajs/react";

export default function Show({ user }) {
  const { t } = useLaravelReactI18n();
  const changePasswordDialogRef = useRef();
  const { user: authUser } = usePage().props.auth;
  const [openAttachment, setOpenAttachment] = useState(false);
  const currentPath = window.location.pathname.replace(/\/$/, "");
  const currentQueryString = window.location.search;
  const basePath = `${currentPath}/image`;
  const alias = user.name
    .split(" ")
    .slice(0, 2)
    .map((n) => n.charAt(0))
    .join("");

  const avatar = useMemo(() => {
    if (!user.picture) return null;
    return (
      <AvatarImage
        src={resolveImageSrc(user.picture)}
        alt={user.name}
        className={cn(
          "transition-[filter]",
          authUser.id === user.id && "group-hover:blur-sm",
        )}
      />
    );
  }, [user.picture, authUser.id]);
  return (
    <>
      <FormPage
        isCreate={!user}
        name="user"
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
                {authUser.id === user.id && (
                  <div className="absolute flex items-center justify-center w-full h-full transition-opacity border opacity-0 cursor-pointer group-hover:opacity-100 bg-background/25 rounded-xl gap-x-4">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DialogTrigger asChild>
                          <Button variant="default" size="icon">
                            <UploadIcon className="size-5!" />
                          </Button>
                        </DialogTrigger>
                      </TooltipTrigger>
                      <TooltipContent align="center">
                        {t("user.user.columns.image.upload")}
                      </TooltipContent>
                    </Tooltip>
                    {user.image && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="destructive"
                            size="icon"
                            type="button"
                            onClick={() => {
                              router.delete(
                                `${basePath}${currentQueryString}`,
                                {
                                  reset: ["user", "auth"],
                                  preserveScroll: true,
                                  preserveState: true,
                                },
                              );
                            }}
                          >
                            <Trash2 className="size-5!" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent align="center">
                          {t("user.user.columns.image.remove")}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                )}
              </Avatar>
              <UploadDialog
                open={openAttachment}
                imageOnly
                options={{
                  route: `${basePath}${currentQueryString}`,
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
        usePasswordConfirmationForDelete
        controls={() => {
          return (
            authUser.id === user.id && (
              <>
                <Button type="button" variant="outline" asChild>
                  <a href={route("users.connect-provider", [user.id, "google"])}>
                    <Link2 />
                    {t("user.user.connect_provider.connect_google")}
                  </a>
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => changePasswordDialogRef.current?.open()}
                >
                  {t("user.user.manage_password.change_password")}
                </Button>
              </>
            )
          );
        }}
      >
        <Form />
      </FormPage>
      <FormPageDialog
        ref={changePasswordDialogRef}
        name="change_password"
        ignoreDraft
        method="put"
        routeName="password.update"
        title={t("user.user.manage_password.change_password")}
      >
        <FormChangePassword />
      </FormPageDialog>
    </>
  );
}
