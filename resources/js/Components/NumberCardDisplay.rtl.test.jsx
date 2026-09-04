import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";

// NumberCardDisplay: fetch 1x on mount via axios.post("numberCards.getValue",
// {filters}) -> {value, percentage}, lewat TanStack Query (opsi L) — dedup +
// cache, gated `enabled: isInView` (opsi C, lihat useInViewport polyfill di
// test-setup.js: langsung "intersecting" di jsdom, jadi perilaku tes SAMA
// seperti sebelum lazy-load ditambahkan). BlockDescriptionTooltip di-stub
// jadi spy (pola sama NumberCardBlock/LinkCardBlock.rtl.test.jsx -- logic &
// render aslinya sudah dites terpisah di BlockDescriptionTooltip.test.js).
// resolveIcon & formatNumber dipakai APA ADANYA (real, pure) supaya
// integrasi sungguhan ikut teruji, bukan cuma prop passthrough.

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({
    t: (key) => `TR:${key}`,
    currentLocale: () => "en",
  }),
}));

const usePageMock = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
}));

const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: { post: (...args) => axiosPost(...args) },
}));

const blockDescriptionTooltipSpy = vi.fn();
vi.mock("@/Components/DashboardBlocks/BlockDescriptionTooltip", () => ({
  default: (props) => {
    blockDescriptionTooltipSpy(props);
    return props.description ? (
      <span data-testid="description-tooltip" />
    ) : null;
  },
}));

window.route = (name, id) => `${name}/${id}`;

import NumberCardDisplay from "./NumberCardDisplay";

const baseNumberCard = {
  id: 5,
  label: "Total Penjualan",
};

// QueryClientProvider WAJIB (komponen pakai useQuery) — retry:false supaya
// fetch gagal langsung propagate ke isError tanpa nunggu backoff, gcTime:
// Infinity + queryClient FRESH per render() supaya cache tidak bocor lintas
// test (tiap `it()` mulai dari nol, bukan numpang cache test sebelumnya).
// render() RTL polos cuma membungkus bagian SINKRON dgn act() -- fetch
// axios (dibungkus TanStack Query) resolve di microtask SESUDAH act() itu
// selesai. Bungkus render() ITU SENDIRI dgn await act(async () => {...})
// supaya microtask pertama stabil; assert yang bergantung request/response
// TETAP pakai waitFor() (act-safe internal RTL) -- scheduling internal
// TanStack Query tidak dijamin selesai dalam SATU flush microtask saja.
const renderSettled = async (props) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  // `wrapper` (bukan bungkus JSX manual) -- RTL otomatis pakai wrapper yang
  // SAMA lagi tiap `rerender()` dipanggil nanti, tanpa itu rerender() lepas
  // dari QueryClientProvider dan useQuery() error "No QueryClient set".
  const Wrapper = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  let utils;
  await act(async () => {
    utils = render(<NumberCardDisplay {...props} />, { wrapper: Wrapper });
  });

  return utils;
};

beforeEach(() => {
  axiosPost.mockReset();
  blockDescriptionTooltipSpy.mockClear();
  usePageMock.mockReset();
  usePageMock.mockReturnValue({
    props: { preferences: { default_number_format: "#,###.##" } },
  });
});

describe("NumberCardDisplay — fetch data on mount", () => {
  it("fetch via numberCards.getValue dgn numberCard.id & filters yang benar", async () => {
    axiosPost.mockResolvedValue({ data: { value: 100, percentage: null } });
    await renderSettled({
      numberCard: baseNumberCard,
      filters: { branch_id: "b1" },
    });

    await waitFor(() =>
      expect(axiosPost).toHaveBeenCalledWith("numberCards.getValue/5", {
        filters: { branch_id: "b1" },
      }),
    );
  });

  it("filters default ke {} kalau prop filters tidak diberikan", async () => {
    axiosPost.mockResolvedValue({ data: { value: 0, percentage: null } });
    await renderSettled({ numberCard: baseNumberCard });

    await waitFor(() =>
      expect(axiosPost).toHaveBeenCalledWith("numberCards.getValue/5", {
        filters: {},
      }),
    );
  });

  it("ganti numberCard.id (rerender) memicu fetch ulang dgn id baru", async () => {
    axiosPost.mockResolvedValue({ data: { value: 0, percentage: null } });
    const { rerender } = await renderSettled({ numberCard: baseNumberCard });

    await waitFor(() => expect(axiosPost).toHaveBeenCalledTimes(1));

    await act(async () => {
      rerender(<NumberCardDisplay numberCard={{ ...baseNumberCard, id: 9 }} />);
    });

    await waitFor(() => expect(axiosPost).toHaveBeenCalledTimes(2));
    expect(axiosPost).toHaveBeenLastCalledWith("numberCards.getValue/9", {
      filters: {},
    });
  });

  it("ganti isi filters (rerender, id tetap) memicu fetch ulang", async () => {
    axiosPost.mockResolvedValue({ data: { value: 0, percentage: null } });
    const { rerender } = await renderSettled({
      numberCard: baseNumberCard,
      filters: { year: 2026 },
    });

    await waitFor(() => expect(axiosPost).toHaveBeenCalledTimes(1));

    await act(async () => {
      rerender(
        <NumberCardDisplay
          numberCard={baseNumberCard}
          filters={{ year: 2027 }}
        />,
      );
    });

    await waitFor(() => expect(axiosPost).toHaveBeenCalledTimes(2));
    expect(axiosPost).toHaveBeenLastCalledWith("numberCards.getValue/5", {
      filters: { year: 2027 },
    });
  });
});

describe("NumberCardDisplay — state loading & error", () => {
  it("menampilkan 'Memuat data...' selama request pending, hilang setelah selesai", async () => {
    let resolveFetch;
    axiosPost.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );

    await renderSettled({ numberCard: baseNumberCard });

    expect(screen.getByText("Memuat data...")).toBeInTheDocument();
    expect(screen.queryByText("Gagal memuat data.")).not.toBeInTheDocument();

    await act(async () => {
      resolveFetch({ data: { value: 42, percentage: null } });
    });

    await waitFor(() =>
      expect(screen.queryByText("Memuat data...")).not.toBeInTheDocument(),
    );
  });

  it("menampilkan 'Gagal memuat data.' saat fetch gagal (reject)", async () => {
    axiosPost.mockRejectedValue(new Error("network error"));
    await renderSettled({ numberCard: baseNumberCard });

    await waitFor(() =>
      expect(screen.getByText("Gagal memuat data.")).toBeInTheDocument(),
    );
    expect(screen.queryByText("Memuat data...")).not.toBeInTheDocument();
  });

  it("tidak melempar error saat unmount sebelum fetch selesai (TanStack Query auto-abaikan hasil basi)", async () => {
    let resolveFetch;
    axiosPost.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );

    let unmount;
    await act(async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: Infinity } },
      });
      ({ unmount } = render(
        <QueryClientProvider client={queryClient}>
          <NumberCardDisplay numberCard={baseNumberCard} />
        </QueryClientProvider>,
      ));
    });

    unmount();

    // Resolve SESUDAH unmount -- TanStack Query harus mengabaikan hasil ini
    // (komponen sudah lepas), bukan melempar exception.
    await expect(
      act(async () => {
        resolveFetch({ data: { value: 1, percentage: 5 } });
      }),
    ).resolves.not.toThrow();
  });
});

describe("NumberCardDisplay — value & format angka (fmt)", () => {
  it("mode compact (default, show_full_number falsy) memakai Intl.NumberFormat notation compact, locale currentLocale()", async () => {
    axiosPost.mockResolvedValue({
      data: { value: 1234567, percentage: null },
    });
    await renderSettled({ numberCard: baseNumberCard });

    // Intl.NumberFormat("en", {notation:"compact", maximumFractionDigits:1})
    await waitFor(() => expect(screen.getByText("1.2M")).toBeInTheDocument());
  });

  it("mode full (show_full_number=true) delegasi ke formatNumber NumberInput via preferences.default_number_format", async () => {
    axiosPost.mockResolvedValue({
      data: { value: 1234567.5, percentage: null },
    });
    await renderSettled({
      numberCard: { ...baseNumberCard, show_full_number: true },
    });

    // pattern "#,###.##" -> groupSeparator ",", decimalSeparator ".", scale 2
    await waitFor(() =>
      expect(screen.getByText("1,234,567.50")).toBeInTheDocument(),
    );
  });

  it("value null/undefined dari response (?? 0) diformat sbg 0", async () => {
    axiosPost.mockResolvedValue({ data: {} });
    await renderSettled({ numberCard: baseNumberCard });

    await waitFor(() => expect(screen.getByText("0")).toBeInTheDocument());
  });
});

describe("NumberCardDisplay — badge tren (percentage)", () => {
  it("percentage null -> TIDAK merender badge, Separator, atau teks interval", async () => {
    axiosPost.mockResolvedValue({ data: { value: 10, percentage: null } });
    await renderSettled({ numberCard: baseNumberCard });

    await waitFor(() =>
      expect(screen.queryByText("Memuat data...")).not.toBeInTheDocument(),
    );
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/stats_time_intervals/)).not.toBeInTheDocument();
  });

  it("percentage positif -> badge emerald, ArrowUpRight, dibulatkan 1 desimal (toFixed)", async () => {
    axiosPost.mockResolvedValue({
      data: { value: 10, percentage: 12.345 },
    });
    const { container } = await renderSettled({ numberCard: baseNumberCard });

    await waitFor(() => expect(screen.getByText("12.3%")).toBeInTheDocument());
    const badge = screen.getByText("12.3%").closest("span");
    expect(badge.className).toContain("bg-emerald-500/10");
    expect(badge.className).toContain("text-emerald-600");
    expect(container.querySelector("svg.lucide-arrow-up-right")).toBeTruthy();
  });

  it("percentage negatif -> badge rose, ArrowDownRight, ditampilkan sbg absolut (Math.abs)", async () => {
    axiosPost.mockResolvedValue({
      data: { value: 10, percentage: -8.2 },
    });
    const { container } = await renderSettled({ numberCard: baseNumberCard });

    await waitFor(() => expect(screen.getByText("8.2%")).toBeInTheDocument());
    const badge = screen.getByText("8.2%").closest("span");
    expect(badge.className).toContain("bg-rose-500/10");
    expect(badge.className).toContain("text-rose-600");
    expect(container.querySelector("svg.lucide-arrow-down-right")).toBeTruthy();
  });

  it("percentage tepat 0 -> dianggap tren positif (isPositiveTrend pakai >= 0)", async () => {
    axiosPost.mockResolvedValue({ data: { value: 10, percentage: 0 } });
    const { container } = await renderSettled({ numberCard: baseNumberCard });

    await waitFor(() => expect(screen.getByText("0.0%")).toBeInTheDocument());
    expect(container.querySelector("svg.lucide-arrow-up-right")).toBeTruthy();
  });

  it("percentage terisi -> teks interval terjemahan default 'daily' saat stats_time_interval tidak di-set", async () => {
    axiosPost.mockResolvedValue({ data: { value: 10, percentage: 5 } });
    await renderSettled({ numberCard: baseNumberCard });

    await waitFor(() =>
      expect(
        screen.getByText("TR:settings.number_card.stats_time_intervals.daily"),
      ).toBeInTheDocument(),
    );
  });

  it("percentage terisi -> teks interval memakai numberCard.stats_time_interval apa adanya kalau di-set", async () => {
    axiosPost.mockResolvedValue({ data: { value: 10, percentage: 5 } });
    await renderSettled({
      numberCard: { ...baseNumberCard, stats_time_interval: "weekly" },
    });

    await waitFor(() =>
      expect(
        screen.getByText("TR:settings.number_card.stats_time_intervals.weekly"),
      ).toBeInTheDocument(),
    );
  });
});

describe("NumberCardDisplay — header (icon, label, deskripsi)", () => {
  it("label numberCard dirender sbg heading", async () => {
    axiosPost.mockResolvedValue({ data: { value: 0, percentage: null } });
    await renderSettled({ numberCard: baseNumberCard });

    expect(
      screen.getByRole("heading", { name: "Total Penjualan" }),
    ).toBeInTheDocument();
  });

  it("numberCard.icon di-set -> resolveIcon (real, lucide-react) merender svg", async () => {
    axiosPost.mockResolvedValue({ data: { value: 0, percentage: null } });
    const { container } = await renderSettled({
      numberCard: { ...baseNumberCard, icon: "RocketIcon" },
    });

    expect(container.querySelector("svg.lucide-rocket")).toBeTruthy();
  });

  it("numberCard.icon tidak di-set -> tidak ada svg icon di header", async () => {
    axiosPost.mockResolvedValue({ data: { value: 0, percentage: null } });
    const { container } = await renderSettled({ numberCard: baseNumberCard });

    await waitFor(() =>
      expect(screen.queryByText("Memuat data...")).not.toBeInTheDocument(),
    );
    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });

  it("meneruskan numberCard.description apa adanya ke BlockDescriptionTooltip", async () => {
    axiosPost.mockResolvedValue({ data: { value: 0, percentage: null } });
    const description = "Deskripsi angka ini";
    await renderSettled({
      numberCard: { ...baseNumberCard, description },
    });

    expect(blockDescriptionTooltipSpy).toHaveBeenCalledWith(
      expect.objectContaining({ description }),
    );
    expect(screen.getByTestId("description-tooltip")).toBeInTheDocument();
  });
});

describe("NumberCardDisplay — warna kustom (background_color, color)", () => {
  it("numberCard.background_color diteruskan sbg inline style Card", async () => {
    axiosPost.mockResolvedValue({ data: { value: 0, percentage: null } });
    const { container } = await renderSettled({
      numberCard: { ...baseNumberCard, background_color: "#112233" },
    });

    const card = container.querySelector(".rounded-xl");
    expect(card.style.backgroundColor).toBe("rgb(17, 34, 51)");
  });

  it("numberCard.color diteruskan sbg inline style teks value", async () => {
    axiosPost.mockResolvedValue({ data: { value: 999, percentage: null } });
    const { container } = await renderSettled({
      numberCard: { ...baseNumberCard, color: "#ff0000" },
    });

    await waitFor(() =>
      expect(screen.queryByText("Memuat data...")).not.toBeInTheDocument(),
    );
    const valueSpan = container.querySelector(".text-2xl");
    expect(valueSpan.style.color).toBe("rgb(255, 0, 0)");
  });

  it("tanpa background_color/color -> style backgroundColor/color tidak di-set (undefined)", async () => {
    axiosPost.mockResolvedValue({ data: { value: 0, percentage: null } });
    const { container } = await renderSettled({ numberCard: baseNumberCard });

    const card = container.querySelector(".rounded-xl");
    expect(card.style.backgroundColor).toBe("");
  });
});
