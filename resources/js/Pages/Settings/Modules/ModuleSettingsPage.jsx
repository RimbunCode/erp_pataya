import React, { useEffect, useMemo, useRef } from "react";
import AppLayout from "@/Layouts/AppLayout";
import { Head, useForm } from "@inertiajs/react";
import { Button } from "@/Components/ui/button";
import { SaveIcon } from "lucide-react";
import { FormChildren, FormPageContent } from "@/Pages/Core/FormPage";
import { gooeyToast as toast } from "@/lib/gooeyToast";
import { useLaravelReactI18n } from "laravel-react-i18n";

/**
 * ModuleSettingsPage: wrapper halaman setting per-modul.
 * Menyediakan tab, tombol simpan, badge belum tersimpan, toast sukses/error,
 * dan mode baca-saja jika canWrite=false.
 */
export default function ModuleSettingsPage({
  title,
  name,
  setting = {},
  canWrite = true,
  tabs = [],
  readOnlyFields = [],
  children,
}) {
  const { t } = useLaravelReactI18n();
  const pageTitle = title || t(`${name}.setting.title`, `${name} Settings`);

  const initialValues = useMemo(() => {
    const excluded = ["id", "singleton", "created_at", "updated_at", ...readOnlyFields];
    return Object.fromEntries(Object.entries(setting ?? {}).filter(([field]) => !excluded.includes(field)));
  }, [setting, readOnlyFields]);
  const form = useForm(initialValues);
  const { data, setData, setDefaults, put, processing, isDirty, errors } = form;
  const lastServerValues = useRef(JSON.stringify(initialValues));
  const pageTabs = tabs.length > 0 ? tabs : [{ value: "default" }];

  useEffect(() => {
    const serialized = JSON.stringify(initialValues);
    if (serialized === lastServerValues.current) return;
    if (!isDirty) {
      lastServerValues.current = serialized;
      setData(initialValues);
      setDefaults(initialValues);
    }
  }, [initialValues, isDirty, setData, setDefaults]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canWrite || processing) return;

    const routeName = `moduleSettings.${name}.update`;
    const targetUrl = window.route
      ? window.route(routeName)
      : `/settings/modules/${name}`;

    put(targetUrl, {
      preserveScroll: true,
      onSuccess: (page) => {
        if (page?.props?.setting) {
          const savedValues = Object.fromEntries(
            Object.entries(page.props.setting).filter(([field]) => Object.hasOwn(initialValues, field)),
          );
          setData(savedValues);
          setDefaults(savedValues);
        }
        toast.success(t("core.form.saved", "Settings saved successfully"));
      },
      onError: (errs) => {
        const firstError = Object.values(errs || {})[0];
        toast.error(
          firstError || t("core.form.save_failed", "Failed to save settings"),
        );
      },
    });
  };

  return (
    <AppLayout className="pt-0! relative group/form">
      <Head title={pageTitle} />

      <form onSubmit={handleSubmit} role="form" aria-readonly={!canWrite}>
        <div
          data-header
          className="sticky top-0 z-10 flex items-center justify-between pt-4 pb-2 border-b gap-x-4 bg-background border-muted-foreground/25"
        >
          <div className="flex items-center gap-x-2">
            <h1 className="text-xl font-bold">{pageTitle}</h1>
            {isDirty && (
              <span
                className="text-sm badge warning"
                data-testid="unsaved-badge"
              >
                {t("core.form.not_saved", "Not saved")}
              </span>
            )}
            {!canWrite && (
              <span
                className="text-sm badge secondary"
                data-testid="readonly-badge"
              >
                {t("core.form.read_only", "Read only")}
              </span>
            )}
          </div>

          <div className="flex items-center gap-x-2">
            {canWrite && (
              <Button
                type="submit"
                disabled={processing}
                className="p-2! size-fit h-8"
                data-testid="save-button"
              >
                <SaveIcon className="w-4 h-4 mr-1" />
                {t("core.form.save", "Save")}
              </Button>
            )}
          </div>
        </div>

        {errors && Object.keys(errors).length > 0 && (
          <div className="flex-col w-full mt-4 alert error" role="alert">
            <ul className="pl-5">
              {Object.entries(errors).map(([key, msg]) => (
                <li key={key} className="list-disc text-sm">
                  {msg}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4">
          <FormChildren
            form={form}
            data={data}
            setData={setData}
            defaultData={setting}
            disabled={!canWrite}
            errors={errors}
            defaultMenu={pageTabs[0].value}
            showHeader
          >
            {pageTabs.map((tab) => (
              <FormPageContent key={tab.value} value={tab.value} title={tab.label || tab.title}>
                {typeof children === "function"
                  ? children({ data, setData, disabled: !canWrite, errors, tab: tab.value })
                  : children}
              </FormPageContent>
            ))}
          </FormChildren>
        </div>
      </form>
    </AppLayout>
  );
}
