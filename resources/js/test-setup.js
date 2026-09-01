import "@testing-library/jest-dom/vitest";

// jsdom tidak mengimplementasikan ResizeObserver -- dibutuhkan oleh cmdk
// (dipakai Select, MultiSelect, SelectModel, dll) dan beberapa komponen
// Radix UI lain yang mengukur elemen di layout.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class _ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Node 22+ punya lazy getter `localStorage` global yang butuh flag
// --localstorage-file, dan pada kombinasi Vitest 4.1.7 + Node 22+ di
// lingkungan ini jsdom's localStorage tidak ter-bridge dengan bersih ke
// global scope -- localStorage jadi `undefined`. Ini crash SIAPA SAJA yang
// transitively mengimpor Hooks/useTheme.js (state zustand-nya memanggil
// localStorage.getItem() di module-level saat store dibuat), bukan cuma
// test untuk useTheme sendiri. Polyfill in-memory global di sini (bukan
// per-test-file) supaya seluruh komponen yang narik useTheme tetap bisa
// di-render. Lihat juga Hooks/useTheme.dom.test.js untuk detail root cause.
//
// Guard juga harus cek `getItem` benar-benar function, bukan cuma
// `typeof === "undefined"` -- pada Node versi lain (mis. CI pakai versi
// beda dari mesin dev via .nvmrc), globalThis.localStorage sudah TERISI
// native (bukan undefined) tapi objeknya rusak/tidak lengkap tanpa flag
// --localstorage-file, jadi getItem bukan function. Guard yang cuma cek
// undefined lolos di kondisi ini dan polyfill tidak pernah terpasang.
if (
  typeof globalThis.localStorage === "undefined" ||
  typeof globalThis.localStorage.getItem !== "function"
) {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
}

// jsdom tidak mengimplementasikan window.matchMedia. Dibutuhkan oleh
// Hooks/useTheme.js di module-level (sama alasan seperti localStorage di
// atas) dan komponen lain yang query breakpoint (use-mobile.jsx, useScreen.jsx).
// Default: tidak match apapun -- test yang butuh skenario match tertentu
// tetap boleh override window.matchMedia sendiri (lihat use-mobile.dom.test.js).
if (typeof globalThis.matchMedia === "undefined") {
  globalThis.matchMedia = (query) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
}

// jsdom tidak mengimplementasikan Element.scrollIntoView -- dipakai cmdk untuk
// auto-scroll item terpilih (Select, MultiSelect, NestedSelect, dll).
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
