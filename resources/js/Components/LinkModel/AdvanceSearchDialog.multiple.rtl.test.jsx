/**
 * AdvanceSearchDialog mode `multiple` (seleksi banyak baris: centang + tombol
 * Pilih). Spec finance-multi-tax-per-item, Requirement 9.7.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({
    t: (key, params) =>
      params?.count !== undefined ? `TR:${key}:${params.count}` : `TR:${key}`,
  }),
}));

vi.mock("@/Hooks/usePermission", () => ({
  default: () => ({ can: () => true, canGlobal: () => true }),
}));

vi.mock("@inertiajs/react", () => ({
  router: { get: vi.fn(), reload: vi.fn() },
  usePage: () => ({ props: {}, url: "/test" }),
}));

const axiosPost = vi.fn();
const axiosGet = vi.fn();
vi.mock("axios", () => ({
  default: {
    post: (...args) => axiosPost(...args),
    get: (...args) => axiosGet(...args),
  },
}));

window.route = (name) => name;

import AdvanceSearchDialog from "./AdvanceSearchDialog";

const MODEL = "App\\Models\\Finances\\Tax";

const rows = [
  {
    id: 1,
    code: "PPN",
    rate: 11,
    secret: "x",
    templateLink: ":code",
    thisModel: MODEL,
  },
  {
    id: 2,
    code: "PPH",
    rate: 2,
    secret: "y",
    templateLink: ":code",
    thisModel: MODEL,
  },
  {
    id: 3,
    code: "PBJT",
    rate: 10,
    secret: "z",
    templateLink: ":code",
    thisModel: MODEL,
  },
];

function selectDataResponse() {
  return {
    data: {
      model: MODEL,
      route: "taxes",
      translateKey: null,
      columns: [
        { name: "code", type: "string", linkable: false },
        { name: "rate", type: "number", linkable: true },
      ],
      templateLinkColumns: ["code"],
      parentColumn: null,
      data: {
        data: rows,
        current_page: 1,
        last_page: 1,
        per_page: 25,
        total: rows.length,
      },
    },
  };
}

const renderDialog = (props = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AdvanceSearchDialog
        open
        onOpenChange={vi.fn()}
        model={MODEL}
        onSelect={vi.fn()}
        {...props}
      />
    </QueryClientProvider>,
  );
};

const rowCheckbox = (table, code) =>
  within(within(table).getByText(code).closest("tr")).getByLabelText(
    "TR:core.datatable.select_row",
  );

describe("AdvanceSearchDialog -- multiple", () => {
  beforeEach(() => {
    axiosPost.mockReset().mockResolvedValue(selectDataResponse());
    axiosGet.mockReset().mockResolvedValue({ data: { data: [] } });
  });

  it("centang beberapa baris lalu Pilih: onSelectMany menerima baris TERPANGKAS berurutan sesuai urutan centang", async () => {
    const user = userEvent.setup({ delay: null });
    const onSelectMany = vi.fn();
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();
    renderDialog({
      multiple: true,
      fields: ["rate"],
      onSelect,
      onSelectMany,
      onOpenChange,
    });
    const table = await screen.findByRole("table");
    await within(table).findByText("PPN");

    await user.click(rowCheckbox(table, "PBJT"));
    await user.click(rowCheckbox(table, "PPN"));
    // dialog tetap terbuka selama menyeleksi
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(onSelectMany).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: "TR:core.form.linkmodel.select:2" }),
    );
    expect(onSelectMany).toHaveBeenCalledTimes(1);
    const picked = onSelectMany.mock.calls[0][0];
    expect(picked.map((r) => r.id)).toEqual([3, 1]);
    // `secret` (non-linkable, bukan fields) terbuang; `rate` (fields) tetap
    expect(picked[0]).not.toHaveProperty("secret");
    expect(picked[0]).toHaveProperty("rate", 10);
    expect(picked[0]).toHaveProperty("thisModel", MODEL);
    expect(onSelect).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("klik baris (bukan checkbox) tidak memilih apa pun di mode multiple", async () => {
    const user = userEvent.setup({ delay: null });
    const onSelect = vi.fn();
    const onSelectMany = vi.fn();
    renderDialog({ multiple: true, onSelect, onSelectMany });
    const table = await screen.findByRole("table");
    await user.click(await within(table).findByText("PPN"));
    expect(onSelect).not.toHaveBeenCalled();
    expect(onSelectMany).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "TR:core.form.linkmodel.select:0" }),
    ).toBeInTheDocument();
  });

  it("seleksi awal = nilai LinkModel (urutan terjaga, baris baru di akhir); uncheck mencabut", async () => {
    const user = userEvent.setup({ delay: null });
    const onSelectMany = vi.fn();
    const selected = [
      { id: 2, templateLink: ":code", code: "PPH", thisModel: MODEL },
    ];
    renderDialog({ multiple: true, selected, onSelectMany });
    const table = await screen.findByRole("table");
    await within(table).findByText("PPN");

    expect(rowCheckbox(table, "PPH")).toHaveAttribute("aria-checked", "true");
    expect(rowCheckbox(table, "PPN")).toHaveAttribute("aria-checked", "false");

    await user.click(rowCheckbox(table, "PPN"));
    await user.click(
      screen.getByRole("button", { name: "TR:core.form.linkmodel.select:2" }),
    );
    expect(onSelectMany.mock.calls[0][0].map((r) => r.id)).toEqual([2, 1]);
  });

  it("uncheck baris yang sudah terpilih -> hilang dari hasil; boleh memilih kosong", async () => {
    const user = userEvent.setup({ delay: null });
    const onSelectMany = vi.fn();
    renderDialog({
      multiple: true,
      selected: [
        { id: 1, templateLink: ":code", code: "PPN", thisModel: MODEL },
      ],
      onSelectMany,
    });
    const table = await screen.findByRole("table");
    await within(table).findByText("PPN");
    await user.click(rowCheckbox(table, "PPN"));
    await user.click(
      screen.getByRole("button", { name: "TR:core.form.linkmodel.select:0" }),
    );
    expect(onSelectMany).toHaveBeenCalledWith([]);
  });

  it("dialog dibuka ulang -> seleksi dibangun lagi dari `selected` (centang yang dibatalkan tidak terbawa)", async () => {
    const user = userEvent.setup({ delay: null });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    const ui = (open) => (
      <QueryClientProvider client={queryClient}>
        <AdvanceSearchDialog
          open={open}
          onOpenChange={vi.fn()}
          model={MODEL}
          onSelect={vi.fn()}
          multiple
          selected={[]}
          onSelectMany={vi.fn()}
        />
      </QueryClientProvider>
    );
    const { rerender } = render(ui(true));
    let table = await screen.findByRole("table");
    await within(table).findByText("PPN");
    await user.click(rowCheckbox(table, "PPN"));
    expect(rowCheckbox(table, "PPN")).toHaveAttribute("aria-checked", "true");

    rerender(ui(false));
    rerender(ui(true));
    table = await screen.findByRole("table");
    await within(table).findByText("PPN");
    await waitFor(() =>
      expect(rowCheckbox(table, "PPN")).toHaveAttribute(
        "aria-checked",
        "false",
      ),
    );
  });

  it("mode tunggal (tanpa multiple): tanpa kolom centang & tanpa tombol Pilih; klik baris langsung memilih", async () => {
    const user = userEvent.setup({ delay: null });
    const onSelect = vi.fn();
    renderDialog({ onSelect });
    const table = await screen.findByRole("table");
    expect(
      within(table).queryAllByLabelText("TR:core.datatable.select_row"),
    ).toHaveLength(0);
    expect(
      screen.queryByRole("button", { name: /linkmodel.select/ }),
    ).toBeNull();
    await user.click(await within(table).findByText("PPH"));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0].id).toBe(2);
  });
});
