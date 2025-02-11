import { memo, useEffect } from "react";

import Toasts from "@/Components/Toasts";
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
  return (
    <>
      {children}
      <Toasts />
    </>
  );
});
MasterLayout.displayName = "MasterLayout";
export default MasterLayout;
