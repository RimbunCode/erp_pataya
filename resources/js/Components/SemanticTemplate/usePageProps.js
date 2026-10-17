import { usePage } from "@inertiajs/react";

/**
 * Props halaman Inertia, atau objek kosong bila dipakai di luar komponen
 * Inertia (mis. test komponen, story). `usePage` melempar di luar Inertia;
 * hook di dalamnya (`useContext`) tetap dipanggil sehingga urutan hook stabil.
 * @returns {Record<string, any>}
 */
export default function usePageProps() {
  try {
    return usePage()?.props ?? {};
  } catch {
    return {};
  }
}
