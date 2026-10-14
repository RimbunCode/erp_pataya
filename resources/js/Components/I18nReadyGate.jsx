import { useEffect, useState } from "react";

import { useLaravelReactI18n } from "laravel-react-i18n";

/**
 * Batas tunggu maksimum sebelum UI tetap dirender walau terjemahan belum siap.
 * Mencegah layar kosong selamanya kalau fetch berkas lang gagal (provider
 * tidak punya `.catch`, sehingga `loading` tidak pernah turun).
 */
export const I18N_READY_TIMEOUT_MS = 4000;

/**
 * Meniru deteksi `filesAreEagerlyLoaded` milik `LaravelReactI18nProvider`:
 * glob dengan `{ eager: true }` menghasilkan objek modul, bukan fungsi.
 * Pada mode eager terjemahan sudah tersedia sinkron di render pertama, tapi
 * `loading` milik provider tidak pernah diturunkan, jadi gerbang tidak boleh
 * menunggunya.
 * @param {Record<string, unknown>|undefined} files Hasil `import.meta.glob`.
 * @returns {boolean} True kalau semua berkas sudah dimuat eager.
 */
export function areI18nFilesEager(files) {
  const values = Object.values(files || {});

  return values.length > 0
    ? values.every((value) => typeof value === "object" && value !== null)
    : false;
}

/**
 * Menahan render anak sampai terjemahan awal selesai dimuat.
 *
 * `import.meta.glob("/lang/*.json")` tanpa `eager` membuat provider memuat
 * berkas lang secara asinkron. Sebelum selesai, `t(key)` mengembalikan `key`
 * apa adanya. Komponen React ikut merender ulang setelah itu, tapi nilai yang
 * dihitung sekali lalu disimpan di luar React (mis. label kolom tabel yang
 * ditulis ke model GrapesJS) membeku sebagai kunci mentah. Gerbang ini
 * menutup akarnya di satu tempat: tidak ada halaman yang dirender sebelum
 * `t()` bisa menerjemahkan.
 *
 * Hanya berlaku untuk muat awal: begitu siap, gerbang tidak menutup lagi walau
 * `loading` kembali true (mis. ganti bahasa), supaya state halaman tidak hilang.
 * @param {object} props
 * @param {import("react").ReactNode} props.children Konten yang ditahan.
 * @param {Record<string, unknown>} [props.files] Berkas lang yang diberikan ke provider.
 * @param {number} [props.timeoutMs] Batas tunggu sebelum tetap dirender.
 * @returns {import("react").ReactNode} Anak, atau null selagi menunggu.
 */
export default function I18nReadyGate({
  children,
  files,
  timeoutMs = I18N_READY_TIMEOUT_MS,
}) {
  const { loading } = useLaravelReactI18n();
  const [ready, setReady] = useState(
    () => !loading || areI18nFilesEager(files),
  );

  useEffect(() => {
    if (!loading) {
      setReady(true);
    }
  }, [loading]);

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), timeoutMs);

    return () => clearTimeout(timer);
  }, [timeoutMs]);

  return ready ? children : null;
}
