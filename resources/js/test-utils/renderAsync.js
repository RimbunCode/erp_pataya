import { act, render } from "@testing-library/react";

/**
 * Varian async dari `render()` RTL -- dipakai utk komponen yang menembak
 * axios/fetch (atau async lain) di useEffect saat mount TANPA test-nya
 * eksplisit menunggu (loadUnits, loadGroups, useCurrency, getFonts, dst.
 * pola yang sama berulang di banyak Form/Page).
 *
 * `render()` polos RTL cuma membungkus bagian SINKRON dalam act() --
 * promise (walau mock resolve instan) tetap lanjut di microtask SESUDAH
 * act() itu selesai, jadi setState dari `.then()`-nya jatuh di luar act(),
 * memicu warning React "not wrapped in act(...)". `waitFor()` pasca-render
 * TIDAK cukup: ia cuma membungkus tiap POLL-nya sendiri, balapan vs
 * resolusi microtask PERTAMA yang seringkali sudah lewat sebelum poll
 * pertama jalan.
 *
 * Fix yang benar: bungkus `render()` ITU SENDIRI dalam
 * `await act(async () => {})` -- versi async act() secara eksplisit
 * menunggu SEMUA microtask sampai stabil sebelum baris berikutnya jalan.
 * @param {import('react').ReactElement} ui
 * @param {Parameters<typeof render>[1]} [options]
 * @returns {Promise<ReturnType<typeof render>>}
 */
export async function renderAsync(ui, options) {
  let result;
  await act(async () => {
    result = render(ui, options);
  });
  return result;
}
