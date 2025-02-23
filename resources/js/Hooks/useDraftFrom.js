import { getCookieByName, removeCookie, setCookie } from "@/lib/utils";
import { useForm, usePage } from "@inertiajs/react";

import { create } from "zustand";
import { isDirty } from "zod";
import useDidMountEffect from "./useDidMountEffect";
import { useEffect } from "react";
import { useIsDirtyForm } from "./useIsDirtyForm";

export const useAlertDraftForm = create((set) => ({
  showAlert: false,
  setShowAlert: (value) => set({ showAlert: value }),
  cancel: () => {},
  setCancel: (value) => set({ cancel: value }),
  continue: () => {},
  setContinue: (value) => set({ continue: value }),
}));
<<<<<<< HEAD:resources/js/Hooks/useDraftForm.js
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
=======
export const useDraftFrom = (key, initialData, expiredDays = 1) => {
>>>>>>> origin/dev:resources/js/Hooks/useDraftFrom.js
  const { setShowAlert, setCancel, setContinue } = useAlertDraftForm();
  const { setIsDirty } = useIsDirtyForm();
  const user = usePage().props.auth.user;
  key = user ? `${key}_${user.id}` : null;
  const { ...form } = useForm(initialData);

  useEffect(() => {
    setIsDirty(form.isDirty);
  }, [form.isDirty]);

  useDidMountEffect(() => {
    if (key != null) {
      setCookie(key, JSON.stringify(form.data), {
        days: expiredDays,
        path: window.location.pathname,
        sameSite: "lax",
      });
    }
  }, [form.data, key, expiredDays]);

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

<<<<<<< HEAD:resources/js/Hooks/useDraftForm.js
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

=======
>>>>>>> origin/dev:resources/js/Hooks/useDraftFrom.js
  return {
    ...form,
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
