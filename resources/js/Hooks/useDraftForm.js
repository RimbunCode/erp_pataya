import {
  getFromLocalStorage,
  isDeepEmpty,
  removeFromLocalStorage,
  saveToLocalStorage,
} from "@/lib/utils";
import { useCallback, useEffect } from "react";
import { useForm, usePage } from "@inertiajs/react";

import { create } from "zustand";
import useDidMountEffect from "./useDidMountEffect";
import { useIsDirtyForm } from "./useIsDirtyForm";

export const useAlertDraftForm = create((set) => ({
  showAlert: false,
  setShowAlert: (value) => set({ showAlert: value }),
  cancel: () => {},
  setCancel: (value) => set({ cancel: value }),
  continue: () => {},
  setContinue: (value) => set({ continue: value }),
}));
/**
 *
 * @callback onContinueDraft
 * @returns {void}
 */

/**
 * @param {string} name kunci untuk menyimpan data pada cookie
 * @param {object} initialData
 * @typedef {object} OptionsProps
 * @property {number=} expiredDays jumlah hari berlaku cookie
 * @property {onContinueDraft} onContinueDraft callback ketika data berhasil disimpan
 * @param {OptionsProps} options
 * @returns {import("@inertiajs/react").InertiaFormProps<any>}
 */
export const useDraftForm = (
  name,
  initialData,
  {
    expiredDays = 7,
    onContinueDraft,
    isCreate = false,
    isDialog = false,
    ignoreDraft = false,
  } = {},
) => {
  const { setShowAlert, setCancel, setContinue } = useAlertDraftForm();
  const { setIsDirty, setProcessing, setRecentlySuccessful } = useIsDirtyForm();
  const user = usePage().props.auth.user;
  let key = user ? `${name}_${user.id}` : null;
  key = isCreate
    ? `${key}_create`
    : `${key}_update_${initialData?.id ?? initialData?.code ?? ""}`;
  const {
    submit: submitForm,
    get: getForm,
    patch: patchForm,
    post: postForm,
    put: putForm,
    delete: deleteForm,
    ...form
  } = useForm(initialData ?? {});

  useDidMountEffect(() => {
    setIsDirty(form.isDirty);
    if (!form.isDirty) {
      removeFromLocalStorage(key);
    }
  }, [form.isDirty]);
  useDidMountEffect(() => {
    setProcessing(form.processing);
  }, [form.processing]);
  useDidMountEffect(() => {
    setRecentlySuccessful(form.recentlySuccessful);
  }, [form.recentlySuccessful]);

  useEffect(() => {
    if (form.recentlySuccessful) {
      form.reset();
    }
  }, [initialData]);
  useDidMountEffect(() => {
    if (key != null && form.isDirty) {
      saveToLocalStorage(key, form.data, expiredDays);
    }
    if (!form.isDirty) {
      removeFromLocalStorage(key);
    }
  }, [form.data, form.isDirty, key, expiredDays]);

  const loadDraft = useCallback(() => {
    let dataCookie = getFromLocalStorage(key);
    if (!dataCookie || isDeepEmpty(dataCookie)) return;
    setCancel(() => {
      form.reset();
      removeFromLocalStorage(key);
    });
    setContinue(() => {
      form.setData(dataCookie);
      removeFromLocalStorage(key);
      onContinueDraft?.();
    });
    setShowAlert(true);
  }, [key]);
  useEffect(() => {
    if (isDialog) return;
    if (ignoreDraft) return;
    loadDraft();
  }, []);

  const getOptions = useCallback(
    (options) => {
      return {
        ...(isCreate || isDialog
          ? {
              preserveState: false,
              preserveScroll: false,
              preserveUrl: false,
            }
          : {
              reset: name ? [name, "logs", "flash"] : ["logs", "flash"],
              preserveState: false,
              preserveScroll: true,
            }),
        replace: true,
        ...options,
        onSuccess: (e) => {
          if (!isDialog) {
            form.setDefaults(e.props[name]);
          }
          setIsDirty(false);
          if (options?.onSuccess) options.onSuccess(e);
        },
        onBefore: (e) => {
          removeFromLocalStorage(key);
          if (options?.onBefore) options.onBefore(e);
        },
        onError: (e) => {
          saveToLocalStorage(key, form.data, expiredDays);
          if (options?.onError) options.onError(e);
        },
      };
    },
    [form],
  );

  return {
    ...form,
    key,
    submit(method, url, options) {
      submitForm(method, url, getOptions(options));
    },
    get(url, options) {
      getForm(url, getOptions(options));
    },
    patch(url, options) {
      patchForm(url, getOptions(options));
    },
    post(url, options) {
      postForm(url, getOptions(options));
    },
    put(url, options) {
      putForm(url, getOptions(options));
    },
    delete(url, options) {
      deleteForm(url, getOptions(options));
    },
    loadDraft,
  };

  // return {
  //   data: form.data,
  //   isDirty: boolean,
  //   errors: Partial<Record<keyof TForm, string>>,
  //   hasErrors: boolean,
  //   processing: boolean,
  //   progress: Progress | null,
  //   wasSuccessful: boolean,
  //   recentlySuccessful: boolean,
  //   setData: setDataByObject<TForm> & setDataByMethod<TForm> & setDataByKeyValuePair<TForm>,
  //   transform: (callback: (data: TForm) => object) => void,
  //   setDefaults(): void,
  //   setDefaults(field: keyof TForm, value: FormDataConvertible): void,
  //   setDefaults(fields: Partial<TForm>): void,
  //   reset: (...fields: (keyof TForm)[]) => void,
  //   clearErrors: (...fields: (keyof TForm)[]) => void,
  //   setError(field: keyof TForm, value: string): void,
  //   setError(errors: Record<keyof TForm, string>): void,
  //   submit: (method: Method, url: string, options?: FormOptions) => void,
  //   get: (url: string, options?: FormOptions) => void,
  //   patch: (url: string, options?: FormOptions) => void,
  //   post: (url: string, options?: FormOptions) => void,
  //   put: (url: string, options?: FormOptions) => void,
  //   delete: (url: string, options?: FormOptions) => void,
  // cancel: () => void,
  // };
};
