import { QueryClient } from "@tanstack/react-query";

// Opsi L (optimasi dashboard): dipanggil di app.jsx/ssr.jsx `setup()` --
// FUNGSI (bukan singleton module-level) supaya SSR (ssr.jsx, setup()
// dipanggil ULANG tiap request) selalu dapat instance BARU, tidak ada state
// query bocor lintas user/request lewat proses Node SSR yang persisten.
// Client-side (app.jsx) setup() cuma jalan sekali per page-load, jadi
// instance-nya tetap hidup selama sesi SPA -- persis perilaku yang
// diinginkan (cache dipakai bareng lintas block dashboard di halaman sama).
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Selaras cacheDuration backend (NumberCardService/ChartService,
        // lihat opsi B) -- data dianggap "fresh" (tidak fetch ulang saat
        // remount dlm window ini) sepanjang cache server-side juga masih
        // hidup.
        staleTime: 120_000,
        // Block dashboard gagal fetch langsung tampil "Gagal memuat
        // data." (perilaku lama axios+useEffect, tanpa retry) -- retry
        // default TanStack Query (3x backoff) akan mengubah UX itu.
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });
}
