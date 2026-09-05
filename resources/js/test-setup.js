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

// jsdom tidak mengimplementasikan IntersectionObserver -- dibutuhkan
// Hooks/useInViewport.js (lazy-fetch block dashboard, lihat komentar di
// sana). jsdom tidak punya layout nyata, jadi anggap elemen LANGSUNG
// intersecting begitu di-observe -- perilaku test SAMA seperti sebelum
// lazy-load ditambahkan (fetch langsung on mount), tes yang butuh skenario
// "belum kelihatan" boleh override window.IntersectionObserver sendiri.
if (typeof globalThis.IntersectionObserver === "undefined") {
  globalThis.IntersectionObserver = class _IntersectionObserver {
    constructor(callback) {
      this.callback = callback;
    }
    observe(target) {
      this.callback([{ isIntersecting: true, target }]);
    }
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
    get length() {
      return store.size;
    },
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

// jsdom tidak mengimplementasikan Element.hasPointerCapture/setPointerCapture/
// releasePointerCapture -- dipakai Radix UI (Select, Slider, Tooltip, Switch,
// dll) di handler onPointerDown untuk cek/klaim pointer capture sebelum
// membuka/menutup state. Tanpa polyfill ini, pemanggilan
// `event.currentTarget.hasPointerCapture(...)` melempar TypeError yang
// ditelan diam-diam oleh React event system -- listbox/popup Radix jadi
// TIDAK PERNAH terbuka di test (bukan gagal assert, tapi elemen memang tidak
// pernah ter-render), tanpa pesan error yang jelas menunjuk ke sini.
if (typeof Element !== "undefined" && !Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
}

// jsdom's requestAnimationFrame pakai real timer (~16ms), bukan sinkron.
// FormTable.scheduleParentUpdate() -- dipakai SEMUA Form berbasis FormTable
// untuk propagate kalkulasi total item (net_amount/tax_amount/dst) ke parent
// -- menjadwalkan update lewat rAF ini secara default (immediate=false).
// Karena rAF asli jsdom baru jalan SETELAH act() dari render()/fireEvent()
// pada test sudah selesai, update state yang di-trigger dari dalamnya
// (parent re-render -> NumberInput menerima value baru -> setDisplayValue)
// jatuh DI LUAR act(), memicu warning "not wrapped in act(...)" -- ini
// penyebab tunggal mayoritas warning ForwardRef(NumberInput) di suite ini,
// bukan bug di test/komponen manapun secara individual. Jalankan callback
// SINKRON di test (production tetap pakai rAF asli browser) supaya update
// terjadi dalam call-stack yang sama dengan act() yang sudah membungkus
// render()/fireEvent().
globalThis.requestAnimationFrame = (cb) => {
  cb(Date.now());
  return 0;
};
globalThis.cancelAnimationFrame = () => {};
