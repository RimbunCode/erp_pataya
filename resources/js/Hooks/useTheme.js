import { create } from "zustand";

const setCookieTheme = (value, days = 365) => {
  if (typeof document === "undefined") {
    return;
  }

  const maxAge = days * 24 * 60 * 60;
  document.cookie = `theme=${value};path=/;max-age=${maxAge};SameSite=Lax`;
};

const getInitialTheme = (_current = false) => {
  if (typeof window === "undefined") {
    return;
  }

  const selectedTheme = localStorage.getItem("theme");

  setCookieTheme(selectedTheme ?? "system");
  if (selectedTheme == "system") {
    return _current
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : "system";
  } else if (selectedTheme == "dark" || selectedTheme == "light") {
    return selectedTheme;
  }

  return !_current
    ? "system"
    : window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
};

const useTheme = create((set) => ({
  theme: getInitialTheme(),
  currentTheme: getInitialTheme(true),
  setCurrentTheme: (currentTheme) => set({ currentTheme }),
  setTheme: (theme) => {
    localStorage.setItem("theme", theme);
    setCookieTheme(theme ?? "system");
    if (theme != "system") set({ currentTheme: theme, theme });
    else
      set({
        theme,
        currentTheme: window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light",
      });
  },
}));

export default useTheme;
