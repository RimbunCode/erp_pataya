/**
 * Utilitas untuk membangun dan menyisipkan token variabel ke canvas editor.
 * Menangani tipe variabel: "company", "docInfo", "relation", dan "doc" (default).
 * Menyediakan fungsi-fungsi untuk membangun token, menyederhanakan tampilan,
 * membuat payload drag, dan menyisipkan token inline ke komponen teks.
 * @module variableInsertUtils
 */

import {
  encodeTokenToBase64,
  escapeAttributeValue,
  simplifyInlineDisplayToken,
} from "./variableEncodingUtils";
import { simplifyTokenDisplay } from "../Components/tokenConfigHelpers";

import { getFormattedHandlebarToken } from "./variableTokenUtils";

/**
 * Mengekstrak label key dari token Handlebar dengan menghapus pembungkus {{...}}
 * dan membersihkan prefix helper (relation, label, formatCurrency, formatNumber, #each).
 * Idempotent: jika input sudah tanpa pembungkus, dikembalikan apa adanya setelah cleaning.
 * @param {string} token - String token (bisa dengan atau tanpa pembungkus `{{...}}`)
 * @returns {string} Path variabel bersih tanpa prefix helper dan tanpa pembungkus
 * @example
 * extractLabelKeyFromToken('{{relation doc.category}}')   // "doc.category"
 * extractLabelKeyFromToken('{{label "doc.category"}}')    // "doc.category"
 * extractLabelKeyFromToken('{{formatCurrency doc.total "IDR"}}') // "doc.total"
 * extractLabelKeyFromToken('{{formatNumber doc.qty 0}}')  // "doc.qty"
 * extractLabelKeyFromToken('{{#each doc.items}}...{{/each}}') // "doc.items"
 * extractLabelKeyFromToken('{{doc.name}}')                // "doc.name"
 * extractLabelKeyFromToken('{{company.name}}')            // "company.name"
 */
export function extractLabelKeyFromToken(token) {
  if (!token || typeof token !== "string") {
    return "";
  }

  // Strip {{...}} wrapper
  const match = token.trim().match(/^\{\{\s*(.*?)\s*\}\}$/);
  let inner = match ? match[1] : token.trim();

  // Strip #each prefix and trailing }}...{{/each}}
  // e.g. "#each doc.items}}...{{/each" → "doc.items"
  inner = inner.replace(/^#each\s+/, "").replace(/\}\}.*\{\{\/each$/, "");

  // Strip "relation " prefix → "relation doc.category" → "doc.category"
  inner = inner.replace(/^relation\s+/, "");

  // Strip "label " prefix and surrounding quotes → 'label "doc.category"' → "doc.category"
  inner = inner.replace(/^label\s+/, "");

  // Strip "formatCurrency " prefix and trailing arguments → 'formatCurrency doc.total "IDR"' → "doc.total"
  inner = inner.replace(/^formatCurrency\s+/, "");

  // Strip "formatNumber " prefix and trailing arguments → 'formatNumber doc.qty 0' → "doc.qty"
  inner = inner.replace(/^formatNumber\s+/, "");

  // Strip "formatDate " prefix and trailing arguments
  inner = inner.replace(/^formatDate\s+/, "");

  // Remove trailing helper arguments (quoted strings, numbers) after the path
  // e.g. 'doc.total "IDR"' → "doc.total", 'doc.qty 0' → "doc.qty"
  inner = inner.replace(/\s+["'\d].*$/, "");

  // Remove surrounding quotes (from label helper)
  // e.g. '"doc.category"' → "doc.category"
  inner = inner.replace(/^["']|["']$/g, "");

  return inner;
}

/**
 * Membangun string token Handlebar berdasarkan tipe dan path variabel.
 * Menentukan format token sesuai dengan tipe variabel:
 * - company → {{company.<keyName>}}
 * - docInfo → {{docInfo.<keyName>}}
 * - relation → {{relation doc.<path>}}
 * - default → {{doc.<path>}}
 * @param {object} params - Parameter untuk membangun token
 * @param {string} params.variableType - Tipe variabel (company, docInfo, relation, data, dll)
 * @param {string} params.parentType - Tipe parent dari variabel (company, docInfo, dll)
 * @param {string} params.variablePath - Path lengkap variabel dalam notasi dot
 * @param {string} params.keyName - Nama key variabel (digunakan untuk company/docInfo)
 * @returns {string} String token Handlebar yang sudah diformat
 */
export function buildVariableToken({
  variableType,
  parentType,
  variablePath,
  keyName,
}) {
  // Jika tipe parent atau variabel adalah "company", gunakan format company
  if (parentType === "company" || variableType === "company") {
    return `{{company.${keyName}}}`;
  }
  // Jika tipe parent atau variabel adalah "docInfo", gunakan format docInfo
  if (parentType === "docInfo" || variableType === "docInfo") {
    return `{{docInfo.${keyName}}}`;
  }

  // Normalisasi path agar selalu dimulai dengan "doc."
  const normalizedPath = variablePath.startsWith("doc.")
    ? variablePath
    : `doc.${variablePath}`;

  // Untuk tipe relation, gunakan format "relation doc.<path>"
  if (variableType === "relation") {
    return `{{relation ${normalizedPath}}}`;
  }

  // Default: gunakan path langsung tanpa prefix tambahan
  return `{{${normalizedPath}}}`;
}

/**
 * Menyederhanakan tampilan token untuk ditampilkan di canvas editor.
 * Menangani kasus khusus:
 * - Token kosong dengan variablePath berprefix "doc." → hapus prefix
 * - Token dengan formatCurrency/formatNumber → ekstrak nama field
 * - Lainnya → delegasi ke simplifyTokenDisplay
 * @param {string} token - String token Handlebar lengkap (bisa kosong)
 * @param {string} [variablePath] - Path variabel untuk fallback jika token kosong
 * @returns {string} Token yang disederhanakan untuk tampilan di canvas
 */
export function getSimplifiedTokenDisplay(token, variablePath = "") {
  // Jika token kosong, buat tampilan dari variablePath dengan menghapus prefix "doc."
  if (!token) {
    return variablePath ? `{{${variablePath.replace(/^doc\./, "")}}}` : "";
  }

  // Cek apakah token mengandung formatCurrency atau formatNumber
  const formattedTokenMatch = token.match(
    /\{\{\s*format(?:Currency|Number)\s+doc\.([^\s}]+)/,
  );
  if (formattedTokenMatch?.[1]) {
    return `{{${formattedTokenMatch[1]}}}`;
  }

  // Delegasi ke simplifyTokenDisplay untuk kasus lainnya
  return simplifyTokenDisplay(token);
}

/**
 * Membangun lookup map `labelKey/path -> titleTrans` dari dataTableColumns.
 * Lookup key mengikuti pola key yang digunakan di canvas (`data-label-key`).
 * @param {Array} dataTableColumns
 * @returns {Record<string, string>}
 */
export function buildTitleTransLookupMap(dataTableColumns) {
  const map = {};

  const normalizeTitleTrans = (value) =>
    typeof value === "string" && value.trim() ? value.trim() : null;

  const put = (key, titleTrans) => {
    if (!key) {
      return;
    }
    if (!titleTrans) {
      return;
    }
    map[key] = titleTrans;
  };

  const traverse = (columns, parentPath = "", parentType = "") => {
    if (!Array.isArray(columns)) {
      return;
    }

    for (const col of columns) {
      const colType = col?.type || "";
      const colName = col?.name || "";
      if (!colName) {
        continue;
      }

      let fullKey;
      if (
        parentType === "doc" ||
        parentType === "docInfo" ||
        parentType === "company"
      ) {
        fullKey = parentPath ? `${parentPath}.${colName}` : colName;
      } else if (parentPath) {
        fullKey = `${parentPath}.${colName}`;
      } else {
        fullKey = colName;
      }

      const titleTrans = normalizeTitleTrans(col?.titleTrans);

      put(fullKey, titleTrans);
      put(colName, titleTrans);

      if (parentType === "doc" || colType === "doc") {
        put(`doc.${fullKey}`, titleTrans);
      }

      if (parentType === "company" || colType === "company") {
        put(`company.${colName}`, titleTrans);
        put(`company.${fullKey}`, titleTrans);
      }

      if (parentType === "docInfo" || colType === "docInfo") {
        put(`docInfo.${colName}`, titleTrans);
      }

      if (colType === "relation") {
        put(`doc.${fullKey}`, titleTrans);
        put(`relation doc.${fullKey}`, titleTrans);
      }

      if (Array.isArray(col?.columns) && col.columns.length > 0) {
        const effectiveParentType =
          colType === "doc" || colType === "docInfo" || colType === "company"
            ? colType
            : parentType;
        const effectivePath =
          colType === "doc" || colType === "docInfo" || colType === "company"
            ? ""
            : fullKey;
        traverse(col.columns, effectivePath, effectiveParentType);
      }
    }
  };

  traverse(dataTableColumns, "", "");

  return map;
}

/**
 * Membuat payload data untuk operasi drag variabel ke canvas editor.
 * Menggabungkan informasi variabel dengan token terformat.
 * @param {object} params - Parameter untuk membuat payload
 * @param {object} params.variable - Objek variabel dengan properti name, type, dll
 * @param {Array} params.nestedColumns - Kolom-kolom nested untuk relasi
 * @param {string} params.displayLabel - Label tampilan variabel
 * @param {string} params.fullKey - Key lengkap dalam notasi dot
 * @param {Record<string, string>|null} [params.titleTransLookup] - Lookup titleTrans berdasarkan key/path variabel
 * @returns {object} Payload yang siap digunakan untuk drag-and-drop
 */
export function buildVariableDragPayload({
  variable,
  nestedColumns,
  displayLabel,
  fullKey,
  titleTransLookup = null,
}) {
  const { titleTrans, ...restVariable } = variable || {};
  const labelKey = extractLabelKeyFromToken(
    getFormattedHandlebarToken(variable, fullKey),
  );
  const lookupTitleTrans =
    titleTransLookup && typeof titleTransLookup === "object"
      ? titleTransLookup[labelKey] ||
        titleTransLookup[fullKey] ||
        titleTransLookup[variable?.name]
      : null;
  let normalizedTitleTrans = null;
  if (typeof titleTrans === "string" && titleTrans.trim()) {
    normalizedTitleTrans = titleTrans.trim();
  } else if (typeof lookupTitleTrans === "string" && lookupTitleTrans.trim()) {
    normalizedTitleTrans = lookupTitleTrans.trim();
  }

  const tokenValue =
    getFormattedHandlebarToken(variable, fullKey) ||
    buildVariableToken({
      variableType: variable?.type,
      parentType: variable?.parentType,
      variablePath: fullKey,
      keyName: variable?.name,
    });

  return {
    ...restVariable,
    ...(normalizedTitleTrans ? { titleTrans: normalizedTitleTrans } : {}),
    columns: nestedColumns,
    displayLabel,
    fullKey,
    formattedToken: tokenValue,
    labelKey,
    simplifiedToken: getSimplifiedTokenDisplay(tokenValue, fullKey),
  };
}

/**
 * Membangun definisi komponen GrapesJS untuk mode "Label Only".
 * @param {object} payload - Payload dari buildVariableDragPayload
 * @returns {object} GrapesJS component definition
 */
export function buildLabelComponent(payload) {
  const normalizedTitleTrans =
    typeof payload.titleTrans === "string" && payload.titleTrans.trim()
      ? payload.titleTrans.trim()
      : null;

  return {
    type: "text",
    tagName: "p",
    droppable: true,
    draggable: true,
    attributes: {
      "data-label-key": payload.labelKey,
      ...(normalizedTitleTrans
        ? { "data-trans-title": normalizedTitleTrans }
        : {}),
      title: `{{label "${payload.labelKey}"}}`,
    },
    components: [
      {
        type: "text",
        tagName: "span",
        selectable: true,
        editable: false,
        draggable: false,
        attributes: {
          title: payload.labelKey,
          contenteditable: "false",
        },
        content: payload.displayLabel || payload.name,
      },
    ],
  };
}

/**
 * Membangun definisi komponen GrapesJS untuk mode "Token Only".
 * @param {object} payload - Payload dari buildVariableDragPayload
 * @returns {object} GrapesJS component definition
 */
export function buildTokenComponent(payload) {
  return {
    type: "text",
    tagName: "p",
    editable: true,
    droppable: true,
    draggable: true,
    components: [
      {
        type: "text",
        tagName: "span",
        selectable: true,
        editable: false,
        draggable: false,
        attributes: {
          "data-token": payload.formattedToken,
          title: payload.formattedToken,
          contenteditable: "false",
        },
        content: payload.simplifiedToken,
      },
    ],
  };
}

/**
 * Membangun definisi komponen GrapesJS untuk mode "Both" (gjsSubGrid).
 * @param {object} payload - Payload dari buildVariableDragPayload
 * @returns {object} GrapesJS component definition
 */
export function buildSubGridComponent(payload) {
  const labelComp = buildLabelComponent(payload);
  const tokenComp = buildTokenComponent(payload);

  // Sesuaikan komponen token agar punya separator ": " dan tidak draggable secara independen
  tokenComp.draggable = false;
  tokenComp.components.unshift({
    type: "textnode",
    content: ": ",
  });

  // Label juga tidak draggable secara independen dalam subgrid
  labelComp.draggable = false;

  return {
    type: "gjsSubGrid",
    attributes: {
      "data-variable": payload.fullKey || payload.name,
      "data-variable-type": payload.parentType || payload.type || "data",
    },
    components: [labelComp, tokenComp],
  };
}

/**
 * Mencoba menyisipkan token variabel secara inline ke komponen teks yang sedang diedit.
 * Hanya berhasil jika komponen yang dipilih adalah tipe "text" dan sedang dalam mode edit.
 * Menggunakan execCommand untuk menyisipkan HTML span dengan atribut data variabel.
 * @param {object} editor - Instance editor GrapesJS
 * @param {object} selectedComponent - Komponen yang sedang dipilih di canvas
 * @param {string} token - String token Handlebar yang akan disisipkan
 * @param {string} fullKey - Key lengkap variabel dalam notasi dot
 * @returns {boolean} True jika berhasil menyisipkan, false jika tidak memenuhi syarat
 */
export function tryInsertInlineVariableToken(
  editor,
  selectedComponent,
  token,
  fullKey,
) {
  if (!editor || !selectedComponent || !token) {
    return false;
  }

  // Periksa apakah komponen adalah tipe teks dan sedang dalam mode edit
  const isTextComponent = selectedComponent.is?.("text");
  const isTextEditingActive = editor.Commands?.isActive?.(
    "core:component-text",
  );

  if (!isTextComponent || !isTextEditingActive) {
    return false;
  }

  // Dapatkan dokumen iframe canvas untuk eksekusi insertHTML
  const iframeDocument = editor.Canvas.getDocument?.();
  if (!iframeDocument?.execCommand) {
    return false;
  }

  // Bangun HTML inline dengan atribut data untuk identifikasi variabel
  const inlinePath = fullKey.replace(/^doc\./, "");
  const displayToken = simplifyInlineDisplayToken(fullKey, token);
  const encodedToken = encodeTokenToBase64(token);
  const inlineHtml = `<span data-variable-inline="${escapeAttributeValue(inlinePath)}" data-variable-path="${escapeAttributeValue(inlinePath)}" data-token="${escapeAttributeValue(token)}" data-token-b64="${escapeAttributeValue(encodedToken)}" contenteditable="false" class="inline-variable-token">${escapeAttributeValue(displayToken)}</span>`;

  // Sisipkan HTML ke posisi kursor saat ini dalam komponen teks
  iframeDocument.execCommand("insertHTML", false, inlineHtml);
  selectedComponent.trigger("change:content");
  editor.trigger("update");

  return true;
}
