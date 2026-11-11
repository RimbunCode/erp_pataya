import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const stableT = (key, vars) =>
  vars && typeof vars === "object" ? `${key}|${JSON.stringify(vars)}` : key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

const putMock = vi.fn();
const postMock = vi.fn();
const routerPutMock = vi.fn();
let generateErrors = {};
let reasonErrors = {};
vi.mock("@inertiajs/react", () => ({
  Head: ({ title }) => <title>{title}</title>,
  router: { put: (...args) => routerPutMock(...args) },
  useForm: (initial) => {
    const isGenerate = "year" in initial;

    return {
      data: initial,
      setData: vi.fn(),
      reset: vi.fn(),
      post: postMock,
      put: putMock,
      errors: isGenerate ? generateErrors : reasonErrors,
      processing: false,
    };
  },
}));

vi.mock("@/Layouts/AppLayout", () => ({
  default: ({ children }) => <div data-testid="app-layout">{children}</div>,
}));

window.route = (name, params) =>
  params !== undefined ? `${name}/${params}` : name;

import Index from "./Index";

const period = (id, name, status, closedAt = null) => ({
  id,
  name,
  start_date: `${name}-01`,
  end_date: `${name}-28`,
  status,
  closed_at: closedAt,
});

const years = [
  {
    id: "y26",
    name: "2026",
    start_date: "2026-01-01",
    end_date: "2026-12-31",
    status: "open",
    periods: [
      period("p1", "2026-01", "closed", "2026-02-01T00:00:00Z"),
      period("p2", "2026-02", "open"),
    ],
  },
];

const allowAll = {
  canGenerate: true,
  canClose: true,
  canReopen: true,
  canEnforce: true,
};

describe("FiscalPeriods Index", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateErrors = {};
    reasonErrors = {};
  });

  it("daftar tahun dan periode dengan status terjemahan", () => {
    render(<Index fiscalYears={years} {...allowAll} />);

    expect(screen.getAllByTestId("fiscal-year")).toHaveLength(1);
    const rows = screen.getAllByTestId("fiscal-period");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("2026-01");
    expect(rows[0]).toHaveTextContent(
      "finances.fiscalPeriod.columns.status.options.closed",
    );
    expect(rows[1]).toHaveTextContent(
      "finances.fiscalPeriod.columns.status.options.open",
    );
  });

  it("keadaan kosong: pesan generate tahun pertama", () => {
    render(<Index fiscalYears={[]} {...allowAll} />);

    expect(screen.getByTestId("empty-state")).toHaveTextContent(
      "finances.fiscalPeriod.list.empty",
    );
  });

  it("tombol aksi mengikuti status: periode open = Tutup, closed = Buka Kembali", () => {
    render(<Index fiscalYears={years} {...allowAll} />);

    const [closedRow, openRow] = screen.getAllByTestId("fiscal-period");
    expect(
      within(closedRow).getByRole("button", {
        name: "finances.fiscalPeriod.actions.open",
      }),
    ).toBeInTheDocument();
    expect(
      within(openRow).getByRole("button", {
        name: "finances.fiscalPeriod.actions.close",
      }),
    ).toBeInTheDocument();
  });

  it("tanpa izin tutup/buka: tidak ada tombol aksi", () => {
    render(
      <Index
        fiscalYears={years}
        canGenerate
        canClose={false}
        canReopen={false}
        canEnforce
      />,
    );

    expect(
      screen.queryByRole("button", { name: /finances\.fiscalPeriod\.actions/ }),
    ).toBeNull();
  });

  it("izin hanya tutup: periode closed tidak punya tombol Buka Kembali", () => {
    render(
      <Index
        fiscalYears={years}
        canGenerate
        canClose
        canReopen={false}
        canEnforce
      />,
    );

    const [closedRow, openRow] = screen.getAllByTestId("fiscal-period");
    expect(within(closedRow).queryByRole("button")).toBeNull();
    expect(within(openRow).getByRole("button")).toBeInTheDocument();
  });

  it("menutup periode: dialog alasan lalu PUT fiscalPeriods.close", async () => {
    const user = userEvent.setup();
    render(<Index fiscalYears={years} {...allowAll} />);

    const [, openRow] = screen.getAllByTestId("fiscal-period");
    await user.click(
      within(openRow).getByRole("button", {
        name: "finances.fiscalPeriod.actions.close",
      }),
    );
    expect(
      await screen.findByLabelText("finances.fiscalPeriod.close.reason"),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "finances.fiscalPeriod.close.confirm",
      }),
    );

    await waitFor(() => expect(putMock).toHaveBeenCalledTimes(1));
    expect(putMock.mock.calls[0][0]).toBe("fiscalPeriods.close/p2");
  });

  it("membuka kembali periode memakai route open", async () => {
    const user = userEvent.setup();
    render(<Index fiscalYears={years} {...allowAll} />);

    const [closedRow] = screen.getAllByTestId("fiscal-period");
    await user.click(
      within(closedRow).getByRole("button", {
        name: "finances.fiscalPeriod.actions.open",
      }),
    );
    await user.click(
      await screen.findByRole("button", {
        name: "finances.fiscalPeriod.open.confirm",
      }),
    );

    await waitFor(() => expect(putMock).toHaveBeenCalledTimes(1));
    expect(putMock.mock.calls[0][0]).toBe("fiscalPeriods.open/p1");
  });

  it("form generate tahun tampil bila boleh dan memanggil POST generate", async () => {
    const user = userEvent.setup();
    render(<Index fiscalYears={[]} defaultYear={2027} {...allowAll} />);

    const form = screen.getByTestId("generate-form");
    expect(within(form).getByLabelText("finances.fiscalPeriod.generate.year")).toHaveValue(2027);
    await user.click(
      within(form).getByRole("button", {
        name: "finances.fiscalPeriod.generate.submit",
      }),
    );

    expect(postMock).toHaveBeenCalledTimes(1);
    expect(postMock.mock.calls[0][0]).toBe("fiscalPeriods.generate");
  });

  it("tanpa izin generate: form tidak ditampilkan", () => {
    render(<Index fiscalYears={[]} {...allowAll} canGenerate={false} />);

    expect(screen.queryByTestId("generate-form")).toBeNull();
  });

  it("menampilkan kesalahan validasi generate (mis. tahun non-kalender)", () => {
    generateErrors = { year: "Tahun fiskal 2026 sudah ada dengan rentang non-kalender" };
    render(<Index fiscalYears={[]} {...allowAll} />);

    expect(
      screen.getByText("Tahun fiskal 2026 sudah ada dengan rentang non-kalender"),
    ).toBeInTheDocument();
  });

  it("toggle penegakan: status awal dan PUT enforcement saat diubah", async () => {
    const user = userEvent.setup();
    render(
      <Index fiscalYears={years} enforceFiscalPeriod={false} {...allowAll} />,
    );

    const toggle = screen.getByRole("switch");
    expect(toggle).not.toBeChecked();
    await user.click(toggle);

    expect(routerPutMock).toHaveBeenCalledTimes(1);
    expect(routerPutMock.mock.calls[0][0]).toBe("fiscalPeriods.enforcement");
    expect(routerPutMock.mock.calls[0][1]).toEqual({
      enforce_fiscal_period: true,
    });
  });

  it("penegakan aktif: toggle tercentang dan mematikan mengirim false", async () => {
    const user = userEvent.setup();
    render(
      <Index fiscalYears={years} enforceFiscalPeriod {...allowAll} />,
    );

    const toggle = screen.getByRole("switch");
    expect(toggle).toBeChecked();
    await user.click(toggle);

    expect(routerPutMock.mock.calls[0][1]).toEqual({
      enforce_fiscal_period: false,
    });
  });

  it("tanpa izin ubah setting: toggle dinonaktifkan dengan keterangan", () => {
    render(
      <Index fiscalYears={years} {...allowAll} canEnforce={false} />,
    );

    expect(screen.getByRole("switch")).toBeDisabled();
    expect(
      screen.getByText("finances.fiscalPeriod.enforcement.read_only"),
    ).toBeInTheDocument();
  });

  it("peringatan transaksi di periode tak terdefinisi muncul dengan jumlahnya", () => {
    render(<Index fiscalYears={years} uncoveredCount={12} {...allowAll} />);

    expect(screen.getByTestId("uncovered-warning")).toHaveTextContent(
      'finances.fiscalPeriod.enforcement.warning|{"count":12}',
    );
  });

  it("tanpa transaksi tak tercakup: tidak ada peringatan", () => {
    render(<Index fiscalYears={years} uncoveredCount={0} {...allowAll} />);

    expect(screen.queryByTestId("uncovered-warning")).toBeNull();
  });
});
