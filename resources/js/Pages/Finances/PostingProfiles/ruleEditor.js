// Logika murni editor aturan akun bersyarat Posting Profile (Requirement 12, Task 12.2). Validasi klien mencerminkan
// `PostingProfileRequest` dan `PostingProfileService` (peran, kondisi barang hanya untuk peran peka-barang, kunci
// kondisi kembar, prioritas), supaya pengguna melihat penolakan di barisnya sebelum menyimpan; server tetap menjadi
// penjaga akhir.

export const MAX_PRIORITY = 4294967295;

let rowCounter = 0;

/**
 * Kunci baris React yang stabil. `id` dari server tidak dipakai karena aturan dibuat ulang tiap penyimpanan.
 * @returns {string}
 */
export const nextRowKey = () => {
  rowCounter += 1;

  return `rule-${rowCounter}`;
};

/**
 * Baris kosong untuk aturan baru.
 * @returns {object}
 */
export const emptyRow = () => ({
  key: nextRowKey(),
  role: "",
  document_type: null,
  variant: null,
  item_type: null,
  is_stock_item: null,
  item_category_id: null,
  category: null,
  account: null,
  priority: "0",
});

/**
 * Baris editor dari aturan yang dikirim controller. `item_category_id` mentah dibawa walau objek kategori tidak ada,
 * agar aturan berkategori tidak diam-diam menjadi aturan "semua" saat disimpan ulang.
 * @param {object} rule
 * @returns {object}
 */
export const rowFromRule = (rule) => ({
  key: nextRowKey(),
  role: rule.role ?? "",
  document_type: rule.document_type ?? null,
  variant: rule.variant ?? null,
  item_type: rule.item_type ?? null,
  is_stock_item:
    rule.is_stock_item === null || rule.is_stock_item === undefined
      ? null
      : Boolean(rule.is_stock_item),
  item_category_id: rule.item_category_id ?? rule.category?.id ?? null,
  category: rule.category ?? null,
  account: rule.account ?? null,
  priority: String(rule.priority ?? 0),
});

/**
 * Bentuk kiriman ke server: hanya id dan nilai kondisi, tanpa objek tampilan.
 * @param {object} row
 * @returns {object}
 */
export const toPayload = (row) => ({
  role: row.role,
  document_type: row.document_type,
  variant: row.variant,
  item_type: row.item_type,
  is_stock_item: row.is_stock_item,
  item_category_id: row.item_category_id,
  account_id: row.account?.id ?? "",
  priority: Number.parseInt(row.priority, 10) || 0,
});

const blankToNull = (value) =>
  value === undefined || value === null || value === "" ? null : value;

/**
 * Kunci identitas kondisi (peran + lima kondisi), sama dengan `PostingProfileService::conditionKey()`: kosong
 * dianggap null dan `false` pada `is_stock_item` berbeda dari null. Prioritas dan akun tidak ikut.
 * @param {object} row
 * @returns {string}
 */
export const conditionKey = (row) =>
  JSON.stringify([
    row.role ?? "",
    blankToNull(row.document_type),
    blankToNull(row.variant),
    blankToNull(row.item_type),
    blankToNull(row.is_stock_item) === null ? null : Boolean(row.is_stock_item),
    blankToNull(row.item_category_id),
  ]);

/**
 * Apakah baris memuat kondisi atribut barang.
 * @param {object} row
 * @returns {boolean}
 */
export const hasItemCondition = (row) =>
  blankToNull(row.item_type) !== null ||
  blankToNull(row.is_stock_item) !== null ||
  blankToNull(row.item_category_id) !== null;

/**
 * Kondisi barang yang dikosongkan bila peran berganti ke peran non peka-barang.
 * @returns {object}
 */
export const clearedItemConditions = () => ({
  item_type: null,
  is_stock_item: null,
  item_category_id: null,
  category: null,
});

/**
 * Validasi seluruh baris. Hasil: peta `key baris => [{field, message}]`; `message` adalah kunci terjemahan di bawah
 * `finances.postingProfile.rules_editor.errors`. Baris kembar dilaporkan pada kemunculan kedua dan seterusnya.
 * @param {object[]} rows
 * @param {{value: string, line_sensitive: boolean}[]} roles
 * @returns {Record<string, {field: string, message: string}[]>}
 */
export const validateRows = (rows, roles) => {
  const errors = {};
  const seen = new Set();
  const add = (row, field, message) => {
    (errors[row.key] ??= []).push({ field, message });
  };

  for (const row of rows) {
    const role = roles.find((candidate) => candidate.value === row.role);

    if (!role) {
      add(row, "role", "role_required");
    }
    if (!row.account?.id) {
      add(row, "account", "account_required");
    }
    if (!/^\d+$/.test(String(row.priority ?? "").trim())) {
      add(row, "priority", "priority_invalid");
    } else if (Number(row.priority) > MAX_PRIORITY) {
      add(row, "priority", "priority_too_large");
    }
    if (role && !role.line_sensitive && hasItemCondition(row)) {
      add(row, "role", "item_condition_role");

      continue;
    }
    if (role) {
      const key = conditionKey(row);
      if (seen.has(key)) {
        add(row, "role", "duplicate");
      }
      seen.add(key);
    }
  }

  return errors;
};
