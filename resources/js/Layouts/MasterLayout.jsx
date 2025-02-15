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
import { memo, useEffect } from "react";

import Toasts from "@/Components/Toasts";
import { useAlertDraftForm } from "@/Hooks/useDraftFrom";
import { useIsDirtyForm } from "@/Hooks/useIsDirtyForm";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";
import useTheme from "@/Hooks/useTheme";

const MasterLayout = memo(({ children }) => {
  const lang = usePage().props.lang ?? "";
  const { setLocale } = useLaravelReactI18n();
  const { theme, currentTheme, setCurrentTheme } = useTheme();
  const isDebug = usePage().props.debug;
  // const isDebug = true;
  useEffect(() => {
    setLocale(lang);
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
    continue: continueDirtyForm,
  } = useIsDirtyForm();
  return (
    <>
      {children}
      <Toasts />
      <AlertDialog
        open={showAlertDirtyForm}
        onOpenChange={setShowAlertDirtyForm}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Page</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave this page?
            </AlertDialogDescription>
            <AlertDialogFooter>
              <AlertDialogCancel className="h-8" onClick={cancelDirtyForm}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction className="h-8" onClick={continueDirtyForm}>
                Leave
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogHeader>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showAlertDrafForm} onOpenChange={setShowAlertDrafForm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unfinished Form</AlertDialogTitle>
            <AlertDialogDescription>
              You have an unfinished draft of this form. Would you like to
              continue?
            </AlertDialogDescription>
            <AlertDialogFooter>
              <AlertDialogCancel
                className="h-8"
                variant="destructive"
                onClick={cancelDraftForm}
              >
                Ignore
              </AlertDialogCancel>
              <AlertDialogAction className="h-8" onClick={continueDraftForm}>
                Continue
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogHeader>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});
MasterLayout.displayName = "MasterLayout";
export default MasterLayout;
