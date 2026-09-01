import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";

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

// reload() di ChartDisplay.jsx memanggil axios.post(...).then(setData/
// setLoading) di useEffect saat mount. `render()` polos dari RTL cuma
// membungkus bagian SINKRON dalam act() -- promise mock (walau resolve
// instan) tetap lanjut di microtask SESUDAH act() itu selesai, plus
// `waitFor()` pasca-render cuma membungkus tiap POLL-nya sendiri (balapan
// vs resolusi microtask pertama). Fix yang benar: bungkus render() ITU
// SENDIRI dalam `await act(async () => {...})` -- versi async act() secara
// eksplisit menunggu SEMUA microtask (termasuk .then() axios) sampai stabil
// sebelum baris berikutnya jalan.
const renderSettled = async (props) => {
  const utils = render.bind(null);
  let result;
  await act(async () => {
    result = utils(<ChartDisplay {...props} />);
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

    expect(axiosPost).toHaveBeenCalledWith(
      "charts.getData/5",
      expect.objectContaining({
        filters: { branch_id: "b1" },
        config: {},
      }),
    );
    expect(screen.queryByText("Memuat data...")).not.toBeInTheDocument();
  });

  it("menampilkan pesan error saat fetch gagal", async () => {
    axiosPost.mockRejectedValue(new Error("network error"));
    await renderSettled({ chart: baseChart });

    expect(screen.getByText("Gagal memuat data.")).toBeInTheDocument();
  });

  it("berhenti loading & tidak error setelah data berhasil dimuat", async () => {
    axiosPost.mockResolvedValue({ data: [{ period: "Jan", total: 100 }] });
    await renderSettled({ chart: baseChart });

    expect(screen.queryByText("Memuat data...")).not.toBeInTheDocument();
    expect(screen.queryByText("Gagal memuat data.")).not.toBeInTheDocument();
  });

  it("chart_name dirender di header", async () => {
    axiosPost.mockResolvedValue({ data: [] });
    await renderSettled({ chart: baseChart });

    expect(screen.getByText("Sales per Bulan")).toBeInTheDocument();
  });
});
