import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { TooltipProvider } from "@/Components/ui/tooltip";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({
    t: (key, params) =>
      params ? `TR:${key}:${JSON.stringify(params)}` : `TR:${key}`,
  }),
}));

const axiosGet = vi.fn();
const axiosDelete = vi.fn();
vi.mock("axios", () => ({
  default: {
    get: (...a) => axiosGet(...a),
    delete: (...a) => axiosDelete(...a),
  },
}));

window.route = (name, params) =>
  params ? `${name}/${JSON.stringify(params)}` : name;

// Search Bar host-agnostic (Requirement 14.1): TIDAK boleh memakai `router`
// maupun `usePage`. Mock ini MELEMPAR bila salah satunya disentuh, jadi
// seluruh file test ini otomatis gagal bila kontrak itu dilanggar.
vi.mock("@inertiajs/react", () => ({
  router: new Proxy(
    {},
    {
      get() {
        throw new Error("SearchBar tidak boleh memakai router");
      },
    },
  ),
  usePage: () => {
    throw new Error("SearchBar tidak boleh memakai usePage");
  },
}));

vi.mock("@/Hooks/use-mobile", () => ({ useIsMobile: () => false }));

vi.mock("@/Components/Table/Table2", () => ({
  DATE_GROUP_GRANULARITIES: ["day", "month", "quarter", "half", "year"],
  DEFAULT_NUMBER_GROUP_RANGE_OPTIONS: [10, 100, 1000],
}));

// SaveFilterControl asli sudah punya test sendiri (FilterTable2.rtl.test.jsx).
vi.mock("../Filter/FilterTable2", () => ({
  SaveFilterControl: () => <div data-testid="save-control" />,
}));

// Select operator & ValueField di-stub (lihat ChipEditor.rtl.test.jsx).
vi.mock("@/Components/Select", () => ({
  default: ({ value, onValueChange, options }) => (
    <select
      data-testid="operator-select"
      value={value ?? ""}
      onChange={(e) => onValueChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  ),
}));
vi.mock("../Filter/ValueField", () => ({
  default: ({ column, operator, value, onChange }) => (
    <div
      data-testid="value-field"
      data-column={column?.name}
      data-operator={operator}
      data-value={JSON.stringify(value)}
    >
      <button type="button" onClick={() => onChange("dari-stub")}>
        set-value
      </button>
    </div>
  ),
}));

import SearchBar from "./SearchBar";

const columns = {
  code: { name: "code", title: "Kode", type: "string" },
  name: { name: "name", title: "Nama", type: "string" },
  status: {
    name: "status",
    title: "Status",
    type: "formStatus",
    options: [
      { value: "draft", label: "Draft" },
      { value: "completed", label: "Selesai" },
    ],
  },
  total: { name: "total", title: "Total", type: "currency" },
  created_at: { name: "created_at", title: "Dibuat", type: "date" },
  active: { name: "active", title: "Aktif", type: "boolean" },
};

const groupOptions = [
  { value: "__no_group__", label: "Tidak ada" },
  { value: "created_at", label: "Dibuat" },
  { value: "total", label: "Total" },
];

const PLACEHOLDER = "Cari Test…";

const statusDraftTree = {
  root: { k: "and", c: { a: { k: "status", o: "=", v: "draft" } } },
};

const renderBar = (overrides = {}) => {
  const props = {
    columns,
    tree: null,
    onTreeChange: vi.fn(),
    getSearchColumns: () => ["code", "name"],
    placeholder: PLACEHOLDER,
    ...overrides,
  };
  const ui = (p) => (
    <TooltipProvider>
      <SearchBar {...p} />
    </TooltipProvider>
  );
  const utils = render(ui(props));
  return {
    props,
    input: screen.getByPlaceholderText(PLACEHOLDER),
    rerenderWith: (next) => utils.rerender(ui({ ...props, ...next })),
    ...utils,
  };
};

/** Fokus input lalu ketik teks (mode key/value, tergantung state SearchBar). */
const typeInto = async (user, input, text) => {
  await user.click(input);
  await user.type(input, text);
};

const savedA = {
  id: 1,
  name: "PO Bulan Ini",
  is_shared: true,
  is_saved: true,
  filter: statusDraftTree,
  sort: null,
  group: null,
};
const savedB = {
  id: 2,
  name: "Draft saya",
  is_shared: false,
  is_saved: true,
  filter: statusDraftTree,
  sort: null,
  group: null,
};

describe("SearchBar — teks bebas (Chip Cari)", () => {
  beforeEach(() => {
    axiosGet.mockReset();
    axiosDelete.mockReset();
    axiosGet.mockResolvedValue({ data: { data: [] } });
  });

  it("ketik + Enter menambah grup OR matches per kolom dari getSearchColumns()", async () => {
    const user = userEvent.setup({ delay: null });
    const { props, input } = renderBar();

    await typeInto(user, input, "PT A");
    await screen.findByRole("option", { name: /search_all/ });
    await user.keyboard("{Enter}");

    await waitFor(() => expect(props.onTreeChange).toHaveBeenCalledTimes(1));
    const tree = props.onTreeChange.mock.calls[0][0];
    expect(tree.root.k).toBe("and");
    const groups = Object.values(tree.root.c);
    expect(groups).toHaveLength(1);
    expect(groups[0].k).toBe("or");
    expect(
      Object.values(groups[0].c).map((l) => [l.k, l.o, l.v]),
    ).toEqual([
      ["code", "matches", "PT A"],
      ["name", "matches", "PT A"],
    ]);
    // sukses -> input dikosongkan
    await waitFor(() => expect(input).toHaveValue(""));
  });

  it("getSearchColumns dipanggil SAAT Enter (bukan disimpan): perubahan setelah mengetik ikut terbawa", async () => {
    const user = userEvent.setup({ delay: null });
    let cols = ["code", "name"];
    const { props, input } = renderBar({ getSearchColumns: () => cols });

    await typeInto(user, input, "PT A");
    await screen.findByRole("option", { name: /search_all/ });
    cols = ["name"]; // mis. user menyembunyikan kolom Kode di Table2
    await user.keyboard("{Enter}");

    await waitFor(() => expect(props.onTreeChange).toHaveBeenCalledTimes(1));
    const [group] = Object.values(props.onTreeChange.mock.calls[0][0].root.c);
    expect(Object.values(group.c).map((l) => l.k)).toEqual(["name"]);
  });

  it("chip Cari kedua ditambahkan sebagai grup OR terpisah (AND antar-pencarian)", async () => {
    const user = userEvent.setup({ delay: null });
    const existing = {
      root: {
        k: "and",
        c: {
          g1: {
            k: "or",
            c: {
              s1: { k: "code", o: "matches", v: "PT A" },
              s2: { k: "name", o: "matches", v: "PT A" },
            },
          },
        },
      },
    };
    const { props, input } = renderBar({ tree: existing });

    await typeInto(user, input, "Budi");
    await screen.findByRole("option", { name: /search_all/ });
    await user.keyboard("{Enter}");

    await waitFor(() => expect(props.onTreeChange).toHaveBeenCalledTimes(1));
    const tree = props.onTreeChange.mock.calls[0][0];
    expect(Object.keys(tree.root.c)).toHaveLength(2);
    expect(tree.root.c.g1).toEqual(existing.root.c.g1);
  });

  it("seksi teks bebas hilang bila getSearchColumns() kosong; Enter tanpa item = no-op", async () => {
    const user = userEvent.setup({ delay: null });
    const { props, input } = renderBar({ getSearchColumns: () => [] });

    await typeInto(user, input, "Nama");
    // saran Kolom tetap ada, teks bebas TIDAK.
    await screen.findByRole("option", { name: "Nama" });
    expect(
      screen.queryByRole("option", { name: /search_all/ }),
    ).not.toBeInTheDocument();

    await user.clear(input);
    await user.type(input, "zzz");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    await user.keyboard("{Enter}");
    expect(props.onTreeChange).not.toHaveBeenCalled();
  });

  it("item pertama selalu di-highlight; kembali ke item pertama saat yang di-highlight hilang dari daftar", async () => {
    const user = userEvent.setup({ delay: null });
    const { input } = renderBar();

    await typeInto(user, input, "St");
    const textOption = await screen.findByRole("option", {
      name: /search_all/,
    });
    const statusOption = screen.getByRole("option", { name: "Status" });
    expect(textOption).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowDown}");
    await waitFor(() =>
      expect(statusOption).toHaveAttribute("aria-selected", "true"),
    );

    // "Str" tidak lagi cocok dgn "Status" -> highlight harus balik ke item pertama.
    await user.type(input, "r");
    await waitFor(() =>
      expect(
        screen.getByRole("option", { name: /search_all/ }),
      ).toHaveAttribute("aria-selected", "true"),
    );
    expect(screen.queryByRole("option", { name: "Status" })).not.toBeInTheDocument();
  });

  it("label saran memakai <mark> pada bagian yang cocok", async () => {
    const user = userEvent.setup({ delay: null });
    const { input } = renderBar();

    await typeInto(user, input, "Nama");
    const option = await screen.findByRole("option", { name: "Nama" });

    const marks = option.querySelectorAll("mark");
    expect(marks).toHaveLength(1);
    expect(marks[0]).toHaveTextContent("Nama");
  });

  it("nama saved filter ber-HTML dirender sebagai teks (bukan elemen) -- aman dari XSS", async () => {
    const user = userEvent.setup({ delay: null });
    axiosGet.mockResolvedValue({
      data: {
        data: [
          {
            ...savedA,
            name: '<img src=x onerror="window.__xss = 1">',
          },
        ],
      },
    });
    const { input } = renderBar({ model: "AppModelsItem" });

    await typeInto(user, input, "img");
    const option = await screen.findByRole("option", { name: /<img src=x/ });

    expect(option).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
    expect(window.__xss).toBeUndefined();
    // bagian yang cocok ("img") ter-mark, sisanya teks polos.
    expect(option.querySelector("mark")).toHaveTextContent("img");
  });

  it("mengetik '/' tidak di-preventDefault dan masuk ke input", async () => {
    const user = userEvent.setup({ delay: null });
    const { input } = renderBar();
    await user.click(input);

    const notPrevented = fireEvent.keyDown(input, { key: "/", code: "Slash" });
    expect(notPrevented).toBe(true);

    await user.type(input, "/");
    expect(input).toHaveValue("/");
  });

  it("tidak mendaftarkan listener keydown global (document/window) saat mount", () => {
    const docSpy = vi.spyOn(document, "addEventListener");
    const winSpy = vi.spyOn(window, "addEventListener");
    try {
      renderBar();
      const types = [...docSpy.mock.calls, ...winSpy.mock.calls].map(
        ([type]) => type,
      );
      expect(types).not.toContain("keydown");
    } finally {
      docSpy.mockRestore();
      winSpy.mockRestore();
    }
  });
});

describe("SearchBar — mode value", () => {
  beforeEach(() => {
    axiosGet.mockReset();
    axiosGet.mockResolvedValue({ data: { data: [] } });
  });

  it("kolom string: pill prefix -> ketik + Enter menambah leaf matches", async () => {
    const user = userEvent.setup({ delay: null });
    const { props, input } = renderBar();

    await typeInto(user, input, "Nama");
    await user.click(await screen.findByRole("option", { name: "Nama" }));

    expect(screen.getByText("[Nama:]")).toBeInTheDocument();
    expect(input).toHaveValue("");

    await user.type(input, "laptop");
    await user.keyboard("{Enter}");

    await waitFor(() => expect(props.onTreeChange).toHaveBeenCalledTimes(1));
    const [leaf] = Object.values(props.onTreeChange.mock.calls[0][0].root.c);
    expect(leaf).toEqual({ k: "name", o: "matches", v: "laptop" });
    // sukses -> kembali ke mode key
    await waitFor(() =>
      expect(screen.queryByText("[Nama:]")).not.toBeInTheDocument(),
    );
    expect(input).toHaveValue("");
  });

  it("kolom number: input non-numerik ditolak dgn pesan inline tanpa commit; numerik -> leaf =", async () => {
    const user = userEvent.setup({ delay: null });
    const { props, input } = renderBar();

    await typeInto(user, input, "Total");
    await user.click(await screen.findByRole("option", { name: "Total" }));
    expect(screen.getByText("[Total:]")).toBeInTheDocument();

    await user.type(input, "abc");
    await user.keyboard("{Enter}");
    expect(
      await screen.findByText("TR:core.datatable.search.number_invalid"),
    ).toBeInTheDocument();
    expect(props.onTreeChange).not.toHaveBeenCalled();
    // teks ketikan tidak hilang
    expect(input).toHaveValue("abc");

    await user.clear(input);
    // mengetik lagi menghapus pesan error
    expect(
      screen.queryByText("TR:core.datatable.search.number_invalid"),
    ).not.toBeInTheDocument();
    await user.type(input, "1500");
    await user.keyboard("{Enter}");

    await waitFor(() => expect(props.onTreeChange).toHaveBeenCalledTimes(1));
    const [leaf] = Object.values(props.onTreeChange.mock.calls[0][0].root.c);
    expect(leaf).toEqual({ k: "total", o: "=", v: 1500 });
  });

  it("kolom ber-opsi: daftar nilai inline bisa difilter dgn mengetik; pilih -> leaf =", async () => {
    const user = userEvent.setup({ delay: null });
    const { props, input } = renderBar();

    await typeInto(user, input, "Status");
    await user.click(await screen.findByRole("option", { name: "Status" }));
    expect(screen.getByText("[Status:]")).toBeInTheDocument();

    expect(await screen.findByRole("option", { name: "Draft" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Selesai" })).toBeInTheDocument();

    await user.type(input, "sel");
    await waitFor(() =>
      expect(screen.queryByRole("option", { name: "Draft" })).not.toBeInTheDocument(),
    );
    await user.click(screen.getByRole("option", { name: "Selesai" }));

    await waitFor(() => expect(props.onTreeChange).toHaveBeenCalledTimes(1));
    const [leaf] = Object.values(props.onTreeChange.mock.calls[0][0].root.c);
    expect(leaf).toEqual({ k: "status", o: "=", v: "completed" });
    await waitFor(() =>
      expect(screen.queryByText("[Status:]")).not.toBeInTheDocument(),
    );
  });

  it("kolom boolean: daftar Ya/Tidak -> leaf = true", async () => {
    const user = userEvent.setup({ delay: null });
    const { props, input } = renderBar();

    await typeInto(user, input, "Aktif");
    await user.click(await screen.findByRole("option", { name: "Aktif" }));
    await user.click(
      await screen.findByRole("option", { name: "TR:core.datatable.yes" }),
    );

    await waitFor(() => expect(props.onTreeChange).toHaveBeenCalledTimes(1));
    const [leaf] = Object.values(props.onTreeChange.mock.calls[0][0].root.c);
    expect(leaf).toEqual({ k: "active", o: "=", v: true });
  });

  it("kolom date: langsung membuka ChipEditor draft; Terapkan menambah leaf (addLeafChip)", async () => {
    const user = userEvent.setup({ delay: null });
    const { props, input } = renderBar();

    await typeInto(user, input, "Dibuat");
    await user.click(await screen.findByRole("option", { name: "Dibuat" }));

    const field = await screen.findByTestId("value-field");
    expect(field).toHaveAttribute("data-column", "created_at");
    // operator default = operator pertama tipe date.
    expect(screen.getByTestId("operator-select")).toHaveValue("in_period");

    await user.click(screen.getByText("set-value"));
    await user.click(
      screen.getByRole("button", { name: "TR:core.datatable.search.apply" }),
    );

    await waitFor(() => expect(props.onTreeChange).toHaveBeenCalledTimes(1));
    const [leaf] = Object.values(props.onTreeChange.mock.calls[0][0].root.c);
    expect(leaf).toEqual({ k: "created_at", o: "in_period", v: "dari-stub" });
    await waitFor(() =>
      expect(screen.queryByTestId("value-field")).not.toBeInTheDocument(),
    );
  });

  it("mengetik lagi di input meninggalkan draft ChipEditor (tanpa commit)", async () => {
    const user = userEvent.setup({ delay: null });
    const { props, input } = renderBar();

    await typeInto(user, input, "Dibuat");
    await user.click(await screen.findByRole("option", { name: "Dibuat" }));
    await screen.findByTestId("value-field");

    await user.type(input, "x");

    await waitFor(() =>
      expect(screen.queryByTestId("value-field")).not.toBeInTheDocument(),
    );
    expect(props.onTreeChange).not.toHaveBeenCalled();
  });

  it("Esc di mode value kembali ke mode key", async () => {
    const user = userEvent.setup({ delay: null });
    const { input } = renderBar();

    await typeInto(user, input, "Nama");
    await user.click(await screen.findByRole("option", { name: "Nama" }));
    expect(screen.getByText("[Nama:]")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByText("[Nama:]")).not.toBeInTheDocument();
  });

  it("Backspace pada input kosong di mode value kembali ke mode key (chip tidak tersentuh)", async () => {
    const user = userEvent.setup({ delay: null });
    const { props, input } = renderBar({ tree: statusDraftTree });

    await typeInto(user, input, "Nama");
    await user.click(await screen.findByRole("option", { name: "Nama" }));
    expect(screen.getByText("[Nama:]")).toBeInTheDocument();

    await user.keyboard("{Backspace}");
    expect(screen.queryByText("[Nama:]")).not.toBeInTheDocument();
    expect(props.onTreeChange).not.toHaveBeenCalled();
    expect(screen.getByText("Status: Draft")).toBeInTheDocument();
  });
});

describe("SearchBar — saran Nilai & merge", () => {
  beforeEach(() => {
    axiosGet.mockReset();
    axiosGet.mockResolvedValue({ data: { data: [] } });
  });

  it("saran Nilai menambah leaf = dengan label ber-prefix ('Status: Selesai')", async () => {
    const user = userEvent.setup({ delay: null });
    const { props, input } = renderBar();

    await typeInto(user, input, "Selesai");
    const option = await screen.findByRole("option", {
      name: "Status: Selesai",
    });
    // prefix polos, hanya bagian opsi yang di-mark.
    expect(option.querySelector("mark")).toHaveTextContent("Selesai");
    expect(option).toHaveTextContent("Status: Selesai");
    await user.click(option);

    await waitFor(() => expect(props.onTreeChange).toHaveBeenCalledTimes(1));
    const [leaf] = Object.values(props.onTreeChange.mock.calls[0][0].root.c);
    expect(leaf).toEqual({ k: "status", o: "=", v: "completed" });
  });

  it("kolom yang sama sudah punya leaf = -> digabung jadi satu leaf in (nilai unik)", async () => {
    const user = userEvent.setup({ delay: null });
    const { props, input } = renderBar({ tree: statusDraftTree });

    await typeInto(user, input, "Selesai");
    await user.click(
      await screen.findByRole("option", { name: "Status: Selesai" }),
    );

    await waitFor(() => expect(props.onTreeChange).toHaveBeenCalledTimes(1));
    const tree = props.onTreeChange.mock.calls[0][0];
    expect(tree.root.c).toEqual({
      a: { k: "status", o: "in", v: ["draft", "completed"] },
    });
  });
});

describe("SearchBar — chip", () => {
  beforeEach(() => {
    axiosGet.mockReset();
    axiosGet.mockResolvedValue({ data: { data: [] } });
  });

  const twoLeafTree = {
    root: {
      k: "and",
      c: {
        a: { k: "status", o: "=", v: "draft" },
        b: { k: "name", o: "matches", v: "laptop" },
      },
    },
  };
  const laptopLabel = "Nama TR:core.datatable.filter.operator.matches laptop";

  it("menampilkan chip dari tree; × menghapus chip lewat onTreeChange", async () => {
    const user = userEvent.setup({ delay: null });
    const { props } = renderBar({ tree: twoLeafTree });

    expect(screen.getByText("Status: Draft")).toBeInTheDocument();
    expect(screen.getByText(laptopLabel)).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: /remove_chip.*Status: Draft/,
      }),
    );

    await waitFor(() => expect(props.onTreeChange).toHaveBeenCalledTimes(1));
    expect(props.onTreeChange.mock.calls[0][0].root.c).toEqual({
      b: twoLeafTree.root.c.b,
    });
  });

  it("menghapus chip terakhir menghasilkan onTreeChange(null)", async () => {
    const user = userEvent.setup({ delay: null });
    const { props } = renderBar({ tree: statusDraftTree });

    await user.click(
      screen.getByRole("button", { name: /remove_chip.*Status: Draft/ }),
    );

    await waitFor(() => expect(props.onTreeChange).toHaveBeenCalledWith(null));
  });

  it("Backspace di input kosong: pertama menyorot chip terakhir, kedua menghapusnya", async () => {
    const user = userEvent.setup({ delay: null });
    const { props, input } = renderBar({ tree: twoLeafTree });
    await user.click(input);

    await user.keyboard("{Backspace}");
    const lastChip = screen.getByText(laptopLabel).closest("span");
    expect(lastChip).toHaveClass("ring-destructive");
    expect(props.onTreeChange).not.toHaveBeenCalled();

    await user.keyboard("{Backspace}");
    await waitFor(() => expect(props.onTreeChange).toHaveBeenCalledTimes(1));
    expect(props.onTreeChange.mock.calls[0][0].root.c).toEqual({
      a: twoLeafTree.root.c.a,
    });
  });

  it("Backspace ×2 pada chip group (bukan node tree) memanggil onGroupChange({column:null}), bukan onTreeChange", async () => {
    const user = userEvent.setup({ delay: null });
    const onGroupChange = vi.fn();
    const { props, input } = renderBar({
      tree: twoLeafTree,
      group: { column: "created_at", granularity: "month", range: null },
      groupOptions,
      onGroupChange,
    });
    await user.click(input);

    await user.keyboard("{Backspace}");
    expect(
      screen
        .getByText("≡ Dibuat › TR:core.datatable.granularity.month")
        .closest("span"),
    ).toHaveClass("ring-destructive");
    await user.keyboard("{Backspace}");

    expect(onGroupChange).toHaveBeenCalledWith({
      column: null,
      granularity: null,
      range: null,
    });
    expect(props.onTreeChange).not.toHaveBeenCalled();
  });

  it("tombol lain menghilangkan sorotan chip -- Backspace berikutnya tidak menghapus", async () => {
    const user = userEvent.setup({ delay: null });
    const { props, input } = renderBar({ tree: twoLeafTree });
    await user.click(input);

    await user.keyboard("{Backspace}");
    expect(screen.getByText(laptopLabel).closest("span")).toHaveClass(
      "ring-destructive",
    );

    await user.keyboard("x");
    expect(screen.getByText(laptopLabel).closest("span")).not.toHaveClass(
      "ring-destructive",
    );
    await user.keyboard("{Backspace}"); // menghapus "x" (input tidak kosong)
    expect(props.onTreeChange).not.toHaveBeenCalled();
  });

  it("klik chip leaf -> ChipEditor -> Terapkan memperbarui tree (updateChip)", async () => {
    const user = userEvent.setup({ delay: null });
    const { props } = renderBar({ tree: twoLeafTree });

    await user.click(screen.getByText(laptopLabel));

    const field = await screen.findByTestId("value-field");
    expect(field).toHaveAttribute("data-column", "name");
    expect(field).toHaveAttribute("data-operator", "matches");
    expect(field).toHaveAttribute("data-value", '"laptop"');
    expect(screen.getByTestId("operator-select")).toHaveValue("matches");

    await user.click(screen.getByText("set-value"));
    await user.click(
      screen.getByRole("button", { name: "TR:core.datatable.search.apply" }),
    );

    await waitFor(() => expect(props.onTreeChange).toHaveBeenCalledTimes(1));
    expect(props.onTreeChange.mock.calls[0][0].root.c).toEqual({
      a: twoLeafTree.root.c.a,
      b: { k: "name", o: "matches", v: "dari-stub" },
    });
    // editor menutup setelah sukses
    await waitFor(() =>
      expect(screen.queryByTestId("value-field")).not.toBeInTheDocument(),
    );
  });

  it("chip Cari: label + klik membuka editor teks; Terapkan mengganti v semua anak grup", async () => {
    const user = userEvent.setup({ delay: null });
    const searchTree = {
      root: {
        k: "and",
        c: {
          g: {
            k: "or",
            c: {
              s1: { k: "code", o: "matches", v: "PT A" },
              s2: { k: "name", o: "matches", v: "PT A" },
            },
          },
        },
      },
    };
    const { props } = renderBar({ tree: searchTree });

    await user.click(
      screen.getByText('TR:core.datatable.search.search_chip:{"text":"PT A"}'),
    );

    expect(
      await screen.findByText(
        'TR:core.datatable.search.searching_in:{"columns":"Kode, Nama"}',
      ),
    ).toBeInTheDocument();
    const editorInput = screen.getByDisplayValue("PT A");
    await user.clear(editorInput);
    await user.type(editorInput, "PT Baru");
    await user.click(
      screen.getByRole("button", { name: "TR:core.datatable.search.apply" }),
    );

    await waitFor(() => expect(props.onTreeChange).toHaveBeenCalledTimes(1));
    const [group] = Object.values(props.onTreeChange.mock.calls[0][0].root.c);
    expect(Object.values(group.c).map((l) => l.v)).toEqual([
      "PT Baru",
      "PT Baru",
    ]);
  });

  it("chip advanced: klik memanggil onOpenBuilder", async () => {
    const user = userEvent.setup({ delay: null });
    const advancedTree = {
      root: {
        k: "and",
        c: {
          g: {
            k: "or",
            c: {
              x: { k: "status", o: "=", v: "draft" },
              y: { k: "name", o: "matches", v: "a" },
            },
          },
        },
      },
    };
    const onOpenBuilder = vi.fn();
    renderBar({ tree: advancedTree, onOpenBuilder });

    await user.click(
      screen.getByText('TR:core.datatable.search.advanced_chip:{"count":2}'),
    );

    expect(onOpenBuilder).toHaveBeenCalledTimes(1);
  });
});

describe("SearchBar — Group by (chip & saran)", () => {
  beforeEach(() => {
    axiosGet.mockReset();
    axiosGet.mockResolvedValue({ data: { data: [] } });
  });

  it("group aktif tampil sebagai chip '≡ Kolom › Granularity'; × memanggil onGroupChange({column:null})", async () => {
    const user = userEvent.setup({ delay: null });
    const onGroupChange = vi.fn();
    renderBar({
      group: { column: "created_at", granularity: "month", range: null },
      groupOptions,
      onGroupChange,
    });

    expect(
      screen.getByText("≡ Dibuat › TR:core.datatable.granularity.month"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /remove_chip.*Dibuat/ }));

    expect(onGroupChange).toHaveBeenCalledWith({
      column: null,
      granularity: null,
      range: null,
    });
  });

  it("chip group kolom number menampilkan range; klik membuka editor group + granularity", async () => {
    const user = userEvent.setup({ delay: null });
    const onGroupChange = vi.fn();
    const { rerenderWith } = renderBar({
      group: { column: "total", granularity: null, range: 100 },
      groupOptions,
      onGroupChange,
    });
    expect(screen.getByText("≡ Total › 100")).toBeInTheDocument();

    rerenderWith({
      group: { column: "created_at", granularity: "month", range: null },
    });
    await user.click(
      screen.getByText("≡ Dibuat › TR:core.datatable.granularity.month"),
    );
    await user.click(
      await screen.findByRole("button", {
        name: "TR:core.datatable.granularity.year",
      }),
    );

    expect(onGroupChange).toHaveBeenCalledWith({
      column: "created_at",
      granularity: "year",
      range: null,
    });
  });

  it("saran Kelompokkan memanggil onGroupChange dgn default (date -> month, number -> range pertama)", async () => {
    const user = userEvent.setup({ delay: null });
    const onGroupChange = vi.fn();
    const { input } = renderBar({ groupOptions, onGroupChange });

    await typeInto(user, input, "Dibuat");
    await user.click(await screen.findByRole("option", { name: /group_by_label/ }));
    expect(onGroupChange).toHaveBeenLastCalledWith({
      column: "created_at",
      granularity: "month",
      range: null,
    });

    await user.type(input, "Total");
    await user.click(await screen.findByRole("option", { name: /group_by_label/ }));
    expect(onGroupChange).toHaveBeenLastCalledWith({
      column: "total",
      granularity: null,
      range: 10,
    });
  });

  it("tanpa groupOptions seksi Kelompokkan tidak ada", async () => {
    const user = userEvent.setup({ delay: null });
    const { input } = renderBar();

    await typeInto(user, input, "Dibuat");
    await screen.findByRole("option", { name: "Dibuat" });

    expect(
      screen.queryByRole("option", { name: /group_by_label/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("TR:core.datatable.search.section.group"),
    ).not.toBeInTheDocument();
  });
});

describe("SearchBar — Filter Tersimpan", () => {
  beforeEach(() => {
    axiosGet.mockReset();
    axiosDelete.mockReset();
    axiosGet.mockResolvedValue({ data: { data: [savedA, savedB] } });
  });

  it("fetch saved-filters.index LAZY saat fokus pertama (1x), bukan saat mount tanpa activeFid", async () => {
    const user = userEvent.setup({ delay: null });
    const { input } = renderBar({ model: "AppModelsItem" });

    expect(axiosGet).not.toHaveBeenCalled();

    await user.click(input);
    await waitFor(() => expect(axiosGet).toHaveBeenCalledTimes(1));
    expect(axiosGet).toHaveBeenCalledWith("saved-filters.index", {
      params: { model: "AppModelsItem" },
    });

    // fokus ulang tidak fetch lagi (di-cache).
    await user.click(document.body);
    await user.click(input);
    expect(axiosGet).toHaveBeenCalledTimes(1);
  });

  it("dengan activeFid di-fetch saat mount", async () => {
    renderBar({ model: "AppModelsItem", activeFid: 99 });

    await waitFor(() => expect(axiosGet).toHaveBeenCalledTimes(1));
  });

  it("tanpa model: tidak pernah fetch dan tidak ada seksi Filter Tersimpan", async () => {
    const user = userEvent.setup({ delay: null });
    const { input } = renderBar({ activeFid: 1 });

    await typeInto(user, input, "PO");
    await screen.findByRole("option", { name: /search_all/ });

    expect(axiosGet).not.toHaveBeenCalled();
    expect(
      screen.queryByText("TR:core.datatable.search.section.saved"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("PO Bulan Ini")).not.toBeInTheDocument();
  });

  it("respons berupa array langsung juga didukung", async () => {
    const user = userEvent.setup({ delay: null });
    axiosGet.mockResolvedValue({ data: [savedA] });
    const { input } = renderBar({ model: "AppModelsItem" });

    await typeInto(user, input, "PO");

    expect(
      await screen.findByRole("option", { name: "PO Bulan Ini" }),
    ).toBeInTheDocument();
  });

  it("fetch gagal -> daftar kosong tanpa error; saran lain tetap jalan", async () => {
    const user = userEvent.setup({ delay: null });
    axiosGet.mockRejectedValue(new Error("500"));
    const { input } = renderBar({ model: "AppModelsItem" });

    await typeInto(user, input, "Nama");
    await waitFor(() => expect(axiosGet).toHaveBeenCalledTimes(1));

    expect(
      await screen.findByRole("option", { name: "Nama" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("TR:core.datatable.search.section.saved"),
    ).not.toBeInTheDocument();
  });

  it("pilih saran Filter Tersimpan -> onPickSaved(saved) + chip sumber", async () => {
    const user = userEvent.setup({ delay: null });
    const onPickSaved = vi.fn();
    const { input } = renderBar({ model: "AppModelsItem", onPickSaved });

    await typeInto(user, input, "PO");
    await user.click(await screen.findByRole("option", { name: "PO Bulan Ini" }));

    expect(onPickSaved).toHaveBeenCalledWith(savedA);
    expect(await screen.findByText("PO Bulan Ini")).toBeInTheDocument();
    expect(input).toHaveValue("");
  });

  it("chip sumber dideteksi dari activeFid (nama dari index) dan TIDAK dirty saat tree sama", async () => {
    renderBar({
      model: "AppModelsItem",
      activeFid: 1,
      tree: statusDraftTree,
      getViewSnapshot: () => ({ sort: null, group: null }),
    });

    expect(await screen.findByText("PO Bulan Ini")).toBeInTheDocument();
    expect(
      screen.queryByRole("img", {
        name: "TR:core.datatable.filter.saved.dirty",
      }),
    ).not.toBeInTheDocument();
  });

  it("titik dirty muncul saat tree berbeda dari sumber", async () => {
    const { rerenderWith } = renderBar({
      model: "AppModelsItem",
      activeFid: 1,
      tree: statusDraftTree,
    });
    await screen.findByText("PO Bulan Ini");

    rerenderWith({
      tree: {
        root: { k: "and", c: { a: { k: "status", o: "=", v: "completed" } } },
      },
    });

    expect(
      await screen.findByRole("img", {
        name: "TR:core.datatable.filter.saved.dirty",
      }),
    ).toBeInTheDocument();
  });

  it("titik dirty muncul saat sort/group aktif berbeda dari yang tersimpan di sumber", async () => {
    axiosGet.mockResolvedValue({
      data: {
        data: [
          {
            ...savedA,
            sort: "-created_at",
            group: { column: "created_at", granularity: "month", range: null },
          },
        ],
      },
    });
    const same = () => ({
      sort: "-created_at",
      group: { column: "created_at", granularity: "month", range: null },
    });
    const { rerenderWith } = renderBar({
      model: "AppModelsItem",
      activeFid: 1,
      tree: statusDraftTree,
      getViewSnapshot: same,
    });
    await screen.findByText("PO Bulan Ini");
    const dirtyDot = () =>
      screen.queryByRole("img", { name: "TR:core.datatable.filter.saved.dirty" });
    expect(dirtyDot()).not.toBeInTheDocument();

    // sort berbeda -> dirty
    rerenderWith({
      getViewSnapshot: () => ({ sort: "-total", group: same().group }),
    });
    await waitFor(() => expect(dirtyDot()).toBeInTheDocument());

    // kembali sama -> tidak dirty; group berbeda (granularity) -> dirty
    rerenderWith({ getViewSnapshot: same });
    await waitFor(() => expect(dirtyDot()).not.toBeInTheDocument());
    rerenderWith({
      getViewSnapshot: () => ({
        sort: "-created_at",
        group: { column: "created_at", granularity: "year", range: null },
      }),
    });
    await waitFor(() => expect(dirtyDot()).toBeInTheDocument());
  });

  it("null di sumber (sort/group) berarti 'tidak mengatur' -- tidak pernah membuat dirty", async () => {
    renderBar({
      model: "AppModelsItem",
      activeFid: 1,
      tree: statusDraftTree,
      // sumber: sort null & group null -> snapshot apa pun tidak dirty.
      getViewSnapshot: () => ({
        sort: "-total",
        group: { column: "total", granularity: null, range: 100 },
      }),
    });

    await screen.findByText("PO Bulan Ini");
    expect(
      screen.queryByRole("img", {
        name: "TR:core.datatable.filter.saved.dirty",
      }),
    ).not.toBeInTheDocument();
  });

  it("klik × pada chip sumber memanggil onTreeChange(null) dan melepas sumber", async () => {
    const user = userEvent.setup({ delay: null });
    const { props } = renderBar({
      model: "AppModelsItem",
      activeFid: 1,
      tree: statusDraftTree,
    });
    await screen.findByText("PO Bulan Ini");

    await user.click(
      screen.getByRole("button", { name: /remove_chip.*PO Bulan Ini/ }),
    );

    await waitFor(() => expect(props.onTreeChange).toHaveBeenCalledWith(null));
    await waitFor(() =>
      expect(screen.queryByText("PO Bulan Ini")).not.toBeInTheDocument(),
    );
  });
});

describe("SearchBar — Panel ▾", () => {
  beforeEach(() => {
    axiosGet.mockReset();
    axiosDelete.mockReset();
    axiosGet.mockResolvedValue({ data: { data: [savedA, savedB] } });
    axiosDelete.mockResolvedValue({});
  });

  const openPanel = async (user) => {
    await user.click(
      screen.getByRole("button", {
        name: "TR:core.datatable.search.open_panel",
      }),
    );
    return screen.findByRole("dialog");
  };

  it("membuka Panel memicu fetch daftar walau input belum pernah difokus", async () => {
    const user = userEvent.setup({ delay: null });
    renderBar({ model: "AppModelsItem", tree: statusDraftTree });
    expect(axiosGet).not.toHaveBeenCalled();

    const panel = await openPanel(user);

    expect(await within(panel).findByText("Draft saya")).toBeInTheDocument();
    expect(within(panel).getByText("PO Bulan Ini")).toBeInTheDocument();
    expect(axiosGet).toHaveBeenCalledTimes(1);
  });

  it("hapus item non-shared memanggil axios.delete dan membuang dari daftar", async () => {
    const user = userEvent.setup({ delay: null });
    const { props } = renderBar({ model: "AppModelsItem", tree: statusDraftTree });
    const panel = await openPanel(user);
    await within(panel).findByText("Draft saya");

    // hanya item non-shared yang punya tombol hapus.
    const deleteButtons = within(panel).getAllByTitle(
      "TR:core.datatable.filter.delete.label",
    );
    expect(deleteButtons).toHaveLength(1);
    await user.click(deleteButtons[0]);

    await waitFor(() =>
      expect(axiosDelete).toHaveBeenCalledWith(
        'saved-filters.destroy/{"savedFilter":2}',
      ),
    );
    await waitFor(() =>
      expect(within(panel).queryByText("Draft saya")).not.toBeInTheDocument(),
    );
    // bukan filter aktif -> tree tidak disentuh.
    expect(props.onTreeChange).not.toHaveBeenCalled();
  });

  it("menghapus filter yang sedang aktif (activeFid) juga onTreeChange(null) dan melepas chip sumber", async () => {
    const user = userEvent.setup({ delay: null });
    const { props } = renderBar({
      model: "AppModelsItem",
      activeFid: 2,
      tree: statusDraftTree,
    });
    // chip sumber terdeteksi (nama dari index)
    const chipName = await screen.findByText("Draft saya");
    expect(chipName).toBeInTheDocument();

    const panel = await openPanel(user);
    await user.click(
      within(panel).getByTitle("TR:core.datatable.filter.delete.label"),
    );

    await waitFor(() => expect(props.onTreeChange).toHaveBeenCalledWith(null));
    await waitFor(() =>
      expect(screen.queryByText("Draft saya")).not.toBeInTheDocument(),
    );
  });

  it("memilih item di Panel memanggil onPickSaved dan menutup Panel", async () => {
    const user = userEvent.setup({ delay: null });
    const onPickSaved = vi.fn();
    renderBar({ model: "AppModelsItem", onPickSaved });
    const panel = await openPanel(user);

    await user.click(await within(panel).findByText("PO Bulan Ini"));

    expect(onPickSaved).toHaveBeenCalledWith(savedA);
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("Builder lanjutan memanggil onOpenBuilder dan menutup Panel", async () => {
    const user = userEvent.setup({ delay: null });
    const onOpenBuilder = vi.fn();
    renderBar({ model: "AppModelsItem", onOpenBuilder });
    const panel = await openPanel(user);

    await user.click(
      within(panel).getByRole("button", {
        name: "TR:core.datatable.search.advanced_builder",
      }),
    );

    expect(onOpenBuilder).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("Hapus semua filter: hanya bila tree tidak kosong; memanggil onTreeChange(null)", async () => {
    const user = userEvent.setup({ delay: null });
    const { props, unmount } = renderBar({ tree: null });
    let panel = await openPanel(user);
    expect(
      within(panel).queryByRole("button", {
        name: "TR:core.datatable.search.clear_all",
      }),
    ).not.toBeInTheDocument();
    unmount();

    const next = renderBar({ tree: statusDraftTree });
    panel = await openPanel(user);
    await user.click(
      within(panel).getByRole("button", {
        name: "TR:core.datatable.search.clear_all",
      }),
    );

    await waitFor(() =>
      expect(next.props.onTreeChange).toHaveBeenCalledWith(null),
    );
    expect(props.onTreeChange).not.toHaveBeenCalled();
  });

  it("tanpa model: Panel tanpa judul/daftar Filter Tersimpan (aksi Builder tetap ada)", async () => {
    const user = userEvent.setup({ delay: null });
    renderBar({});
    const panel = await openPanel(user);

    expect(
      within(panel).queryByText("TR:core.datatable.search.section.saved"),
    ).not.toBeInTheDocument();
    expect(
      within(panel).getByRole("button", {
        name: "TR:core.datatable.search.advanced_builder",
      }),
    ).toBeInTheDocument();
    expect(axiosGet).not.toHaveBeenCalled();
  });

  it("kolom Group by di Panel hanya ada bila groupOptions diberikan; pilih kolom memanggil onGroupChange", async () => {
    const user = userEvent.setup({ delay: null });
    const onGroupChange = vi.fn();
    renderBar({ groupOptions, onGroupChange });
    const panel = await openPanel(user);

    expect(
      within(panel).getByText("TR:core.datatable.group_by"),
    ).toBeInTheDocument();
    await user.click(within(panel).getByText("Dibuat"));

    expect(onGroupChange).toHaveBeenCalledWith({
      column: "created_at",
      granularity: "month",
      range: null,
    });
  });
});

describe("SearchBar — busy state & error (Requirement 15)", () => {
  beforeEach(() => {
    axiosGet.mockReset();
    axiosGet.mockResolvedValue({ data: { data: [] } });
  });

  it("Promise onTreeChange pending -> spinner + commit kedua ditolak; selesai -> spinner hilang & input dikosongkan", async () => {
    const user = userEvent.setup({ delay: null });
    let resolveCommit;
    const onTreeChange = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveCommit = resolve;
        }),
    );
    const { input } = renderBar({ onTreeChange });

    await typeInto(user, input, "PT A");
    await screen.findByRole("option", { name: /search_all/ });
    await user.keyboard("{Enter}");

    expect(
      await screen.findByRole("status", {
        name: "TR:core.datatable.search.applying",
      }),
    ).toBeInTheDocument();
    expect(onTreeChange).toHaveBeenCalledTimes(1);

    // commit kedua saat pending ditolak (Enter lagi tidak memanggil host).
    await user.keyboard("{Enter}");
    expect(onTreeChange).toHaveBeenCalledTimes(1);
    expect(input).toHaveValue("PT A");

    await act(async () => {
      resolveCommit();
    });
    await waitFor(() =>
      expect(screen.queryByRole("status")).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(input).toHaveValue(""));
  });

  it("commit lain (hapus chip) juga ditolak selama Promise pending", async () => {
    const user = userEvent.setup({ delay: null });
    let resolveCommit;
    const onTreeChange = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveCommit = resolve;
        }),
    );
    renderBar({ onTreeChange, tree: statusDraftTree });
    const removeButton = () =>
      screen.getByRole("button", { name: /remove_chip.*Status: Draft/ });

    await user.click(removeButton());
    await screen.findByRole("status");
    await user.click(removeButton());

    expect(onTreeChange).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveCommit();
    });
    await waitFor(() =>
      expect(screen.queryByRole("status")).not.toBeInTheDocument(),
    );
  });

  it("Promise ditolak -> teks ketikan TIDAK dikosongkan, spinner hilang", async () => {
    const user = userEvent.setup({ delay: null });
    const onTreeChange = vi.fn(() => Promise.reject(new Error("gagal")));
    const { input } = renderBar({ onTreeChange });

    await typeInto(user, input, "PT A");
    await screen.findByRole("option", { name: /search_all/ });
    await user.keyboard("{Enter}");

    await waitFor(() => expect(onTreeChange).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.queryByRole("status")).not.toBeInTheDocument(),
    );
    expect(input).toHaveValue("PT A");

    // setelah gagal, commit baru boleh lagi.
    await user.keyboard("{Enter}");
    await waitFor(() => expect(onTreeChange).toHaveBeenCalledTimes(2));
  });
});
