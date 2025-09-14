import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/Components/ui/alert-dialog";
import { memo, useCallback, useEffect } from "react";
import { router, usePage } from "@inertiajs/react";

import { Toaster } from "@/Components/ui/sonner";
import { TooltipProvider } from "@/Components/ui/tooltip";
import { useAlertDraftForm } from "@/Hooks/useDraftForm";
import useDeleteModal from "@/Hooks/useDeleteModal";
import { useIsDirtyForm } from "@/Hooks/useIsDirtyForm";
import { useLaravelReactI18n } from "laravel-react-i18n";
import useTheme from "@/Hooks/useTheme";

const MasterLayout = memo(({ children }) => {
  const lang = usePage().props.lang ?? "";
  const { t, setLocale } = useLaravelReactI18n();
  const { theme, currentTheme, setCurrentTheme } = useTheme();
  const isDebug = usePage().props.debug;
  // const isDebug = true;
  useEffect(() => {
    setLocale(lang);
    const contentsOfLocalStorage = Object.entries(localStorage);
    contentsOfLocalStorage.forEach(([key, value]) => {
      try {
        const parsedValue = JSON.parse(value);
        if (new Date(parsedValue.expiredDate) < new Date(Date.now())) {
          localStorage.removeItem(key);
          return;
        }
      } catch {
        /* empty */
      }
      return;
    });
  }, []);
  // Theme logic
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
  }, []);
  useEffect(() => {
    if (currentTheme === "light") {
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
    }
  }, [currentTheme]);
  // end theme logic

  // prevent user to open context menu browser or inspect element
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
  }, []);

  const {
    showAlert: showAlertDrafForm,
    setShowAlert: setShowAlertDrafForm,
    cancel: cancelDraftForm,
    continue: continueDraftForm,
  } = useAlertDraftForm();
  const {
    showAlert: showAlertDirtyForm,
    setShowAlert: setShowAlertDirtyForm,
    cancel: cancelDirtyForm,
    leave: continueDirtyForm,
    saveAsDraft,
    setIsDirty,
  } = useIsDirtyForm();
  const {
    isOpen: isOpenDeleteDialog,
    close: closeDeleteDialog,
    route: deleteRoute,
    id: deleteId,
  } = useDeleteModal();
  const { url } = usePage();
  useEffect(() => {
    setIsDirty(false);
  }, [url]);
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
      },
    });
  }, [deleteRoute, closeDeleteDialog, deleteId]);
  return (
    <>
      <TooltipProvider>{children}</TooltipProvider>
      <Toaster />
      {/* Alert for leave form */}
      <AlertDialog
        open={showAlertDirtyForm}
        onOpenChange={setShowAlertDirtyForm}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("core.form.leave.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("core.form.leave.subtitle")}
            </AlertDialogDescription>
            <AlertDialogFooter>
              <AlertDialogCancel className="h-8" onClick={cancelDirtyForm}>
                {t("core.form.leave.cancel")}
              </AlertDialogCancel>
              <AlertDialogCancel
                className="h-8"
                variant="secondary"
                onClick={continueDirtyForm}
              >
                {t("core.form.leave.leave")}
              </AlertDialogCancel>
              <AlertDialogAction className="h-8" onClick={saveAsDraft}>
                {t("core.form.leave.save_as_draft")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogHeader>
        </AlertDialogContent>
      </AlertDialog>

      {/* Alert for continue draft form */}
      <AlertDialog open={showAlertDrafForm} onOpenChange={setShowAlertDrafForm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("core.form.unfinished.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("core.form.unfinished.subtitle")}
            </AlertDialogDescription>
            <AlertDialogFooter>
              <AlertDialogCancel
                className="h-8"
                variant="destructive"
                onClick={cancelDraftForm}
              >
                {t("core.form.unfinished.ignore")}
              </AlertDialogCancel>
              <AlertDialogAction className="h-8" onClick={continueDraftForm}>
                {t("core.form.unfinished.continue")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogHeader>
        </AlertDialogContent>
      </AlertDialog>

      {/* Alert for delete item */}
      <AlertDialog
        open={isOpenDeleteDialog}
        onOpenChange={(v) => {
          if (!v) {
            closeDeleteDialog();
          }
        }}
      >
        <AlertDialogContent onKeyDown={handleKeyDown}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("inventory.unit.delete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("inventory.unit.delete.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={closeDeleteDialog}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={onDelete}>
              {t("inventory.unit.delete.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});
MasterLayout.displayName = "MasterLayout";
export default MasterLayout;
