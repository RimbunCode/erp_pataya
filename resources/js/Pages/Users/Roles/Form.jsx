import { Alert, AlertIcon, AlertTitle } from "@/Components/ui/alert";
import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";
import { PlusIcon, Trash2Icon } from "lucide-react";
import React, { useCallback, useRef } from "react";

import { Button } from "@/Components/ui/button";
import { FormCheckbox } from "@/Components/ui/checkbox";
import FormInput from "@/Components/FormInput";
import FormNewRule from "./FormNewRule";
import { Input } from "@/Components/ui/input";
import { RiErrorWarningFill } from "@remixicon/react";
import { Textarea } from "@/Components/ui/textarea";
import { generateRandom } from "@/lib/utils";
import { toast } from "sonner";
import { useLaravelReactI18n } from "laravel-react-i18n";

function Form() {
  const { data, setData } = useFormPage();
  const { t } = useLaravelReactI18n();
  const ruleRef = useRef();
  const showDuplicateRuleAlert = useCallback(() => {
    toast.custom(
      (e) => (
        <Alert
          variant="destructive"
          icon="destructive"
          onClose={() => toast.dismiss(e)}
        >
          <AlertIcon>
            <RiErrorWarningFill />
          </AlertIcon>
          <AlertTitle>{t("user.role.errors.alert_already_exists")}</AlertTitle>
        </Alert>
      ),
      {
        duration: 5000,
      },
    );
  }, [t]);

  const hasDuplicateRule = useCallback(
    (rules, { permissionId, level, onlyCreator, excludeId }) =>
      (rules ?? []).some(
        (item) =>
          item.id !== excludeId &&
          item.permission_id === permissionId &&
          item.only_creator === onlyCreator &&
          item.level === level,
      ),
    [],
  );

  const onAddPermission = useCallback(
    (rule) => {
      if (!rule.model) return;
      const rules = data?.rules ?? [];
      const level = Number(rule.model?.is_submitable ? rule.level : 0);
      const onlyCreator = level > 0 ? false : rule.only_creator;
      if (
        hasDuplicateRule(rules, {
          permissionId: rule.model.id,
          level,
          onlyCreator,
        })
      ) {
        showDuplicateRuleAlert();
        return;
      }
      const permissionKeys =
        level > 0
          ? ["read", "write"]
          : onlyCreator
            ? rule.model.permissions.filter((p) => p !== "create")
            : rule.model.permissions;

      setData("rules", [
        {
          permission_id: rule.model.id,
          name: rule.model.name,
          level,
          only_creator: onlyCreator,
          is_submitable: level == 0 && rule.model?.is_submitable,
          permission: rule.model,
          id: generateRandom(8),
          isNew: true,
          permissions: Object.fromEntries(
            permissionKeys.map((k) => [k, false]),
          ),
          permissionKeys,
        },
        ...rules,
      ]);
    },
    [data?.rules, hasDuplicateRule, setData, showDuplicateRuleAlert],
  );
  // const onOnlyCreatorChange = useCallback(
  //   (val, rule) => {
  //     const nextOnlyCreator = val === true;
  //     const rules = data?.rules ?? [];
  //     if (
  //       hasDuplicateRule(rules, {
  //         permissionId: rule.permission_id,
  //         level: rule.level,
  //         onlyCreator: nextOnlyCreator,
  //         excludeId: rule.id,
  //       })
  //     ) {
  //       showDuplicateRuleAlert();
  //       return;
  //     }
  //     setData(
  //       "rules",
  //       rules.map((r) =>
  //         r.id === rule.id ? { ...r, only_creator: nextOnlyCreator } : r,
  //       ),
  //     );
  //   },
  //   [data?.rules, hasDuplicateRule, setData, showDuplicateRuleAlert],
  // );
  const onPermissionChange = useCallback(
    (rule, key, val) => {
      const nextValue = val === true;
      setData((prev) => {
        const rules = (prev.rules ?? []).map((r) => {
          if (r.id != rule.id) return r;

          let permissions = { ...r.permissions, [key]: nextValue };

          // RULE 1: kalau read = false
          if (key === "read" && !nextValue) {
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

          // RULE 2: selain read, kalau true -> read harus true
          if (key !== "read" && key !== "select" && nextValue === true) {
            permissions.read = true;

            // khusus import -> create ikut true
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
    },
    [setData],
  );
  const toggleAllPermissions = useCallback(
    (rule, val) => {
      const nextValue = val === true;
      setData((prev) => ({
        ...prev,
        rules: (prev.rules ?? []).map((r) =>
          r.id === rule.id
            ? {
                ...r,
                permissions: Object.fromEntries(
                  Object.entries(r.permissions).map(([k]) => [k, nextValue]),
                ),
              }
            : r,
        ),
      }));
    },
    [setData],
  );
  const getCheckState = useCallback((permissions, keys) => {
    let hasTrue = false,
      hasFalse = false;
    for (const k of keys) {
      permissions[k] ? (hasTrue = true) : (hasFalse = true);
      if (hasTrue && hasFalse) return "indeterminate";
    }

    return hasTrue ? true : false;
  }, []);
  const rules = data?.rules ?? [];
  return (
    <>
      <FormPageContent title={t("user.role.general")} value="general">
        <div className="grid gap-y-4 gap-x-4 grid-cols-2">
          <FormInput
            label={t("user.role.columns.name")}
            required={true}
            name="name"
          >
            <Input
              value={data?.name}
              onChange={(e) => setData("name", e.target.value)}
            />
          </FormInput>
          <FormInput
            label={t("user.role.columns.description")}
            name="description"
            className="col-span-full"
          >
            <Textarea
              value={data?.description ?? ""}
              onChange={(e) => setData("description", e.target.value)}
            />
          </FormInput>
          <FormCheckbox
            checked={data?.is_disabled}
            onCheckedChange={(val) => setData("is_disabled", val)}
            label={t("user.role.columns.is_disabled")}
          />
        </div>
      </FormPageContent>
      <FormPageContent
        title={t("user.role.permission_manager")}
        value="permission_manager"
      >
        <div className="grid gap-x-4 grid-cols-[minmax(auto,384px)_max-content_minmax(0,1fr)_64px] text-sm  [&>div>*]:px-4 max-w-full overflow-hidden">
          {/* Rules */}
          <div className="col-span-4 pb-1 mt-4 mb-2 border-b border-muted-foreground/25 flex justify-between">
            <h1 className="-ml-3 text-xl font-bold">{t("user.role.rules")}</h1>
            <Button
              variant="primary"
              type="button"
              onClick={() => ruleRef.current?.open()}
            >
              <PlusIcon />
              {t("user.role.add_rule")}
            </Button>
          </div>
          <div className="grid grid-cols-subgrid col-span-4 rounded-md py-2 bg-muted [&>div]:font-bold [&>div]:text-sm">
            <div>{t("user.role.columns.model")}</div>
            <div>{t("user.role.columns.level")}</div>
            <div>{t("user.role.columns.permissions")}</div>
          </div>
          {rules.length > 0 ? (
            rules.map((rule) => {
              const allChecked = getCheckState(
                rule?.permissions ?? [],
                rule?.permissionKeys ?? [],
              );
              return (
                <div
                  key={rule.id}
                  className="grid col-span-4 py-4 border-b grid-cols-subgrid border-muted-foreground/25"
                >
                  <div className="flex flex-col gap-y-2">
                    <span className="font-medium">{rule.name}</span>
                    {rule.level <= 0 &&
                      rule.permission.allow_only_creator &&
                      rule.only_creator && (
                        <span>{`(${t("user.role.columns.only_creator")})`}</span>
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
                        setData((prev) => ({
                          ...prev,
                          rules: (prev.rules ?? []).filter(
                            (r) => r.id !== rule.id,
                          ),
                        }));
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
      <FormNewRule ref={ruleRef} onApply={onAddPermission} />
    </>
  );
}

export default Form;
