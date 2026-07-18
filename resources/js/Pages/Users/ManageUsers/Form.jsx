import { Dialog, DialogContent, DialogHeader } from "@/Components/ui/dialog";
import { DialogDescription, DialogTitle } from "@radix-ui/react-dialog";
import { ExternalLinkIcon, MailCheckIcon, ShieldCheckIcon } from "lucide-react";
import {
  FormPageContent,
  FormPageContentTitle,
  useFormPage,
} from "@/Pages/Core/FormPage";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/Components/ui/input-group";
import React, { useCallback, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/Components/ui/tooltip";
import { WhenVisible, usePage } from "@inertiajs/react";

import { Button } from "@/Components/ui/button";
import DatetimePicker from "@/Components/DatetimePicker";
import { FormCheckbox } from "@/Components/ui/checkbox";
import FormInput from "@/Components/FormInput";
import { Input } from "@/Components/ui/input";
import LoadingIcon from "@/Components/LoadingIcon";
import QueryString from "qs";
import Select from "@/Components/Select";
import axios from "axios";
import { cn } from "@/lib/utils";
import { useLaravelReactI18n } from "laravel-react-i18n";

function Form() {
  const { user: authUser } = usePage().props.auth;
  const { t } = useLaravelReactI18n();
  const { roles, branches } = usePage().props;
  const { data, setData } = useFormPage();
  const route = window.route;
  const [openDetailRole, setOpenDetailRole] = useState(false);
  const [detailsRole, setDetailsRole] = useState();
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(false);

  const getDetailsRole = useCallback((id) => {
    setIsLoadingPermissions(true);
    axios
      .get(
        route("roles.show", Array.isArray(id) ? "id" : id) +
          (Array.isArray(id) ? "?" + QueryString.stringify({ ids: id }) : ""),
      )
      .then(({ data }) => {
        setDetailsRole(data);
        setOpenDetailRole(true);
      })
      .catch((err) => {
        console.log(err);
      })
      .finally(() => {
        setIsLoadingPermissions(false);
      });
  }, []);
  const getDetailAllRole = useCallback(() => {
    setIsLoadingPermissions(true);
    axios
      .get(
        route("roles.permissions") +
          "?" +
          QueryString.stringify({ ids: data.roles }),
      )
      .then(({ data }) => {
        setDetailsRole(data);
        setOpenDetailRole(true);
      })
      .catch((err) => {
        console.log(err);
      })
      .finally(() => {
        setIsLoadingPermissions(false);
      });
  }, [data?.roles]);

  return (
    <>
      <FormPageContent title={t("user.user.basic_info")} value="basic_info">
        {/* <FormPageTitle>Test</FormPageTitle>
        <FormPageDescription>
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Dolore,
          maiores.
        </FormPageDescription> */}
        <div className="grid pt-2 gap-x-8 gap-y-4 md:grid-cols-3">
          <FormInput
            label={t("user.user.columns.email")}
            required={true}
            error={
              authUser.id === data?.id &&
              !data?.email_verified_at &&
              t("user.user.columns.email.not_verified")
            }
          >
            <InputGroup>
              <InputGroupInput
                disabled={authUser.id != data?.id}
                type="email"
                value={data.email}
                onChange={(e) => setData("email", e.target.value)}
              />
              {data.email_verified_at ? (
                <InputGroupAddon align="inline-start">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <ShieldCheckIcon className="text-green-500 size-5" />
                    </TooltipTrigger>
                    <TooltipContent align="center" side="bottom">
                      {t("user.user.columns.email.verified")}
                    </TooltipContent>
                  </Tooltip>
                </InputGroupAddon>
              ) : (
                authUser.id == data?.id && (
                  <InputGroupAddon align="inline-end">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button type="button" variant="ghost" size="icon">
                          <MailCheckIcon />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent align="center" side="bottom">
                        {t("user.user.columns.email.verify")}
                      </TooltipContent>
                    </Tooltip>
                  </InputGroupAddon>
                )
              )}
            </InputGroup>
          </FormInput>
          <FormInput label={t("user.user.columns.username")} required={true}>
            <Input
              disabled={authUser.id != data?.id}
              value={data.username}
              onChange={(e) => setData("username", e.target.value)}
            />
          </FormInput>
          <FormInput label={t("user.user.columns.name")} required={true}>
            <Input
              disabled={authUser.id != data?.id}
              value={data.name}
              onChange={(e) => setData("name", e.target.value)}
            />
          </FormInput>
          <FormInput label={t("user.user.columns.gender")}>
            <Select
              disabled={authUser.id != data?.id}
              value={data.gender}
              onValueChange={(val) => setData("gender", val)}
              optionTrans="user.user.columns.gender.options"
              options={["male", "female"]}
            />
          </FormInput>
          <FormInput label={t("user.user.columns.phone")}>
            <Input
              disabled={authUser.id != data?.id}
              type="text"
              value={data.phone}
              onChange={(e) => setData("phone", e.target.value)}
            />
          </FormInput>
          <FormInput label={t("user.user.columns.birthdate")}>
            <DatetimePicker
              disabled={authUser.id != data?.id}
              type="date"
              value={data.birthdate}
              maxYear={new Date().getFullYear() - 15}
              yearRange={70}
              onValueChange={(val) => setData("birthdate", val)}
            />
          </FormInput>
        </div>
      </FormPageContent>
      {authUser.id != data?.id && (
        <>
          <FormPageContent
            title={t("user.user.roles_and_permissions")}
            value="roles_and_permissions"
          >
            <FormPageContentTitle className="flex justify-between gap-4">
              {t("user.user.roles")}
              <Button
                type="button"
                variant="primary"
                disabled={
                  isLoadingPermissions || !data.roles || data.roles?.length <= 0
                }
                onClick={() => getDetailAllRole()}
              >
                {isLoadingPermissions && <LoadingIcon className="size-4" />}{" "}
                {t("user.user.show_permissions")}
              </Button>
            </FormPageContentTitle>

            <WhenVisible
              data={["roles"]}
              fallback={
                <div className="text-base! font-normal text-foreground flex gap-x-4">
                  <LoadingIcon className="size-4" />
                  <span>{t("core.form.loading")} ...</span>
                </div>
              }
            >
              <div className="columns-[15rem] *:break-inside-avoid gap-x-2 space-y-4 mt-2">
                {roles &&
                  roles.map(
                    (role) =>
                      !role.is_disabled && (
                        <FormCheckbox
                          className="min-h-6 "
                          key={role.id}
                          disabled={isLoadingPermissions || role.is_disabled}
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
                          classNameLabel="text-sm font-medium leading-none cursor-pointer hover:underline peer-disabled:cursor-not-allowed peer-disabled:opacity-70 group flex items-center"
                        >
                          <div>
                            {isLoadingPermissions && (
                              <LoadingIcon className="size-4 mr-2!" />
                            )}{" "}
                            <span onClick={() => getDetailsRole(role.id)}>
                              {role.name}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className={cn(
                                " opacity-0 group-hover:opacity-100 transition-opacity ml-2 p-1! size-fit! [&>svg]:size-3",
                              )}
                              onClick={() => {
                                window.open(
                                  route("roles.show", role.id),
                                  "_blank",
                                );
                              }}
                            >
                              <ExternalLinkIcon />
                            </Button>
                          </div>
                        </FormCheckbox>
                      ),
                  )}
              </div>
            </WhenVisible>
          </FormPageContent>
          <FormPageContent
            title={t("user.user.roles_and_permissions")}
            value="roles_and_permissions"
          >
            <FormPageContentTitle>
              {t("user.user.branches")}
            </FormPageContentTitle>
            <WhenVisible
              data={["branches"]}
              fallback={
                <div className="text-base! font-normal text-foreground flex gap-x-4">
                  <LoadingIcon className="size-4" />
                  <span>{t("core.form.loading")} ...</span>
                </div>
              }
            >
              <div className="columns-[15rem] gap-x-2 space-y-4 mt-2">
                {branches &&
                  branches.map((branch) => (
                    <FormCheckbox
                      key={branch.id}
                      disabled={branch.is_disabled}
                      checked={data.branches?.includes(branch.id)}
                      onCheckedChange={(val) => {
                        if (val) {
                          setData("branches", [...data.branches, branch.id]);
                        } else {
                          setData(
                            "branches",
                            data.branches?.filter((x) => x !== branch.id),
                          );
                          if (branch.id == data.default_branch_id) {
                            setData("default_branch_id", null);
                          }
                        }
                      }}
                      classNameLabel="text-sm font-medium leading-none cursor-pointer hover:underline peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      label={branch.name}
                    />
                  ))}
              </div>
            </WhenVisible>
            <FormInput
              className="max-w-sm mt-4"
              label={t("user.user.default_branch")}
              required={true}
            >
              <Select
                value={data.default_branch_id}
                onValueChange={(val) => setData("default_branch_id", val)}
                options={
                  branches?.map((x) => ({
                    value: x.id,
                    label: x.name,
                  })) ?? []
                }
              />
            </FormInput>
          </FormPageContent>
        </>
      )}
      <Dialog open={openDetailRole} onOpenChange={setOpenDetailRole}>
        <DialogContent className="max-w-(--breakpoint-lg) max-h-[85vh] flex flex-col overflow-hidden border-muted-foreground/25">
          <DialogHeader className="pb-2 border-b border-muted-foreground/25 shrink-0">
            <DialogTitle className="font-bold">
              {(detailsRole && detailsRole.name) ?? t("user.user.permissions")}
            </DialogTitle>
            <DialogDescription className="sr-only"></DialogDescription>
          </DialogHeader>
          <div className="grid [&>div]:px-3 gap-x-1 grid-cols-[minmax(auto,1fr)_max-content_min-content_repeat(12,max-content)] text-sm [&>div>*]:px-1h max-w-full w-full overflow-auto [&>div>*]:h-full [&>div>*]:items-center [&>div>*]:flex [&>div>*]:justify-center [&>div>*]:py-2 [&>div>*:not(:last-child)]:border-0">
            <div className="grid grid-cols-subgrid col-span-full items-center rounded-md bg-muted [&>div]:font-bold [&>div]:text-xs lg:[&>div]:text-sm">
              <div className="px-2! justify-start! text-left">
                {t("user.role.columns.model")}
              </div>
              <div className="px-2! text-center border-l! border-muted-foreground/30!">
                {t("user.role.columns.level")}
              </div>
              <div className="px-2! text-center border-x! border-muted-foreground/30! text-wrap">
                {t("user.role.columns.only_creator")}
              </div>
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
                  <div className="px-2! justify-start! text-left">
                    {rule.name}
                  </div>
                  <div className="px-2! text-center border-l! border-muted-foreground/30!">
                    {rule.level}
                  </div>
                  <div className="px-2! text-center border-x! border-muted-foreground/30!">
                    {rule.only_creator ? "✓" : "-"}
                  </div>
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

export default Form;
