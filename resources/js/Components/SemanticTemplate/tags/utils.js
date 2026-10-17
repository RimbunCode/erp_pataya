import { isValidElement } from "react";

/**
 * Teks polos dari children React (string/angka/array/elemen bersarang).
 * Dipakai tag yang butuh nilai teks, mis. <status> dan tooltip <truncate>.
 * @param {import("react").ReactNode} node
 * @returns {string}
 */
export function childrenToText(node) {
  if (node == null || typeof node === "boolean") {
    return "";
  }
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(childrenToText).join("");
  }
  if (isValidElement(node)) {
    return childrenToText(node.props?.children);
  }

  return "";
}

/**
 * Nilai dianggap "terisi" untuk <when>: truthy, dan array kosong tidak terisi.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isFilled(value) {
  return Array.isArray(value) ? value.length > 0 : Boolean(value);
}
