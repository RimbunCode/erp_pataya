import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
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
  formErrors: {},
  clearErrors: vi.fn(),
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
        errors: mocks.formErrors,
        clearErrors: mocks.clearErrors,
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

vi.mock("@/Pages/Inventory/Categories/CategoryLinkModel", () => ({
  default: ({ value, onValueChange, disabled }) => (
    <div>
      <button
        type="button"
        data-testid="category-picker"
        disabled={disabled}
        onClick={() =>
          onValueChange({
            id: "cat-new",
            name: "Suku Cadang",
            thisModel: "App\Models\Inventory\Category",
          })
        }
      >
        pilih kategori
      </button>
      <button
        type="button"
        data-testid="category-clear"
        onClick={() => onValueChange(null)}
      >
        kosongkan kategori
      </button>
      <span data-testid="category-picked">{value?.name ?? ""}</span>
    </div>
  ),
}));

vi.mock("@/Components/ui/select", () => ({
  Select: ({ value, onValueChange, disabled, children }) => (
    <select
      value={value ?? ""}
      disabled={disabled}
      onChange={(event) => onValueChange?.(event.target.value)}
    >
      <option value="" />
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }) => <>{children}</>,
  SelectItem: ({ value, children }) => (
    <option value={value}>{children}</option>
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
  {
    value: "discount",
    label: "Diskon",
    line_sensitive: false,
    master: false,
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
  documentTypes: ["sales_invoice", "purchase_invoice"],
  itemTypes: ["inventory", "service"],
  canWrite: true,
  canActivate: true,
  defaultFrom: "2026-07-01",
};

describe("PostingProfiles Form", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pickCounter = 0;
    mocks.pageProps = {};
    mocks.formErrors = {};
  });

  it("menampilkan satu baris per peran dengan peran akun master diberi petunjuk", () => {
    render(<Form {...baseProps} profile={profile()} />);

    const rows = screen.getAllByTestId("role-row");
    expect(rows).toHaveLength(4);
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

  it("menampilkan aturan akun bersyarat baca-saja pada profil aktif", () => {
    render(
      <Form
        {...baseProps}
        profile={profile({
          status: "active",
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

  describe("editor aturan akun bersyarat (Task 12.2)", () => {
    const ACCOUNT = {
      id: "a2",
      account_number: "4120",
      account_name: "Retur Penjualan",
      thisModel: "App\\Models\\Finances\\Account",
    };
    const rule = (overrides = {}) => ({
      id: "r1",
      role: "revenue",
      document_type: "sales_invoice",
      variant: "return",
      item_type: null,
      is_stock_item: null,
      item_category_id: null,
      category: null,
      account: ACCOUNT,
      priority: 2,
      ...overrides,
    });
    const editorRows = () => screen.queryAllByTestId("rule-editor-row");
    const field = (row, name) =>
      within(within(row).getByTestId(`rule-${name}`)).getByRole("combobox");
    const save = (user) =>
      user.click(
        screen.getByRole("button", {
          name: "finances.postingProfile.form.save",
        }),
      );
    const addRow = (user) =>
      user.click(
        screen.getByRole("button", {
          name: "finances.postingProfile.rules_editor.add",
        }),
      );

    it("draft menampilkan aturan sebagai baris editor, bukan tabel baca-saja", () => {
      render(<Form {...baseProps} profile={profile({ rules: [rule()] })} />);

      expect(editorRows()).toHaveLength(1);
      expect(screen.queryByTestId("rule-row")).toBeNull();
      expect(field(editorRows()[0], "role")).toHaveValue("revenue");
      expect(field(editorRows()[0], "document_type")).toHaveValue(
        "sales_invoice",
      );
      expect(field(editorRows()[0], "variant")).toHaveValue("return");
    });

    it("menambah baris lalu menyimpan mengirim aturan hanya berisi id dan nilai kondisi", async () => {
      const user = userEvent.setup();
      render(<Form {...baseProps} profile={profile()} />);

      expect(screen.getByTestId("rules-empty")).toBeInTheDocument();
      await addRow(user);
      const [row] = editorRows();
      await user.selectOptions(field(row, "role"), "revenue");
      await user.selectOptions(field(row, "document_type"), "sales_invoice");
      await user.selectOptions(field(row, "variant"), "return");
      await user.selectOptions(field(row, "item_type"), "service");
      await user.selectOptions(field(row, "is_stock_item"), "false");
      await user.click(within(row).getByTestId("category-picker"));
      await user.click(
        within(within(row).getByTestId("rule-account")).getByTestId(
          "account-picker",
        ),
      );
      const priority = within(row).getByRole("spinbutton");
      await user.clear(priority);
      await user.type(priority, "7");
      await save(user);

      expect(mocks.put).toHaveBeenCalledTimes(1);
      const [, data] = mocks.put.mock.calls[0];
      expect(data.rules).toEqual([
        {
          role: "revenue",
          document_type: "sales_invoice",
          variant: "return",
          item_type: "service",
          is_stock_item: false,
          item_category_id: "cat-new",
          account_id: "acc-1",
          priority: 7,
        },
      ]);
    });

    it("kolom Semua mengirim null dan baris dapat dihapus", async () => {
      const user = userEvent.setup();
      render(
        <Form
          {...baseProps}
          profile={profile({
            rules: [rule(), rule({ id: "r2", variant: null, priority: 0 })],
          })}
        />,
      );

      await user.selectOptions(field(editorRows()[0], "variant"), "__any__");
      await user.click(
        within(editorRows()[1]).getByRole("button", {
          name: "finances.postingProfile.rules_editor.remove",
        }),
      );
      expect(editorRows()).toHaveLength(1);
      await save(user);

      const [, data] = mocks.put.mock.calls[0];
      expect(data.rules).toHaveLength(1);
      expect(data.rules[0].variant).toBeNull();
      expect(data.rules[0].account_id).toBe("a2");
    });

    it("mengosongkan semua baris mengirim daftar kosong agar server menghapus aturan", async () => {
      const user = userEvent.setup();
      render(<Form {...baseProps} profile={profile({ rules: [rule()] })} />);

      await user.click(
        within(editorRows()[0]).getByRole("button", {
          name: "finances.postingProfile.rules_editor.remove",
        }),
      );
      await save(user);

      expect(mocks.put.mock.calls[0][1].rules).toEqual([]);
    });

    it("kombinasi kembar ditolak di baris kedua dan simpan tidak dikirim", async () => {
      const user = userEvent.setup();
      render(
        <Form
          {...baseProps}
          profile={profile({
            rules: [rule(), rule({ id: "r2", priority: 9 })],
          })}
        />,
      );

      await save(user);

      expect(mocks.put).not.toHaveBeenCalled();
      const errors = screen.getAllByTestId("rule-error");
      expect(errors).toHaveLength(1);
      expect(errors[0]).toHaveTextContent(
        "finances.postingProfile.rules_editor.errors.duplicate",
      );
      expect(editorRows()[1].nextElementSibling).toContainElement(errors[0]);

      // Memperbaiki kondisi menghilangkan galat dan membuka jalan simpan.
      await user.selectOptions(field(editorRows()[1], "variant"), "normal");
      expect(screen.queryByTestId("rule-error")).toBeNull();
      await save(user);
      expect(mocks.put).toHaveBeenCalledTimes(1);
    });

    it("peran dan akun wajib diisi sebelum simpan", async () => {
      const user = userEvent.setup();
      render(<Form {...baseProps} profile={profile()} />);

      await addRow(user);
      await save(user);

      expect(mocks.put).not.toHaveBeenCalled();
      const text = screen
        .getAllByTestId("rule-error")
        .map((node) => node.textContent);
      expect(text).toContain(
        "finances.postingProfile.rules_editor.errors.role_required",
      );
      expect(text).toContain(
        "finances.postingProfile.rules_editor.errors.account_required",
      );
    });

    it("prioritas negatif ditolak di sisi klien", async () => {
      const user = userEvent.setup();
      render(<Form {...baseProps} profile={profile({ rules: [rule()] })} />);

      const priority = within(editorRows()[0]).getByRole("spinbutton");
      fireEvent.change(priority, { target: { value: "-3" } });
      await save(user);

      expect(mocks.put).not.toHaveBeenCalled();
      expect(screen.getByTestId("rule-error")).toHaveTextContent(
        "finances.postingProfile.rules_editor.errors.priority_invalid",
      );
    });

    it("peran non peka-barang menonaktifkan kondisi barang dan berganti ke peran itu mengosongkannya", async () => {
      const user = userEvent.setup();
      render(
        <Form
          {...baseProps}
          profile={profile({
            rules: [
              rule({
                item_type: "inventory",
                is_stock_item: true,
                item_category_id: "cat-1",
                category: {
                  id: "cat-1",
                  name: "Lama",
                  thisModel: "App\\Models\\Inventory\\Category",
                },
              }),
            ],
          })}
        />,
      );
      const [row] = editorRows();
      expect(field(row, "item_type")).toBeEnabled();
      expect(within(row).getByTestId("category-picked")).toHaveTextContent(
        "Lama",
      );

      await user.selectOptions(field(row, "role"), "discount");

      expect(field(row, "item_type")).toBeDisabled();
      expect(field(row, "is_stock_item")).toBeDisabled();
      expect(within(row).getByTestId("category-picker")).toBeDisabled();
      expect(within(row).getByTestId("category-picked")).toHaveTextContent("");
      expect(
        within(row).getByText(
          "finances.postingProfile.rules_editor.not_line_sensitive_hint",
        ),
      ).toBeInTheDocument();

      await save(user);
      const [payload] = mocks.put.mock.calls[0][1].rules;
      expect(payload).toMatchObject({
        role: "discount",
        item_type: null,
        is_stock_item: null,
        item_category_id: null,
      });
    });

    it("peran diskon menampilkan petunjuk aturan terpisah per jenis dokumen", async () => {
      const user = userEvent.setup();
      render(<Form {...baseProps} profile={profile()} />);

      await addRow(user);
      expect(screen.queryByTestId("rule-discount-hint")).toBeNull();
      await user.selectOptions(field(editorRows()[0], "role"), "discount");

      expect(screen.getByTestId("rule-discount-hint")).toHaveTextContent(
        "finances.postingProfile.rules_editor.discount_hint",
      );
    });

    it("kategori tersimpan tidak hilang saat LinkModel memanggil onValueChange(null) untuk nilai tanpa thisModel", async () => {
      const user = userEvent.setup();
      render(
        <Form
          {...baseProps}
          profile={profile({
            rules: [
              rule({
                item_category_id: "cat-1",
                category: { id: "cat-1", name: "Tanpa Model" },
              }),
            ],
          })}
        />,
      );

      await user.click(screen.getByTestId("category-clear"));
      expect(screen.getByTestId("category-picked")).toHaveTextContent(
        "Tanpa Model",
      );
      await save(user);

      expect(mocks.put.mock.calls[0][1].rules[0].item_category_id).toBe(
        "cat-1",
      );
    });

    it("kategori yang objeknya tidak ada tetap dibawa id mentahnya, dan dapat dikosongkan eksplisit", async () => {
      const user = userEvent.setup();
      render(
        <Form
          {...baseProps}
          profile={profile({
            rules: [rule({ item_category_id: "cat-hilang", category: null })],
          })}
        />,
      );

      await save(user);
      expect(mocks.put.mock.calls[0][1].rules[0].item_category_id).toBe(
        "cat-hilang",
      );

      await user.click(screen.getByTestId("category-clear"));
      await save(user);
      expect(mocks.put.mock.calls[1][1].rules[0].item_category_id).toBeNull();
    });

    it("aturan berperan kustom tampil baca-saja dan tidak ikut dikirim", async () => {
      const user = userEvent.setup();
      render(
        <Form
          {...baseProps}
          profile={profile({
            rules: [
              rule(),
              rule({ id: "r9", role: "custom_tax", variant: null }),
            ],
          })}
        />,
      );

      expect(editorRows()).toHaveLength(1);
      expect(screen.getAllByTestId("rule-row")).toHaveLength(1);
      expect(screen.getByTestId("rule-row")).toHaveTextContent("custom_tax");
      await save(user);

      expect(mocks.put.mock.calls[0][1].rules).toHaveLength(1);
      expect(mocks.put.mock.calls[0][1].rules[0].role).toBe("revenue");
    });

    it("aturan berperan kustom dibawa lewat custom_rule_ids dan tombol Hapus membuangnya tanpa mengubah baris editor", async () => {
      const user = userEvent.setup();
      render(
        <Form
          {...baseProps}
          profile={profile({
            rules: [
              rule(),
              rule({ id: "r9", role: "custom_tax", variant: null }),
              rule({ id: "r10", role: "custom_fee", variant: null }),
            ],
          })}
        />,
      );

      await save(user);
      expect(mocks.put.mock.calls[0][1].custom_rule_ids).toEqual(["r9", "r10"]);

      const customRow = screen
        .getAllByTestId("rule-row")
        .find((row) => row.textContent.includes("custom_tax"));
      await user.click(
        within(customRow).getByRole("button", {
          name: "finances.postingProfile.rules_editor.remove",
        }),
      );

      const rows = screen.getAllByTestId("rule-row");
      expect(rows).toHaveLength(1);
      expect(rows[0]).toHaveTextContent("custom_fee");
      expect(editorRows()).toHaveLength(1);

      await save(user);
      expect(mocks.put.mock.calls[1][1].custom_rule_ids).toEqual(["r10"]);
      expect(mocks.put.mock.calls[1][1].rules).toHaveLength(1);
    });

    it("menampilkan galat server per baris dan galat umum aturan", () => {
      mocks.formErrors = {
        "rules.0.role": "Peran revenue bukan peka-barang.",
        rules: "Daftar aturan tidak valid.",
      };
      render(<Form {...baseProps} profile={profile({ rules: [rule()] })} />);

      expect(screen.getByTestId("rule-error")).toHaveTextContent(
        "Peran revenue bukan peka-barang.",
      );
      expect(
        screen.getByText("Daftar aturan tidak valid."),
      ).toBeInTheDocument();
    });

    it("membersihkan galat server aturan saat baris berubah agar tidak salah alamat", async () => {
      const user = userEvent.setup();
      mocks.formErrors = {
        "rules.0.role": "Galat lama.",
        rules: "Galat umum.",
        name: "Galat nama.",
      };
      render(<Form {...baseProps} profile={profile({ rules: [rule()] })} />);

      await user.click(
        within(editorRows()[0]).getByRole("button", {
          name: "finances.postingProfile.rules_editor.remove",
        }),
      );

      expect(mocks.clearErrors).toHaveBeenCalledWith("rules.0.role", "rules");
    });

    it("profil baru dapat menyimpan aturan bersama draft pertamanya", async () => {
      const user = userEvent.setup();
      render(<Form {...baseProps} profile={null} canActivate={false} />);

      await addRow(user);
      const [row] = editorRows();
      await user.selectOptions(field(row, "role"), "receivable");
      await user.click(
        within(within(row).getByTestId("rule-account")).getByTestId(
          "account-picker",
        ),
      );
      await user.click(
        screen.getByRole("button", {
          name: "finances.postingProfile.form.create",
        }),
      );

      expect(mocks.post).toHaveBeenCalledTimes(1);
      expect(mocks.post.mock.calls[0][1].rules).toEqual([
        expect.objectContaining({ role: "receivable", account_id: "acc-1" }),
      ]);
    });

    it("profil aktif berisi aturan baca-saja tanpa editor, namun dapat disalin menjadi versi baru", () => {
      render(
        <Form
          {...baseProps}
          profile={profile({ status: "active", rules: [rule()] })}
        />,
      );

      expect(editorRows()).toHaveLength(0);
      expect(screen.getAllByTestId("rule-row")).toHaveLength(1);
      expect(
        screen.queryByRole("button", {
          name: "finances.postingProfile.rules_editor.add",
        }),
      ).toBeNull();
      expect(
        screen.getByRole("button", {
          name: "finances.postingProfile.actions.new_version",
        }),
      ).toBeInTheDocument();
    });

    it("tanpa izin write draft tidak menampilkan editor", () => {
      render(
        <Form
          {...baseProps}
          canWrite={false}
          profile={profile({ rules: [rule()] })}
        />,
      );

      expect(editorRows()).toHaveLength(0);
      expect(screen.getAllByTestId("rule-row")).toHaveLength(1);
    });
  });
});
