/**
 * Palet warna untuk badge dan dot pada Semantic Template.
 *
 * Nama kelas Tailwind ditulis literal lengkap (bukan hasil konkatenasi)
 * agar terdeteksi oleh scanner Tailwind saat build.
 */

/** @type {Record<string, string>} Kelas badge bergaya "soft" per nama warna. */
export const BADGE_COLORS = {
  gray: "border-transparent bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100",
  blue: "border-transparent bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200",
  green:
    "border-transparent bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200",
  yellow:
    "border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200",
  orange:
    "border-transparent bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200",
  red: "border-transparent bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200",
  purple:
    "border-transparent bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200",
};

/** Varian badge bawaan dari resources/js/Components/ui/badge.jsx. */
export const BADGE_VARIANTS = [
  "default",
  "secondary",
  "destructive",
  "outline",
];

/**
 * Menentukan varian dan kelas tambahan badge dari nilai warna.
 *
 * - Varian bawaan dipakai langsung.
 * - Nama warna palet memakai varian "outline" dengan kelas warna khusus.
 * - Nilai lain (termasuk null/undefined/kosong) jatuh ke varian "secondary".
 * @param {string|null|undefined} color
 * @returns {{ variant: string, className: string }}
 */
export function resolveBadgeColor(color) {
  if (BADGE_VARIANTS.includes(color)) {
    return { variant: color, className: "" };
  }

  if (Object.hasOwn(BADGE_COLORS, color)) {
    return { variant: "outline", className: BADGE_COLORS[color] };
  }

  return { variant: "secondary", className: "" };
}

/** @type {Record<string, string>} Kelas bg untuk titik indikator per nama warna/varian. */
export const DOT_COLORS = {
  gray: "bg-gray-400",
  blue: "bg-blue-500",
  green: "bg-green-500",
  yellow: "bg-yellow-500",
  orange: "bg-orange-500",
  red: "bg-red-500",
  purple: "bg-purple-500",
  default: "bg-primary",
  secondary: "bg-muted-foreground",
  destructive: "bg-destructive",
  outline: "bg-foreground",
};

/**
 * Mengembalikan kelas bg titik indikator. Nilai tak dikenal memakai fallback "secondary".
 * @param {string|null|undefined} color
 * @returns {string}
 */
export function resolveDotColor(color) {
  if (Object.hasOwn(DOT_COLORS, color)) {
    return DOT_COLORS[color];
  }

  return DOT_COLORS.secondary;
}
