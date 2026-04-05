import { Alert, AlertIcon, AlertTitle } from "@/Components/ui/alert";
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

import DeleteDialog from "./AlertDialogs/DeleteDialog";
import { RiErrorWarningFill } from "@remixicon/react";
import { Toaster } from "@/Components/ui/sonner";
import { TooltipProvider } from "@/Components/ui/tooltip";
import { toast } from "sonner";
import { useAlertDraftForm } from "@/Hooks/useDraftForm";
import { useIsDirtyForm } from "@/Hooks/useIsDirtyForm";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";
import useTheme from "@/Hooks/useTheme";

const AlertDialogs = memo(() => {
  const { lang } = usePage().props;
  const { t, setLocale } = useLaravelReactI18n();

  useEffect(() => {
    setLocale(lang ?? "");
  }, [lang]);

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
  const { url } = usePage();
  useEffect(() => {
    setIsDirty(false);
  }, [setIsDirty, url]);
  return (
    <>
      {/* Alert for leave form */}
      <AlertDialog
        open={showAlertDirtyForm}
        onOpenChange={setShowAlertDirtyForm}
      >
        <AlertDialogContent forceAsDialog align="center">
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
        <AlertDialogContent forceAsDialog align="center">
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
      <DeleteDialog />
    </>
  );
});

AlertDialogs.displayName = "AlertDialogs";

const MasterLayout = memo(({ children }) => {
  const { theme, currentTheme, setCurrentTheme } = useTheme();
  const { debug: isDebug } = usePage().props;
  const { t } = useLaravelReactI18n();

  useEffect(() => {
    if (isDebug) return;
    const translateWithFallback = (key, fallback) => {
      const translated = t(key);
      return translated === key ? fallback : translated;
    };
    const getHttpErrorMessage = (status) => {
      const messages = {
        400: translateWithFallback(
          "core.errors.http.400",
          "Permintaan tidak valid. Silakan periksa data yang dikirim.",
        ),
        401: translateWithFallback(
          "core.errors.http.401",
          "Sesi Anda berakhir atau belum login. Silakan login kembali.",
        ),
        403: translateWithFallback(
          "core.errors.http.403",
          "Anda tidak memiliki izin untuk melakukan aksi ini.",
        ),
        404: translateWithFallback(
          "core.errors.http.404",
          "Data atau halaman yang diminta tidak ditemukan.",
        ),
        405: translateWithFallback(
          "core.errors.http.405",
          "Metode request tidak diizinkan untuk endpoint ini.",
        ),
        409: translateWithFallback(
          "core.errors.http.409",
          "Terjadi konflik data. Silakan muat ulang halaman dan coba lagi.",
        ),
        419: translateWithFallback(
          "core.errors.http.419",
          "Halaman kedaluwarsa. Silakan refresh lalu coba lagi.",
        ),
        422: translateWithFallback(
          "core.errors.http.422",
          "Data tidak valid. Silakan periksa kembali input Anda.",
        ),
        429: translateWithFallback(
          "core.errors.http.429",
          "Terlalu banyak permintaan. Coba lagi beberapa saat lagi.",
        ),
        500: translateWithFallback(
          "core.errors.http.500",
          "Terjadi kesalahan server internal.",
        ),
        502: translateWithFallback(
          "core.errors.http.502",
          "Server upstream sedang bermasalah.",
        ),
        503: translateWithFallback(
          "core.errors.http.503",
          "Layanan sementara tidak tersedia.",
        ),
        504: translateWithFallback(
          "core.errors.http.504",
          "Waktu tunggu ke server habis.",
        ),
      };

      return (
        messages[status] ||
        translateWithFallback(
          "core.errors.http.default",
          "Terjadi kesalahan saat memproses permintaan Anda.",
        )
      );
    };
    const showHttpErrorToast = (status) => {
      if (typeof status !== "number" || status < 400 || status >= 600) {
        return;
      }
      toast.custom((toastId) => (
        <Alert
          variant="destructive"
          icon="destructive"
          onClose={() => toast.dismiss(toastId)}
        >
          <AlertIcon>
            <RiErrorWarningFill />
          </AlertIcon>
          <AlertTitle>{getHttpErrorMessage(status)}</AlertTitle>
        </Alert>
      ));
    };
    const onInertiaInvalid = (event) => {
      const status = event?.detail?.response?.status;
      if (typeof status !== "number" || status < 400 || status >= 600) {
        return;
      }

      showHttpErrorToast(status);
      event.preventDefault();
    };
    const onInertiaException = (event) => {
      const status = event?.detail?.exception?.response?.status;
      if (typeof status === "number" && status >= 400 && status < 600) {
        showHttpErrorToast(status);
        event.preventDefault();
        return;
      }

      toast.error(
        translateWithFallback("core.errors.network.title", "Koneksi gagal"),
        {
          description: translateWithFallback(
            "core.errors.network.description",
            "Tidak dapat menghubungi server. Periksa koneksi Anda.",
          ),
        },
      );
      event.preventDefault();
    };

    document.addEventListener("inertia:invalid", onInertiaInvalid);
    document.addEventListener("inertia:exception", onInertiaException);

    return () => {
      document.removeEventListener("inertia:invalid", onInertiaInvalid);
      document.removeEventListener("inertia:exception", onInertiaException);
    };
  }, [isDebug, t]);

  // const isDebug = true;
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
  }, [setCurrentTheme, theme]);

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
  }, [isDebug]);
  return (
    <>
      <TooltipProvider>{children}</TooltipProvider>
      <Toaster />
      <AlertDialogs />
    </>
  );
});
MasterLayout.displayName = "MasterLayout";
export default MasterLayout;
