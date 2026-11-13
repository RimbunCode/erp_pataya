import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const stableT = (key, vars) =>
  vars && typeof vars === "object" ? `${key}|${JSON.stringify(vars)}` : key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

const mocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), pageProps: {} }));

vi.mock("@inertiajs/react", async () => {
  const React = await import("react");

  return {
    Head: ({ title }) => <title>{title}</title>,
    router: { get: mocks.get, put: mocks.put },
    usePage: () => ({ props: mocks.pageProps }),
    useForm: (initial) => {
      const [data, setDataState] = React.useState(initial);

      return {
        data,
        setData: (key, value) =>
          setDataState((current) =>
            typeof key === "string"
              ? { ...current, [key]: value }
              : { ...current, ...key },
          ),
        errors: {},
        processing: false,
      };
    },
  };
});

vi.mock("@/Layouts/AppLayout", () => ({
  default: ({ children }) => <div data-testid="app-layout">{children}</div>,
}));

window.route = (name, params) =>
  params !== undefined ? `${name}/${params}` : name;

import Index from "./Index";

const documentTypes = ["sales_invoice", "stock_entry"];
const statuses = ["match", "mismatch"];
const modes = { sales_invoice: "off", stock_entry: "shadow" };

const logs = {
  total: 2,
  data: [
    {
      id: "l1",
      document_type: "sales_invoice",
      status: "mismatch",
      source_type: "SalesInvoice",
      source_id: "src-1",
      created_at: "2026-11-02T10:00:00+00:00",
      diff: { reason: "akun berbeda" },
    },
    {
      id: "l2",
      document_type: "stock_entry",
      status: "match",
      source_type: "StockEntry",
      source_id: "src-2",
      created_at: "2026-11-01T10:00:00+00:00",
      diff: null,
    },
  ],
};

const baseProps = {
  logs,
  documentTypes,
  statuses,
  modes,
  canSwitchMode: false,
};

describe("PostingParityLogs Index", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pageProps = {};
  });

  it("daftar log dengan jenis dokumen dan status terjemahan", () => {
    render(<Index {...baseProps} />);

    const rows = screen.getAllByTestId("parity-log");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent(
      "finances.postingParityLog.columns.document_type.options.sales_invoice",
    );
    expect(rows[0]).toHaveTextContent(
      "finances.postingParityLog.columns.status.options.mismatch",
    );
    expect(rows[0]).toHaveTextContent("src-1");
  });

  it("filter dikirim sebagai query tanpa nilai kosong", async () => {
    const user = userEvent.setup();
    render(<Index {...baseProps} />);

    await user.selectOptions(
      screen.getByLabelText("finances.postingParityLog.filters.document_type"),
      "sales_invoice",
    );
    await user.selectOptions(
      screen.getByLabelText("finances.postingParityLog.filters.status"),
      "mismatch",
    );
    await user.click(
      screen.getByRole("button", {
        name: "finances.postingParityLog.filters.apply",
      }),
    );

    expect(mocks.get).toHaveBeenCalledWith(
      "postingParityLogs.index",
      { document_type: "sales_invoice", status: "mismatch" },
      expect.any(Object),
    );
  });

  it("atur ulang filter memuat daftar tanpa query", async () => {
    const user = userEvent.setup();
    render(<Index {...baseProps} filters={{ status: "mismatch" }} />);

    await user.click(
      screen.getByRole("button", {
        name: "finances.postingParityLog.filters.reset",
      }),
    );

    expect(mocks.get).toHaveBeenCalledWith(
      "postingParityLogs.index",
      {},
      expect.any(Object),
    );
  });

  it("selisih hanya ditampilkan untuk log yang memilikinya", async () => {
    const user = userEvent.setup();
    render(<Index {...baseProps} />);

    const rows = screen.getAllByTestId("parity-log");
    expect(
      within(rows[1]).queryByRole("button", {
        name: "finances.postingParityLog.list.show_diff",
      }),
    ).toBeNull();

    await user.click(
      within(rows[0]).getByRole("button", {
        name: "finances.postingParityLog.list.show_diff",
      }),
    );
    expect(rows[0]).toHaveTextContent("akun berbeda");
  });

  it("tanpa izin ubah mode, kontrol tidak dirender dan mode tampil sebagai teks", () => {
    render(<Index {...baseProps} canSwitchMode={false} />);

    const rows = screen.getAllByTestId("mode-row");
    expect(rows).toHaveLength(2);
    expect(within(rows[1]).queryByRole("button")).toBeNull();
    expect(rows[1]).toHaveTextContent(
      "finances.postingParityLog.mode.options.shadow",
    );
    expect(
      screen.getByText("finances.postingParityLog.mode.read_only"),
    ).toBeInTheDocument();
  });

  it("dengan izin, memilih shadow langsung memanggil rute ubah mode", async () => {
    const user = userEvent.setup();
    render(<Index {...baseProps} canSwitchMode />);

    const row = screen.getAllByTestId("mode-row")[0];
    expect(
      within(row).getByRole("button", {
        name: "finances.postingParityLog.mode.options.off",
      }),
    ).toHaveAttribute("aria-pressed", "true");

    await user.click(
      within(row).getByRole("button", {
        name: "finances.postingParityLog.mode.options.shadow",
      }),
    );

    expect(mocks.put).toHaveBeenCalledWith(
      "postingParityLogs.switchMode/sales_invoice",
      { mode: "shadow" },
      expect.any(Object),
    );
  });

  it("mengklik mode yang sudah aktif tidak mengirim apa pun", async () => {
    const user = userEvent.setup();
    render(<Index {...baseProps} canSwitchMode />);

    await user.click(
      within(screen.getAllByTestId("mode-row")[0]).getByRole("button", {
        name: "finances.postingParityLog.mode.options.off",
      }),
    );

    expect(mocks.put).not.toHaveBeenCalled();
  });

  it("memilih on meminta konfirmasi eksplisit sebelum mengirim", async () => {
    const user = userEvent.setup();
    render(<Index {...baseProps} canSwitchMode />);

    await user.click(
      within(screen.getAllByTestId("mode-row")[0]).getByRole("button", {
        name: "finances.postingParityLog.mode.options.on",
      }),
    );
    expect(mocks.put).not.toHaveBeenCalled();

    const dialog = await screen.findByRole("dialog");
    const confirm = within(dialog).getByRole("button", {
      name: "finances.postingParityLog.mode.confirm.confirm",
    });
    expect(confirm).toBeDisabled();

    await user.click(
      within(dialog).getByLabelText(
        "finances.postingParityLog.mode.confirm.checkbox",
      ),
    );
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    expect(mocks.put).toHaveBeenCalledWith(
      "postingParityLogs.switchMode/sales_invoice",
      { mode: "on", confirmed: true },
      expect.any(Object),
    );
  });

  it("membatalkan dialog konfirmasi on tidak mengubah mode", async () => {
    const user = userEvent.setup();
    render(<Index {...baseProps} canSwitchMode />);

    await user.click(
      within(screen.getAllByTestId("mode-row")[0]).getByRole("button", {
        name: "finances.postingParityLog.mode.options.on",
      }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", {
        name: "finances.postingParityLog.mode.confirm.cancel",
      }),
    );

    expect(mocks.put).not.toHaveBeenCalled();
  });

  it("menampilkan keadaan kosong bila tidak ada log", () => {
    render(<Index {...baseProps} logs={{ data: [], total: 0 }} />);

    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });

  it("menampilkan galat validasi server (filter dan ubah mode) dalam alert", () => {
    mocks.pageProps = {
      errors: {
        date_to: "Tanggal akhir sebelum tanggal awal",
        confirmed: "Konfirmasi diperlukan",
      },
    };
    render(<Index {...baseProps} />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Tanggal akhir sebelum tanggal awal");
    expect(alert).toHaveTextContent("Konfirmasi diperlukan");
  });

  it("tanpa galat tidak ada alert", () => {
    render(<Index {...baseProps} />);

    expect(screen.queryByRole("alert")).toBeNull();
  });
});
