import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import AppLayout from "@/Layouts/AppLayout";
import { Head, useForm } from "@inertiajs/react";
import {
  FormChildren,
  FormPageContent,
  FormPageSaveButton,
} from "@/Pages/Core/FormPage";
import { gooeyToast as toast } from "@/lib/gooeyToast";
import { useLaravelReactI18n } from "laravel-react-i18n";

/**
 * ModuleSettingsPage: wrapper halaman setting per-modul.
 * Menyediakan tab, tombol simpan, badge belum tersimpan, toast sukses/error,
 * dan mode baca-saja jika canWrite=false.
 * @param root0
 * @param root0.title
 * @param root0.name
 * @param root0.setting
 * @param root0.canWrite
 * @param root0.tabs
 * @param root0.readOnlyFields
 * @param root0.children
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
  const [savingAdditionalSettings, setSavingAdditionalSettings] =
    useState(false);
  const [additionalSettingsDirty, setAdditionalSettingsDirty] = useState(false);
  const additionalSaveHandler = useRef(null);
  const submissionInFlight = useRef(false);
  const registerSaveHandler = useCallback(
    (preparePayload, callbacks = {}, dirty = false) => {
      additionalSaveHandler.current = preparePayload
        ? { preparePayload, callbacks }
        : null;
      setAdditionalSettingsDirty(!!preparePayload && dirty);
    },
    [],
  );
  const pageTitle = title || t(`${name}.setting.title`, `${name} Settings`);

  const initialValues = useMemo(() => {
    const excluded = [
      "id",
      "singleton",
      "created_at",
      "updated_at",
      ...readOnlyFields,
    ];
    return Object.fromEntries(
      Object.entries(setting ?? {}).filter(
        ([field]) => !excluded.includes(field),
      ),
    );
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canWrite || processing || submissionInFlight.current) return;

    submissionInFlight.current = true;
    setSavingAdditionalSettings(true);
    const handler = additionalSaveHandler.current;
    const callbacks = handler?.callbacks ?? {};
    const finishSave = () => {
      submissionInFlight.current = false;
      setSavingAdditionalSettings(false);
    };

    try {
      let additionalPayload = {};
      if (handler && additionalSettingsDirty) {
        const prepared = await handler.preparePayload();
        if (prepared === false) {
          finishSave();
          return;
        }
        if (
          !Array.isArray(prepared?.tax_rules) ||
          !Array.isArray(prepared?.warehouse_rules)
        ) {
          throw new Error(
            t("core.form.save_failed", "Failed to save settings"),
          );
        }
        additionalPayload = {
          tax_rules: prepared.tax_rules,
          warehouse_rules: prepared.warehouse_rules,
          rules_version: prepared.rules_version,
        };
      }

      const routeName = `moduleSettings.${name}.update`;
      const targetUrl = window.route
        ? window.route(routeName)
        : `/settings/modules/${name}`;

      form.transform((values) => ({ ...values, ...additionalPayload }));
      callbacks.onStart?.();
      put(targetUrl, {
        preserveScroll: true,
        onSuccess: (page) => {
          if (page?.props?.setting) {
            const savedValues = Object.fromEntries(
              Object.entries(page.props.setting).filter(([field]) =>
                Object.hasOwn(initialValues, field),
              ),
            );
            setData(savedValues);
            setDefaults(savedValues);
          }
          callbacks.onSuccess?.(page);
          toast.success(t("core.form.saved", "Settings saved successfully"));
        },
        onError: (errs) => {
          callbacks.onError?.(errs);
          const firstError = Object.values(errs || {})[0];
          toast.error(
            firstError || t("core.form.save_failed", "Failed to save settings"),
          );
        },
        onCancel: () => callbacks.onCancel?.(),
        onNetworkError: (event) => callbacks.onNetworkError?.(event),
        onHttpException: (event) => callbacks.onHttpException?.(event),
        onFinish: () => {
          try {
            callbacks.onFinish?.();
          } finally {
            finishSave();
          }
        },
      });
    } catch (error) {
      finishSave();
      toast.error(
        error?.message || t("core.form.save_failed", "Failed to save settings"),
      );
    }
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
            {(isDirty || additionalSettingsDirty) && (
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
              <FormPageSaveButton
                disabled={processing || savingAdditionalSettings}
                data-testid="save-button"
              />
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
              <FormPageContent
                key={tab.value}
                value={tab.value}
                title={tab.label || tab.title}
                forceMount={tab.forceMount}
              >
                {typeof children === "function"
                  ? children({
                      data,
                      setData,
                      disabled: !canWrite,
                      errors,
                      tab: tab.value,
                      registerSaveHandler,
                    })
                  : children}
              </FormPageContent>
            ))}
          </FormChildren>
        </div>
      </form>
    </AppLayout>
  );
}
