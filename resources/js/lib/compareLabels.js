// Urut abjad label yang SUDAH diterjemahkan (hasil t()), mengikuti aturan
// collation bahasa aktif app (mis. "id"/"en" dari currentLocale()). locale
// undefined -> default runtime, jadi aman dipanggil tanpa locale.
export function compareLabels(a, b, locale) {
  return String(a ?? "").localeCompare(String(b ?? ""), locale);
}
