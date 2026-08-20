import { describe, expect, it, vi, beforeEach } from "vitest";
import { render as rtlRender, screen } from "@testing-library/react";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

vi.mock("@inertiajs/react", () => ({
  usePage: () => ({ props: { lang: "en" } }),
}));

const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: { post: (...args) => axiosPost(...args) },
}));

window.route = (name, id) => `${name}/${id}`;

import DashboardChart from "./DashboardChart";
import { TooltipProvider } from "./ui/tooltip";

const render = (ui) => rtlRender(<TooltipProvider>{ui}</TooltipProvider>);

const baseWidget = {
  id: 1,
  chart_type: "bar",
  calculation_type: "total",
  time_based_on: "created_at",
  timespan: "last_month",
};

describe("DashboardChart", () => {
  beforeEach(() => {
    axiosPost.mockReset();
  });

  it("memanggil axios get-chart dengan widget id yang benar setelah debounce", async () => {
    axiosPost.mockResolvedValue({ data: [] });
    render(<DashboardChart widget={baseWidget} />);

    await vi.waitFor(
      () =>
        expect(axiosPost).toHaveBeenCalledWith(
          "get-chart/1",
          expect.objectContaining({
            config: expect.objectContaining({ timespan: "last_month" }),
          }),
        ),
      { timeout: 2000 },
    );
  });

  it("tidak memanggil axios jika widget.time_based_on kosong", async () => {
    axiosPost.mockResolvedValue({ data: [] });
    render(<DashboardChart widget={{ ...baseWidget, time_based_on: null }} />);

    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(axiosPost).not.toHaveBeenCalled();
  });

  // Aggregate value (total/average) hanya dirender di layout widget.type==="card"
  // (bukan di layout chart biasa). recharts <ResponsiveContainer> sendiri tidak
  // pernah render children di jsdom (butuh ResizeObserver dgn dimensi nyata,
  // yang tidak dimiliki jsdom) -- jadi verifikasi angka HARUS lewat layout
  // "card", bukan lewat isi chart itu sendiri.
  it("menampilkan total agregasi dari data yang diterima (calculation_type='total')", async () => {
    axiosPost.mockResolvedValue({
      data: [
        { period: "Jan", total: 100 },
        { period: "Feb", total: 250 },
      ],
    });
    render(<DashboardChart widget={{ ...baseWidget, type: "card" }} />);

    // total = 100 + 250 = 350. Timeout diperpanjang (default findByText 1000ms
    // mepet dgn debounce fetch 500ms di source -- rawan flaky saat CPU
    // contention pada suite besar, lihat testTimeout global di vitest.config.js).
    expect(
      await screen.findByText("350", {}, { timeout: 3000 }),
    ).toBeInTheDocument();
  });

  it("menampilkan rata-rata dari data yang diterima (calculation_type='average')", async () => {
    axiosPost.mockResolvedValue({
      data: [
        { period: "Jan", average: 100 },
        { period: "Feb", average: 300 },
      ],
    });
    render(
      <DashboardChart
        widget={{ ...baseWidget, type: "card", calculation_type: "average" }}
      />,
    );

    // average = (100 + 300) / 2 = 200
    expect(
      await screen.findByText("200", {}, { timeout: 3000 }),
    ).toBeInTheDocument();
  });

  it("menampilkan 0 saat data kosong", async () => {
    axiosPost.mockResolvedValue({ data: [] });
    render(<DashboardChart widget={{ ...baseWidget, type: "card" }} />);

    expect(
      await screen.findByText("0", {}, { timeout: 3000 }),
    ).toBeInTheDocument();
  });
});
