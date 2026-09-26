// searchSuggestions — fungsi murni: teks yang diketik user -> daftar saran
// terbagi 5 seksi berurutan (design.md §5.2; Requirement 3).

import {
  buildChipsLeaf,
  buildDateChipsLeaf,
  buildDatePresets,
  columnTitle,
  isColumnSearchable,
  resolveValueMode,
  suggestPeriodTokens,
} from "./columnSearch";
import { buildOptionList, isStatusColumn } from "./searchChips";
import { columnHasOptions } from "../Filter/operators";

// Sentinel "Tidak ada" pada `groupOptions` -- mirror `NO_GROUP_VALUE`
// (DataTable2.jsx:96). Didefinisikan lokal (bukan import dari Pages/) agar
// modul murni ini tidak bergantung ke komponen Page.
const NO_GROUP_VALUE = "__no_group__";

const SECTION_LIMITS = { text: 1, saved: 3, column: 5, value: 5, group: 3 };

const toArray = (value) => {
  if (!value) return [];
  return Array.isArray(value) ? value : Object.values(value);
};

/**
 * Pemecah kata -- selaras `highlightMatch` (split `/\s+/`, case-insensitive).
 * @param text
 */
const wordsOf = (text) =>
  `${text ?? ""}`.trim().toLowerCase().split(/\s+/).filter(Boolean);

/**
 * Pisahkan kata ketikan menurut sebuah kolom (revisi 13): kata yang ada di
 * JUDUL kolom = "kata kolom" (membatasi saran nilai ke kolom itu), sisanya =
 * kata pencarian nilai. Kata asli (huruf besar/kecil dipertahankan) dipakai
 * utk `restText` (nilai yg diketik), versi kecil utk pencocokan label.
 * @param {string[]} originalWords kata ketikan (belum di-lowercase)
 * @param {string} colLabel
 * @returns {{colWords: string[], restWords: string[], restText: string}}
 */
const splitScope = (originalWords, colLabel) => {
  const lower = `${colLabel ?? ""}`.toLowerCase();
  const colWords = [];
  const restWords = [];
  for (const word of originalWords) {
    (lower.includes(word.toLowerCase()) ? colWords : restWords).push(word);
  }
  return { colWords, restWords, restText: restWords.join(" ") };
};

/**
 * Item cocok bila SETIAP kata query muncul di label (case-insensitive).
 * @param label
 * @param words
 */
const matchesAllWords = (label, words) => {
  const lower = `${label ?? ""}`.toLowerCase();
  return words.every((w) => lower.includes(w));
};

// --- Revisi 3: bobot relevansi saran gabungan (Requirement 20). ------------

/**
 * Match PREFIX: seluruh teks ketikan (bukan per-kata) ada di AWAL label,
 * atau di awal salah satu KATA dalam label -- lebih relevan drpd cuma
 * substring di tengah kata (Requirement 20.1).
 * @param {string} label
 * @param {string} queryLower teks ketikan (SUDAH trim+lowercase, utuh).
 * @returns {boolean}
 */
const isPrefixMatch = (label, queryLower) => {
  if (!queryLower) return false;
  const lowerLabel = `${label ?? ""}`.toLowerCase();
  if (lowerLabel.startsWith(queryLower)) return true;
  return lowerLabel.split(/\s+/).some((w) => w.startsWith(queryLower));
};

/**
 * Skor 1 item saran -- tingkat match (prefix > substring) dikali 10, plus
 * +1 bila `boosted` (kolom baru dipakai, HANYA relevan utk seksi Kolom,
 * Requirement 20.2). Boosted-substring (11) SENGAJA di antara prefix (20/21)
 * & substring polos (10) -- persis urutan yg diminta desain.
 * @param {string} label
 * @param {string} queryLower
 * @param {boolean} [boosted]
 * @returns {number}
 */
const scoreItem = (label, queryLower, boosted = false) => {
  const tier = isPrefixMatch(label, queryLower) ? 2 : 1;
  return tier * 10 + (boosted ? 1 : 0);
};

/**
 * Urutkan ITEM tiap seksi (skor turun, stabil) lalu urutkan SEKSI berdasar
 * skor item tertinggi di dalamnya (bukan urutan tetap 1-5 lama). Seksi
 * kosong tak pernah masuk sini (sudah difilter sebelum dipanggil).
 * @param {Array<{section: string, items: Array<{score?: number}>}>} sections
 * @returns {Array<{section: string, items: Array<object>}>}
 */
const rankSections = (sections) => {
  const ranked = sections.map((sec) => ({
    section: sec.section,
    items: [...sec.items].sort((a, b) => (b._score ?? 0) - (a._score ?? 0)),
  }));
  return ranked
    .map((sec, index) => ({
      ...sec,
      index,
      topScore: sec.items[0]?._score ?? 0,
    }))
    .sort((a, b) => b.topScore - a.topScore || a.index - b.index)
    .map(({ section, items }) => ({
      section,
      items: items.map(({ _score, ...item }) => item),
    }));
};

/**
 * Kolom relation yang JUDULNYA disebut ketikan (revisi 13) -- host memakainya
 * utk fetch record ke endpoint LinkModel (`search` = sisa kata) lalu
 * meneruskan hasilnya ke `buildSuggestions({ relationRecords })`. Hanya SATU
 * kolom (kata kolom terbanyak; seri -> urutan kolom); ketikan < 3 huruf tak
 * memicu fetch.
 * @param {string} text
 * @param {object} root0
 * @param {object} [root0.columns]
 * @param {(key: string) => string} root0.t
 * @returns {{column: object, search: string}|null}
 */
const findRelationScope = (text, { columns, t } = {}) => {
  const trimmed = `${text ?? ""}`.trim();
  if (trimmed.length < 3) return null;
  const originalWords = trimmed.split(/\s+/);
  let best = null;
  for (const col of toArray(columns)) {
    if (!isColumnSearchable(col) || resolveValueMode(col) !== "relation") {
      continue;
    }
    const scope = splitScope(originalWords, columnTitle(col, t));
    if (scope.colWords.length === 0) continue;
    if (!best || scope.colWords.length > best.scope.colWords.length) {
      best = { column: col, scope };
    }
  }
  return best && { column: best.column, search: best.scope.restText };
};

/**
 * Bangun saran dropdown Search Bar dari teks yang sedang diketik. Seksi
 * kosong tidak dikembalikan; teks kosong/whitespace -> `[]` (Requirement
 * 3.1-3.6).
 * @param {string} text
 * @param {object} root0
 * @param {object} [root0.columns] peta/array kolom (getColumns())
 * @param {string[]} [root0.searchColumns] hasil `resolveSearchColumns()`
 * @param {Array<object>} [root0.savedFilters] hasil `saved-filters.index`
 * @param {Array<{value:string, label:string}>} [root0.groupOptions]
 * @param {(key: string, params?: object) => string} root0.t
 * @param {Date} [root0.now] basis "sekarang" utk preset periode kolom
 *   tanggal (default `new Date()`) -- parameter injeksi utk kemudahan test.
 * @param {string[]} [root0.recentColumns] nama kolom yg baru dipakai (revisi
 *   3, Requirement 20.2/20.4) -- HANYA memengaruhi bobot seksi Kolom, urutan
 *   terbaru-di-depan tak dipakai (cuma keanggotaan set yg dicek).
 * @param {{i18nLabels: object, dateLocale?: object}} [root0.dateContext]
 *   konteks parse periode (revisi 13) -- tanpa ini, ketikan "<kolom tanggal>
 *   sep 2026" tak menghasilkan saran periode (preset tetap ada).
 * @param {{column: string, records: Array<{record: object, label: string}>}} [root0.relationRecords]
 *   record hasil fetch host utk kolom relation yg disebut ketikan (lihat
 *   `findRelationScope`).
 * Item: `{ key, label, payload, prefix? }` -- needle highlight SELALU teks
 * ketikan (`highlightMatch(label.slice(prefix.length), text)`), bukan field
 * terpisah; `prefix` hanya ada di seksi `value`.
 * @returns {Array<{section: string, items: Array<object>}>}
 */
const buildSuggestions = (
  text,
  {
    columns,
    searchColumns,
    savedFilters,
    groupOptions,
    t,
    now,
    recentColumns,
    dateContext,
    relationRecords,
  } = {},
) => {
  const trimmed = `${text ?? ""}`.trim();
  if (!trimmed) return [];
  const words = wordsOf(trimmed);
  const queryLower = trimmed.toLowerCase();
  const matches = (label) => matchesAllWords(label, words);
  const recentSet = new Set(recentColumns ?? []);

  /**
   * Skor + urutkan + potong ke batas seksi -- SELALU urutkan SEBELUM potong
   * supaya item berskor tinggi tak ikut terbuang oleh batas (Requirement
   * 20.1, 20.3).
   * @param {Array<object>} items
   * @param {number} limit
   * @param {(item: object) => string} labelOf label yg DISKOR (bkn selalu
   *   `item.label` -- seksi Nilai/Kelompokkan skor dari label mentah opsi,
   *   bukan label gabungan "Kolom: opsi").
   * @param {(item: object) => boolean} [boostOf]
   */
  const rankLimit = (items, limit, labelOf, boostOf) =>
    items
      .map((item) => ({
        ...item,
        _score: scoreItem(labelOf(item), queryLower, boostOf?.(item)),
      }))
      .sort((a, b) => b._score - a._score)
      .slice(0, limit);

  const sections = [];

  // 1. Teks bebas -- hanya bila ada kolom pencarian (Requirement 3.6, 5.5).
  if (Array.isArray(searchColumns) && searchColumns.length > 0) {
    const label = t("core.datatable.search.search_all", { text: trimmed });
    sections.push({
      section: "text",
      items: rankLimit(
        [{ key: "text", label, payload: { text: trimmed } }],
        SECTION_LIMITS.text,
        (item) => item.label,
      ),
    });
  }

  // 2. Filter Tersimpan -- hanya bila host memberi `savedFilters`.
  if (Array.isArray(savedFilters)) {
    const items = savedFilters
      .map((saved) => {
        const label = saved?.name || t("core.datatable.filter.saved.untitled");
        if (!matches(label)) return null;
        return {
          key: `saved-${saved.id}`,
          label,
          payload: saved,
        };
      })
      .filter(Boolean);
    if (items.length > 0) {
      sections.push({
        section: "saved",
        items: rankLimit(items, SECTION_LIMITS.saved, (item) => item.label),
      });
    }
  }

  // 3. Kolom.
  const columnList = toArray(columns).filter((col) =>
    isColumnSearchable(col, t),
  );
  const columnItems = columnList
    .map((col) => {
      const label = columnTitle(col, t);
      if (!matches(label)) return null;
      return {
        key: `column-${col.name}`,
        label,
        payload: { column: col.name },
      };
    })
    .filter(Boolean);
  if (columnItems.length > 0) {
    sections.push({
      section: "column",
      items: rankLimit(
        columnItems,
        SECTION_LIMITS.column,
        (item) => item.label,
        (item) => recentSet.has(item.payload.column),
      ),
    });
  }

  // 4. Nilai -- opsi kolom ber-opsi + boolean + preset/periode kolom tanggal +
  // nilai ketikan kolom angka/teks + record kolom relation. Cocok label nilai
  // SAJA (bukan label gabungan "Kolom: Label"), ATAU -- revisi 13 -- ketikan
  // menyebut JUDUL kolom lalu (opsional) nilainya: "status" -> nilai kolom
  // Status; "status diterima" -> "Status: Diterima". `prefix` ("Kolom: ")
  // dirender polos oleh komponen; hanya sisa label yg di-highlight (design.md
  // §5.2 baris terakhir).
  const originalWords = trimmed.split(/\s+/);
  const valueItems = [];
  for (const col of columnList) {
    const colLabel = columnTitle(col, t);
    const { colWords, restWords, restText } = splitScope(
      originalWords,
      colLabel,
    );
    const scoped = colWords.length > 0;
    const restLower = restWords.map((w) => w.toLowerCase());
    // Label nilai cocok: seluruh ketikan ada di label, ATAU (kata kolom
    // dikeluarkan) sisanya. Skor dihitung thd "Kolom Label" bila lewat jalur
    // kedua supaya ketikan "kolom nilai" terhitung prefix.
    const matchesValue = (label) =>
      matches(label) || (scoped && matchesAllWords(label, restLower));
    const scoreLabel = (label) =>
      matches(label) ? label : `${colLabel} ${label}`;
    const item = (key, label, payload, matchLabel, extra) => ({
      key: `value-${col.name}-${key}`,
      label: `${colLabel}: ${label}`,
      prefix: `${colLabel}: `,
      payload,
      _matchLabel: matchLabel,
      ...extra,
    });
    const mode = resolveValueMode(col);

    if (columnHasOptions(col)) {
      for (const opt of buildOptionList(col, t)) {
        if (!matchesValue(opt.label)) continue;
        valueItems.push(
          item(
            opt.value,
            opt.label,
            // `formStatuses` (array status) tak punya `=` -> `in` (backend Cleaner).
            col.type === "formStatuses"
              ? { k: col.name, o: "in", v: [opt.value] }
              : { k: col.name, o: "=", v: opt.value },
            scoreLabel(opt.label),
            isStatusColumn(col) ? { badgeStatus: opt.value } : undefined,
          ),
        );
      }
    } else if (col.type === "boolean") {
      for (const boolValue of [true, false]) {
        const boolLabel = t(
          boolValue ? "core.datatable.yes" : "core.datatable.no",
        );
        if (!matchesValue(boolLabel)) continue;
        valueItems.push(
          item(
            boolValue,
            boolLabel,
            { k: col.name, o: "=", v: boolValue },
            scoreLabel(boolLabel),
          ),
        );
      }
    } else if (mode === "date") {
      // Kolom tanggal: preset periode (Hari ini, Bulan ini, ...) -- nilai
      // in_period absolut, tanpa dialog DateSelector.
      for (const preset of buildDatePresets(now ?? new Date(), t)) {
        if (!matchesValue(preset.label)) continue;
        valueItems.push(
          item(
            preset.key,
            preset.label,
            { k: col.name, o: "in_period", v: preset.value },
            scoreLabel(preset.label),
          ),
        );
      }
      // Periode yg diketik ("tanggal sep 2026", "dibuat >= jan 26") -- sama
      // dgn saran di daftar nilai kolom itu, dibatasi 3 per kolom.
      if (scoped && restText && dateContext) {
        const periods = suggestPeriodTokens(restText, {
          ...dateContext,
          isDatetime: col.type === "datetime",
          now,
        }).slice(0, 3);
        for (const period of periods) {
          const leaf = buildDateChipsLeaf(col, [period.value]);
          if (!leaf) continue;
          valueItems.push(
            item(period.key, period.label, leaf, `${colLabel} ${period.label}`),
          );
        }
      }
    } else if ((mode === "number" || mode === "text") && scoped && restText) {
      // Kolom angka/teks: sisa ketikan = nilainya ("total 500", "nama budi"),
      // operator default per tipe (`=`/perbandingan; `matches`).
      const leaf = buildChipsLeaf(col, [restText]);
      if (leaf) {
        valueItems.push(
          item(
            "typed",
            mode === "text" ? `"${restText}"` : restText,
            leaf,
            `${colLabel} ${restText}`,
          ),
        );
      }
    }
  }
  // Record kolom relation hasil fetch host (sudah dicari dgn sisa ketikan).
  const relationColumn = relationRecords?.records?.length
    ? columnList.find((col) => col.name === relationRecords.column)
    : null;
  if (relationColumn) {
    const colLabel = columnTitle(relationColumn, t);
    for (const { record, label } of relationRecords.records) {
      valueItems.push({
        key: `value-${relationColumn.name}-${record.id}`,
        label: `${colLabel}: ${label}`,
        prefix: `${colLabel}: `,
        payload: { k: relationColumn.name, o: "=", v: record },
        _matchLabel: `${colLabel} ${label}`,
      });
    }
  }
  if (valueItems.length > 0) {
    const ranked = rankLimit(
      valueItems,
      SECTION_LIMITS.value,
      (item) => item._matchLabel,
    );
    sections.push({
      section: "value",
      items: ranked.map(({ _matchLabel, ...item }) => item),
    });
  }

  // 5. Kelompokkan -- hanya bila host memberi `groupOptions`.
  if (Array.isArray(groupOptions)) {
    const items = groupOptions
      .filter((opt) => opt.value !== NO_GROUP_VALUE)
      .map((opt) => {
        if (!matches(opt.label)) return null;
        return {
          key: `group-${opt.value}`,
          label: t("core.datatable.search.group_by_label", {
            column: opt.label,
          }),
          payload: { column: opt.value },
          _matchLabel: opt.label,
        };
      })
      .filter(Boolean);
    if (items.length > 0) {
      const ranked = rankLimit(
        items,
        SECTION_LIMITS.group,
        (item) => item._matchLabel,
      );
      sections.push({
        section: "group",
        items: ranked.map(({ _matchLabel, ...item }) => item),
      });
    }
  }

  return rankSections(sections);
};

export { buildSuggestions, findRelationScope };
