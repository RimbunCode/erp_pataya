import { useRef, useEffect, useCallback, forwardRef, useState, useMemo, createElement } from "react";
import { mergeDataIntoQueryString, router, shouldIntercept } from "@inertiajs/core";
import { r as removeFromLocalStorage, s as saveToLocalStorage, b as getFromLocalStorage, i as isDeepEmpty } from "./utils-ClCZGsDL.js";
import { usePage, useForm } from "@inertiajs/react";
import { create } from "zustand";
const useDidMountEffect = (func, deps) => {
  const didMount = useRef(false);
  useEffect(() => {
    if (didMount.current) return func();
    else didMount.current = true;
  }, deps);
};
const useIsDirtyForm = create((set) => ({
  isDirty: false,
  setIsDirty: (value) => set({ isDirty: value }),
  processing: false,
  setProcessing: (value) => set({ processing: value }),
  recentlySuccessful: false,
  setRecentlySuccessful: (value) => set({ recentlySuccessful: value }),
  showAlert: false,
  setShowAlert: (value) => set({ showAlert: value }),
  cancel: () => {
  },
  setCancel: (value) => set({ cancel: value }),
  leave: () => {
  },
  setLeave: (value) => set({ leave: value }),
  saveAsDraft: () => {
  },
  setSaveAsDraft: (value) => set({ saveAsDraft: value })
}));
const useAlertDraftForm = create((set) => ({
  showAlert: false,
  setShowAlert: (value) => set({ showAlert: value }),
  cancel: () => {
  },
  setCancel: (value) => set({ cancel: value }),
  continue: () => {
  },
  setContinue: (value) => set({ continue: value })
}));
const useDraftForm = (name, initialData, {
  expiredDays = 7,
  onContinueDraft,
  isCreate = false,
  isDialog = false,
  ignoreDraft = false
} = {}) => {
  const { setShowAlert, setCancel, setContinue } = useAlertDraftForm();
  const { setIsDirty, setProcessing, setRecentlySuccessful } = useIsDirtyForm();
  const user = usePage().props.auth.user;
  let key = user ? `${name}_${user.id}` : null;
  key = isCreate ? `${key}_create` : `${key}_update_${(initialData == null ? void 0 : initialData.id) ?? (initialData == null ? void 0 : initialData.code) ?? ""}`;
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
      onContinueDraft == null ? void 0 : onContinueDraft();
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
        ...isCreate || isDialog ? {
          preserveState: false,
          preserveScroll: false,
          preserveUrl: false
        } : {
          reset: name ? [name, "logs", "flash"] : ["logs", "flash"],
          preserveState: false,
          preserveScroll: true
        },
        replace: true,
        ...options,
        onSuccess: (e) => {
          if (!isDialog) {
            form.setDefaults(e.props[name]);
          }
          setIsDirty(false);
          if (options == null ? void 0 : options.onSuccess) options.onSuccess(e);
        },
        onBefore: (e) => {
          removeFromLocalStorage(key);
          if (options == null ? void 0 : options.onBefore) options.onBefore(e);
        },
        onError: (e) => {
          saveToLocalStorage(key, form.data, expiredDays);
          if (options == null ? void 0 : options.onError) options.onError(e);
        }
      };
    },
    [form]
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
    loadDraft
  };
};
const noop = () => void 0;
const Link = forwardRef(
  ({
    children,
    as = "a",
    data = {},
    href,
    method = "get",
    preserveScroll = false,
    preserveState = null,
    replace = false,
    only = [],
    except = [],
    headers = {},
    queryStringArrayFormat = "brackets",
    async = false,
    onClick = noop,
    onCancelToken = noop,
    onBefore = noop,
    onStart = noop,
    onProgress = noop,
    onFinish = noop,
    onCancel = noop,
    onSuccess = noop,
    onError = noop,
    prefetch = false,
    cacheFor = 0,
    ...props
  }, ref) => {
    const [inFlightCount, setInFlightCount] = useState(0);
    const hoverTimeout = useRef();
    as = as.toLowerCase();
    method = method.toLowerCase();
    const [_href, _data] = mergeDataIntoQueryString(
      method,
      href || "",
      data,
      queryStringArrayFormat
    );
    href = _href;
    data = _data;
    const baseParams = {
      data,
      method,
      preserveScroll,
      preserveState: preserveState ?? method !== "get",
      replace,
      only,
      except,
      headers,
      async
    };
    const { setLeave, setSaveAsDraft, isDirty, setIsDirty, setShowAlert } = useIsDirtyForm();
    const { cancel } = useAlertDraftForm();
    const onVisit = (href2, visitParams2) => {
      setLeave(() => {
        router.visit(href2, visitParams2);
        setShowAlert(false);
        setIsDirty(false);
        removeFromLocalStorage(window.keyForm);
        cancel();
      });
      setSaveAsDraft(() => {
        router.visit(href2, visitParams2);
        setShowAlert(false);
        setIsDirty(false);
      });
      if (isDirty) {
        setShowAlert(true);
      } else {
        setShowAlert(false);
        router.visit(href2, visitParams2);
      }
    };
    const visitParams = {
      ...baseParams,
      onCancelToken,
      onBefore,
      onStart(event) {
        setInFlightCount((count) => count + 1);
        onStart(event);
      },
      onProgress,
      onFinish(event) {
        setInFlightCount((count) => count - 1);
        onFinish(event);
      },
      onCancel,
      onSuccess,
      onError
    };
    const doPrefetch = () => {
      router.prefetch(href, baseParams, { cacheFor: cacheForValue });
    };
    const prefetchModes = useMemo(
      () => {
        if (prefetch === true) {
          return ["hover"];
        }
        if (prefetch === false) {
          return [];
        }
        if (Array.isArray(prefetch)) {
          return prefetch;
        }
        return [prefetch];
      },
      Array.isArray(prefetch) ? prefetch : [prefetch]
    );
    const cacheForValue = useMemo(() => {
      if (cacheFor !== 0) {
        return cacheFor;
      }
      if (prefetchModes.length === 1 && prefetchModes[0] === "click") {
        return 0;
      }
      return 3e4;
    }, [cacheFor, prefetchModes]);
    useEffect(() => {
      return () => {
        clearTimeout(hoverTimeout.current);
      };
    }, []);
    useEffect(() => {
      if (prefetchModes.includes("mount")) {
        setTimeout(() => doPrefetch());
      }
    }, prefetchModes);
    const regularEvents = {
      onClick: (event) => {
        onClick(event);
        if (shouldIntercept(event)) {
          event.preventDefault();
          onVisit(href, visitParams);
        }
      }
    };
    const prefetchHoverEvents = {
      onMouseEnter: () => {
        hoverTimeout.current = window.setTimeout(() => {
          doPrefetch();
        }, 75);
      },
      onMouseLeave: () => {
        clearTimeout(hoverTimeout.current);
      },
      onClick: regularEvents.onClick
    };
    const prefetchClickEvents = {
      onMouseDown: (event) => {
        if (shouldIntercept(event)) {
          event.preventDefault();
          doPrefetch();
        }
      },
      onMouseUp: (event) => {
        event.preventDefault();
        onVisit(href, visitParams);
      },
      onClick: (event) => {
        onClick(event);
        if (shouldIntercept(event)) {
          event.preventDefault();
        }
      }
    };
    if (method !== "get") {
      as = "button";
    }
    const elProps = {
      a: { href },
      button: { type: "button" }
    };
    return createElement(
      as,
      {
        ...props,
        ...elProps[as] || {},
        ref,
        ...(() => {
          if (prefetchModes.includes("hover")) {
            return prefetchHoverEvents;
          }
          if (prefetchModes.includes("click")) {
            return prefetchClickEvents;
          }
          return regularEvents;
        })(),
        "data-loading": inFlightCount > 0 ? "" : void 0
      },
      children
    );
  }
);
Link.displayName = "InertiaLink";
export {
  Link as L,
  useIsDirtyForm as a,
  useDidMountEffect as b,
  useDraftForm as c,
  useAlertDraftForm as u
};
