import {
  getFromLocalStorage,
  isDeepEmpty,
  removeFromLocalStorage,
  saveToLocalStorage,
} from "@/lib/utils";
import { useCallback, useEffect, useRef } from "react";
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
 * @returns {import("@inertiajs/react").InertiaFormProps<Record<string, unknown>>}
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
  const {
    setIsDirty,
    setProcessing,
    setRecentlySuccessful,
    keepDraftOnClean,
    setKeepDraftOnClean,
  } = useIsDirtyForm();
  const skipSaveRef = useRef(false);
  const skipRemovalRef = useRef(false);
  const checkedDraftKeyRef = useRef(null);
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
  const dataRef = useRef(form.data);
  const resetRef = useRef(form.reset);
  const setDataRef = useRef(form.setData);
  // pastikan alert draft tidak tersisa saat unmount
  useEffect(() => {
    return () => {
      setShowAlert(false);
    };
  }, [setShowAlert]);
  useEffect(() => {
    dataRef.current = form.data;
  }, [form.data]);
  useEffect(() => {
    resetRef.current = form.reset;
    setDataRef.current = form.setData;
  }, [form.reset, form.setData]);
  useEffect(() => {
    if (!key || isDialog) return;
    window.keyForm = key;
    return () => {
      if (window.keyForm === key) {
        delete window.keyForm;
      }
    };
  }, [key, isDialog]);
  const keepDraftFlag = key ? keepDraftOnClean?.[key] : false;
  useDidMountEffect(() => {
    setIsDirty(form.isDirty);
    if (!form.isDirty && key) {
      if (keepDraftFlag) {
        setKeepDraftOnClean(key, false);
        skipRemovalRef.current = true;
        return;
      }
      if (skipRemovalRef.current) {
        skipRemovalRef.current = false;
        return;
      } else {
        removeFromLocalStorage(key);
      }
    }
  }, [
    form.isDirty,
    keepDraftFlag,
    key,
    setIsDirty,
    setKeepDraftOnClean,
    skipRemovalRef,
  ]);
  useEffect(() => {
    if (!key || !form.isDirty) return;
    const handleBeforeUnload = (event) => {
      saveToLocalStorage(key, dataRef.current, expiredDays);
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [key, expiredDays, form.isDirty]);
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
  }, [form.recentlySuccessful]);
  useDidMountEffect(() => {
    if (key && form.isDirty && !skipSaveRef.current) {
      saveToLocalStorage(key, form.data, expiredDays);
    }
  }, [
    expiredDays,
    form.data,
    form.isDirty,
    keepDraftFlag,
    key,
    setKeepDraftOnClean,
    skipSaveRef,
  ]);

  const loadDraft = useCallback(() => {
    if (!key) return;
    const dataCookie = getFromLocalStorage(key);
    if (!dataCookie || isDeepEmpty(dataCookie)) return;
    setCancel(() => {
      setShowAlert(false);
      resetRef.current?.();
      removeFromLocalStorage(key);
    });
    setContinue(() => {
      setDataRef.current?.(dataCookie);
      removeFromLocalStorage(key);
      setShowAlert(false);
      onContinueDraft?.();
    });
    // sedikit delay agar tidak ditimpa effect lain pada tick yang sama
    setTimeout(() => setShowAlert(true), 0);
  }, [key, onContinueDraft, setCancel, setContinue, setShowAlert]);
  useEffect(() => {
    if (isDialog) return;
    if (ignoreDraft) return;
    if (!key) return;
    if (checkedDraftKeyRef.current === key) return;
    checkedDraftKeyRef.current = key;
    loadDraft();
  }, [ignoreDraft, isDialog, key, loadDraft]);

  const getOptions = useCallback(
    (options) => {
      return {
        ...(isDialog || isCreate
          ? {
              // Dialog/create: biar state & error tidak hilang saat submit
              preserveState: true,
              preserveScroll: true,
              preserveUrl: false,
            }
          : {
              // Halaman (create/update): muat ulang props terbaru dari backend
              preserveState: false,
              preserveScroll: true,
            }),
        replace: true,
        ...options,
        onSuccess: (e) => {
          setShowAlert(false); // pastikan alert unfinished ditutup saat sukses submit
          if (!isDialog) {
            form.setDefaults(e.props[name]);
          }
          setIsDirty(false);
          skipSaveRef.current = true; // jangan tulis ulang draft sesaat setelah sukses
          if (options?.onSuccess) options.onSuccess(e);
        },
        onBefore: (e) => {
          setShowAlert(false);
          skipSaveRef.current = true; // hentikan autosave selama submit
          if (key) {
            removeFromLocalStorage(key);
          }
          if (options?.onBefore) options.onBefore(e);
        },
        onError: (errors) => {
          // jangan biarkan alert unfinished menggantung pada error
          setShowAlert(false);
          skipSaveRef.current = false; // aktifkan kembali autosave jika gagal
          if (!options?.isSubmit && key) {
            saveToLocalStorage(key, form.data, expiredDays);
          }
          if (options?.onError) options.onError(errors);
        },
      };
    },
    [expiredDays, form, isCreate, isDialog, key, name, setIsDirty],
  );

  return {
    ...form,
    key,
    submit(method, url, options) {
      skipSaveRef.current = true;
      setShowAlert(false);
      submitForm(method, url, getOptions(options));
    },
    get(url, options) {
      skipSaveRef.current = true;
      setShowAlert(false);
      getForm(url, getOptions(options));
    },
    patch(url, options) {
      skipSaveRef.current = true;
      setShowAlert(false);
      patchForm(url, getOptions(options));
    },
    post(url, options) {
      skipSaveRef.current = true;
      setShowAlert(false);
      postForm(url, getOptions(options));
    },
    put(url, options) {
      skipSaveRef.current = true;
      setShowAlert(false);
      putForm(url, getOptions(options));
    },
    delete(url, options) {
      skipSaveRef.current = true;
      setShowAlert(false);
      deleteForm(
        url,
        getOptions({
          ...options,
          onSuccess: (e) => {
            if (key) removeFromLocalStorage(key);
            options?.onSuccess?.(e);
          },
        }),
      );
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
