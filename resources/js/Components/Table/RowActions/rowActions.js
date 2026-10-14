import { Trash2Icon } from "lucide-react";

/**
 * Key tetap untuk aksi hapus bawaan DataTable2.
 * Dipakai untuk membedakan aksi delete dari aksi kustom saat render dan dispatch.
 */
export const DELETE_ACTION_KEY = "__delete";

/**
 * Melengkapi definisi aksi dengan nilai default.
 * Field yang sudah diisi tidak ditimpa, dan objek input tidak dimutasi.
 * @param {{
 *   key: string,
 *   label: string,
 *   icon?: import("react").ComponentType,
 *   variant?: "default" | "destructive",
 *   single?: boolean,
 *   bulk?: boolean,
 *   enabled?: (row: object) => boolean,
 *   requires?: string[],
 *   confirm?: object | null,
 *   onAction: (rows: object[], helpers: object) => void,
 * }} def Definisi aksi mentah.
 * @returns {{
 *   key: string,
 *   label: string,
 *   icon: import("react").ComponentType | undefined,
 *   variant: "default" | "destructive",
 *   single: boolean,
 *   bulk: boolean,
 *   enabled: (row: object) => boolean,
 *   requires: string[],
 *   confirm: object | null,
 *   onAction: (rows: object[], helpers: object) => void,
 * }} Aksi yang sudah ter-normalisasi.
 */
export function normalizeAction(def) {
  return {
    ...def,
    key: def.key,
    label: def.label,
    icon: def.icon,
    onAction: def.onAction,
    variant: def.variant ?? "default",
    single: def.single ?? true,
    bulk: def.bulk ?? false,
    enabled: def.enabled ?? (() => true),
    requires: def.requires ?? [],
    confirm: def.confirm ?? null,
  };
}

/**
 * Mengambil aksi yang tampil di menu satu baris.
 * Aksi dengan `single: false` atau `enabled(row)` bernilai false dibuang.
 * Urutan aksi dipertahankan.
 * @param {object[]} actions Daftar aksi (mentah atau sudah ter-normalisasi).
 * @param {object} row Baris data yang sedang dirender.
 * @returns {ReturnType<typeof normalizeAction>[]} Aksi yang berlaku untuk baris ini.
 */
export function resolveRowActions(actions, row) {
  return actions
    .map(normalizeAction)
    .filter((action) => action.single && action.enabled(row));
}

/**
 * Membagi baris terpilih menjadi yang memenuhi `enabled` dan yang akan dilewati.
 * @param {object} action Aksi bulk.
 * @param {object[]} rows Baris yang dipilih.
 * @returns {{ eligible: object[], skipped: object[] }} Baris yang diproses dan dilewati.
 */
export function partitionBulk(action, rows) {
  const { enabled } = normalizeAction(action);
  const eligible = [];
  const skipped = [];

  for (const row of rows) {
    (enabled(row) ? eligible : skipped).push(row);
  }

  return { eligible, skipped };
}

/**
 * Membuat aksi hapus bawaan DataTable2.
 * Aksi dinonaktifkan bila `canDelete === false` atau policy `can("delete")` menolak
 * untuk pemilik baris tersebut.
 *
 * Saat dipanggil dari bulk bar, aksi selalu lewat `onBulk` meskipun hanya satu baris,
 * agar dialog konfirmasi bulk tetap dipakai.
 * @param {{
 *   can: (action: string, context: object) => boolean,
 *   label: string,
 *   bulkDestroy?: boolean,
 *   onSingle: (row: object) => void,
 *   onBulk: (rows: object[]) => void,
 * }} options Dependensi dari DataTable2.
 * @returns {ReturnType<typeof normalizeAction>} Aksi hapus yang sudah ter-normalisasi.
 */
export function buildDeleteAction({
  can,
  label,
  bulkDestroy,
  onSingle,
  onBulk,
}) {
  return normalizeAction({
    key: DELETE_ACTION_KEY,
    label,
    icon: Trash2Icon,
    variant: "destructive",
    single: true,
    bulk: Boolean(bulkDestroy),
    enabled: (row) =>
      row?.canDelete !== false &&
      can("delete", { user_id: row?.created_by_id }),
    onAction: (rows, helpers) =>
      helpers?.source === "bulk" ? onBulk(rows) : onSingle(rows[0]),
  });
}

/**
 * Memberi peringatan di mode development bila ada baris yang tidak memiliki
 * field yang dibutuhkan aksi (`requires`). Tidak melakukan apa pun di build produksi.
 *
 * Peringatan dikeluarkan sekali per aksi per pemanggilan.
 * @param {object[]} actions Daftar aksi.
 * @param {object[]} rows Baris data yang akan dirender.
 * @returns {void}
 */
export function warnMissingRequires(actions, rows) {
  if (import.meta.env.PROD) {
    return;
  }

  for (const action of actions) {
    const requires = action.requires ?? [];

    if (requires.length === 0) {
      continue;
    }

    const missing = new Set();

    for (const row of rows) {
      for (const field of requires) {
        if (!row || !(field in row)) {
          missing.add(field);
        }
      }
    }

    if (missing.size > 0) {
      console.warn(
        `[rowActions] aksi "${action.key}" membutuhkan field ${[...missing].join(", ")} yang tidak ada pada sebagian baris.`,
      );
    }
  }
}
