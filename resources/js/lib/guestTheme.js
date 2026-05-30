import { getByPath } from "@/lib/guestContentDraft";

export const DEFAULT_GUEST_THEME = {
  primary: "#2563eb",
  primaryHover: "#1d4ed8",
  primarySoft: "#dbeafe",
  primarySoftForeground: "#1d4ed8",
  foreground: "#0f172a",
  mutedForeground: "#64748b",
  background: "#f8fafc",
  card: "#ffffff",
};

function normalizeColor(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalizedValue = value.trim();

  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(normalizedValue)) {
    return fallback;
  }

  return normalizedValue;
}

export function resolveGuestTheme(content = {}) {
  return {
    primary: normalizeColor(
      getByPath(content, "theme.guest.primary"),
      DEFAULT_GUEST_THEME.primary,
    ),
    primaryHover: normalizeColor(
      getByPath(content, "theme.guest.primaryHover"),
      DEFAULT_GUEST_THEME.primaryHover,
    ),
    primarySoft: normalizeColor(
      getByPath(content, "theme.guest.primarySoft"),
      DEFAULT_GUEST_THEME.primarySoft,
    ),
    primarySoftForeground: normalizeColor(
      getByPath(content, "theme.guest.primarySoftForeground"),
      DEFAULT_GUEST_THEME.primarySoftForeground,
    ),
    foreground: normalizeColor(
      getByPath(content, "theme.guest.foreground"),
      DEFAULT_GUEST_THEME.foreground,
    ),
    mutedForeground: normalizeColor(
      getByPath(content, "theme.guest.mutedForeground"),
      DEFAULT_GUEST_THEME.mutedForeground,
    ),
    background: normalizeColor(
      getByPath(content, "theme.guest.background"),
      DEFAULT_GUEST_THEME.background,
    ),
    card: normalizeColor(
      getByPath(content, "theme.guest.card"),
      DEFAULT_GUEST_THEME.card,
    ),
  };
}

export function buildGuestThemeStyle(content = {}) {
  const theme = resolveGuestTheme(content);

  return {
    "--primary": theme.primary,
    "--primary-hover": theme.primaryHover,
    "--primary-soft": theme.primarySoft,
    "--primary-soft-foreground": theme.primarySoftForeground,
    "--foreground": theme.foreground,
    "--muted-foreground": theme.mutedForeground,
    "--background": theme.background,
    "--card": theme.card,
    "--background-accent": theme.background,
  };
}
