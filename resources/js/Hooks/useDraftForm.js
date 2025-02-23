import { getCookieByName, removeCookie, setCookie } from "@/lib/utils";
import { useCallback, useEffect } from "react";
import { useForm, usePage } from "@inertiajs/react";

import { create } from "zustand";
import { isDirty } from "zod";
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
 * @callback onContinue
 * @returns {void}
 */

/**
 * @param {string} key kunci untuk menyimpan data pada cookie
 * @param {object} initialData
 * @typedef {object} OptionsProps
 * @property {number=} expiredDays jumlah hari berlaku cookie
 * @property {onContinue} onContinue callback ketika data berhasil disimpan
 * @param {OptionsProps} options
 * @returns {import("@inertiajs/react").InertiaFormProps<any>}
 */
export const useDraftForm = (
  key,
  initialData,
  { expiredDays = 1, onContinue } = {},
) => {
  const { setShowAlert, setCancel, setContinue } = useAlertDraftForm();
  const { setIsDirty } = useIsDirtyForm();
  const user = usePage().props.auth.user;
  key = user ? `${key}_${user.id}` : null;
  const {
    submit: submitForm,
    get: getForm,
    patch: patchForm,
    post: postForm,
    put: putForm,
    delete: deleteForm,
    ...form
  } = useForm(initialData);

  useDidMountEffect(() => {
    setIsDirty(form.isDirty);
    if (!form.isDirty) {
      removeCookie(key, window.location.pathname);
    }
  }, [form.isDirty]);

  useEffect(() => {
    if (form.recentlySuccessful) {
      form.reset();
    }
  }, [initialData]);
  useDidMountEffect(() => {
    if (key != null && form.isDirty) {
      setCookie(key, JSON.stringify(form.data), {
        days: expiredDays,
        path: window.location.pathname,
        sameSite: "lax",
      });
    }
  }, [form.data, form.isDirty, key, expiredDays]);

  useEffect(() => {
    const dataCookie = getCookieByName(key);
    if (dataCookie != null) {
      setCancel(() => {
        console.log("remove cookie");
        removeCookie(key, window.location.pathname);
      });
      setContinue(() => {
        form.setData(JSON.parse(dataCookie));
        removeCookie(key, window.location.pathname);
        onContinue?.();
      });
      setShowAlert(true);
    }
  }, []);

  const getOptions = useCallback(
    (options) => {
      return {
        preserveState: true,
        preverseScroll: true,
        replace: true,
        ...options,
        onSuccess: (e) => {
          form.setDefaults(e.props.role);
          if (options?.onSuccess) options.onSuccess(e);
        },
        onBefore: (e) => {
          removeCookie(key, window.location.pathname);
          if (options?.onBefore) options.onBefore(e);
        },
        onError: (e) => {
          setCookie(key, JSON.stringify(form.data), {
            days: expiredDays,
            path: window.location.pathname,
            sameSite: "lax",
          });
          if (options?.onError) options.onError(e);
        },
      };
    },
    [form],
  );

  return {
    ...form,
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
