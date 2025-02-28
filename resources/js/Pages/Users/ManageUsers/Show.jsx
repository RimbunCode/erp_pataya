/* eslint-disable jsdoc/require-jsdoc */
import { Avatar, AvatarFallback, AvatarImage } from "@/Components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTrigger,
} from "@/Components/ui/dialog";
import { DialogDescription, DialogTitle } from "@radix-ui/react-dialog";
import {
  FormPage,
  FormPageContent,
  FormPageContentTitle,
} from "@/Pages/Core/FormPage";
import React, { useCallback, useMemo, useState } from "react";
import { SaveIcon, Trash2, UploadIcon } from "lucide-react";
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

import { Button } from "@/Components/ui/button";
import { Checkbox } from "@/Components/ui/Checkbox";
import DatetimePicker from "@/Components/DatetimePicker";
import FormInput from "@/Components/FormInput";
import { Input } from "@/Components/ui/input";
import UploadDialog from "@/Pages/Core/Components/UploadDialog";
import axios from "axios";
import { useDraftForm } from "@/Hooks/useDraftForm";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Show({ user, roles, auth }) {
  const { t } = useLaravelReactI18n();
  const { data, setData, put, processing, errors, reset, isDirty } =
    useDraftForm("user", user);
  const route = window.route;
  const [openAttachment, setOpenAttachment] = useState(false);
  const [openDetailRole, setOpenDetailRole] = useState(false);
  const [detailsRole, setDetailsRole] = useState();
  const alias = user.name
    .split(" ")
    .slice(0, 2)
    .map((n) => n.charAt(0))
    .join("");
  const onSubmit = (e) => {
    e.preventDefault();

    put(route("users.update", user.id));
  };

  const getDetailsRole = useCallback((id) => {
    axios
      .get(route("roles.show", id))
      .then(({ data }) => {
        setDetailsRole(data);
        setOpenDetailRole(true);
      })
      .catch((err) => {
        console.log(err);
      });
  }, []);

  const avatar = useMemo(() => {
    if (!user.image) return null;
    return (
      <AvatarImage
        src={
          route("files.show", user.image) +
          `?v=${new Date(user.updated_at).getTime()}`
        }
        alt={user.name}
        className=" transition-[filter] group-hover:blur-sm"
      />
    );
  }, [user.image]);
  return (
    <>
      <FormPage
        disabled={processing}
        title={user.name}
        badge={
          isDirty && (
            <span className="text-sm badge warning">
              {t("core.form.not_saved")}
            </span>
          )
        }
        controls={
          <Button
            role="save"
            className="!p-2 size-fit h-8"
            onClick={onSubmit}
            disabled={processing}
          >
            <SaveIcon />
            {t("core.form.save")}
          </Button>
        }
        sidebarContent={(defaultComp) => (
          <>
            <Dialog open={openAttachment} onOpenChange={setOpenAttachment}>
              <Avatar className="relative w-full h-auto border rounded-xl aspect-square max-w-64 group">
                {avatar}
                <AvatarFallback className="rounded-lg ">
                  <p className="w-full font-semibold text-center text-muted-foreground text-9xl  transition-[filter]">
                    {alias}
                  </p>
                </AvatarFallback>
                <div className="absolute flex items-center justify-center w-full h-full transition-opacity border opacity-0 cursor-pointer group-hover:opacity-100 bg-background/25 rounded-xl gap-x-4">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DialogTrigger asChild>
                        <Button variant="default" size="icon">
                          <UploadIcon className="!size-5" />
                        </Button>
                      </DialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent align="center">Upload</TooltipContent>
                  </Tooltip>
                  {user.image && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="destructive" size="icon">
                          <Trash2 className="!size-5" />
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
        <FormPageContent title={t("user.user.basic_info")} value="basic_info">
          {/* <FormPageTitle>Test</FormPageTitle>
        <FormPageDescription>
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Dolore,
          maiores.
        </FormPageDescription> */}
          <div className="grid pt-2 gap-x-8 gap-y-4 md:grid-cols-3">
            <FormInput label={t("user.user.columns.email")} required={true}>
              <Input
                type="email"
                value={data.email}
                onChange={(e) => setData("email", e.target.value)}
              />
            </FormInput>
            <FormInput label={t("user.user.columns.username")} required={true}>
              <Input
                value={data.username}
                onChange={(e) => setData("username", e.target.value)}
              />
            </FormInput>
            <FormInput label={t("user.user.columns.name")} required={true}>
              <Input
                value={data.name}
                onChange={(e) => setData("name", e.target.value)}
              />
            </FormInput>
            <FormInput label={t("user.user.columns.gender")}>
              <Select
                value={data.gender}
                onValueChange={(val) => setData("gender", val)}
              >
                <SelectTrigger className="">
                  <SelectValue placeholder="Gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </FormInput>
            <FormInput label={t("user.user.columns.phone")}>
              <Input
                type="text"
                value={data.phone}
                onChange={(e) => setData("phone", e.target.value)}
              />
            </FormInput>
            <FormInput label={t("user.user.columns.birthdate")}>
              <DatetimePicker
                type="date"
                value={data.birthdate}
                onValueChange={(val) => setData("birthdate", val)}
              />
            </FormInput>
          </div>
        </FormPageContent>
        {auth.user.id != user.id && (
          <FormPageContent title={t("user.user.roles")} value="roles">
            <FormPageContentTitle>{t("user.user.roles")}</FormPageContentTitle>
            <div className="columns-[15rem] gap-x-2 mt-2">
              {roles &&
                roles.map((role) => (
                  <div className="flex items-center space-x-2" key={role.id}>
                    <Checkbox
                      id={role.id + "_Checkbox"}
                      disabled={role.is_disabled}
                      checked={data.roles.includes(role.id)}
                      onCheckedChange={(val) => {
                        if (val) {
                          setData("roles", [...data.roles, role.id]);
                        } else {
                          setData(
                            "roles",
                            data.roles.filter((x) => x !== role.id),
                          );
                        }
                      }}
                    />
                    <span
                      onClick={() => getDetailsRole(role.id)}
                      className="text-sm font-medium leading-none cursor-pointer hover:underline peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {role.name}
                    </span>
                  </div>
                ))}
            </div>
          </FormPageContent>
        )}
      </FormPage>
      <Dialog open={openDetailRole} onOpenChange={setOpenDetailRole}>
        <DialogContent className="max-w-screen-lg border-muted-foreground/25">
          <DialogHeader className="pb-2 border-b border-muted-foreground/25">
            <DialogTitle className="font-bold">
              {detailsRole && detailsRole.name}
            </DialogTitle>
            <DialogDescription className="sr-only"></DialogDescription>
          </DialogHeader>
          <div className="grid [&>div]:px-3 gap-x-1 grid-cols-[minmax(auto,1fr)_max-content_auto_repeat(12,max-content)] text-sm [&>div>*]:px-1h max-w-full w-full overflow-x-auto [&>div>*]:h-full [&>div>*]:items-center [&>div>*]:flex [&>div>*]:justify-center [&>div>*]:py-2 [&>div>*:not(:last-child)]:border-0">
            <div className="grid grid-cols-subgrid col-span-full items-center rounded-md bg-muted [&>div]:font-bold [&>div]:text-xs lg:[&>div]:text-sm">
              <div className="!pr-2 !pl-2 !justify-start text-left">Model</div>
              <div className="text-center">Level</div>
              <div className="text-center">If Owner</div>
              {[
                "select",
                "read",
                "write",
                "create",
                "delete",
                "submit",
                "cancel",
                "amend",
                "print",
                "import",
                "export",
                "share",
              ].map((x) => (
                <div key={x} className="text-center capitalize">
                  {x}
                </div>
              ))}
            </div>
            {detailsRole?.rules &&
              detailsRole.rules.map((rule) => (
                <div
                  key={rule.id}
                  className="grid border-b col-span-full items-center grid-cols-subgrid border-muted-foreground/25 [&>div]:text-xs lg:[&>div]:text-sm"
                >
                  <div className="!pr-2 !justify-start text-left">
                    {rule.name}
                  </div>
                  <div className="text-center">{rule.level}</div>
                  <div className="text-center">{rule.if_owner ? "✓" : "-"}</div>
                  {[
                    "select",
                    "read",
                    "write",
                    "create",
                    "delete",
                    "submit",
                    "cancel",
                    "amend",
                    "print",
                    "import",
                    "export",
                    "share",
                  ].map((x) => (
                    <div key={x} className="text-center">
                      {rule.permissions[x] ? "✓" : "-"}
                    </div>
                  ))}
                </div>
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
