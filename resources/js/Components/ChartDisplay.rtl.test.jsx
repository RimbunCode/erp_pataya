import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({
    t: (key) => `TR:${key}`,
    currentLocale: () => "en",
  }),
}));

vi.mock("@inertiajs/react", () => ({
  usePage: () => ({
    props: { preferences: { default_number_format: "#,###.##" } },
  }),
}));

const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: { post: (...args) => axiosPost(...args) },
}));

window.route = (name, id) => `${name}/${id}`;

import ChartDisplay from "./ChartDisplay";

// Ganti dari DashboardChart.rtl.test.jsx (komponen lama, sudah dihapus sejak
// refactor Widget -> Chart/NumberCard terpisah, lihat komentar di
// ChartDisplay.jsx). Data sumber sekarang `chart`/`charts.getData` (bukan
// `widget`/`get-chart`). Aggregate "card" (total/average) SUDAH BUKAN
// tanggung jawab komponen ini -- dipisah ke NumberCardDisplay.jsx -- jadi
// tidak diuji di sini. recharts <ResponsiveContainer> tidak pernah render
// children di jsdom (butuh dimensi layout nyata), jadi verifikasi berhenti
// di state loading/error/loaded (bukan isi visual chart itu sendiri).
const baseChart = {
  id: 5,
  chart_name: "Sales per Bulan",
  chart_source_type: "time_series",
  visual_type: "bar",
};

// QueryClientProvider WAJIB (opsi L, komponen pakai useQuery) — queryClient
// FRESH per render() supaya cache tidak bocor lintas test. render() polos
// dari RTL cuma membungkus bagian SINKRON dalam act() -- promise mock (walau
// resolve instan) tetap lanjut di microtask SESUDAH act() itu selesai, plus
// scheduling internal TanStack Query bisa butuh lebih dari satu flush
// microtask. Fix: bungkus render() dalam `await act(async () => {...})`
// UNTUK microtask pertama, lalu assert state pasca-fetch pakai waitFor()
// (act-safe internal RTL) yang polling sampai benar-benar stabil.
const renderSettled = async (props) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  let result;
  await act(async () => {
    result = render(
      <QueryClientProvider client={queryClient}>
        <ChartDisplay {...props} />
      </QueryClientProvider>,
    );
  });
  return result;
};

describe("ChartDisplay", () => {
  beforeEach(() => {
    axiosPost.mockReset();
  });

  it("fetch data via charts.getData dengan chart.id & filters yang benar saat mount", async () => {
    axiosPost.mockResolvedValue({ data: [{ period: "Jan", total: 100 }] });
    await renderSettled({ chart: baseChart, filters: { branch_id: "b1" } });

    await waitFor(() =>
      expect(axiosPost).toHaveBeenCalledWith(
        "charts.getData/5",
        expect.objectContaining({
          filters: { branch_id: "b1" },
          config: {},
        }),
      ),
    );
    expect(screen.queryByText("Memuat data...")).not.toBeInTheDocument();
  });

  it("menampilkan pesan error saat fetch gagal", async () => {
    axiosPost.mockRejectedValue(new Error("network error"));
    await renderSettled({ chart: baseChart });

    await waitFor(() =>
      expect(screen.getByText("Gagal memuat data.")).toBeInTheDocument(),
    );
  });

  it("berhenti loading & tidak error setelah data berhasil dimuat", async () => {
    axiosPost.mockResolvedValue({ data: [{ period: "Jan", total: 100 }] });
    await renderSettled({ chart: baseChart });

    await waitFor(() =>
      expect(screen.queryByText("Memuat data...")).not.toBeInTheDocument(),
    );
    expect(screen.queryByText("Gagal memuat data.")).not.toBeInTheDocument();
  });

  it("chart_name dirender di header", async () => {
    axiosPost.mockResolvedValue({ data: [] });
    await renderSettled({ chart: baseChart });

    expect(screen.getByText("Sales per Bulan")).toBeInTheDocument();
  });
});
