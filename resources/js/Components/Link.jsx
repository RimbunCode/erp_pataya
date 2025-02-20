import {
  createElement,
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  mergeDataIntoQueryString,
  router,
  shouldIntercept,
} from "@inertiajs/core";

import { useAlertDraftForm } from "@/Hooks/useDraftForm";
import { useIsDirtyForm } from "@/Hooks/useIsDirtyForm";

const noop = () => undefined;

const Link = forwardRef(
  (
    {
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
    },
    ref,
  ) => {
    const [inFlightCount, setInFlightCount] = useState(0);
    const hoverTimeout = useRef();

    as = as.toLowerCase();
    method = method.toLowerCase();
    const [_href, _data] = mergeDataIntoQueryString(
      method,
      href || "",
      data,
      queryStringArrayFormat,
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
      async,
    };
    const { setContinue, isDirty, setIsDirty, setShowAlert } = useIsDirtyForm();
    const { cancel } = useAlertDraftForm();

    const onVisit = (href, visitParams) => {
      setContinue(() => {
        router.visit(href, visitParams);
        setShowAlert(false);
        setIsDirty(false);
        cancel();
      });
      console.log(isDirty);
      if (isDirty) {
        setShowAlert(true);
      } else {
        setShowAlert(false);
        router.visit(href, visitParams);
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
      onError,
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
      Array.isArray(prefetch) ? prefetch : [prefetch],
    );

    const cacheForValue = useMemo(() => {
      if (cacheFor !== 0) {
        // If they've provided a value, respect it
        return cacheFor;
      }

      if (prefetchModes.length === 1 && prefetchModes[0] === "click") {
        // If they've only provided a prefetch mode of 'click',
        // we should only prefetch for the next request but not keep it around
        return 0;
      }

      // Otherwise, default to 30 seconds
      return 30_000;
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
      },
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
      onClick: regularEvents.onClick,
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
          // Let the mouseup event handle the visit
          event.preventDefault();
        }
      },
    };

    if (method !== "get") {
      as = "button";
    }

    const elProps = {
      a: { href },
      button: { type: "button" },
    };

    return createElement(
      as,
      {
        ...props,
        ...(elProps[as] || {}),
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
        "data-loading": inFlightCount > 0 ? "" : undefined,
      },
      children,
    );
  },
);
Link.displayName = "InertiaLink";

export default Link;
