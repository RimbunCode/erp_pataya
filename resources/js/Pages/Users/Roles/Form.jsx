import { Checkbox, FormCheckbox } from "@/Components/ui/checkbox";
import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";
import { PlusIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/Components/ui/button";
import FormInput from "@/Components/FormInput";
import { Input } from "@/Components/ui/input";
import React, { useCallback } from "react";
import { Textarea } from "@/Components/ui/textarea";
import { generateRandom } from "@/lib/utils";
import { toast } from "sonner";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { useState } from "react";
import PermissionLinkModel from "@/Pages/Core/PermissionLinkModel";

function Form() {
  const { data, setData } = useFormPage();
  const { t } = useLaravelReactI18n();
  const [newRule, setNewRule] = useState({ level: 0, only_creator: false });
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
    const permissionKeys =
      newRule.level > 0 ? ["read", "write"] : newRule.model.permissions;

    setData("rules", [
      {
        permission_id: newRule.model.id,
        name: newRule.model.name,
        level: Number(newRule.model?.is_submitable ? newRule.level : 0),
        only_creator: newRule.level > 0 ? false : newRule.only_creator,
        is_submitable: newRule.level == 0 && newRule.model?.is_submitable,
        id: generateRandom(8),
        isNew: true,
        permissions: Object.fromEntries(permissionKeys.map((k) => [k, false])),
        permissionKeys,
      },
      ...(data.rules ?? []),
    ]);
    setNewRule({ level: 0, only_creator: false });
  };
  const onOnlyCreatorChange = useCallback(
    (val, rule) => {
      if (
        data.rules?.findIndex(
          (r) =>
            r.permission_id == rule.permission_id &&
            r.only_creator === val &&
            r.level === rule.level,
        ) >= 0
      ) {
        toast(t("user.role.alert_already_exists"), {
          duration: 3000,
        });
        return;
      }
      setData(
        "rules",
        data?.rules.map((r) =>
          r.id === rule.id ? { ...r, only_creator: val } : r,
        ),
      );
    },
    [data.rules, t],
  );
  const onPermissionChange = useCallback((rule, key, val) => {
    setData((prev) => {
      const rules = prev.rules.map((r) => {
        if (r.id != rule.id) return r;

        let permissions = { ...r.permissions, [key]: val };

        // RULE 1: kalau read = false
        if (key === "read" && !val) {
          permissions = {
            ...permissions,
            write: false,
            ...(rule.level === 0 && {
              create: false,
              delete: false,
              amend: false,
              submit: false,
              cancel: false,
              import: false,
              export: false,
              share: false,
              print: false,
            }),
          };
        }

        // RULE 2: selain read, kalau true → read harus true
        if (key !== "read" && key !== "select" && val === true) {
          permissions.read = true;

          // khusus import → create ikut true
          if (key === "import") {
            permissions.create = true;
          }
        }

        // filter hanya key yang valid
        permissions = Object.fromEntries(
          Object.entries(permissions).filter(([k]) =>
            rule.permissionKeys?.includes(k),
          ),
        );

        return { ...r, permissions };
      });
      return {
        ...prev,
        rules: rules,
      };
    });
  }, []);
  const toggleAllPermissions = useCallback((rule, val) => {
    setData(
      "rules",
      data?.rules.map((r) =>
        r.id === rule.id
          ? {
              ...r,
              permissions: Object.fromEntries(
                Object.entries(r.permissions).map(([k]) => [k, val]),
              ),
            }
          : r,
      ),
    );
  });
  const getCheckState = useCallback((permissions, keys) => {
    let hasTrue = false,
      hasFalse = false;

    for (const k of keys) {
      permissions[k] ? (hasTrue = true) : (hasFalse = true);
      if (hasTrue && hasFalse) return "indeterminate";
    }

    return hasTrue ? true : false;
  }, []);
  return (
    <>
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
              value={data?.description ?? ""}
              onChange={(e) => setData("description", e.target.value)}
            />
          </FormInput>
          <FormCheckbox
            checked={data?.is_disabled}
            onCheckedChange={(val) => setData("is_disabled", val)}
            label="Disabled"
          />
        </div>
      </FormPageContent>
      <FormPageContent title="Permission Manager" value="permission_manager">
        <div className="grid gap-x-4 grid-cols-[minmax(auto,384px)_max-content_minmax(0,1fr)_64px] text-sm  [&>div>*]:px-4 max-w-full overflow-hidden">
          <div className="border-2 shadow-md rounded-xl p-4 grid col-span-4 grid-cols-subgrid [&_label]:text-base! mb-4 *:px-0! [&_[role=forminput]]:gap-y-0.5! border-b pb-4  border-muted-foreground/25">
            <div className="col-span-4 pb-1 mb-2 border-b border-muted-foreground/25">
              <h1 className="text-base font-bold">{t("user.role.new_rule")}</h1>
            </div>
            <FormInput
              label={t("user.role.columns.model")}
              required
              className="ml-1"
            >
              <PermissionLinkModel
                required={false}
                placeholder={t("user.role.columns.model.placeholder")}
                value={newRule.model}
                onValueChange={(val) =>
                  setNewRule((prev) => ({
                    ...prev,
                    model: val,
                    level: val?.is_submitable ? prev.level : 0,
                  }))
                }
              />
            </FormInput>
            <FormInput label={t("user.role.columns.level")}>
              <Input
                type="number"
                disabled={!(newRule.model?.is_submitable ?? false)}
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
              <FormInput
                label={t("user.role.columns.only_creator")}
                className="w-fit"
              >
                {(id) => (
                  <div className="flex items-center justify-center flex-1 w-full">
                    <Checkbox
                      disabled={
                        newRule.level > 0 ||
                        !(newRule.model?.is_submitable ?? false)
                      }
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
                  type="button"
                  variant="default"
                  className="h-8 w-fit"
                  onClick={onAddPermission}
                >
                  <PlusIcon className="size-5" />
                  {t("user.role.add_rule")}
                </Button>
              </FormInput>
            </div>
          </div>
          {/* Rules */}
          <div className="col-span-4 pb-1 mt-4 mb-2 border-b border-muted-foreground/25">
            <h1 className="-ml-3 text-xl font-bold">{t("user.role.rules")}</h1>
          </div>
          <div className="grid grid-cols-subgrid col-span-4 rounded-md py-2 bg-muted [&>div]:font-bold [&>div]:text-sm">
            <div>{t("user.role.columns.model")}</div>
            <div>{t("user.role.columns.level")}</div>
            <div>{t("user.role.columns.permissions")}</div>
          </div>
          {data?.rules && data?.rules.length > 0 ? (
            data?.rules.map((rule) => {
              const allChecked = getCheckState(
                rule?.permissions ?? [],
                rule?.permissionKeys ?? [],
              );
              return (
                <div
                  key={rule.id}
                  className="grid col-span-4 py-4 border-b grid-cols-subgrid border-muted-foreground/25"
                >
                  <div className="flex flex-col gap-y-4">
                    <span className="font-medium">{rule.name}</span>
                    {rule.level <= 0 && rule.is_submitable && (
                      <FormCheckbox
                        checked={rule.only_creator}
                        onCheckedChange={(val) =>
                          onOnlyCreatorChange(val, rule)
                        }
                        label={t("user.role.columns.only_creator")}
                      />
                    )}
                  </div>
                  <div className="font-medium text-center">{rule.level}</div>
                  <div className="columns-[76px] space-y-3 self-center items-center">
                    <FormCheckbox
                      checked={allChecked}
                      onCheckedChange={(val) => toggleAllPermissions(rule, val)}
                      label={t(`user.role.permissions.all`)}
                      classNameLabel="capitalize"
                    />
                    {rule.permissionKeys.map((key) => {
                      const value = rule.permissions[key] ?? false;
                      return (
                        <FormCheckbox
                          key={key}
                          checked={value}
                          onCheckedChange={(val) =>
                            onPermissionChange(rule, key, val)
                          }
                          label={t(`user.role.permissions.${key}`)}
                          classNameLabel="capitalize"
                        />
                      );
                    })}
                  </div>
                  <div className="flex justify-center">
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
    </>
  );
}

export default Form;
