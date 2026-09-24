import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
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

// GroupPicker (ChipEditor.jsx, dipakai per-chip editor "group" & Panel kolom
// Group) hanya butuh 2 konstanta ini -- Table2.jsx menarik graf modul berat
// (dnd-kit, inertia, css) yang tidak relevan di sini.
vi.mock("@/Components/Table/Table2", () => ({
  DATE_GROUP_GRANULARITIES: ["day", "month", "quarter", "half", "year"],
  DEFAULT_NUMBER_GROUP_RANGE_OPTIONS: [10, 100, 1000],
}));

// SaveFilterControl asli (dropdown simpan/timpa + axios) sudah punya test
// sendiri di FilterTable2.rtl.test.jsx.
vi.mock("../Filter/FilterTable2", () => ({
  SaveFilterControl: () => <div data-testid="save-control" />,
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
  customer: {
    name: "customer",
    title: "Customer",
    type: "relation",
    related: "App\\Models\\Sales\\Customer",
    columns: {
      "customer.name": { name: "customer.name", type: "string", title: "Nama" },
    },
  },
  // Relasi BELUM ter-hydrate -- bentuk PERSIS yg dikirim backend
  // (`getColumns()` selalu `columns: []` utk tipe relation, verified via
  // tinker). Anak-anaknya di-fetch LAZY oleh SearchBar saat kolom ini
  // benar-benar dipilih (`ensureRelationHydrated`, pola sama dgn
  // FilterItem2.fetchRelationColumns).
  category: {
    name: "category",
    title: "Kategori",
    type: "relation",
    related: "App\\Models\\Inventory\\Category",
    columns: {},
  },
  // Relasi TANPA anak string yg bisa dicari sekalipun sudah di-fetch --
  // simulasikan related model yg semua kolomnya non-string (id/angka).
  emptyRelation: {
    name: "emptyRelation",
    title: "Kosongan",
    type: "relation",
    related: "App\\Models\\Core\\EmptyThing",
    columns: {},
  },
  // Judul BELUM diterjemahkan (titleTrans tanpa entri lang) -- tetap HARUS
  // muncul di saran/Panel Kolom, paritas dgn FilterItem2 (regresi nyata:
  // asset_category_id/id/type pada Item hilang dari daftar Kolom Search Bar
  // padahal tetap ada di Filter lanjutan; columnSearch.js).
  untranslated: {
    name: "untranslated",
    type: "string",
    titleTrans: "inventory.item.columns.untranslated",
  },
  // Tipe tak didukung (time) -- tak boleh ditawarkan sbg pencarian kolom.
  meetingTime: { name: "meetingTime", title: "Jam", type: "time" },
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

/**
 * Fokus input lalu ketik teks (mode key/value, tergantung state SearchBar).
 * @param user
 * @param input
 * @param text
 */
const typeInto = async (user, input, text) => {
  await user.click(input);
  await user.type(input, text);
};

// Mock `t` di file ini (dipakai buat membangun string expected yg IDENTIK
// dgn label chip/saran hasil render, tanpa hardcode).
const mockT = (key, params) =>
  params ? `TR:${key}:${JSON.stringify(params)}` : `TR:${key}`;

// Saran & chip yg lewat `highlightMatch` bisa PECAH jadi beberapa text node
// (mark + teks sisa) di dalam SATU <span> pembungkus -- RTL `getByText`
// default (`getNodeText`) HANYA membaca text node LANGSUNG (bukan
// `element.textContent` rekursif), jadi tak pernah cocok dgn string utuh utk
// label yg SEBAGIAN di-mark. Matcher ini cek `element.textContent` (rekursif)
// pada elemen <span> pembungkusnya secara eksplisit.
const findByFullText = (text) =>
  screen.findByText(
    (_content, el) => el?.tagName === "SPAN" && el.textContent === text,
  );

/**
 * Klik saran kolom di seksi "Kolom" secara TERSKOP ke CommandGroup-nya --
 * seksi "text bebas" (Cari "<ketikan>" di semua kolom) BISA jg mengandung
 * <mark> dgn teks match yg SAMA (echo dari `inputValue` di dalam label,
 * bahkan di JSON param mock `t`), jadi `getByText(label)` polos ambigu.
 * @param user
 * @param label
 */
const pickColumnSuggestion = async (user, label) => {
  const heading = await screen.findByText(
    "TR:core.datatable.search.section.column",
  );
  const group =
    heading.closest('[cmdk-group=""]') ?? heading.closest("[cmdk-group]");
  await user.click(within(group).getByText(label));
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

beforeEach(() => {
  axiosGet.mockReset().mockResolvedValue({ data: { data: [] } });
  axiosDelete.mockReset().mockResolvedValue({});
});

describe("SearchBar — kontrak host-agnostic & tata letak", () => {
  it("tidak memicu error 'tidak boleh memakai router/usePage' saat dirender & dipakai", async () => {
    const user = userEvent.setup({ delay: null });
    const { input } = renderBar();
    await typeInto(user, input, "abc");
    // Sampai di sini tanpa exception -- @inertiajs/react tak pernah disentuh.
    expect(input).toHaveValue("abc");
  });

  it("ikon filter, chip, input, dan tombol chevron berada dalam SATU border (bukan kotak terpisah)", () => {
    renderBar({ tree: statusDraftTree });
    const chevron = screen.getByRole("button", {
      name: "TR:core.datatable.search.open_panel",
    });
    const input = screen.getByPlaceholderText(PLACEHOLDER);
    const bar = chevron.closest(".border");
    expect(bar).not.toBeNull();
    // Input & chip (leaf "status") adalah keturunan wadah ber-border yang SAMA.
    expect(bar).toContainElement(input);
    expect(bar).toContainElement(screen.getByText(/Status: Draft/));
  });

  it("mengetik '/' di dalam input TIDAK memicu apa pun di luar (tak ada listener global)", async () => {
    const user = userEvent.setup({ delay: null });
    const { input } = renderBar();
    await typeInto(user, input, "/x");
    expect(input).toHaveValue("/x");
  });
});

describe("SearchBar — warna chip berdasarkan peran", () => {
  it("chip biasa (leaf) memakai warna secondary", () => {
    renderBar({ tree: statusDraftTree });
    const chip = screen.getByText(/Status: Draft/).closest("span");
    expect(chip.className).toContain("bg-secondary");
    expect(chip.className).toContain("text-secondary-foreground");
    expect(chip.className).not.toContain("bg-blue");
    expect(chip.className).not.toContain("amber");
  });

  it("chip group memakai warna biru", () => {
    renderBar({
      group: { column: "created_at", granularity: "month", range: null },
    });
    const chip = screen.getByText(/Dibuat/).closest("span");
    expect(chip.className).toContain("bg-blue-500/15");
    expect(chip.className).toContain("text-blue-700");
  });

  it("chip sumber (saved filter) SELALU emas, dirty atau tidak", async () => {
    axiosGet.mockResolvedValue({ data: { data: [savedA] } });
    const { input } = renderBar({
      model: "App\\Models\\Inventory\\Item",
      activeFid: 1,
    });
    await waitFor(() => expect(axiosGet).toHaveBeenCalled());
    const chip = await screen.findByText("PO Bulan Ini");
    // `chip` = <span className="truncate"> (pembungkus nama) -- warna ada di
    // <span> LUAR (pemegang tombol Bookmark+nama+X), naik via elemen <button>.
    expect(chip.closest("button").closest("span").className).toContain(
      "bg-amber-500/15",
    );
    expect(input).toBeTruthy();
  });
});

describe("SearchBar — Panel muncul saat fokus & chevron (Requirement revisi 2)", () => {
  it("fokus dgn input kosong langsung menampilkan Panel (bukan cuma via chevron)", async () => {
    const user = userEvent.setup({ delay: null });
    const { input } = renderBar({ model: "App\\Models\\Inventory\\Item" });

    await user.click(input);

    expect(
      await screen.findByText("TR:core.datatable.filter.filter"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("TR:core.datatable.search.section.column"),
    ).toBeInTheDocument();
  });

  it("klik chevron menampilkan Panel walau input sedang terisi teks", async () => {
    const user = userEvent.setup({ delay: null });
    const { input } = renderBar();
    await typeInto(user, input, "abc");
    expect(
      screen.queryByText("TR:core.datatable.filter.filter"),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "TR:core.datatable.search.open_panel",
      }),
    );

    expect(
      await screen.findByText("TR:core.datatable.filter.filter"),
    ).toBeInTheDocument();
    // Suplemen teks masih ada di input (chevron tidak membuangnya).
    expect(input).toHaveValue("abc");
  });

  it("mengetik SETELAH Panel dipaksa terbuka via chevron kembali ke saran", async () => {
    const user = userEvent.setup({ delay: null });
    const { input } = renderBar();
    await user.click(
      screen.getByRole("button", {
        name: "TR:core.datatable.search.open_panel",
      }),
    );
    expect(
      await screen.findByText("TR:core.datatable.filter.filter"),
    ).toBeInTheDocument();

    await user.type(input, "code");

    await waitFor(() =>
      expect(
        screen.queryByText("TR:core.datatable.filter.filter"),
      ).not.toBeInTheDocument(),
    );
  });

  it("klik-luar menutup dropdown (Panel maupun saran)", async () => {
    const user = userEvent.setup({ delay: null });
    const { input } = renderBar();
    await user.click(input);
    expect(
      await screen.findByText("TR:core.datatable.filter.filter"),
    ).toBeInTheDocument();

    await user.click(document.body);

    await waitFor(() =>
      expect(
        screen.queryByText("TR:core.datatable.filter.filter"),
      ).not.toBeInTheDocument(),
    );
  });
});

describe("SearchBar — teks bebas (Chip Cari)", () => {
  it("mengetik menampilkan saran 'Cari ... di semua kolom'; Enter -> onTreeChange grup OR matches", async () => {
    const user = userEvent.setup({ delay: null });
    const { input, props } = renderBar();

    await typeInto(user, input, "lap");
    expect(
      await findByFullText(
        mockT("core.datatable.search.search_all", { text: "lap" }),
      ),
    ).toBeInTheDocument();

    await user.keyboard("{Enter}");

    await waitFor(() => expect(props.onTreeChange).toHaveBeenCalledTimes(1));
    const tree = props.onTreeChange.mock.calls[0][0];
    const group = Object.values(tree.root.c)[0];
    expect(group.k).toBe("or");
    const leaves = Object.values(group.c);
    expect(leaves.map((l) => l.k).sort()).toEqual(["code", "name"]);
    expect(leaves.every((l) => l.o === "matches" && l.v === "lap")).toBe(true);
  });

  it("input dikosongkan setelah commit sukses", async () => {
    const user = userEvent.setup({ delay: null });
    const { input } = renderBar();
    await typeInto(user, input, "lap");
    await user.keyboard("{Enter}");
    await waitFor(() => expect(input).toHaveValue(""));
  });

  it("tanpa kolom pencarian (getSearchColumns kosong) -> tak ada saran teks bebas", async () => {
    const user = userEvent.setup({ delay: null });
    const { input } = renderBar({ getSearchColumns: () => [] });
    await typeInto(user, input, "lap");
    expect(
      screen.queryByText(
        (_content, el) =>
          el?.tagName === "SPAN" &&
          el.textContent ===
            mockT("core.datatable.search.search_all", { text: "lap" }),
      ),
    ).not.toBeInTheDocument();
  });
});

describe("SearchBar — pilih kolom (saran & Panel) masuk mode value TANPA dialog operator", () => {
  it("saran 'Kolom' string -> mode value; Enter -> leaf matches (bukan draft/dialog)", async () => {
    const user = userEvent.setup({ delay: null });
    const { input, props } = renderBar();

    await typeInto(user, input, "Kode");
    await pickColumnSuggestion(user, "Kode");

    expect(screen.getByText("[Kode:]")).toBeInTheDocument();
    // Tak ada pemilih operator apa pun yang dirender.
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(
      screen.queryByText("TR:core.datatable.filter.select_operator"),
    ).not.toBeInTheDocument();

    await user.type(input, "abc");
    await user.keyboard("{Enter}");

    await waitFor(() => expect(props.onTreeChange).toHaveBeenCalledTimes(1));
    const leaf = Object.values(props.onTreeChange.mock.calls[0][0].root.c)[0];
    expect(leaf).toEqual({ k: "code", o: "matches", v: "abc" });
  });

  it("klik kolom di kolom 'Kolom' Panel juga masuk mode value yang sama", async () => {
    const user = userEvent.setup({ delay: null });
    const { input } = renderBar();
    await user.click(input); // Panel (input kosong).
    const columnSection = (
      await screen.findByText("TR:core.datatable.search.section.column")
    ).closest("section");

    await user.click(within(columnSection).getByText("Kode"));

    expect(screen.getByText("[Kode:]")).toBeInTheDocument();
  });

  it("kolom number -> Enter membuat leaf '='; teks non-numerik menampilkan error & tak commit", async () => {
    const user = userEvent.setup({ delay: null });
    const { input, props } = renderBar();
    await typeInto(user, input, "Total");
    await pickColumnSuggestion(user, "Total");

    await user.type(input, "abc");
    await user.keyboard("{Enter}");
    expect(
      screen.getByText("TR:core.datatable.search.number_invalid"),
    ).toBeInTheDocument();
    expect(props.onTreeChange).not.toHaveBeenCalled();

    await user.clear(input);
    await user.type(input, "1500");
    await user.keyboard("{Enter}");
    await waitFor(() => expect(props.onTreeChange).toHaveBeenCalledTimes(1));
    expect(
      Object.values(props.onTreeChange.mock.calls[0][0].root.c)[0],
    ).toEqual({
      k: "total",
      o: "=",
      v: 1500,
    });
  });

  it("kolom ber-opsi -> daftar nilai inline; klik opsi commit '=' langsung", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await typeInto(user, bar.input, "Status");
    await pickColumnSuggestion(user, "Status");

    expect(await screen.findByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("Selesai")).toBeInTheDocument();
    await user.click(screen.getByText("Draft"));

    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    expect(
      Object.values(bar.props.onTreeChange.mock.calls[0][0].root.c)[0],
    ).toEqual({
      k: "status",
      o: "=",
      v: "draft",
    });
  });

  it("kolom boolean -> daftar Ya/Tidak, tanpa dialog", async () => {
    const user = userEvent.setup({ delay: null });
    const { input, props } = renderBar();
    await typeInto(user, input, "Aktif");
    await pickColumnSuggestion(user, "Aktif");

    await user.click(await screen.findByText("TR:core.datatable.yes"));

    await waitFor(() => expect(props.onTreeChange).toHaveBeenCalledTimes(1));
    expect(
      Object.values(props.onTreeChange.mock.calls[0][0].root.c)[0],
    ).toEqual({
      k: "active",
      o: "=",
      v: true,
    });
  });

  it("kolom tanggal -> preset periode inline (bukan DateSelector/dialog); klik preset -> in_period", async () => {
    const user = userEvent.setup({ delay: null });
    const { input, props } = renderBar();
    await typeInto(user, input, "Dibuat");
    await pickColumnSuggestion(user, "Dibuat");

    const preset = await screen.findByText(
      "TR:core.datatable.search.period.this_month",
    );
    await user.click(preset);

    await waitFor(() => expect(props.onTreeChange).toHaveBeenCalledTimes(1));
    const leaf = Object.values(props.onTreeChange.mock.calls[0][0].root.c)[0];
    expect(leaf.k).toBe("created_at");
    expect(leaf.o).toBe("in_period");
    expect(leaf.v.period).toBe("month");
    expect(leaf.v.operator).toBe("is");
  });

  it("kolom relasi -> diketik seperti teks, commit matches pada kolom anak (customer.name)", async () => {
    const user = userEvent.setup({ delay: null });
    const { input, props } = renderBar();
    await typeInto(user, input, "Customer");
    await pickColumnSuggestion(user, "Customer");

    expect(screen.getByText("[Customer:]")).toBeInTheDocument();
    await user.type(input, "PT A");
    await user.keyboard("{Enter}");

    await waitFor(() => expect(props.onTreeChange).toHaveBeenCalledTimes(1));
    expect(
      Object.values(props.onTreeChange.mock.calls[0][0].root.c)[0],
    ).toEqual({
      k: "customer.name",
      o: "matches",
      v: "PT A",
    });
  });

  it("kolom judul belum diterjemahkan TETAP muncul (paritas Filter lanjutan); tipe tak didukung tetap tak pernah muncul", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await user.click(bar.input); // Panel.
    const columnSection = (
      await screen.findByText("TR:core.datatable.search.section.column")
    ).closest("section");
    expect(
      within(columnSection).getByText("TR:inventory.item.columns.untranslated"),
    ).toBeInTheDocument();
    expect(within(columnSection).queryByText("Jam")).not.toBeInTheDocument();
  });
});

describe("SearchBar — hidrasi lazy kolom relasi (feedback verifikasi visual: kolom relasi hilang dari daftar Kolom)", () => {
  it("kolom relasi BELUM ter-hydrate tetap tampil di Panel & saran (bukan cuma yang anaknya sudah ter-populate)", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await user.click(bar.input); // Panel.
    const columnSection = (
      await screen.findByText("TR:core.datatable.search.section.column")
    ).closest("section");

    expect(within(columnSection).getByText("Kategori")).toBeInTheDocument();
  });

  it("memilih kolom relasi belum ter-hydrate -> fetch anak via model.columns, disable input saat memuat, lalu commit matches pada anak yang ditemukan", async () => {
    let resolveFetch;
    axiosGet.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );
    const user = userEvent.setup({ delay: null });
    const { input, props } = renderBar();

    await typeInto(user, input, "Kategori");
    await pickColumnSuggestion(user, "Kategori");

    expect(axiosGet).toHaveBeenCalledWith(
      "model.columns/" +
        JSON.stringify({ model: "App\\Models\\Inventory\\Category" }),
    );
    expect(screen.getByText("[Kategori:]")).toBeInTheDocument();
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute(
      "placeholder",
      "TR:core.datatable.search.loading_relation",
    );

    await act(async () => {
      resolveFetch({
        data: { columns: [{ name: "name", type: "string", title: "Nama" }] },
      });
      await Promise.resolve();
    });

    expect(input).not.toBeDisabled();
    await user.type(input, "Elektronik");
    await user.keyboard("{Enter}");

    await waitFor(() => expect(props.onTreeChange).toHaveBeenCalledTimes(1));
    expect(
      Object.values(props.onTreeChange.mock.calls[0][0].root.c)[0],
    ).toEqual({ k: "category.name", o: "matches", v: "Elektronik" });
  });

  it("memilih kolom relasi yang sama dua kali hanya fetch sekali (di-cache per sesi)", async () => {
    axiosGet.mockResolvedValue({
      data: { columns: [{ name: "name", type: "string", title: "Nama" }] },
    });
    const user = userEvent.setup({ delay: null });
    const { input } = renderBar();

    await typeInto(user, input, "Kategori");
    await pickColumnSuggestion(user, "Kategori");
    await waitFor(() => expect(input).not.toBeDisabled());
    await user.keyboard("{Escape}");

    await typeInto(user, input, "Kategori");
    await pickColumnSuggestion(user, "Kategori");
    await waitFor(() => expect(input).not.toBeDisabled());

    expect(axiosGet).toHaveBeenCalledTimes(1);
  });

  it("relasi tanpa anak string yang bisa dicari (walau sudah di-fetch) -> keluar dari mode value, bukan macet loading", async () => {
    axiosGet.mockResolvedValue({
      data: { columns: [{ name: "id", type: "number", title: "ID" }] },
    });
    const user = userEvent.setup({ delay: null });
    const { input } = renderBar();

    await typeInto(user, input, "Kosongan");
    await pickColumnSuggestion(user, "Kosongan");

    await waitFor(() =>
      expect(screen.queryByText("[Kosongan:]")).not.toBeInTheDocument(),
    );
    expect(input).toHaveValue("");
  });

  it("edit chip leaf pada anak relasi dotted yang BELUM ter-hydrate sesi ini (mis. dari saved filter) -> tetap bisa diedit sbg teks tanpa fetch", async () => {
    const dottedTree = {
      root: {
        k: "and",
        c: { a: { k: "category.name", o: "matches", v: "Elektronik" } },
      },
    };
    const user = userEvent.setup({ delay: null });
    const bar = renderBar({ tree: dottedTree });

    await user.click(
      screen.getByText(
        `Kategori › name ${mockT("core.datatable.filter.operator.matches")} Elektronik`,
      ),
    );

    expect(bar.input).toHaveValue("Elektronik");
    expect(axiosGet).not.toHaveBeenCalled();

    await user.clear(bar.input);
    await user.type(bar.input, "Furnitur");
    await user.keyboard("{Enter}");

    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    expect(
      Object.values(bar.props.onTreeChange.mock.calls[0][0].root.c)[0],
    ).toEqual({ k: "category.name", o: "matches", v: "Furnitur" });
  });

  it("chip leaf relasi BARE (k = nama relasi, v = record objek dari Builder lanjutan) -> fallback onOpenBuilder, bukan diedit sbg teks", async () => {
    const bareRelationTree = {
      root: {
        k: "and",
        c: { a: { k: "category", o: "=", v: { id: 3, name: "Elektronik" } } },
      },
    };
    const user = userEvent.setup({ delay: null });
    const onOpenBuilder = vi.fn();
    renderBar({ tree: bareRelationTree, onOpenBuilder });

    await user.click(screen.getByText(/Kategori/));

    expect(onOpenBuilder).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("[Kategori:]")).not.toBeInTheDocument();
  });
});

describe("SearchBar — merge nilai kolom sama menjadi 'in'", () => {
  it("pilih 2 opsi berbeda pada kolom sama -> satu leaf 'in'", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await typeInto(user, bar.input, "Status");
    await pickColumnSuggestion(user, "Status");
    await user.click(await screen.findByText("Draft"));
    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );

    const tree1 = bar.props.onTreeChange.mock.calls[0][0];
    bar.rerenderWith({ tree: tree1 });

    await typeInto(user, bar.input, "Status");
    await pickColumnSuggestion(user, "Status");
    await user.click(await screen.findByText("Selesai"));

    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(2),
    );
    const leaf = Object.values(
      bar.props.onTreeChange.mock.calls[1][0].root.c,
    )[0];
    expect(leaf).toEqual({ k: "status", o: "in", v: ["draft", "completed"] });
  });
});

describe("SearchBar — edit chip existing memakai widget nilai yang sama (tanpa editor operator)", () => {
  const leafTextTree = {
    root: { k: "and", c: { a: { k: "code", o: "matches", v: "abc" } } },
  };

  it("klik chip leaf teks -> mode value terisi nilai lama; Enter MEMPERBARUI node yang sama (bukan menambah)", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar({ tree: leafTextTree });

    await user.click(
      screen.getByText(
        `Kode ${mockT("core.datatable.filter.operator.matches")} abc`,
      ),
    );
    expect(screen.getByText("[Kode:]")).toBeInTheDocument();
    expect(bar.input).toHaveValue("abc");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();

    await user.clear(bar.input);
    await user.type(bar.input, "xyz");
    await user.keyboard("{Enter}");

    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    const tree = bar.props.onTreeChange.mock.calls[0][0];
    expect(Object.keys(tree.root.c)).toEqual(["a"]);
    expect(tree.root.c.a).toEqual({ k: "code", o: "matches", v: "xyz" });
  });

  it("klik chip leaf ber-opsi -> daftar nilai inline; pilih -> updateChip (id tetap)", async () => {
    const statusTree = {
      root: { k: "and", c: { x: { k: "status", o: "=", v: "draft" } } },
    };
    const user = userEvent.setup({ delay: null });
    const bar = renderBar({ tree: statusTree });

    await user.click(screen.getByText(/Status: Draft/));
    await user.click(await screen.findByText("Selesai"));

    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    const tree = bar.props.onTreeChange.mock.calls[0][0];
    expect(Object.keys(tree.root.c)).toEqual(["x"]);
    expect(tree.root.c.x).toEqual({ k: "status", o: "=", v: "completed" });
  });

  it("chip leaf pada kolom tak didukung (mis. sudah dihapus dari config) -> fallback onOpenBuilder", async () => {
    const ghostTree = {
      root: { k: "and", c: { a: { k: "ghost_col", o: "=", v: "x" } } },
    };
    const user = userEvent.setup({ delay: null });
    const onOpenBuilder = vi.fn();
    renderBar({ tree: ghostTree, onOpenBuilder });

    await user.click(screen.getByText(/ghost_col/));

    expect(onOpenBuilder).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("[")).not.toBeInTheDocument();
  });

  it("chip 'search' (Cari) tetap bisa diedit via popover teks kecil (bukan operator)", async () => {
    const searchTree = {
      root: {
        k: "and",
        c: {
          g: {
            k: "or",
            c: {
              a: { k: "code", o: "matches", v: "lap" },
              b: { k: "name", o: "matches", v: "lap" },
            },
          },
        },
      },
    };
    const user = userEvent.setup({ delay: null });
    const bar = renderBar({ tree: searchTree });

    await user.click(
      screen.getByText(
        mockT("core.datatable.search.search_chip", { text: "lap" }),
      ),
    );
    // Ada DUA textbox di layar (input utama Search Bar + input editor chip
    // "Cari" di popover) -- ambil yang bernilai "lap" (isi editor, bukan
    // input utama yg tetap kosong).
    const textbox = (await screen.findAllByRole("textbox")).find(
      (el) => el.value === "lap",
    );
    expect(textbox).toBeTruthy();
    await user.clear(textbox);
    await user.type(textbox, "top");
    await user.click(
      screen.getByRole("button", { name: "TR:core.datatable.search.apply" }),
    );

    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    const group = Object.values(
      bar.props.onTreeChange.mock.calls[0][0].root.c,
    )[0];
    expect(Object.values(group.c).every((l) => l.v === "top")).toBe(true);
  });

  it("chip 'advanced' (Filter lanjutan) membuka Builder, bukan editor bar", async () => {
    const advancedTree = {
      root: {
        k: "and",
        c: {
          g: {
            k: "or",
            c: {
              a: { k: "total", o: ">", v: 100 },
              b: { k: "code", o: "matches", v: "x" },
            },
          },
        },
      },
    };
    const user = userEvent.setup({ delay: null });
    const onOpenBuilder = vi.fn();
    renderBar({ tree: advancedTree, onOpenBuilder });

    await user.click(
      screen.getByText(
        mockT("core.datatable.search.advanced_chip", { count: 2 }),
      ),
    );

    expect(onOpenBuilder).toHaveBeenCalledTimes(1);
  });
});

describe("SearchBar — Group by (chip & saran)", () => {
  it("saran seksi Kelompokkan memanggil onGroupChange dgn default kolom", async () => {
    const user = userEvent.setup({ delay: null });
    const onGroupChange = vi.fn();
    const { input } = renderBar({ groupOptions, onGroupChange });

    await typeInto(user, input, "Dibuat");
    await user.click(
      await findByFullText(
        mockT("core.datatable.search.group_by_label", { column: "Dibuat" }),
      ),
    );

    expect(onGroupChange).toHaveBeenCalledWith({
      column: "created_at",
      granularity: "month",
      range: null,
    });
  });

  it("chip group menampilkan kolom + granularity; klik membuka editor granularity (GroupPicker)", async () => {
    const user = userEvent.setup({ delay: null });
    const onGroupChange = vi.fn();
    renderBar({
      groupOptions,
      onGroupChange,
      group: { column: "created_at", granularity: "month", range: null },
    });

    expect(screen.getByText(/Dibuat/)).toBeInTheDocument();
    await user.click(screen.getByText(/Dibuat.*month|Dibuat/));
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

  it("klik × pada chip group -> onGroupChange({column:null,...})", async () => {
    const user = userEvent.setup({ delay: null });
    const onGroupChange = vi.fn();
    renderBar({
      groupOptions,
      onGroupChange,
      group: { column: "created_at", granularity: "month", range: null },
    });

    await user.click(
      screen.getByRole("button", {
        name: 'TR:core.datatable.search.remove_chip:{"label":"≡ Dibuat › TR:core.datatable.granularity.month"}',
      }),
    );

    expect(onGroupChange).toHaveBeenCalledWith({
      column: null,
      granularity: null,
      range: null,
    });
  });

  it("tanpa groupOptions, seksi Kelompokkan & kolom Group Panel tidak ada", async () => {
    const user = userEvent.setup({ delay: null });
    const { input } = renderBar({ groupOptions: undefined });
    await user.click(input);
    expect(
      screen.queryByText("TR:core.datatable.group_by"),
    ).not.toBeInTheDocument();
  });
});

describe("SearchBar — Filter Tersimpan", () => {
  it("daftar di-fetch lazy saat fokus pertama (bukan saat mount)", () => {
    renderBar({ model: "App\\Models\\Inventory\\Item" });
    expect(axiosGet).not.toHaveBeenCalled();
  });

  it("fokus memicu fetch sekali; fokus berikutnya tak fetch ulang", async () => {
    const user = userEvent.setup({ delay: null });
    const { input } = renderBar({ model: "App\\Models\\Inventory\\Item" });
    await user.click(input);
    await user.click(document.body);
    await user.click(input);
    await waitFor(() => expect(axiosGet).toHaveBeenCalledTimes(1));
  });

  it("activeFid yg cocok di daftar -> chip sumber muncul dgn nama dari index (bukan show)", async () => {
    axiosGet.mockResolvedValue({ data: { data: [savedA] } });
    renderBar({ model: "App\\Models\\Inventory\\Item", activeFid: 1 });
    expect(await screen.findByText("PO Bulan Ini")).toBeInTheDocument();
  });

  it("saran 'Filter Tersimpan' memanggil onPickSaved & menampilkan chip sumber", async () => {
    axiosGet.mockResolvedValue({ data: { data: [savedA, savedB] } });
    const user = userEvent.setup({ delay: null });
    const onPickSaved = vi.fn();
    const { input } = renderBar({
      model: "App\\Models\\Inventory\\Item",
      onPickSaved,
    });
    await typeInto(user, input, "Draft");
    const item = await findByFullText("Draft saya");
    await user.click(item);

    expect(onPickSaved).toHaveBeenCalledWith(savedB);
    // Dropdown ditutup setelah memilih -- saran/panel tak lagi tampil.
    await waitFor(() =>
      expect(
        screen.queryByText("TR:core.datatable.search.section.saved"),
      ).not.toBeInTheDocument(),
    );
  });

  it("dirty: tree berbeda dari sumber -> titik dirty muncul; sort/group berbeda jg dirty", async () => {
    axiosGet.mockResolvedValue({ data: { data: [savedA] } });
    const bar = renderBar({
      model: "App\\Models\\Inventory\\Item",
      activeFid: 1,
      tree: statusDraftTree,
      getViewSnapshot: () => ({ sort: null, group: null }),
    });
    await screen.findByText("PO Bulan Ini");
    expect(
      screen.queryByLabelText("TR:core.datatable.filter.saved.dirty"),
    ).not.toBeInTheDocument();

    bar.rerenderWith({
      tree: { root: { k: "and", c: {} } },
      activeFid: 1,
      model: "App\\Models\\Inventory\\Item",
      getViewSnapshot: () => ({ sort: null, group: null }),
    });
    expect(
      await screen.findByLabelText("TR:core.datatable.filter.saved.dirty"),
    ).toBeInTheDocument();
  });

  it("null di sumber (sort/group) TIDAK PERNAH membuat dirty", async () => {
    axiosGet.mockResolvedValue({ data: { data: [savedA] } });
    renderBar({
      model: "App\\Models\\Inventory\\Item",
      activeFid: 1,
      tree: statusDraftTree,
      getViewSnapshot: () => ({ sort: "-created_at", group: { column: "x" } }),
    });
    await screen.findByText("PO Bulan Ini");
    expect(
      screen.queryByLabelText("TR:core.datatable.filter.saved.dirty"),
    ).not.toBeInTheDocument();
  });

  it("klik × pada chip sumber -> onTreeChange(null) & chip hilang", async () => {
    axiosGet.mockResolvedValue({ data: { data: [savedA] } });
    const user = userEvent.setup({ delay: null });
    const bar = renderBar({
      model: "App\\Models\\Inventory\\Item",
      activeFid: 1,
    });
    await screen.findByText("PO Bulan Ini");

    await user.click(
      screen.getByRole("button", {
        name: 'TR:core.datatable.search.remove_chip:{"label":"PO Bulan Ini"}',
      }),
    );

    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledWith(null),
    );
    expect(screen.queryByText("PO Bulan Ini")).not.toBeInTheDocument();
  });
});

describe("SearchBar — Panel (kolom Filter, Group, Kolom)", () => {
  it("hapus item non-shared di Panel memanggil axios.delete", async () => {
    axiosGet.mockResolvedValue({ data: { data: [savedA, savedB] } });
    const user = userEvent.setup({ delay: null });
    const { input } = renderBar({ model: "App\\Models\\Inventory\\Item" });
    await user.click(input);
    await screen.findByText("Draft saya");

    await user.click(
      screen.getAllByTitle("TR:core.datatable.filter.delete.label")[0],
    );

    await waitFor(() =>
      expect(axiosDelete).toHaveBeenCalledWith(
        'saved-filters.destroy/{"savedFilter":2}',
      ),
    );
  });

  it("Builder lanjutan menutup dropdown & memanggil onOpenBuilder", async () => {
    const user = userEvent.setup({ delay: null });
    const onOpenBuilder = vi.fn();
    const { input } = renderBar({ onOpenBuilder });
    await user.click(input);
    await screen.findByText("TR:core.datatable.filter.filter");

    await user.click(
      screen.getByRole("button", {
        name: "TR:core.datatable.search.advanced_builder",
      }),
    );

    expect(onOpenBuilder).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(
        screen.queryByText("TR:core.datatable.filter.filter"),
      ).not.toBeInTheDocument(),
    );
  });

  it("Hapus semua filter hanya muncul saat tree berisi & memanggil onTreeChange(null)", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar({ tree: statusDraftTree });
    await user.click(bar.input);
    await user.click(
      screen.getByRole("button", {
        name: "TR:core.datatable.search.clear_all",
      }),
    );
    expect(bar.props.onTreeChange).toHaveBeenCalledWith(null);
  });

  it("tanpa tree berisi, tombol Hapus semua filter tidak ada", async () => {
    const user = userEvent.setup({ delay: null });
    const { input } = renderBar({ tree: null });
    await user.click(input);
    await screen.findByText("TR:core.datatable.filter.filter");
    expect(
      screen.queryByRole("button", {
        name: "TR:core.datatable.search.clear_all",
      }),
    ).not.toBeInTheDocument();
  });

  it("tanpa `model`, kolom Filter Tersimpan (daftar+simpan) tidak aktif; Builder tetap ada", async () => {
    const user = userEvent.setup({ delay: null });
    const { input } = renderBar({ model: undefined });
    await user.click(input);
    await screen.findByText("TR:core.datatable.filter.filter");
    expect(screen.queryByTestId("save-control")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "TR:core.datatable.search.advanced_builder",
      }),
    ).toBeInTheDocument();
  });
});

describe("SearchBar — keyboard: Backspace hapus chip terakhir (2 tahap)", () => {
  const twoLeaf = {
    root: {
      k: "and",
      c: {
        a: { k: "code", o: "matches", v: "x" },
        b: { k: "name", o: "matches", v: "y" },
      },
    },
  };

  it("Backspace pertama menyorot, kedua menghapus chip TERAKHIR", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar({ tree: twoLeaf });

    await user.click(bar.input);
    await user.keyboard("{Backspace}");
    const lastChip = screen
      .getByText(`Nama ${mockT("core.datatable.filter.operator.matches")} y`)
      .closest("span");
    expect(lastChip.className).toContain("ring-2");
    expect(bar.props.onTreeChange).not.toHaveBeenCalled();

    await user.keyboard("{Backspace}");
    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    const tree = bar.props.onTreeChange.mock.calls[0][0];
    expect(Object.keys(tree.root.c)).toEqual(["a"]);
  });

  it("mengetik apa pun setelah disorot membatalkan sorotan (tak langsung terhapus)", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar({ tree: twoLeaf });
    await user.click(bar.input);
    await user.keyboard("{Backspace}");
    await user.type(bar.input, "z");
    expect(
      screen
        .getByText(`Nama ${mockT("core.datatable.filter.operator.matches")} y`)
        .closest("span").className,
    ).not.toContain("ring-2");
  });

  it("Backspace saat mode value keluar dari mode value dulu (tak langsung hapus chip)", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar({ tree: twoLeaf });
    await typeInto(user, bar.input, "Kode");
    await pickColumnSuggestion(user, "Kode");
    expect(screen.getByText("[Kode:]")).toBeInTheDocument();

    await user.keyboard("{Backspace}");

    expect(screen.queryByText("[Kode:]")).not.toBeInTheDocument();
    expect(bar.props.onTreeChange).not.toHaveBeenCalled();
  });
});

describe("SearchBar — busy state & error (Requirement 15)", () => {
  it("onTreeChange yg return Promise pending -> spinner tampil & commit kedua ditolak", async () => {
    let resolvePromise;
    const onTreeChange = vi.fn(
      () =>
        new Promise((resolve) => {
          resolvePromise = resolve;
        }),
    );
    const user = userEvent.setup({ delay: null });
    const { input } = renderBar({ onTreeChange });

    await typeInto(user, input, "lap");
    await user.keyboard("{Enter}");

    expect(await screen.findByRole("status")).toBeInTheDocument();
    expect(onTreeChange).toHaveBeenCalledTimes(1);

    // Commit kedua (mis. tambah "Cari" lain) ditolak selama busy.
    await typeInto(user, input, "top");
    await user.keyboard("{Enter}");
    expect(onTreeChange).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolvePromise();
      await Promise.resolve();
    });
    await waitFor(() =>
      expect(screen.queryByRole("status")).not.toBeInTheDocument(),
    );
  });

  it("onTreeChange gagal (reject) -> input TIDAK dikosongkan, chip tak berubah", async () => {
    const onTreeChange = vi.fn(() => Promise.reject(new Error("gagal")));
    const user = userEvent.setup({ delay: null });
    const { input } = renderBar({ onTreeChange, tree: null });

    await typeInto(user, input, "lap");
    await user.keyboard("{Enter}");

    await waitFor(() => expect(onTreeChange).toHaveBeenCalledTimes(1));
    expect(input).toHaveValue("lap");
  });
});

describe("SearchBar — highlightMatch tanpa celah flex-gap (regresi bug visual)", () => {
  it("label bertanda <mark> dibungkus SATU <span> (bukan node terpisah di CommandItem flex)", async () => {
    const user = userEvent.setup({ delay: null });
    const { input } = renderBar();

    // Cocokkan SEBAGIAN kata ("Cus" di dalam "Customer") -- persis bentuk bug
    // aslinya (screenshot verifikasi visual: "Category" tampil "Cate gory").
    // Discope ke CommandGroup "Kolom": seksi "text bebas" jg mengandung
    // <mark> match lain (echo ketikan di dalam label-nya).
    await typeInto(user, input, "Cus");
    const heading = await screen.findByText(
      "TR:core.datatable.search.section.column",
    );
    const group =
      heading.closest('[cmdk-group=""]') ?? heading.closest("[cmdk-group]");
    const mark = group.querySelector("mark");

    expect(mark).not.toBeNull();
    expect(mark.textContent).toBe("Cus");
    // <mark> dan potongan teks berikutnya berbagi parent <span> yang SAMA --
    // kalau langsung jadi children CommandItem (flex gap-2), keduanya jadi
    // flex-item TERPISAH dan renderer menambah celah visual di antaranya
    // (screenshot verifikasi visual: "Cate gory").
    expect(mark.parentElement.tagName).toBe("SPAN");
    expect(mark.parentElement.childNodes.length).toBeGreaterThan(1);
    expect(mark.parentElement.textContent).toBe("Customer");
  });
});
