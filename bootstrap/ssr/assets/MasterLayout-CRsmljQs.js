import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import * as React from "react";
import { memo, useEffect, useCallback } from "react";
import { b as buttonVariants } from "./button-Us2TB7GG.js";
import { c as cn } from "./utils-ClCZGsDL.js";
import { u as useIsMobile } from "./use-mobile-BsFue-bT.js";
import { usePage, router } from "@inertiajs/react";
import { Loader2Icon, OctagonXIcon, TriangleAlertIcon, InfoIcon, CircleCheckIcon } from "lucide-react";
import { Toaster as Toaster$1 } from "sonner";
import { create } from "zustand";
import { c as TooltipProvider } from "./tooltip-Df8khweJ.js";
import { u as useAlertDraftForm, a as useIsDirtyForm } from "./Link-p0Z4AKax.js";
import { useLaravelReactI18n } from "laravel-react-i18n";
const AlertDialog = AlertDialogPrimitive.Root;
const AlertDialogPortal = AlertDialogPrimitive.Portal;
const AlertDialogOverlay = React.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(
  AlertDialogPrimitive.Overlay,
  {
    className: cn(
      "fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    ),
    ...props,
    ref
  }
));
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName;
const AlertDialogContent = React.forwardRef(
  ({ className, forceAsDialog = false, align = "top", ...props }, ref) => {
    const isMobile = useIsMobile();
    return /* @__PURE__ */ jsxs(AlertDialogPortal, { children: [
      /* @__PURE__ */ jsx(AlertDialogOverlay, {}),
      /* @__PURE__ */ jsxs(
        "div",
        {
          className: cn(
            "fixed h-screen w-full z-50 flex items-center md:px-6",
            align == "top" && "flex-col",
            align == "bottom" && "flex-col-reverse"
          ),
          children: [
            align != "center" && /* @__PURE__ */ jsx("div", { className: "h-[8%]" }),
            /* @__PURE__ */ jsx(
              "div",
              {
                className: cn(
                  "flex-1 w-full flex items-center",
                  align == "center" && "flex-col justify-center",
                  align == "top" && "flex-col",
                  align == "bottom" && "flex-col-reverse"
                ),
                children: /* @__PURE__ */ jsx(
                  AlertDialogPrimitive.Content,
                  {
                    ref,
                    className: cn(
                      "overflow-y-auto w-full md:h-auto grid content-start max-w-lg gap-4 border bg-background p-6 shadow-lg duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:ease-in data-[state=closed]:ease-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 sm:rounded-lg",
                      align == "top" && "data-[state=closed]:slide-out-to-top-[28%] data-[state=open]:slide-in-from-top-[28%]",
                      align == "bottom" && "data-[state=closed]:slide-out-to-bottom-[28%] data-[state=open]:slide-in-from-bottom-[28%]",
                      !forceAsDialog && "h-screen",
                      !forceAsDialog && isMobile && "max-w-full!",
                      className
                    ),
                    ...props
                  }
                )
              }
            )
          ]
        }
      )
    ] });
  }
);
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;
const AlertDialogHeader = ({ className, ...props }) => /* @__PURE__ */ jsx(
  "div",
  {
    className: cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className
    ),
    ...props
  }
);
AlertDialogHeader.displayName = "AlertDialogHeader";
const AlertDialogFooter = ({ className, ...props }) => /* @__PURE__ */ jsx(
  "div",
  {
    className: cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    ),
    ...props
  }
);
AlertDialogFooter.displayName = "AlertDialogFooter";
const AlertDialogTitle = React.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(
  AlertDialogPrimitive.Title,
  {
    ref,
    className: cn("text-lg font-semibold", className),
    ...props
  }
));
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName;
const AlertDialogDescription = React.forwardRef(
  ({ className, ...props }, ref) => /* @__PURE__ */ jsx(
    AlertDialogPrimitive.Description,
    {
      ref,
      className: cn("text-sm text-muted-foreground", className),
      ...props
    }
  )
);
AlertDialogDescription.displayName = AlertDialogPrimitive.Description.displayName;
const AlertDialogAction = React.forwardRef(
  ({ variant, size, className, ...props }, ref) => /* @__PURE__ */ jsx(
    AlertDialogPrimitive.Action,
    {
      ref,
      className: cn(
        buttonVariants({
          variant: variant ?? "primary",
          size: size ?? "lg"
        }),
        "p-2 md:size-fit",
        className
      ),
      ...props
    }
  )
);
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName;
const AlertDialogCancel = React.forwardRef(
  ({ variant, size, className, ...props }, ref) => /* @__PURE__ */ jsx(
    AlertDialogPrimitive.Cancel,
    {
      ref,
      className: cn(
        buttonVariants({
          variant: variant ?? "outline",
          size: size ?? "lg"
        }),
        "mt-2 sm:mt-0 p-2 md:size-fit ",
        className
      ),
      ...props
    }
  )
);
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName;
const getInitialTheme = (_current = false) => {
  if (typeof window !== "undefined" && window.localStorage) {
    const selectedTheme = localStorage.getItem("theme");
    if (selectedTheme == "system") {
      return _current ? window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light" : "system";
    } else if (selectedTheme == "dark" || selectedTheme == "light") {
      return selectedTheme;
    }
    return !_current ? "system" : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
};
const useTheme = create((set) => ({
  theme: getInitialTheme(),
  currentTheme: getInitialTheme(true),
  setCurrentTheme: (currentTheme) => set({ currentTheme }),
  setTheme: (theme) => {
    localStorage.setItem("theme", theme);
    if (theme != "system") set({ currentTheme: theme, theme });
    else
      set({
        theme,
        currentTheme: window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
      });
  }
}));
const Toaster = ({ ...props }) => {
  const { currentTheme } = useTheme();
  return /* @__PURE__ */ jsx(
    Toaster$1,
    {
      theme: currentTheme,
      className: "group toaster [&_[data-type=success]>[data-icon]]:text-success [&_[data-type=success]_[data-title]]:text-success [&_[data-type=info]_[data-title]]:text-info [&_[data-type=error]>[data-icon]]:text-destructive [&_[data-type=error]_[data-title]]:text-destructive",
      toastOptions: {
        classNames: {
          toast: "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground! group-[.toaster]:border-border group-[.toaster]:shadow-lg has-[[role=alert]]:border-0! has-[[role=alert]]:shadow-none! has-[[role=alert]]:bg-transparent!",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:rounded-md! group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:rounded-md! group-[.toast]:bg-secondary group-[.toast]:text-secondary-foreground!"
        }
      },
      icons: {
        success: /* @__PURE__ */ jsx(CircleCheckIcon, { className: "size-4" }),
        info: /* @__PURE__ */ jsx(InfoIcon, { className: "size-4" }),
        warning: /* @__PURE__ */ jsx(TriangleAlertIcon, { className: "size-4" }),
        error: /* @__PURE__ */ jsx(OctagonXIcon, { className: "size-4" }),
        loading: /* @__PURE__ */ jsx(Loader2Icon, { className: "size-4 animate-spin" })
      },
      ...props
    }
  );
};
const useDeleteModal = create((set) => ({
  isOpen: false,
  route: null,
  id: null,
  deleteItem(route, id) {
    set({ isOpen: true, route, id });
  },
  close: () => set({ isOpen: false, route: null, id: null })
}));
const AlertDialogs = memo(() => {
  const { lang, translateKey } = usePage().props;
  const { t, setLocale } = useLaravelReactI18n();
  useEffect(() => {
    setLocale(lang ?? "");
  }, [lang]);
  const {
    showAlert: showAlertDrafForm,
    setShowAlert: setShowAlertDrafForm,
    cancel: cancelDraftForm,
    continue: continueDraftForm
  } = useAlertDraftForm();
  const {
    showAlert: showAlertDirtyForm,
    setShowAlert: setShowAlertDirtyForm,
    cancel: cancelDirtyForm,
    leave: continueDirtyForm,
    saveAsDraft,
    setIsDirty
  } = useIsDirtyForm();
  const {
    isOpen: isOpenDeleteDialog,
    close: closeDeleteDialog,
    route: deleteRoute,
    id: deleteId
  } = useDeleteModal();
  const { url } = usePage();
  useEffect(() => {
    setIsDirty(false);
  }, [setIsDirty, url]);
  function handleKeyDown(e) {
    if (e.key == "Escape") {
      closeDeleteDialog();
    }
  }
  const route = window.route;
  const onDelete = useCallback(() => {
    router.delete(route(deleteRoute, deleteId), {
      onSuccess: () => {
        closeDeleteDialog();
      }
    });
  }, [route, deleteRoute, deleteId, closeDeleteDialog]);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(
      AlertDialog,
      {
        open: showAlertDirtyForm,
        onOpenChange: setShowAlertDirtyForm,
        children: /* @__PURE__ */ jsx(AlertDialogContent, { forceAsDialog: true, align: "center", children: /* @__PURE__ */ jsxs(AlertDialogHeader, { children: [
          /* @__PURE__ */ jsx(AlertDialogTitle, { children: t("core.form.leave.title") }),
          /* @__PURE__ */ jsx(AlertDialogDescription, { children: t("core.form.leave.subtitle") }),
          /* @__PURE__ */ jsxs(AlertDialogFooter, { children: [
            /* @__PURE__ */ jsx(AlertDialogCancel, { className: "h-8", onClick: cancelDirtyForm, children: t("core.form.leave.cancel") }),
            /* @__PURE__ */ jsx(
              AlertDialogCancel,
              {
                className: "h-8",
                variant: "secondary",
                onClick: continueDirtyForm,
                children: t("core.form.leave.leave")
              }
            ),
            /* @__PURE__ */ jsx(AlertDialogAction, { className: "h-8", onClick: saveAsDraft, children: t("core.form.leave.save_as_draft") })
          ] })
        ] }) })
      }
    ),
    /* @__PURE__ */ jsx(AlertDialog, { open: showAlertDrafForm, onOpenChange: setShowAlertDrafForm, children: /* @__PURE__ */ jsx(AlertDialogContent, { forceAsDialog: true, align: "center", children: /* @__PURE__ */ jsxs(AlertDialogHeader, { children: [
      /* @__PURE__ */ jsx(AlertDialogTitle, { children: t("core.form.unfinished.title") }),
      /* @__PURE__ */ jsx(AlertDialogDescription, { children: t("core.form.unfinished.subtitle") }),
      /* @__PURE__ */ jsxs(AlertDialogFooter, { children: [
        /* @__PURE__ */ jsx(
          AlertDialogCancel,
          {
            className: "h-8",
            variant: "destructive",
            onClick: cancelDraftForm,
            children: t("core.form.unfinished.ignore")
          }
        ),
        /* @__PURE__ */ jsx(AlertDialogAction, { className: "h-8", onClick: continueDraftForm, children: t("core.form.unfinished.continue") })
      ] })
    ] }) }) }),
    /* @__PURE__ */ jsx(
      AlertDialog,
      {
        open: isOpenDeleteDialog,
        onOpenChange: (v) => {
          if (!v) {
            closeDeleteDialog();
          }
        },
        children: /* @__PURE__ */ jsxs(
          AlertDialogContent,
          {
            forceAsDialog: true,
            align: "center",
            onKeyDown: handleKeyDown,
            children: [
              /* @__PURE__ */ jsxs(AlertDialogHeader, { children: [
                /* @__PURE__ */ jsx(AlertDialogTitle, { children: t(`${translateKey}.delete`) }),
                /* @__PURE__ */ jsx(AlertDialogDescription, { children: t(`${translateKey}.delete.description`) })
              ] }),
              /* @__PURE__ */ jsxs(AlertDialogFooter, { children: [
                /* @__PURE__ */ jsx(AlertDialogCancel, { onClick: closeDeleteDialog, children: t("core.form.leave.cancel") }),
                /* @__PURE__ */ jsx(AlertDialogAction, { onClick: onDelete, children: t(`${translateKey}.delete.confirm`) })
              ] })
            ]
          }
        )
      }
    )
  ] });
});
AlertDialogs.displayName = "AlertDialogs";
const MasterLayout = memo(({ children }) => {
  const { theme, currentTheme, setCurrentTheme } = useTheme();
  const isDebug = usePage().props.debug;
  useEffect(() => {
    const contentsOfLocalStorage = Object.entries(localStorage);
    contentsOfLocalStorage.forEach(([key, value]) => {
      try {
        const parsedValue = JSON.parse(value);
        if (new Date(parsedValue.expiredDate) < new Date(Date.now())) {
          localStorage.removeItem(key);
          return;
        }
      } catch {
      }
      return;
    });
  }, []);
  useEffect(() => {
    function onThemeSystemChanged(e) {
      if (theme != "system") return;
      setCurrentTheme(e.matches ? "dark" : "light");
    }
    const matchMedia = window.matchMedia("(prefers-color-scheme: dark)");
    matchMedia.addEventListener("change", onThemeSystemChanged);
    return () => {
      matchMedia.removeEventListener("change", onThemeSystemChanged);
    };
  }, [setCurrentTheme, theme]);
  useEffect(() => {
    if (currentTheme === "light") {
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
    }
  }, [currentTheme]);
  useEffect(() => {
    if (isDebug) return;
    function onContextMenu(e) {
      e.preventDefault();
    }
    function onKeyDown(e) {
      if (e.key == 123) {
        e.preventDefault();
      }
      if (e.ctrlKey && e.shiftKey && e.key == "I") {
        e.preventDefault();
      }
      if (e.ctrlKey && e.shiftKey && e.key == "C") {
        e.preventDefault();
      }
      if (e.ctrlKey && e.shiftKey && e.key == "J") {
        e.preventDefault();
      }
      if (e.ctrlKey && e.key == "U") {
        e.preventDefault();
      }
      if (e.key == "F12") {
        e.preventDefault();
      }
    }
    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isDebug]);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(TooltipProvider, { children }),
    /* @__PURE__ */ jsx(Toaster, {}),
    /* @__PURE__ */ jsx(AlertDialogs, {})
  ] });
});
MasterLayout.displayName = "MasterLayout";
export {
  AlertDialog as A,
  MasterLayout as M,
  AlertDialogContent as a,
  AlertDialogHeader as b,
  AlertDialogTitle as c,
  AlertDialogDescription as d,
  AlertDialogFooter as e,
  AlertDialogCancel as f,
  AlertDialogAction as g,
  useTheme as h,
  useDeleteModal as u
};
