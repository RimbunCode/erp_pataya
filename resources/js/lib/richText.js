/**
 * Nilai awal untuk TiptapEditor dari field rich-text block dashboard.
 *
 * Field disimpan sebagai { json, html }. `json` adalah sumber kebenaran
 * untuk mengedit, tapi tidak selalu ada — data hasil seeding/migrasi bisa
 * hanya punya `html`, dan data lama bisa berupa string biasa. Tanpa
 * fallback, editor terbuka KOSONG untuk kasus itu dan isinya ikut terhapus
 * begitu pengguna menekan Terapkan.
 *
 * TiptapEditor menerima ProseMirror JSON maupun string HTML sebagai
 * content, jadi keduanya aman dikembalikan apa adanya.
 * @param value
 */
export function richTextValue(value) {
  if (!value) return null;
  if (typeof value === "string") return value;

  return value.json ?? value.html ?? null;
}
