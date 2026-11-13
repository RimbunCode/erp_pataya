import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const stableT = (key, vars) =>
  vars && typeof vars === "object" ? `${key}|${JSON.stringify(vars)}` : key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  put: vi.fn(),
  routerPut: vi.fn(),
  routerDelete: vi.fn(),
  pageProps: {},
}));

vi.mock("@inertiajs/react", async () => {
  const React = await import("react");

  return {
    Head: ({ title }) => <title>{title}</title>,
    router: { put: mocks.routerPut, delete: mocks.routerDelete },
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
        post: (url, options) => mocks.post(url, data, options),
        put: (url, options) => mocks.put(url, data, options),
        errors: {},
        processing: false,
      };
    },
  };
});

vi.mock("@/Layouts/AppLayout", () => ({
  default: ({ children }) => <div data-testid="app-layout">{children}</div>,
}));

vi.mock("@/Components/Link", () => ({
  default: ({ href, children, ...rest }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

let pickCounter = 0;
vi.mock("@/Pages/Finances/Accounts/AccountLinkModel", () => ({
  default: ({ value, onValueChange, filters }) => (
    <div>
      <button
        type="button"
        data-testid="account-picker"
        data-filters={JSON.stringify(filters)}
        onClick={() => {
          pickCounter += 1;
          onValueChange({
            id: `acc-${pickCounter}`,
            account_number: `9${pickCounter}`,
            account_name: `Akun ${pickCounter}`,
          });
        }}
      >
        pilih akun
      </button>
      <span data-testid="picked">{value?.id ?? ""}</span>
    </div>
  ),
}));

window.route = (name, params) =>
  params !== undefined ? `${name}/${params}` : name;

import Form from "./Form";

const roles = [
  {
    value: "receivable",
    label: "Piutang",
    line_sensitive: false,
    master: false,
  },
  {
    value: "revenue",
    label: "Pendapatan",
    line_sensitive: true,
    master: false,
  },
  {
    value: "cash_or_bank",
    label: "Kas atau Bank",
    line_sensitive: false,
    master: true,
  },
];

const profile = (overrides = {}) => ({
  id: "p1",
  name: "Profil Utama",
  status: "draft",
  version: 1,
  effective_from: "2026-01-01",
  effective_to: null,
  notes: null,
  previous_profile_id: null,
  accounts: {
    receivable: {
      id: "a-ar",
      account_number: "1231",
      account_name: "Piutang Dagang",
    },
  },
  rules: [],
  ...overrides,
});

const baseProps = {
  roles,
  canWrite: true,
  canActivate: true,
  defaultFrom: "2026-07-01",
};

describe("PostingProfiles Form", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pickCounter = 0;
    mocks.pageProps = {};
  });

  it("menampilkan satu baris per peran dengan peran akun master diberi petunjuk", () => {
    render(<Form {...baseProps} profile={profile()} />);

    const rows = screen.getAllByTestId("role-row");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("Piutang");
    expect(rows[2]).toHaveTextContent(
      "finances.postingProfile.form.role_master_hint",
    );
    expect(rows[1]).toHaveTextContent(
      "finances.postingProfile.form.role_line_sensitive_hint",
    );
  });

  it("pemilih akun hanya menawarkan akun non-grup", () => {
    render(<Form {...baseProps} profile={profile()} />);

    for (const picker of screen.getAllByTestId("account-picker")) {
      expect(picker).toHaveAttribute(
        "data-filters",
        JSON.stringify({ is_group: false }),
      );
    }
  });

  it("menyimpan draft mengirim peta peran ke akun (peran yang dipilih diganti, lainnya dipertahankan)", async () => {
    const user = userEvent.setup();
    render(<Form {...baseProps} profile={profile()} />);

    const revenueRow = screen.getAllByTestId("role-row")[1];
    await user.click(within(revenueRow).getByTestId("account-picker"));
    await user.click(
      screen.getByRole("button", { name: "finances.postingProfile.form.save" }),
    );

    expect(mocks.put).toHaveBeenCalledTimes(1);
    const [url, data] = mocks.put.mock.calls[0];
    expect(url).toBe("postingProfiles.update/p1");
    expect(data.accounts).toEqual({ receivable: "a-ar", revenue: "acc-1" });
    expect(data.name).toBe("Profil Utama");
    expect(data).not.toHaveProperty("status");
  });

  it("profil baru memakai tombol buat draft dan memposting ke rute simpan", async () => {
    const user = userEvent.setup();
    render(<Form {...baseProps} profile={null} canActivate={false} />);

    expect(screen.queryByRole("button", { name: /actions\./ })).toBeNull();
    await user.click(
      screen.getByRole("button", {
        name: "finances.postingProfile.form.create",
      }),
    );

    expect(mocks.post).toHaveBeenCalledTimes(1);
    const [url, data] = mocks.post.mock.calls[0];
    expect(url).toBe("postingProfiles.save");
    expect(data.effective_from).toBe("2026-07-01");
  });

  it("profil aktif baca-saja: tanpa pemilih akun dan tombol simpan, tetapi dapat dibuat versi baru", async () => {
    const user = userEvent.setup();
    render(<Form {...baseProps} profile={profile({ status: "active" })} />);

    expect(screen.queryByTestId("account-picker")).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: "finances.postingProfile.form.save",
      }),
    ).toBeNull();
    expect(screen.getByTestId("read-only-note")).toBeInTheDocument();
    expect(
      screen.getByLabelText("finances.postingProfile.columns.name"),
    ).toBeDisabled();

    await user.click(
      screen.getByRole("button", {
        name: "finances.postingProfile.actions.new_version",
      }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByLabelText(
        "finances.postingProfile.new_version.effective_from",
      ),
    ).toHaveValue("2026-07-01");

    await user.click(
      within(dialog).getByRole("button", {
        name: "finances.postingProfile.new_version.confirm",
      }),
    );

    expect(mocks.post).toHaveBeenCalledTimes(1);
    const [url, data] = mocks.post.mock.calls[0];
    expect(url).toBe("postingProfiles.newVersion/p1");
    expect(data.effective_from).toBe("2026-07-01");
  });

  it("aktifkan meminta konfirmasi lalu memanggil rute aktivasi", async () => {
    const user = userEvent.setup();
    render(<Form {...baseProps} profile={profile()} />);

    await user.click(
      screen.getByRole("button", {
        name: "finances.postingProfile.actions.activate",
      }),
    );
    expect(mocks.routerPut).not.toHaveBeenCalled();

    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", {
        name: "finances.postingProfile.confirm.activate.confirm",
      }),
    );

    expect(mocks.routerPut).toHaveBeenCalledWith(
      "postingProfiles.activate/p1",
      {},
      expect.any(Object),
    );
  });

  it("tanpa izin activate tombol aktifkan dan pensiunkan tidak tampil", () => {
    const { rerender } = render(
      <Form {...baseProps} canActivate={false} profile={profile()} />,
    );
    expect(
      screen.queryByRole("button", {
        name: "finances.postingProfile.actions.activate",
      }),
    ).toBeNull();

    rerender(
      <Form
        {...baseProps}
        canActivate={false}
        profile={profile({ status: "active" })}
      />,
    );
    expect(
      screen.queryByRole("button", {
        name: "finances.postingProfile.actions.retire",
      }),
    ).toBeNull();
  });

  it("pensiunkan profil aktif memanggil rute retire setelah konfirmasi", async () => {
    const user = userEvent.setup();
    render(<Form {...baseProps} profile={profile({ status: "active" })} />);

    await user.click(
      screen.getByRole("button", {
        name: "finances.postingProfile.actions.retire",
      }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", {
        name: "finances.postingProfile.confirm.retire.confirm",
      }),
    );

    expect(mocks.routerPut).toHaveBeenCalledWith(
      "postingProfiles.retire/p1",
      {},
      expect.any(Object),
    );
  });

  it("menampilkan peringatan celah dari flash setelah pensiun", () => {
    mocks.pageProps = {
      flash: {
        retireWarnings: ["Tidak ada profil aktif 2026-01-01 s.d. 2026-12-31"],
      },
    };
    render(<Form {...baseProps} profile={profile({ status: "retired" })} />);

    expect(screen.getByTestId("retire-warnings")).toHaveTextContent(
      "Tidak ada profil aktif 2026-01-01 s.d. 2026-12-31",
    );
  });

  it("menampilkan peringatan peran wajib yang belum terpetakan per jenis dokumen", () => {
    render(
      <Form
        {...baseProps}
        profile={profile()}
        unmapped={[{ document_type: "sales_invoice", roles: ["revenue"] }]}
      />,
    );

    const warning = screen.getByTestId("unmapped-warning");
    expect(warning).toHaveAttribute("role", "alert");
    expect(screen.getAllByTestId("unmapped-item")).toHaveLength(1);
    expect(warning).toHaveTextContent("Pendapatan");
    expect(warning).toHaveTextContent("sales_invoice");
  });

  it("tidak ada peringatan bila semua peran terpetakan", () => {
    render(<Form {...baseProps} profile={profile()} unmapped={[]} />);

    expect(screen.queryByTestId("unmapped-warning")).toBeNull();
  });

  it("hapus draft meminta konfirmasi lalu memanggil rute discard", async () => {
    const user = userEvent.setup();
    render(<Form {...baseProps} profile={profile()} />);

    await user.click(
      screen.getByRole("button", {
        name: "finances.postingProfile.actions.discard",
      }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", {
        name: "finances.postingProfile.confirm.discard.confirm",
      }),
    );

    expect(mocks.routerDelete).toHaveBeenCalledWith(
      "postingProfiles.discard/p1",
      expect.any(Object),
    );
  });

  it("tidak ada pilihan cakupan cabang pada form (profil global)", () => {
    render(<Form {...baseProps} profile={profile()} />);

    expect(screen.queryByText(/branch/i)).toBeNull();
    expect(screen.queryByLabelText(/branch|cabang/i)).toBeNull();
  });

  it("menampilkan aturan akun bersyarat baca-saja", () => {
    render(
      <Form
        {...baseProps}
        profile={profile({
          rules: [
            {
              id: "r1",
              role: "revenue",
              document_type: "sales_invoice",
              variant: "return",
              item_type: null,
              is_stock_item: false,
              category: null,
              account: {
                id: "a2",
                account_number: "4120",
                account_name: "Retur Penjualan",
              },
              priority: 2,
            },
          ],
        })}
      />,
    );

    const row = screen.getByTestId("rule-row");
    expect(row).toHaveTextContent("Pendapatan");
    expect(row).toHaveTextContent("4120 - Retur Penjualan");
    expect(row).toHaveTextContent(
      "finances.postingProfile.columns.variant.options.return",
    );
    expect(row).toHaveTextContent("finances.postingProfile.form.no");
  });

  it("berganti profil me-remount form sehingga nilai mengikuti profil baru", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <Form {...baseProps} profile={profile({ id: "p1", name: "Versi 1" })} />,
    );
    expect(
      screen.getByLabelText("finances.postingProfile.columns.name"),
    ).toHaveValue("Versi 1");

    rerender(
      <Form
        {...baseProps}
        profile={profile({
          id: "p2",
          name: "Versi 2",
          version: 2,
          effective_from: "2026-07-01",
          notes: "catatan v2",
          accounts: {},
        })}
      />,
    );

    expect(
      screen.getByLabelText("finances.postingProfile.columns.name"),
    ).toHaveValue("Versi 2");
    expect(
      screen.getByLabelText("finances.postingProfile.columns.effective_from"),
    ).toHaveValue("2026-07-01");
    expect(
      screen.getByLabelText("finances.postingProfile.columns.notes"),
    ).toHaveValue("catatan v2");

    await user.click(
      screen.getByRole("button", { name: "finances.postingProfile.form.save" }),
    );
    const [url, data] = mocks.put.mock.calls[0];
    expect(url).toBe("postingProfiles.update/p2");
    expect(data.accounts).toEqual({});
  });

  it("menampilkan catatan bahwa pemeriksaan hanya melihat akun default", () => {
    render(
      <Form
        {...baseProps}
        profile={profile()}
        unmapped={[{ document_type: "sales_invoice", roles: ["revenue"] }]}
      />,
    );

    expect(screen.getByTestId("unmapped-warning")).toHaveTextContent(
      "finances.postingProfile.unmapped.note",
    );
  });
});
