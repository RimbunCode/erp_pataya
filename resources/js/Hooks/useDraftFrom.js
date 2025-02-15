import { getCookieByName, removeCookie, setCookie } from "@/lib/utils";
import { useForm, usePage } from "@inertiajs/react";

import { create } from "zustand";
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
export const useDraftFrom = (key, initialData, expiredDays = 1) => {
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
        removeCookie(key, window.location.pathname);
      });
      setContinue(() => {
        form.setData(JSON.parse(dataCookie));
        removeCookie(key, window.location.pathname);
      });
      setShowAlert(true);
    }
  }, []);

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
