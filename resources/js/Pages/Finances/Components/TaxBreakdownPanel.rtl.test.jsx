import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({
    t: (key, params) => (params ? `${key}|${JSON.stringify(params)}` : key),
  }),
}));

const usePageMock = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
  // Deferred menampilkan fallback selama prop belum ada, lalu children setelah prop terisi.
  Deferred: ({ data, fallback, children }) => {
    const props = usePageMock().props;
    const loaded = data.every((key) => props[key] !== undefined);
    return loaded ? children : fallback;
  },
}));

vi.mock("@/Components/Link", () => ({
  default: ({ href, children, ...rest }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// FormPageContent butuh konteks FormPage penuh (tab). Test ini hanya menguji isi panel.
vi.mock("@/Pages/Core/FormPage", () => ({
  FormPageContent: ({ title, children }) => (
    <section aria-label={title}>{children}</section>
  ),
}));

window.route = (name, id) => `/${name}/${id}`;

import TaxBreakdownPanel from "./TaxBreakdownPanel";

const row = (overrides = {}) => ({
  line: 1,
  tax_id: "tax-1",
  tax_name: "PPN 12%",
  category: "ppn_standard",
  behavior: "additive",
  base_amount: "1000000.00",
  dpp_factor: "11/12",
  dpp_amount: "916666.67",
  rate: "12",
  // Nilai sengaja tidak sama dengan 916666.67 x 12%: panel harus menampilkan yang dikirim server.
  tax_amount: "123456.00",
  rounding_adjustment: "0.01",
  is_legacy: false,
  warnings: [],
  version: {
    id: "v1",
    number: 2,
    rounding_mode: "per_line",
    missing: false,
  },
  ...overrides,
});

const panel = (overrides = {}) => ({
  state: "snapshot",
  warnings: [],
  rows: [row()],
  totals: { additive: "123456.00", withholding: "0" },
  minor_unit: 2,
  can_view_versions: true,
  ...overrides,
});

function renderWith(taxBreakdown, props = {}) {
  usePageMock.mockReturnValue({ props: { taxBreakdown } });
  return render(<TaxBreakdownPanel {...props} />);
}

describe("TaxBreakdownPanel", () => {
  beforeEach(() => {
    usePageMock.mockReset();
  });

  it("dokumen baru menampilkan catatan tanpa menunggu data", () => {
    renderWith(undefined, { isNew: true });

    expect(
      screen.getByText("finances.taxBreakdown.states.new"),
    ).toBeInTheDocument();
  });

  it("menampilkan skeleton selama deferred prop belum dimuat", () => {
    const { container } = renderWith(undefined);

    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("snapshot: menampilkan nilai dari server per komponen tanpa menghitung ulang", () => {
    renderWith(panel());

    expect(
      screen.getByText("finances.taxBreakdown.states.snapshot"),
    ).toBeInTheDocument();
    const [dataRow] = screen.getAllByTestId("tax-breakdown-row");
    expect(within(dataRow).getByText("PPN 12%")).toBeInTheDocument();
    expect(within(dataRow).getByText("11/12")).toBeInTheDocument();
    expect(within(dataRow).getByText("1,000,000.00")).toBeInTheDocument();
    expect(within(dataRow).getByText("916,666.67")).toBeInTheDocument();
    expect(within(dataRow).getByText("123,456.00")).toBeInTheDocument();
    expect(within(dataRow).getByText("0.01")).toBeInTheDocument();
    expect(
      screen.getByTestId("tax-breakdown-total-additive"),
    ).toHaveTextContent("123,456.00");
    expect(
      screen.queryByTestId("tax-breakdown-total-withholding"),
    ).not.toBeInTheDocument();
  });

  it("versi aturan menjadi tautan ke halaman Pajak hanya bila pembaca boleh melihatnya", () => {
    const { unmount } = renderWith(panel());
    const link = screen.getByRole("link", {
      name: 'finances.taxBreakdown.version.label|{"number":2}',
    });
    expect(link).toHaveAttribute("href", "/taxes.show/tax-1");
    unmount();

    renderWith(panel({ can_view_versions: false }));
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(
      screen.getByText(/finances\.taxBreakdown\.version\.label/),
    ).toBeInTheDocument();
  });

  it("komponen legacy diberi label legacy, versi yang hilang tidak error", () => {
    renderWith(
      panel({
        state: "legacy",
        rows: [
          row({ is_legacy: true, version: null }),
          row({
            line: 2,
            version: {
              id: "gone",
              number: null,
              rounding_mode: null,
              missing: true,
            },
          }),
        ],
      }),
    );

    expect(
      screen.getByText("finances.taxBreakdown.states.legacy"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("finances.taxBreakdown.version.legacy"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("finances.taxBreakdown.version.missing"),
    ).toBeInTheDocument();
  });

  it("peringatan tingkat dokumen (snapshot_build_failed) tampil sebagai alert tanpa tabel", () => {
    renderWith(
      panel({
        warnings: ["snapshot_build_failed"],
        rows: [],
        totals: null,
      }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "finances.taxBreakdown.warnings.snapshot_build_failed",
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("peringatan per komponen tampil di baris, kode asing tidak hilang", () => {
    renderWith(
      panel({
        rows: [
          row({ warnings: ["persisted_vs_engine_mismatch", "kode_baru"] }),
        ],
      }),
    );

    const notes = screen.getAllByRole("note");
    expect(notes[0]).toHaveTextContent(
      "finances.taxBreakdown.warnings.persisted_vs_engine_mismatch",
    );
    expect(notes[1]).toHaveTextContent('"code":"kode_baru"');
  });

  it("menampilkan total pajak dipotong hanya bila tidak nol", () => {
    renderWith(panel({ totals: { additive: "100.00", withholding: "20.00" } }));

    expect(
      screen.getByTestId("tax-breakdown-total-withholding"),
    ).toHaveTextContent("20.00");
  });

  it("state pending, none, error, dan state tak dikenal", () => {
    const { unmount } = renderWith(panel({ state: "pending" }));
    expect(
      screen.getByText("finances.taxBreakdown.states.pending"),
    ).toBeInTheDocument();
    unmount();

    const none = renderWith({ state: "none", rows: [], warnings: [] });
    expect(
      screen.getByText("finances.taxBreakdown.states.none"),
    ).toBeInTheDocument();
    none.unmount();

    const error = renderWith({ state: "error", rows: [], warnings: [] });
    expect(
      screen.getByText("finances.taxBreakdown.states.error"),
    ).toBeInTheDocument();
    error.unmount();

    renderWith({ state: "apa-saja" });
    expect(
      screen.getByText("finances.taxBreakdown.states.error"),
    ).toBeInTheDocument();
  });
});
