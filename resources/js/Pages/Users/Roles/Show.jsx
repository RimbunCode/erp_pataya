/* eslint-disable jsdoc/require-jsdoc */
import { FormPage, FormPageContent } from "@/Pages/Core/FormPage";
import { PlusIcon, SaveIcon, Trash2Icon } from "lucide-react";
import React from "react";

import { Button } from "@/Components/ui/button";
import { Checkbox } from "@/Components/ui/checkbox";
import Combobox from "@/Components/Combobox";
import { CommandItem } from "@/Components/ui/command";
import FormInput from "@/Components/FormInput";
import { Input } from "@/Components/ui/input";
import QueryString from "qs";
import { Textarea } from "@/Components/ui/textarea";
import axios from "axios";
import { generateRandom } from "@/lib/utils";
import { toast } from "sonner";
import useDidMountEffect from "@/Hooks/useDidMountEffect";
import { useDraftForm } from "@/Hooks/useDraftForm";
import { useState } from "react";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Show({ role }) {
  const { data, setData, put, post, processing, errors, isDirty } =
    useDraftForm("role", role);
  const { t } = useLaravelReactI18n();
  const route = window.route;
  const [newRule, setNewRule] = useState({ level: 0, only_creator: false });
  const [models, setModels] = useState([]);
  const [searchModel, setSearchModel] = useState("");

  useDidMountEffect(() => {
    const reloadModel = setTimeout(() => {
      axios
        .get(
          `${route("roles.permissions")}?${QueryString.stringify({ search: searchModel })}`,
        )
        .then((res) => {
          setModels(res.data);
        })
        .catch((err) => {
          console.log(err);
        });
    }, 500);
    return () => {
      clearTimeout(reloadModel);
    };
  }, [searchModel]);

  const onAddPermission = () => {
    if (!newRule.model) return;
    if (
      data.rules?.findIndex(
        (r) =>
          r.permission_id == newRule.model.id &&
          r.only_creator === newRule.only_creator &&
          r.level === newRule.level,
      ) >= 0
    ) {
      toast("Rule already exists", {
        duration: 3000,
      });
      return;
    }
    setData("rules", [
      ...(data.rules ?? []),
      {
        permission_id: newRule.model.id,
        name: newRule.model.name,
        level: newRule.level,
        only_creator: newRule.level > 0 ? false : newRule.only_creator,
        id: generateRandom(8),
        isNew: true,
        permissions: Object.fromEntries(
          (newRule.level > 0
            ? ["read", "write"]
            : newRule.model.permissions
          ).map((k) => [k, false]),
        ),
      },
    ]);
    setNewRule({ level: 0, only_creator: false });
  };
  const onSubmit = (e) => {
    e.preventDefault();
    if (role) {
      put(route("roles.update", role.id), {
        reset: ["role"],
      });
    } else {
      post(route("roles.store"));
    }
  };
  return (
    <FormPage
      isCreate={!role}
      errors={errors}
      fieldNameTrans="user.role.columns"
      disabled={processing}
      title={role?.name ?? t("user.role.new")}
      onSubmit={onSubmit}
      badge={
        isDirty && <span className="text-sm badge warning">Not Saved</span>
      }
      controls={
        <Button
          type="submit"
          className="!p-2 size-fit h-8"
          disabled={processing}
        >
          <SaveIcon />
          Save
        </Button>
      }
    >
      <FormPageContent title="General" value="general">
        <div className="grid gap-y-4 gap-x-4">
          <FormInput label="Name" required={true} name="name">
            <Input
              value={data?.name}
              onChange={(e) => setData("name", e.target.value)}
            />
          </FormInput>
          <FormInput label="Description" name="description">
            <Textarea
              value={data?.description}
              onChange={(e) => setData("description", e.target.value)}
            />
          </FormInput>

          <div role="forminput" className="flex items-center space-x-2">
            <Checkbox
              id="disabled"
              checked={data?.is_disabled}
              onCheckedChange={(val) => setData("is_disabled", val)}
            />
            <label
              htmlFor="disabled"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Disabled
            </label>
          </div>
        </div>
      </FormPageContent>
      <FormPageContent title="Permission Manager" value="permission_manager">
        <div className="grid gap-x-4 grid-cols-[minmax(auto,512px)_max-content_minmax(auto,512px)_max-content] text-sm  [&>div>*]:px-4 max-w-full overflow-hidden">
          <div className="grid col-span-4 grid-cols-subgrid [&_label]:!text-base mb-4 [&>*]:!px-0 [&_[role=forminput]]:!gap-y-0.5 border-b pb-4  border-muted-foreground/25">
            <div className="col-span-4 pb-1 mb-2 border-b border-muted-foreground/25">
              <h1 className="text-base font-bold">{t("user.role.new_rule")}</h1>
            </div>
            <FormInput label={t("user.role.model")} required>
              <Combobox
                search={searchModel}
                onSearchChange={setSearchModel}
                options={models}
                value={newRule.model}
                placeholder={t("user.role.model.placeholder")}
                templateTrigger={(model) => {
                  return <>{model.name}</>;
                }}
                templateItem={(model) => {
                  return (
                    <CommandItem
                      key={model.id}
                      value={`${model.module}_${model.name}`}
                      keywords={[model.module, model.name]}
                      onSelect={() => {
                        setNewRule((prev) => ({ ...prev, model }));
                      }}
                      className="block px-4 "
                    >
                      <p className="font-medium">{model.name}</p>
                      <p className="text-xs">{model.module}</p>
                    </CommandItem>
                  );
                }}
              />
            </FormInput>
            <FormInput label={t("user.role.level")}>
              <Input
                type="number"
                value={newRule.level}
                onChange={(e) => {
                  setNewRule((prev) => ({ ...prev, level: e.target.value }));
                }}
                min={0}
                max={9}
                className="w-16 text-center"
              />
            </FormInput>
            <div className="flex justify-between col-span-2 gap-x-4">
              <FormInput label={t("user.role.only_creator")} className="w-fit">
                {(id) => (
                  <div className="flex items-center justify-center flex-1 w-full">
                    <Checkbox
                      disabled={newRule.level > 0}
                      id={id}
                      checked={newRule.level > 0 ? false : newRule.only_creator}
                      onCheckedChange={(val) =>
                        setNewRule((prev) => ({ ...prev, only_creator: val }))
                      }
                    />
                  </div>
                )}
              </FormInput>
              <FormInput label="" className="justify-end w-fit">
                <Button
                  variant="default"
                  className="h-8 w-fit"
                  type="submit"
                  onClick={onAddPermission}
                >
                  <PlusIcon className="size-5" />
                  {t("user.role.add_rule")}
                </Button>
              </FormInput>
            </div>
          </div>
          {/* Rules */}
          <div className="grid grid-cols-subgrid col-span-4 rounded-md py-2 bg-muted [&>div]:font-bold [&>div]:text-sm">
            <div>{t("user.role.model")}</div>
            <div>{t("user.role.level")}</div>
            <div>{t("user.role.only_creator")}</div>
          </div>
          {data?.rules && data?.rules.length > 0 ? (
            data?.rules.map((rule) => {
              return (
                <div
                  key={rule.id}
                  className="grid col-span-4 py-4 border-b grid-cols-subgrid border-muted-foreground/25"
                >
                  <div className="flex flex-col gap-y-4">
                    <span className="font-medium">{rule.name}</span>
                    {rule.level <= 0 && (
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={rule.id + "_checked"}
                          checked={rule.only_creator}
                          onCheckedChange={(val) => {
                            setData(
                              "rules",
                              data?.rules.map((r) =>
                                r.id === rule.id
                                  ? { ...r, only_creator: val }
                                  : r,
                              ),
                            );
                          }}
                        />
                        <label
                          htmlFor={rule.id + "_checked"}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {t("user.role.only_creator")}
                        </label>
                      </div>
                    )}
                  </div>
                  <div className="font-medium text-center">{rule.level}</div>
                  <div className="columns-[76px] space-y-4 self-center items-center">
                    {Object.entries(rule.permissions ?? {}).map(
                      ([key, value]) => {
                        return (
                          <div
                            className="flex items-center space-x-2 w-fit"
                            key={key}
                          >
                            <Checkbox
                              id={`${rule.id}_${key}_checkbox`}
                              checked={value}
                              onCheckedChange={(val) =>
                                setData(
                                  "rules",
                                  data?.rules.map((r) => {
                                    if (r.id != rule.id) return r;

                                    return {
                                      ...r,
                                      permissions: {
                                        ...r.permissions,
                                        [key]: val,
                                      },
                                    };
                                  }),
                                )
                              }
                            />
                            <label
                              htmlFor={`${rule.id}_${key}_checkbox`}
                              className="text-sm leading-none capitalize peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              {t(`user.role.permissions.${key}`)}
                            </label>
                          </div>
                        );
                      },
                    )}
                  </div>
                  <div>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="size-8"
                      onClick={() => {
                        setData(
                          "rules",
                          data?.rules.filter((r) => r.id !== rule.id),
                        );
                      }}
                    >
                      <Trash2Icon className="size-5" />
                    </Button>
                  </div>
                </div>
              );
            })
          ) : (
            // No rules
            <div className="grid col-span-4 py-4 border-b grid-cols-subgrid border-muted-foreground/25">
              <p className="flex flex-col col-span-4 text-center gap-y-4">
                <span className="font-medium">No rules found</span>
              </p>
            </div>
          )}
        </div>
      </FormPageContent>
    </FormPage>
  );
}
