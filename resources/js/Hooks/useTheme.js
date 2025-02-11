import { create } from "zustand";

const getInitialTheme = (_current = false) => {
  if (typeof window !== "undefined" && window.localStorage) {
    const selectedTheme = localStorage.getItem("theme");

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
        currentTheme: window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light",
      });
  },
}));

export default useTheme;
