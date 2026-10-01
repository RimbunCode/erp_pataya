import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
// Revisi 4: `useLinkModelOptions` (live-suggestion relation) fetch via
// `axios.post(route("model"), ...)` -- default kosong (belum di-resolve),
// tiap describe block yg butuh relation mengatur ulang via mockResolvedValue.
const axiosPost = vi.fn(() => Promise.resolve({ data: { data: [] } }));
vi.mock("axios", () => ({
  default: {
    get: (...a) => axiosGet(...a),
    delete: (...a) => axiosDelete(...a),
    post: (...a) => axiosPost(...a),
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
  { value: "created_at", label: "Dibuat" },
  { value: "total", label: "Total" },
];

const PLACEHOLDER = "Cari Test…";

const statusDraftTree = {
  root: { k: "and", c: { a: { k: "status", o: "=", v: "draft" } } },
};

// `useLinkModelOptions` (revisi 4) memanggil `useQuery()` TANPA syarat --
// SearchBar butuh QueryClientProvider di setiap render, atau langsung error
// "No QueryClient set". QueryClient BARU per `renderBar()` (bukan
// module-level), pola sama `LinkModel.rtl.test.jsx` -- supaya cache TIDAK
// bocor lintas test (dua `it()` yang mount kolom relasi sama akan punya
// queryKey sama; kalau clientnya sama, test kedua bisa diam-diam serve dari
// cache test pertama alih-alih benar-benar fetch).
const renderBar = (overrides = {}) => {
  const props = {
    columns,
    tree: null,
    onTreeChange: vi.fn(),
    getSearchColumns: () => ["code", "name"],
    placeholder: PLACEHOLDER,
    ...overrides,
  };
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const ui = (p) => (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SearchBar {...p} />
      </TooltipProvider>
    </QueryClientProvider>
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

/**
 * Revisi 3 (staged-apply, Requirement 17): SEMUA aksi (pilih kolom+nilai,
 * edit/hapus chip, saved filter, group) HANYA mengubah draftTree/draftGroup
 * lokal -- `onTreeChange`/`onGroupChange`/`onPickSaved` (host) baru terpanggil
 * lewat salah satu dari 3 jalur trigger. Test yang ingin assert host
 * terpanggil WAJIB memanggil helper ini SETELAH aksi staged -- pakai tombol
 * Search (jalur trigger paling tidak bergantung state dropdown/fokus).
 * @param user
 */
const clickApply = async (user) => {
  await user.click(
    screen.getByRole("button", {
      name: "TR:core.datatable.search.apply_search",
    }),
  );
};

/**
 * Kolom date/datetime (revisi 11) memakai alur chip seperti text/number:
 * Enter #1 = ketikan/saran jadi chip, Enter #2 (kotak kosong) = selesai,
 * Enter #3 (dropdown tertutup) = apply. Dipanggil tepat SETELAH mengetik.
 * @param user
 */
const enterFinishApply = async (user) => {
  await user.keyboard("{Enter}");
  await user.keyboard("{Enter}");
  await user.keyboard("{Enter}");
};

/**
 * Nilai BERSIMBOL (`>5`, `>=2027`, `a..b`) = satu-satunya nilai -> langsung
 * SELESAI saat terbentuk (revisi 12b): Enter #1 = selesai, Enter #2 = apply.
 * @param user
 */
const finishApplySymbol = async (user) => {
  await user.keyboard("{Enter}");
  await user.keyboard("{Enter}");
};

/**
 * Isi kotak SEKALI JALAN (tempel) -- utk menyiapkan chip di tes berat: mengetik
 * per karakter di kolom date merender ulang widget kalender tiap tombol dan
 * sering melewati timeout saat suite penuh jalan paralel. Tempel menyertakan
 * pemisah -> chip terbentuk (jalur `insertFromPaste`).
 * @param user
 * @param input
 * @param text
 */
const pasteText = async (user, input, text) => {
  await user.click(input);
  await user.paste(text);
};

/**
 * Baris opsi (checkbox) di dropdown nilai berdasarkan label -- sejak revisi 7
 * label yg sama juga tampil sbg CHIP di kotak search, jadi `getByText(label)`
 * polos ambigu. Baris opsi = `role="option"` cmdk.
 * @param label
 */
const optionRow = (label) =>
  screen.queryAllByRole("option").find((el) => el.textContent === label);

/**
 * Chip nilai (revisi 7) di dalam kotak search berdasarkan label -- dicari lewat
 * tombol hapusnya (`aria-label` remove_chip).
 * @param label
 */
const chipRemoveButton = (label) =>
  screen.getByRole("button", {
    name: `TR:core.datatable.search.remove_chip:${JSON.stringify({ label })}`,
  });

const valueChip = (label) =>
  screen
    .queryAllByRole("button", {
      name: `TR:core.datatable.search.remove_chip:${JSON.stringify({ label })}`,
    })[0]
    ?.closest("span");

/**
 * Nilai `aria-selected` sel kalender untuk satu tanggal (format `YYYY-MM-DD`).
 *
 * Sel dicari lewat atribut `data-day`, bukan lewat nama aksesibel tombolnya.
 * Nama itu dihasilkan react-day-picker dalam bahasa Inggris berformat panjang
 * ("September 15th, 2026") dan berubah antar versi: pada 9.14 sel tanggal
 * dirender sebagai `<td role="gridcell">` bernama angka saja, sehingga
 * pencarian lama berhenti menemukan apa pun. `data-day` adalah data, bukan
 * teks tampilan, jadi tidak ikut berubah oleh pelokalan maupun pembaruan
 * pustaka.
 * @param isoDate
 */
const selectedStateOfDay = (isoDate) =>
  screen
    .getByRole("grid")
    .querySelector(`[data-day="${isoDate}"]`)
    ?.closest("td")
    ?.getAttribute("aria-selected");

// Sebagian test membekukan waktu karena memakai tanggal tetap sementara widget
// kalender membuka bulan berjalan. Pemulihan dilakukan di sini, bukan di
// masing-masing test, supaya timer palsu tidak pernah bocor ke test berikutnya
// bila sebuah test gagal di tengah jalan.
afterEach(() => {
  vi.useRealTimers();
});

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
  axiosPost.mockReset().mockResolvedValue({ data: { data: [] } });
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

  it("input TIDAK punya border/ring sendiri -- cuma wadah luar yang boleh (regresi visual: @tailwindcss/forms strategy 'base' memasang border+ring bawaan ke SETIAP <input>)", () => {
    const { input } = renderBar();
    // Bukan cek CSS ter-render (jsdom tak load stylesheet) -- cek daftar
    // class React yang mematikan default plugin forms ADA & di-`!important`-kan,
    // sama seperti pola LinkModel.jsx/Select.jsx (`border-0!`,
    // `focus-visible:ring-0!`).
    expect(input.className).toContain("border-0!");
    expect(input.className).toContain("shadow-none!");
    expect(input.className).toContain("focus:ring-0!");
  });

  it("mengetik '/' di dalam input TIDAK memicu apa pun di luar (tak ada listener global)", async () => {
    const user = userEvent.setup({ delay: null });
    const { input } = renderBar();
    await typeInto(user, input, "/x");
    expect(input).toHaveValue("/x");
  });
});

describe("SearchBar — warna chip berdasarkan peran (revisi 9)", () => {
  it("chip filter (leaf) berwarna biru, TANPA ikon", () => {
    renderBar({ tree: statusDraftTree });
    const chip = screen.getByText(/Status: Draft/).closest("span");
    expect(chip.className).toContain("bg-blue-500/15");
    expect(chip.className).toContain("text-blue-700");
    expect(chip.className).not.toContain("amber");
    expect(chip.className).not.toContain("emerald");
    // satu-satunya svg = tombol hapus (x), tak ada ikon peran.
    expect(chip.querySelectorAll("svg")).toHaveLength(1);
    expect(chip.querySelector("svg.lucide-x")).toBeTruthy();
  });

  it("chip group berwarna hijau + ikon tumpukan (Layers), label tanpa awalan '≡'", () => {
    renderBar({
      group: [{ column: "created_at", granularity: "month", range: null }],
    });
    const chip = screen.getByText(/Dibuat/).closest("span");
    expect(chip.className).toContain("bg-emerald-500/15");
    expect(chip.className).toContain("text-emerald-700");
    expect(chip.querySelector("svg.lucide-layers")).toBeTruthy();
    expect(chip.textContent).not.toContain("≡");
  });

  it("chip sumber (saved filter) SELALU emas + ikon bintang, dirty atau tidak", async () => {
    axiosGet.mockResolvedValue({ data: { data: [savedA] } });
    const { input } = renderBar({
      model: "App\\Models\\Inventory\\Item",
      activeFid: 1,
    });
    await waitFor(() => expect(axiosGet).toHaveBeenCalled());
    const chip = await screen.findByText("PO Bulan Ini");
    // `chip` = <span className="truncate"> (pembungkus nama) -- warna ada di
    // <span> LUAR (pemegang tombol ikon+nama+X), naik via elemen <button>.
    const outer = chip.closest("button").closest("span");
    expect(outer.className).toContain("bg-amber-500/20");
    expect(outer.querySelector("svg.lucide-star")).toBeTruthy();
    expect(outer.querySelector("svg.lucide-bookmark")).toBeNull();
    expect(input).toBeTruthy();
  });

  it("chip nilai (di dalam kotak nilai) berwarna secondary", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await typeInto(user, bar.input, "Kode");
    await pickColumnSuggestion(user, "Kode");
    await user.type(bar.input, "abc|");
    const chip = valueChip("abc");
    expect(chip.className).toContain("bg-secondary");
    expect(chip.className).toContain("text-secondary-foreground");
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
    // Revisi 3: Enter di mode value cuma commit ke draftTree (staged) --
    // onTreeChange (host) baru terpanggil setelah trigger apply eksplisit.
    expect(props.onTreeChange).not.toHaveBeenCalled();
    await clickApply(user);

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
    expect(props.onTreeChange).not.toHaveBeenCalled();
    await clickApply(user);
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
    expect(bar.props.onTreeChange).not.toHaveBeenCalled();
    await clickApply(user);

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
    expect(props.onTreeChange).not.toHaveBeenCalled();
    await clickApply(user);

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
    expect(props.onTreeChange).not.toHaveBeenCalled();
    await clickApply(user);

    await waitFor(() => expect(props.onTreeChange).toHaveBeenCalledTimes(1));
    const leaf = Object.values(props.onTreeChange.mock.calls[0][0].root.c)[0];
    expect(leaf.k).toBe("created_at");
    expect(leaf.o).toBe("in_period");
    expect(leaf.v.period).toBe("month");
    expect(leaf.v.operator).toBe("is");
  });

  it("kolom relasi -> live-suggestion record (revisi 4); klik record lalu Enter (selesai, revisi 7) membentuk leaf record, BUKAN dari teks", async () => {
    axiosPost.mockResolvedValue({
      data: { data: [{ id: 9, name: "PT A" }] },
    });
    const user = userEvent.setup({ delay: null });
    const { input, props } = renderBar();
    await typeInto(user, input, "Customer");
    await pickColumnSuggestion(user, "Customer");

    expect(screen.getByText("[Customer:]")).toBeInTheDocument();
    // Revisi 7: Enter = SELESAI (bukan toggle item ter-highlight) -- record
    // dipilih lewat klik, Enter menyelesaikan; belum ke host sampai apply.
    await user.click(await screen.findByText("PT A"));
    await user.keyboard("{Enter}");
    expect(props.onTreeChange).not.toHaveBeenCalled();
    await clickApply(user);

    await waitFor(() => expect(props.onTreeChange).toHaveBeenCalledTimes(1));
    expect(
      Object.values(props.onTreeChange.mock.calls[0][0].root.c)[0],
    ).toEqual({
      k: "customer",
      o: "=",
      v: { id: 9, name: "PT A" },
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

describe("SearchBar — revisi 4: live-suggestion record kolom relation (Requirement 22)", () => {
  it("kolom relasi tetap tampil di Panel & saran", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await user.click(bar.input); // Panel.
    const columnSection = (
      await screen.findByText("TR:core.datatable.search.section.column")
    ).closest("section");

    expect(within(columnSection).getByText("Kategori")).toBeInTheDocument();
  });

  it("memilih kolom relasi -> fetch opsi awal (search kosong) via route('model'), pilih record -> leaf {k, o:'=', v:record}", async () => {
    let resolveFetch;
    axiosPost.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );
    const user = userEvent.setup({ delay: null });
    const { input, props } = renderBar();

    await typeInto(user, input, "Kategori");
    await pickColumnSuggestion(user, "Kategori");

    // Fetch opsi awal dipicu SEGERA (search kosong), bukan menunggu ketikan.
    expect(axiosPost).toHaveBeenCalledWith(
      "model",
      expect.objectContaining({
        model: "App\\Models\\Inventory\\Category",
        search: "",
      }),
    );
    expect(screen.getByText("[Kategori:]")).toBeInTheDocument();
    expect(input).not.toBeDisabled(); // mengetik saat loading tetap alur normal.

    await act(async () => {
      resolveFetch({
        data: {
          data: [
            { id: 3, name: "Elektronik" },
            { id: 4, name: "Furnitur" },
          ],
        },
      });
      await Promise.resolve();
    });

    await user.click(await screen.findByText("Elektronik"));
    expect(props.onTreeChange).not.toHaveBeenCalled();
    await clickApply(user);

    await waitFor(() => expect(props.onTreeChange).toHaveBeenCalledTimes(1));
    expect(
      Object.values(props.onTreeChange.mock.calls[0][0].root.c)[0],
    ).toEqual({ k: "category", o: "=", v: { id: 3, name: "Elektronik" } });
  });

  it("fetch sedang berlangsung -> indikator loading tampil; hasil kosong -> pesan tidak ditemukan", async () => {
    let resolveFetch;
    axiosPost.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );
    const user = userEvent.setup({ delay: null });
    const { input } = renderBar();

    await typeInto(user, input, "Kategori");
    await pickColumnSuggestion(user, "Kategori");

    expect(
      await screen.findByRole("status", { hidden: true }),
    ).toBeInTheDocument();

    await act(async () => {
      resolveFetch({ data: { data: [] } });
      await Promise.resolve();
    });

    expect(
      await screen.findByText("TR:core.form.not_found"),
    ).toBeInTheDocument();
  });

  it("pilih record kedua pada kolom relation yang sudah punya leaf -> digabung jadi 'in', dedup by id", async () => {
    axiosPost.mockResolvedValue({
      data: {
        data: [
          { id: 3, name: "Elektronik" },
          { id: 4, name: "Furnitur" },
        ],
      },
    });
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();

    await typeInto(user, bar.input, "Kategori");
    await pickColumnSuggestion(user, "Kategori");
    await user.click(await screen.findByText("Elektronik"));
    await clickApply(user);
    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    const afterFirst = bar.props.onTreeChange.mock.calls[0][0];

    bar.rerenderWith({ tree: afterFirst });
    await typeInto(user, bar.input, "Kategori");
    await pickColumnSuggestion(user, "Kategori");
    await user.click(await screen.findByText("Furnitur"));
    await clickApply(user);

    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(2),
    );
    expect(
      Object.values(bar.props.onTreeChange.mock.calls[1][0].root.c)[0],
    ).toEqual({
      k: "category",
      o: "in",
      v: [
        { id: 3, name: "Elektronik" },
        { id: 4, name: "Furnitur" },
      ],
    });
  });

  it("edit chip leaf pada anak relasi dotted yang BELUM ter-hydrate (mis. dari saved filter) -> tetap bisa diedit sbg teks tanpa fetch", async () => {
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
    expect(axiosPost).not.toHaveBeenCalled();

    await user.clear(bar.input);
    await user.type(bar.input, "Furnitur");
    await user.keyboard("{Enter}");
    expect(bar.props.onTreeChange).not.toHaveBeenCalled();
    await clickApply(user);

    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    expect(
      Object.values(bar.props.onTreeChange.mock.calls[0][0].root.c)[0],
    ).toEqual({ k: "category.name", o: "matches", v: "Furnitur" });
  });

  it("chip leaf relasi BARE (k = nama relasi, v = record objek) -> masuk mode value relation dari 0, BUKAN fallback onOpenBuilder", async () => {
    axiosPost.mockResolvedValue({ data: { data: [] } });
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

    expect(onOpenBuilder).not.toHaveBeenCalled();
    expect(screen.getByText("[Kategori:]")).toBeInTheDocument();
    await waitFor(() =>
      expect(axiosPost).toHaveBeenCalledWith(
        "model",
        expect.objectContaining({ search: "" }),
      ),
    );
  });
});

describe("SearchBar — revisi 4: fokus otomatis & placeholder mode value (Requirement 23)", () => {
  it("pilih kolom string dari saran -> fokus otomatis kembali ke input, placeholder mengandung judul kolom", async () => {
    const user = userEvent.setup({ delay: null });
    const { input } = renderBar();

    await typeInto(user, input, "Nama");
    await pickColumnSuggestion(user, "Nama");

    expect(input).toHaveAttribute(
      "placeholder",
      'TR:core.datatable.search.value_placeholder:{"name":"Nama"}',
    );
    await waitFor(() => expect(input).toHaveFocus());
  });

  it("pilih kolom string dari Panel ColumnList -> fokus otomatis kembali ke input", async () => {
    const user = userEvent.setup({ delay: null });
    const { input } = renderBar();

    await user.click(input); // Panel.
    const columnSection = (
      await screen.findByText("TR:core.datatable.search.section.column")
    ).closest("section");
    await user.click(within(columnSection).getByText("Nama"));

    await waitFor(() => expect(input).toHaveFocus());
  });
});

describe("SearchBar — revisi 3: sintaks ketik `kolom:...` (Requirement 19.1-19.2)", () => {
  it("':' saat item ter-highlight ADALAH saran Kolom -> konfirmasi kolom itu, ':' TIDAK masuk inputValue", async () => {
    const user = userEvent.setup({ delay: null });
    // Tanpa seksi teks bebas (getSearchColumns kosong) -> seksi Kolom jadi
    // seksi PERTAMA, item pertamanya otomatis ke-highlight (kontrak cmdk
    // controlled existing) -- hindari simulasi ArrowDown yang rapuh.
    const { input, props } = renderBar({ getSearchColumns: () => [] });

    await typeInto(user, input, "Kode");
    await screen.findByText("TR:core.datatable.search.section.column");
    await user.keyboard(":");

    expect(screen.getByText("[Kode:]")).toBeInTheDocument();
    expect(input).toHaveValue("");

    await user.type(input, "abc");
    await user.keyboard("{Enter}");
    await clickApply(user);
    await waitFor(() => expect(props.onTreeChange).toHaveBeenCalledTimes(1));
    expect(
      Object.values(props.onTreeChange.mock.calls[0][0].root.c)[0],
    ).toEqual({ k: "code", o: "matches", v: "abc" });
  });

  it("':' saat item ter-highlight BUKAN saran Kolom -> ':' diketik apa adanya, tanpa aksi", async () => {
    const user = userEvent.setup({ delay: null });
    const { input } = renderBar();

    // "ode" cuma SUBSTRING kolom "Kode" (bukan prefix) -- skor seksi Kolom
    // & teks bebas SAMA (sama-sama tier substring, revisi 3 §Requirement
    // 20), jadi urutan ASLI (teks bebas duluan) yang menang & tetap
    // ke-highlight -- BUKAN seksi Kolom.
    await typeInto(user, input, "ode");
    await screen.findByText("TR:core.datatable.search.section.column");
    await user.keyboard(":");

    expect(input).toHaveValue("ode:");
    expect(screen.queryByText("[Kode:]")).not.toBeInTheDocument();
  });
});

describe("SearchBar — revisi 3: lastUsedColumns localStorage (Requirement 20.4-20.5)", () => {
  // Model KHUSUS (bukan dipakai describe lain) -- localStorage polyfill
  // global (test-setup.js) persisten SEPANJANG file test ini, jadi key
  // harus unik supaya tak bocor ke/dari test lain.
  const PROBE_MODEL = "App\\Models\\Test\\RtlLastUsedColumnsProbe";
  const storageKey = `searchbar.recent.${PROBE_MODEL}`;

  afterEach(() => {
    localStorage.removeItem(storageKey);
  });

  it("memilih kolom menyimpan namanya ke localStorage (unshift, dedup, cap 8)", async () => {
    const user = userEvent.setup({ delay: null });
    const { input } = renderBar({ model: PROBE_MODEL });

    await typeInto(user, input, "Kode");
    await pickColumnSuggestion(user, "Kode");
    await user.keyboard("{Escape}");

    expect(JSON.parse(localStorage.getItem(storageKey))).toEqual(["code"]);

    await typeInto(user, input, "Total");
    await pickColumnSuggestion(user, "Total");
    await user.keyboard("{Escape}");

    expect(JSON.parse(localStorage.getItem(storageKey))).toEqual([
      "total",
      "code",
    ]);
  });

  it("tanpa `model` -> tidak pernah menyentuh localStorage", async () => {
    const user = userEvent.setup({ delay: null });
    const { input } = renderBar({ model: undefined });

    await typeInto(user, input, "Kode");
    await pickColumnSuggestion(user, "Kode");

    expect(localStorage.getItem(storageKey)).toBeNull();
  });
});

describe("SearchBar — merge nilai kolom sama menjadi 'in'", () => {
  it("pilih 2 opsi berbeda pada kolom sama -> satu leaf 'in'", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await typeInto(user, bar.input, "Status");
    await pickColumnSuggestion(user, "Status");
    await user.click(await screen.findByText("Draft"));
    await clickApply(user);
    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );

    const tree1 = bar.props.onTreeChange.mock.calls[0][0];
    bar.rerenderWith({ tree: tree1 });

    await typeInto(user, bar.input, "Status");
    await pickColumnSuggestion(user, "Status");
    await user.click(await screen.findByText("Selesai"));
    await clickApply(user);

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
        `Kode ${mockT("core.datatable.filter.operator.matches")} "abc"`,
      ),
    );
    expect(screen.getByText("[Kode:]")).toBeInTheDocument();
    expect(bar.input).toHaveValue("abc");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();

    await user.clear(bar.input);
    await user.type(bar.input, "xyz");
    await user.keyboard("{Enter}");
    expect(bar.props.onTreeChange).not.toHaveBeenCalled();
    await clickApply(user);

    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    const tree = bar.props.onTreeChange.mock.calls[0][0];
    expect(Object.keys(tree.root.c)).toEqual(["a"]);
    expect(tree.root.c.a).toEqual({ k: "code", o: "matches", v: "xyz" });
  });

  it("klik chip leaf ber-opsi -> checkbox-multi PREFILL dari leaf existing; toggle opsi lain -> gabung 'in' (id tetap, Requirement 27)", async () => {
    const statusTree = {
      root: { k: "and", c: { x: { k: "status", o: "=", v: "draft" } } },
    };
    const user = userEvent.setup({ delay: null });
    const bar = renderBar({ tree: statusTree });

    await user.click(screen.getByText(/Status: Draft/));
    // Prefill: "Draft" (nilai leaf existing) SUDAH tercentang begitu dropdown
    // dibuka -- klik "Selesai" MENAMBAH (toggle), bukan menggantikan.
    await user.click(await screen.findByText("Selesai"));
    await clickApply(user);

    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    const tree = bar.props.onTreeChange.mock.calls[0][0];
    expect(Object.keys(tree.root.c)).toEqual(["x"]); // id node TETAP.
    expect(tree.root.c.x).toEqual({
      k: "status",
      o: "in",
      v: ["draft", "completed"],
    });
  });

  it("klik chip leaf ber-opsi -> hapus chip lama (×) lalu pilih opsi baru -> tetap SATU nilai (bukan gabung)", async () => {
    const statusTree = {
      root: { k: "and", c: { x: { k: "status", o: "=", v: "draft" } } },
    };
    const user = userEvent.setup({ delay: null });
    const bar = renderBar({ tree: statusTree });

    await user.click(screen.getByText(/Status: Draft/));
    await user.click(
      screen.getByRole("button", {
        name: `TR:core.datatable.search.remove_chip:${JSON.stringify({ label: "Draft" })}`,
      }),
    ); // hapus chip prefill.
    await user.click(await screen.findByText("Selesai")); // pilih baru.
    await clickApply(user);

    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    expect(
      Object.values(bar.props.onTreeChange.mock.calls[0][0].root.c)[0],
    ).toEqual({ k: "status", o: "=", v: "completed" });
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
    // Terapkan di popover ChipEditor cuma commit ke draftTree (revisi 3) --
    // tombol Search bar (nama berbeda, "apply_search") yang benar2 apply.
    expect(bar.props.onTreeChange).not.toHaveBeenCalled();
    await clickApply(user);

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

describe("SearchBar — revisi 3: model staged-apply (Requirement 17)", () => {
  const leafTextTree = {
    root: { k: "and", c: { a: { k: "code", o: "matches", v: "abc" } } },
  };

  it("Enter selagi dropdown/panel TERTUTUP memicu applyDraft (jalur trigger 1)", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await typeInto(user, bar.input, "Kode");
    await pickColumnSuggestion(user, "Kode");
    await user.type(bar.input, "abc");
    // Enter pertama = ketikan jadi chip; Enter kedua (kosong) = selesai ->
    // commit ke draftTree & dropdown tertutup (revisi 9).
    await user.keyboard("{Enter}{Enter}");
    expect(bar.props.onTreeChange).not.toHaveBeenCalled();

    await user.keyboard("{Escape}"); // tutup dropdown, TIDAK membuang draft
    expect(screen.getByText(/Kode/)).toBeInTheDocument();
    await user.keyboard("{Enter}"); // input kosong, dropdown tertutup -> applyDraft

    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
  });

  it("klik tombol chevron / Builder lanjutan / item Panel TIDAK memicu applyDraft (regresi kekhawatiran klik-luar salah-trigger)", async () => {
    const user = userEvent.setup({ delay: null });
    const onOpenBuilder = vi.fn();
    const bar = renderBar({ tree: leafTextTree, onOpenBuilder });

    // Buat draft pending dulu -- hapus chip existing lewat tombol × (staged,
    // synchronous, tak butuh fokus input spt jalur edit-value).
    await user.click(
      screen.getByRole("button", {
        name: 'TR:core.datatable.search.remove_chip:{"label":"Kode TR:core.datatable.filter.operator.matches \\"abc\\""}',
      }),
    );
    expect(bar.props.onTreeChange).not.toHaveBeenCalled();

    // Klik chevron (buka Panel) -- elemen INTERNAL, bukan klik-luar.
    await user.click(
      screen.getByRole("button", {
        name: "TR:core.datatable.search.open_panel",
      }),
    );
    expect(bar.props.onTreeChange).not.toHaveBeenCalled();

    // Klik "Builder lanjutan" di Panel -- juga internal (portal Radix).
    await user.click(
      screen.getByRole("button", {
        name: "TR:core.datatable.search.advanced_builder",
      }),
    );
    expect(bar.props.onTreeChange).not.toHaveBeenCalled();
    expect(onOpenBuilder).toHaveBeenCalledTimes(1);
  });

  it("klik-luar SUNGGUHAN (document.body) dengan draft pending memicu applyDraft (jalur trigger 3)", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar({ tree: leafTextTree });

    await user.click(
      screen.getByRole("button", {
        name: 'TR:core.datatable.search.remove_chip:{"label":"Kode TR:core.datatable.filter.operator.matches \\"abc\\""}',
      }),
    );
    expect(bar.props.onTreeChange).not.toHaveBeenCalled();

    await user.click(document.body);

    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
  });

  it("onTreeChange reject TIDAK me-revert draftTree -- chip tetap ada, bisa dicoba lagi", async () => {
    const onTreeChange = vi.fn(() => Promise.reject(new Error("gagal")));
    const user = userEvent.setup({ delay: null });
    const bar = renderBar({ onTreeChange });

    await typeInto(user, bar.input, "Kode");
    await pickColumnSuggestion(user, "Kode");
    await user.type(bar.input, "abc");
    await user.keyboard("{Enter}");
    await clickApply(user);

    await waitFor(() => expect(onTreeChange).toHaveBeenCalledTimes(1));
    expect(
      screen.getByText(
        `Kode ${mockT("core.datatable.filter.operator.matches")} "abc"`,
      ),
    ).toBeInTheDocument();
  });

  it("titik indikator draft (tombol Search) muncul saat ada perubahan belum di-apply, hilang setelah apply", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    const dot = () =>
      screen.queryByLabelText("TR:core.datatable.search.unapplied");

    expect(dot()).not.toBeInTheDocument();

    await typeInto(user, bar.input, "Kode");
    await pickColumnSuggestion(user, "Kode");
    await user.type(bar.input, "abc");
    await user.keyboard("{Enter}{Enter}");
    expect(dot()).toBeInTheDocument();

    await clickApply(user);
    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
  });
});

describe("SearchBar — Group by (chip & saran)", () => {
  const CHIP_MONTH_LABEL = "Dibuat: TR:core.datatable.granularity.month";
  const removeLabel = (label) =>
    `TR:core.datatable.search.remove_chip:${JSON.stringify({ label })}`;
  const createdMonth = {
    column: "created_at",
    granularity: "month",
    range: null,
  };

  it("saran seksi Kelompokkan memanggil onGroupChange(Groups) dgn default kolom -- baru saat Apply", async () => {
    const user = userEvent.setup({ delay: null });
    const onGroupChange = vi.fn();
    const { input } = renderBar({ groupOptions, onGroupChange });

    await typeInto(user, input, "Dibuat");
    await user.click(
      await findByFullText(
        mockT("core.datatable.search.group_by_label", { column: "Dibuat" }),
      ),
    );
    expect(onGroupChange).not.toHaveBeenCalled();
    await clickApply(user);

    expect(onGroupChange).toHaveBeenCalledWith([createdMonth]);
  });

  it("dua saran group berturut-turut = NESTING: kolom kedua jadi level terdalam", async () => {
    const user = userEvent.setup({ delay: null });
    const onGroupChange = vi.fn();
    const { input } = renderBar({ groupOptions, onGroupChange });

    await typeInto(user, input, "Dibuat");
    await user.click(
      await findByFullText(
        mockT("core.datatable.search.group_by_label", { column: "Dibuat" }),
      ),
    );
    await typeInto(user, input, "Total");
    await user.click(
      await findByFullText(
        mockT("core.datatable.search.group_by_label", { column: "Total" }),
      ),
    );
    await clickApply(user);

    expect(onGroupChange).toHaveBeenCalledTimes(1);
    expect(onGroupChange).toHaveBeenCalledWith([
      createdMonth,
      { column: "total", granularity: null, range: 10 },
    ]);
  });

  it("saran kolom yang SUDAH aktif berlabel 'hapus pengelompokan'; memilihnya membuang level itu (toggle)", async () => {
    const user = userEvent.setup({ delay: null });
    const onGroupChange = vi.fn();
    const { input } = renderBar({
      groupOptions,
      onGroupChange,
      group: [createdMonth],
    });

    await typeInto(user, input, "Dibuat");
    expect(
      screen.queryByText(
        mockT("core.datatable.search.group_by_label", { column: "Dibuat" }),
      ),
    ).not.toBeInTheDocument();
    await user.click(
      await findByFullText(
        mockT("core.datatable.search.group_remove_label", {
          column: "Dibuat",
        }),
      ),
    );
    await clickApply(user);

    expect(onGroupChange).toHaveBeenCalledWith([]);
  });

  it("chip group bertingkat = SATU chip berlabel 'A > B'; level date/number membawa pilihannya", () => {
    renderBar({
      groupOptions,
      group: [
        createdMonth,
        { column: "total", granularity: null, range: 100 },
        { column: "code", granularity: null, range: null },
      ],
    });

    const label =
      "Dibuat: TR:core.datatable.granularity.month > Total: 100 > Kode";
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", {
        name: /search\.remove_chip.*granularity/,
      }),
    ).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: removeLabel(label) }),
    ).toBeInTheDocument();
  });

  it("chip group satu level kolom biasa: label = judul kolom tanpa pemisah", () => {
    renderBar({
      groupOptions,
      group: [{ column: "status", granularity: null, range: null }],
    });

    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("klik chip group membuka editor level; mengganti granularity TIDAK menutup popover & baru diterapkan saat Apply", async () => {
    const user = userEvent.setup({ delay: null });
    const onGroupChange = vi.fn();
    renderBar({
      groupOptions,
      onGroupChange,
      group: [createdMonth],
    });

    await user.click(screen.getByText(CHIP_MONTH_LABEL));
    await user.click(
      await screen.findByRole("combobox", {
        name: "TR:core.datatable.group_levels.granularity",
      }),
    );
    await user.click(
      await screen.findByRole("option", {
        name: "TR:core.datatable.granularity.year",
      }),
    );
    expect(onGroupChange).not.toHaveBeenCalled();
    // Chip ikut menampilkan pilihan baru (draft), editor masih terbuka.
    expect(
      screen.getByText("Dibuat: TR:core.datatable.granularity.year"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Dibuat" }),
    ).toBeInTheDocument();
    await clickApply(user);

    expect(onGroupChange).toHaveBeenCalledWith([
      { column: "created_at", granularity: "year", range: null },
    ]);
  });

  it("mencentang kolom lain di editor chip menambah level ke chip yang sama ('A > B')", async () => {
    const user = userEvent.setup({ delay: null });
    const onGroupChange = vi.fn();
    renderBar({ groupOptions, onGroupChange, group: [createdMonth] });

    await user.click(screen.getByText(CHIP_MONTH_LABEL));
    await user.click(await screen.findByRole("checkbox", { name: "Total" }));

    expect(
      screen.getByText(
        "Dibuat: TR:core.datatable.granularity.month > Total: 10",
      ),
    ).toBeInTheDocument();
    await clickApply(user);
    expect(onGroupChange).toHaveBeenCalledWith([
      createdMonth,
      { column: "total", granularity: null, range: 10 },
    ]);
  });

  it("klik × pada chip group membuang SEMUA level -> onGroupChange([]) saat Apply", async () => {
    const user = userEvent.setup({ delay: null });
    const onGroupChange = vi.fn();
    renderBar({
      groupOptions,
      onGroupChange,
      group: [createdMonth, { column: "code", granularity: null, range: null }],
    });

    await user.click(
      screen.getByRole("button", {
        name: removeLabel(`${CHIP_MONTH_LABEL} > Kode`),
      }),
    );
    expect(onGroupChange).not.toHaveBeenCalled();
    await clickApply(user);

    expect(onGroupChange).toHaveBeenCalledWith([]);
  });

  it("ikon chip group = tombol urutan grup: klik memanggil onGroupSortChange (asc<->desc) TANPA membuka editor level & tanpa menyentuh onGroupChange", async () => {
    const user = userEvent.setup({ delay: null });
    const onGroupChange = vi.fn();
    const onGroupSortChange = vi.fn();
    renderBar({
      groupOptions,
      onGroupChange,
      onGroupSortChange,
      groupSort: "asc",
      group: [createdMonth],
    });

    const icon = screen.getByRole("button", {
      name: "TR:core.datatable.search.group_sort_asc",
    });
    expect(icon.querySelector("svg.lucide-layers")).toBeTruthy();
    expect(icon.querySelector("svg.lucide-arrow-up")).toBeTruthy();

    await user.click(icon);
    expect(onGroupSortChange).toHaveBeenCalledWith("desc");
    expect(onGroupChange).not.toHaveBeenCalled();
    // Editor level (popover chip) TIDAK ikut terbuka.
    expect(screen.queryByRole("checkbox", { name: "Dibuat" })).toBeNull();
  });

  it("groupSort desc: ikon berlabel 'Z–A' dgn panah bawah; klik membalik ke asc", async () => {
    const user = userEvent.setup({ delay: null });
    const onGroupSortChange = vi.fn();
    renderBar({
      groupOptions,
      onGroupSortChange,
      groupSort: "desc",
      group: [createdMonth],
    });

    const icon = screen.getByRole("button", {
      name: "TR:core.datatable.search.group_sort_desc",
    });
    expect(icon.querySelector("svg.lucide-arrow-down")).toBeTruthy();
    await user.click(icon);
    expect(onGroupSortChange).toHaveBeenCalledWith("asc");
  });

  it("tanpa onGroupSortChange ikon chip group hanya hiasan (bukan tombol)", () => {
    renderBar({ groupOptions, group: [createdMonth] });

    expect(
      screen.queryByRole("button", {
        name: /core\.datatable\.search\.group_sort_/,
      }),
    ).toBeNull();
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
    // Revisi 3: pick saved filter hanya preview lokal (pendingSaved) --
    // `onPickSaved` (host) baru terpanggil setelah trigger apply eksplisit.
    expect(onPickSaved).not.toHaveBeenCalled();
    await clickApply(user);

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
      getViewSnapshot: () => ({
        sort: "-created_at",
        group: [{ column: "x", granularity: null, range: null }],
      }),
    });
    await screen.findByText("PO Bulan Ini");
    expect(
      screen.queryByLabelText("TR:core.datatable.filter.saved.dirty"),
    ).not.toBeInTheDocument();
  });

  describe("group bertingkat vs saved filter sumber", () => {
    const a = { column: "created_at", granularity: "month", range: null };
    const b = { column: "code", granularity: null, range: null };
    const savedWithGroup = { ...savedA, group: [a, b] };
    const dirtyLabel = "TR:core.datatable.filter.saved.dirty";

    it("group aktif = group saved filter (urutan sama) -> TIDAK dirty", async () => {
      axiosGet.mockResolvedValue({ data: { data: [savedWithGroup] } });
      renderBar({
        model: "App\\Models\\Inventory\\Item",
        activeFid: 1,
        tree: statusDraftTree,
        groupOptions,
        group: [a, b],
      });
      await screen.findByText("PO Bulan Ini");

      expect(screen.queryByLabelText(dirtyLabel)).not.toBeInTheDocument();
    });

    it("URUTAN level berbeda dari saved filter (nesting berubah) -> dirty", async () => {
      axiosGet.mockResolvedValue({ data: { data: [savedWithGroup] } });
      renderBar({
        model: "App\\Models\\Inventory\\Item",
        activeFid: 1,
        tree: statusDraftTree,
        groupOptions,
        group: [b, a],
      });
      await screen.findByText("PO Bulan Ini");

      expect(await screen.findByLabelText(dirtyLabel)).toBeInTheDocument();
    });

    it("granularity level berbeda dari saved filter -> dirty", async () => {
      axiosGet.mockResolvedValue({ data: { data: [savedWithGroup] } });
      renderBar({
        model: "App\\Models\\Inventory\\Item",
        activeFid: 1,
        tree: statusDraftTree,
        groupOptions,
        group: [{ ...a, granularity: "year" }, b],
      });
      await screen.findByText("PO Bulan Ini");

      expect(await screen.findByLabelText(dirtyLabel)).toBeInTheDocument();
    });
  });

  it("klik × pada chip sumber -> onTreeChange(null) & chip hilang", async () => {
    axiosGet.mockResolvedValue({ data: { data: [savedA] } });
    const user = userEvent.setup({ delay: null });
    // `tree` HARUS realistis cocok dgn saved filter aktif (bukan null) --
    // kalau tidak, draftTree=null "hapus" jadi no-op (sama spt tree yg
    // sudah null) & applyDraft tak pernah memanggil host (Requirement
    // 17.5c: tak ada round-trip kosong bila memang tak ada yg berubah).
    const bar = renderBar({
      model: "App\\Models\\Inventory\\Item",
      activeFid: 1,
      tree: statusDraftTree,
    });
    await screen.findByText("PO Bulan Ini");

    await user.click(
      screen.getByRole("button", {
        name: 'TR:core.datatable.search.remove_chip:{"label":"PO Bulan Ini"}',
      }),
    );
    expect(bar.props.onTreeChange).not.toHaveBeenCalled();
    await clickApply(user);

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
    expect(bar.props.onTreeChange).not.toHaveBeenCalled();
    await clickApply(user);
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
      .getByText(`Nama ${mockT("core.datatable.filter.operator.matches")} "y"`)
      .closest("span");
    expect(lastChip.className).toContain("ring-2");
    expect(bar.props.onTreeChange).not.toHaveBeenCalled();

    await user.keyboard("{Backspace}");
    expect(bar.props.onTreeChange).not.toHaveBeenCalled();
    await clickApply(user);
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
        .getByText(
          `Nama ${mockT("core.datatable.filter.operator.matches")} "y"`,
        )
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

describe("SearchBar — revisi 6: checkbox-multi list/boolean (Requirement 27)", () => {
  it("centang 2 opsi berbeda dalam SATU sesi -> dropdown TETAP terbuka antar klik, commit 'in' saat Enter (native cmdk toggle)", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await typeInto(user, bar.input, "Status");
    await pickColumnSuggestion(user, "Status");

    await user.click(await screen.findByText("Draft"));
    // Requirement 27.1: dropdown TETAP terbuka, BUKAN langsung commit+keluar.
    expect(bar.props.onTreeChange).not.toHaveBeenCalled();
    expect(screen.getByText("[Status:]")).toBeInTheDocument();
    expect(screen.getByText("Selesai")).toBeInTheDocument();

    await user.click(screen.getByText("Selesai"));
    expect(bar.props.onTreeChange).not.toHaveBeenCalled();

    await clickApply(user);
    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    expect(
      Object.values(bar.props.onTreeChange.mock.calls[0][0].root.c)[0],
    ).toEqual({ k: "status", o: "in", v: ["draft", "completed"] });
  });

  it("pilih lalu hapus chip yang sama -> kembali kosong, TIDAK ada leaf terbentuk", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await typeInto(user, bar.input, "Status");
    await pickColumnSuggestion(user, "Status");

    await user.click(await screen.findByText("Draft"));
    await user.click(chipRemoveButton("Draft"));
    await user.keyboard("{Escape}");
    await clickApply(user);

    // Tak ada apa pun yang terpilih saat keluar -> tak ada leaf, tak ada commit.
    expect(bar.props.onTreeChange).not.toHaveBeenCalled();
  });

  it("Escape dgn 1 opsi tercentang -> commit '=' (jalur exit selain Enter/klik-luar/pilih-kolom-lain)", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await typeInto(user, bar.input, "Aktif");
    await pickColumnSuggestion(user, "Aktif");

    await user.click(await screen.findByText("TR:core.datatable.yes"));
    await user.keyboard("{Escape}");
    // Mode value sudah ditutup (Escape keluar) walau blm di-apply ke host.
    expect(screen.queryByText("[Aktif:]")).not.toBeInTheDocument();

    await clickApply(user);
    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    expect(
      Object.values(bar.props.onTreeChange.mock.calls[0][0].root.c)[0],
    ).toEqual({ k: "active", o: "=", v: true });
  });
});

describe("SearchBar — revisi 6: relation checkbox-multi & persist saat search berubah (Requirement 27, 28)", () => {
  it("pilih record, ganti kata kunci pencarian -> chip tetap ada walau tak match fetch terbaru; daftar tak memuat record terpilih", async () => {
    axiosPost.mockResolvedValue({
      data: { data: [{ id: 3, name: "Elektronik" }] },
    });
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await typeInto(user, bar.input, "Kategori");
    await pickColumnSuggestion(user, "Kategori");

    await user.click(await screen.findByText("Elektronik"));
    // Requirement 27.1: TETAP di mode value, dropdown tetap terbuka.
    expect(screen.getByText("[Kategori:]")).toBeInTheDocument();

    axiosPost.mockResolvedValue({
      data: { data: [{ id: 4, name: "Furnitur" }] },
    });
    await user.type(bar.input, "furnitur");

    // Requirement 28.2 (revisi 7): "Elektronik" (SUDAH terpilih) tetap ada
    // sbg CHIP walau fetch terbaru (search="furnitur") tak lagi memuatnya;
    // daftar hanya berisi yg belum terpilih.
    expect(await screen.findByText("Furnitur")).toBeInTheDocument();
    expect(valueChip("Elektronik")).toBeTruthy();
    expect(optionRow("Elektronik")).toBeUndefined();

    await user.click(screen.getByText("Furnitur"));
    await clickApply(user);

    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    expect(
      Object.values(bar.props.onTreeChange.mock.calls[0][0].root.c)[0],
    ).toEqual({
      k: "category",
      o: "in",
      v: [
        { id: 3, name: "Elektronik" },
        { id: 4, name: "Furnitur" },
      ],
    });
  });
});

describe("SearchBar — revisi 6: operator negasi '!' universal (Requirement 29)", () => {
  it("ketik '!' di awal search box mode value list -> badge 'Kecualikan' muncul; commit pakai '!='/'!in'", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await typeInto(user, bar.input, "Status");
    await pickColumnSuggestion(user, "Status");

    await user.type(bar.input, "!");
    expect(
      screen.getByText("TR:core.datatable.search.exclude_badge"),
    ).toBeInTheDocument();

    await user.click(await screen.findByText("Draft"));
    await user.keyboard("{Escape}");
    await clickApply(user);

    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    expect(
      Object.values(bar.props.onTreeChange.mock.calls[0][0].root.c)[0],
    ).toEqual({ k: "status", o: "!=", v: "draft" });
  });

  it("tanpa awalan '!' -> badge TIDAK muncul", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await typeInto(user, bar.input, "Status");
    await pickColumnSuggestion(user, "Status");

    expect(
      screen.queryByText("TR:core.datatable.search.exclude_badge"),
    ).not.toBeInTheDocument();
  });
});

describe("SearchBar — revisi 6: date/datetime, sintaks ketik & embed widget (Requirement 30)", () => {
  it("Enter (chip -> selesai -> apply) dgn token polos (tahun) -> leaf 'in_period', v.operator 'is'", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await typeInto(user, bar.input, "Dibuat");
    await pickColumnSuggestion(user, "Dibuat");

    await user.type(bar.input, "2026");
    await enterFinishApply(user);

    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    expect(
      Object.values(bar.props.onTreeChange.mock.calls[0][0].root.c)[0],
    ).toEqual({
      k: "created_at",
      o: "in_period",
      v: { period: "year", year: 2026, operator: "is" },
    });
  });

  it("'!' -> leaf 'o' jadi '!in_period' (negasi), badge 'Kecualikan' ikut muncul (Requirement 29 universal)", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await typeInto(user, bar.input, "Dibuat");
    await pickColumnSuggestion(user, "Dibuat");

    await user.type(bar.input, "!2026");
    expect(
      screen.getByText("TR:core.datatable.search.exclude_badge"),
    ).toBeInTheDocument();
    await enterFinishApply(user);

    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    const leaf = Object.values(
      bar.props.onTreeChange.mock.calls[0][0].root.c,
    )[0];
    expect(leaf.k).toBe("created_at");
    expect(leaf.o).toBe("!in_period");
  });

  it("'>' -> v.operator 'after' (leaf 'o' TETAP 'in_period', bukan spt number)", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await typeInto(user, bar.input, "Dibuat");
    await pickColumnSuggestion(user, "Dibuat");

    await user.type(bar.input, ">2026");
    await finishApplySymbol(user);

    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    const leaf = Object.values(
      bar.props.onTreeChange.mock.calls[0][0].root.c,
    )[0];
    expect(leaf.o).toBe("in_period");
    expect(leaf.v.operator).toBe("after");
  });

  it("'a..b' -> between, rangeStart/rangeEnd terisi", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await typeInto(user, bar.input, "Dibuat");
    await pickColumnSuggestion(user, "Dibuat");

    await user.type(bar.input, "2026..2027");
    await finishApplySymbol(user);

    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    const leaf = Object.values(
      bar.props.onTreeChange.mock.calls[0][0].root.c,
    )[0];
    expect(leaf.v.operator).toBe("between");
    expect(leaf.v.rangeStart).toEqual({ year: 2026, value: 0 });
    expect(leaf.v.rangeEnd).toEqual({ year: 2027, value: 0 });
  });

  it("teks tak terparse & tanpa widget dipakai -> Enter memilih preset ter-highlight jadi chip (lalu selesai + apply)", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await typeInto(user, bar.input, "Dibuat");
    await pickColumnSuggestion(user, "Dibuat");

    // "month" cocok filter preset (mock `t` echo key mentah, key preset
    // literal mengandung "month") tapi BUKAN token periode valid -- Enter
    // harus jatuh ke cmdk native (pilih preset ter-highlight), BUKAN diam2
    // no-op krn diintersep tanpa hasil.
    await user.type(bar.input, "month");
    // Label preset di-highlight (`highlightMatch`) -- teks "this_month" jadi
    // 2 text node terpisah (sebelum & di dalam <mark>), matcher biasa/regex
    // tak pernah cocok (sama seperti `findByFullText` di atas, tapi pakai
    // `.includes` krn cuma perlu SATU dari beberapa preset yg match "month").
    await screen.findByText(
      (_content, el) =>
        el?.tagName === "SPAN" && el.textContent.includes("this_month"),
    );
    await enterFinishApply(user);

    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    const leaf = Object.values(
      bar.props.onTreeChange.mock.calls[0][0].root.c,
    )[0];
    expect(leaf.o).toBe("in_period");
  });

  it("token belum lengkap ('Q2', tanpa tahun) -> saran meniru format ('Q2 <tahun>'); klik salah satu commit", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await typeInto(user, bar.input, "Dibuat");
    await pickColumnSuggestion(user, "Dibuat");

    await user.type(bar.input, "Q2");
    const now = new Date();
    const candidateYear = now.getFullYear();
    const candidate = await screen.findByText(`Q2 ${candidateYear}`);
    await user.click(candidate);
    await clickApply(user);

    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    const leaf = Object.values(
      bar.props.onTreeChange.mock.calls[0][0].root.c,
    )[0];
    expect(leaf.v.period).toBe("quarter");
    expect(leaf.v.quarter).toBe(1);
    expect(leaf.v.year).toBe(candidateYear);
  });

  it("widget DateSelector ter-embed PENUH di dropdown (kalender muncul di bawah preset)", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await typeInto(user, bar.input, "Dibuat");
    await pickColumnSuggestion(user, "Dibuat");

    expect(await screen.findByRole("grid")).toBeInTheDocument();
  });

  it("klik tanggal di kalender ter-embed -> LANGSUNG komit ke draft & tutup dropdown (revisi 9); apply via Search, bukan otomatis", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await typeInto(user, bar.input, "Dibuat");
    await pickColumnSuggestion(user, "Dibuat");

    const grid = await screen.findByRole("grid");
    const todayCell = within(grid).getByRole("button", { name: /^Today/ });
    await user.click(todayCell);
    // Belum commit (klik widget BUKAN salah satu dari 3 jalur exit).
    expect(bar.props.onTreeChange).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");
    await clickApply(user);

    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    const leaf = Object.values(
      bar.props.onTreeChange.mock.calls[0][0].root.c,
    )[0];
    expect(leaf.o).toBe("in_period");
    expect(leaf.v.period).toBe("day");
  });
});

describe("SearchBar — revisi 6: hint discoverability footer (Requirement 31)", () => {
  it("kolom text -> legend petunjuk muncul (tombol <kbd> + penjelasan), bukan satu kalimat panjang", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await typeInto(user, bar.input, "Kode");
    await pickColumnSuggestion(user, "Kode");
    const legend = screen.getByTestId("search-legend");
    expect(
      within(legend).getByText("TR:core.datatable.search.legend.exclude"),
    ).toBeInTheDocument();
    expect(
      within(legend).getByText(
        "TR:core.datatable.search.legend.enter_finish_empty",
      ),
    ).toBeInTheDocument();
    // pemisah text: | ; , -- masing-masing SATU tombol.
    for (const key of ["|", ";", ","]) {
      expect(
        within(legend)
          .getAllByText(key)
          .some((el) => el.tagName === "KBD"),
      ).toBe(true);
    }
  });

  it("kolom number: koma BUKAN pemisah di legend (desimal); ada legend bandingkan & rentang", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await typeInto(user, bar.input, "Total");
    await pickColumnSuggestion(user, "Total");
    const legend = screen.getByTestId("search-legend");
    expect(
      within(legend).queryByText(",", { selector: "kbd" }),
    ).not.toBeInTheDocument();
    expect(
      within(legend).getByText("TR:core.datatable.search.legend.compare"),
    ).toBeInTheDocument();
    expect(
      within(legend).getByText("TR:core.datatable.search.legend.range"),
    ).toBeInTheDocument();
  });

  it("kolom ber-opsi (list) -> hint muncul (feedback revisi 6: search box kini bisa diketik `a | b |`, bukan cuma centang)", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await typeInto(user, bar.input, "Status");
    await pickColumnSuggestion(user, "Status");
    // Kotak kosong: ↓ ke daftar & Enter = selesai (batal).
    const legend = screen.getByTestId("search-legend");
    expect(
      within(legend).getByText("TR:core.datatable.search.legend.option_down"),
    ).toBeInTheDocument();
    expect(
      within(legend).getByText(
        "TR:core.datatable.search.legend.enter_finish_empty",
      ),
    ).toBeInTheDocument();
    // Mengetik = opsi tersorot: Enter memilih opsi, Tab melengkapi, ↑ di
    // opsi pertama kembali ke kotak (tips berganti mengikuti kondisi).
    await user.type(bar.input, "Dr");
    const active = within(screen.getByTestId("search-legend"));
    for (const id of [
      "option_move",
      "option_pick",
      "option_back",
      "complete",
    ]) {
      expect(
        active.getByText(`TR:core.datatable.search.legend.${id}`),
      ).toBeInTheDocument();
    }
    expect(
      active.queryByText("TR:core.datatable.search.legend.enter_finish_empty"),
    ).not.toBeInTheDocument();
  });

  it("boolean: ↓ lalu Enter = pilih & terapkan; date: alur chip (selesai + simbol + contoh)", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await typeInto(user, bar.input, "Aktif");
    await pickColumnSuggestion(user, "Aktif");
    // Boolean idle: ↓ ke daftar; setelah panah, Enter = pilih & terapkan.
    expect(
      within(screen.getByTestId("search-legend")).getByText(
        "TR:core.datatable.search.legend.option_down",
      ),
    ).toBeInTheDocument();
    await user.keyboard("{ArrowDown}");
    expect(
      within(screen.getByTestId("search-legend")).getByText(
        "TR:core.datatable.search.legend.option_pick_apply",
      ),
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");

    await typeInto(user, bar.input, "Dibuat");
    await pickColumnSuggestion(user, "Dibuat");
    // date: alur chip (Enter kosong = selesai) + simbol & contoh format.
    const dateLegend = within(screen.getByTestId("search-legend"));
    for (const id of ["enter_finish_empty", "separator_number", "examples"]) {
      expect(
        dateLegend.getByText(`TR:core.datatable.search.legend.${id}`),
      ).toBeInTheDocument();
    }
  });

  it("mode key (belum pilih kolom) -> legend TIDAK muncul", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await user.click(bar.input);
    expect(
      screen.queryByText(/TR:core\.datatable\.search\.hint\./),
    ).not.toBeInTheDocument();
  });
});

describe("SearchBar — revisi 6: tooltip chip hover (Requirement 34)", () => {
  it("hover badan chip leaf -> tooltip muncul berisi label LENGKAP (sama teks chip)", async () => {
    const user = userEvent.setup({ delay: null });
    renderBar({
      tree: {
        root: { k: "and", c: { a: { k: "code", o: "matches", v: "abc" } } },
      },
    });
    const chipLabel = `Kode ${mockT("core.datatable.filter.operator.matches")} "abc"`;
    const chipButton = screen.getByText(chipLabel);
    await user.hover(chipButton);

    await waitFor(
      () => {
        // 1 di chip itu sendiri + 1 di TooltipContent (isi identik).
        expect(screen.getAllByText(chipLabel).length).toBeGreaterThan(1);
      },
      { timeout: 2000 },
    );
  });

  it("chip 'search' (Cari) TETAP pakai native title (bukan diganti Radix tooltip)", () => {
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
    renderBar({ tree: searchTree, getSearchColumns: () => ["code", "name"] });
    const chipButton = screen.getByText(
      mockT("core.datatable.search.search_chip", { text: "lap" }),
    );
    expect(chipButton).toHaveAttribute("title", "code, name");
  });
});

describe("SearchBar — feedback revisi 6: Enter pada item Panel (Requirement 33)", () => {
  it("panah dari input -> fokus item Panel; Enter MENGAKTIFKAN item itu (regresi: cmdk root ikut menangkap Enter & preventDefault -> klik native tak pernah terjadi)", async () => {
    const user = userEvent.setup({ delay: null });
    const onOpenBuilder = vi.fn();
    const bar = renderBar({ onOpenBuilder });
    await user.click(bar.input); // Panel (input kosong).
    await screen.findByText("TR:core.datatable.search.section.column");

    await user.keyboard("{ArrowDown}");
    const focused = document.activeElement;
    expect(focused).not.toBe(bar.input);

    await user.keyboard("{Enter}");
    // Item pertama Panel tanpa `model` = "Builder lanjutan".
    expect(onOpenBuilder).toHaveBeenCalledTimes(1);
  });

  it("Enter pada tombol kolom (Panel) masuk mode value kolom itu", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await user.click(bar.input);
    const columnSection = (
      await screen.findByText("TR:core.datatable.search.section.column")
    ).closest("section");
    within(columnSection).getByText("Kode").focus();

    await user.keyboard("{Enter}");
    expect(screen.getByText("[Kode:]")).toBeInTheDocument();
  });
});

describe("SearchBar — revisi 7: chip nilai untuk operator `in` (Requirement 36)", () => {
  const _checkbox = (name) => screen.getByLabelText(name);
  const applied = (bar) =>
    Object.values(bar.props.onTreeChange.mock.calls[0][0].root.c)[0];
  const openColumn = async (user, bar, typed, label = typed) => {
    await typeInto(user, bar.input, typed);
    await pickColumnSuggestion(user, label);
  };
  const openStatus = (user, bar) => openColumn(user, bar, "Status");

  it("klik opsi -> chip muncul di kotak, input kosong, opsi hilang dari daftar; hapus chip -> opsi muncul lagi", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await openStatus(user, bar);

    await user.click(await screen.findByText("Draft"));
    expect(valueChip("Draft")).toBeTruthy();
    expect(bar.input).toHaveValue("");
    expect(optionRow("Draft")).toBeUndefined();
    expect(optionRow("Selesai")).toBeTruthy();
    await user.click(optionRow("Selesai"));
    expect(valueChip("Selesai")).toBeTruthy();
    await user.click(chipRemoveButton("Draft"));
    expect(valueChip("Draft")).toBeUndefined();
    expect(optionRow("Draft")).toBeTruthy();
    expect(valueChip("Selesai")).toBeTruthy();
  });

  it("mengetik `draft|` -> chip kanonik 'Draft', input kosong, dropdown TETAP terbuka, opsi Draft tak tampil lagi", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await openStatus(user, bar);

    await user.type(bar.input, "draft|");
    expect(valueChip("Draft")).toBeTruthy();
    expect(bar.input).toHaveValue("");
    expect(optionRow("Selesai")).toBeTruthy();
    expect(optionRow("Draft")).toBeUndefined();
  });

  it("`draft|selesai|` -> 2 chip; Enter menyelesaikan (dropdown tertutup), Enter berikutnya meng-apply -> leaf 'in'", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await openStatus(user, bar);

    await user.type(bar.input, "draft|selesai|");
    await user.keyboard("{Enter}");
    // Selesai: mode value keluar & dropdown tertutup, belum ke host.
    expect(screen.queryByText("[Status:]")).not.toBeInTheDocument();
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(bar.props.onTreeChange).not.toHaveBeenCalled();

    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    expect(applied(bar)).toEqual({
      k: "status",
      o: "in",
      v: ["draft", "completed"],
    });
  });

  it("Enter TIDAK men-toggle opsi ter-highlight: tanpa chip & tanpa ketikan Enter keluar mode value tanpa leaf", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await openStatus(user, bar);

    await user.keyboard("{Enter}");
    expect(screen.queryByText("[Status:]")).not.toBeInTheDocument();
    await user.keyboard("{Enter}");
    expect(bar.props.onTreeChange).not.toHaveBeenCalled();
  });

  it("ketikan + Enter MEMILIH opsi ter-highlight -> chip, dropdown tetap terbuka; Enter (kotak kosong) menyelesaikan; Enter berikutnya meng-apply", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await openStatus(user, bar);

    await user.type(bar.input, "draft");
    await user.keyboard("{Enter}");
    expect(valueChip("Draft")).toBeTruthy();
    expect(bar.input).toHaveValue("");
    expect(screen.getByText("[Status:]")).toBeInTheDocument();
    expect(optionRow("Selesai")).toBeTruthy();

    await user.keyboard("{Enter}"); // tak ada ketikan/panah -> selesai.
    expect(screen.queryByText("[Status:]")).not.toBeInTheDocument();
    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    expect(applied(bar)).toEqual({ k: "status", o: "=", v: "draft" });
  });

  it("ketikan yang tak cocok opsi mana pun + Enter -> pesan, TIDAK selesai & tak jadi chip", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await openStatus(user, bar);

    await user.type(bar.input, "xyz");
    await user.keyboard("{Enter}");
    expect(screen.getByText("[Status:]")).toBeInTheDocument();
    expect(
      screen.getByText(
        `TR:core.datatable.search.option_not_found:${JSON.stringify({ text: "xyz" })}`,
      ),
    ).toBeInTheDocument();
  });

  it("ketikan parsial ('sel') + Enter memilih opsi ter-highlight yang cocok ('Selesai')", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await openStatus(user, bar);

    await user.type(bar.input, "sel");
    await user.keyboard("{Enter}");
    expect(valueChip("Selesai")).toBeTruthy();
    expect(bar.input).toHaveValue("");
  });

  it("tanpa ketikan/panah Enter = selesai (opsi pertama tak dipilih diam2); ArrowDown lalu Enter memilih opsi pertama (chip), mode value tetap", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await openStatus(user, bar);

    await screen.findByText("Draft");
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");
    expect(valueChip("Draft")).toBeTruthy();
    expect(screen.getByText("[Status:]")).toBeInTheDocument();
    // niat direset -> Enter berikutnya menyelesaikan (bukan memilih Selesai).
    await user.keyboard("{Enter}");
    expect(valueChip("Selesai")).toBeUndefined();
    expect(screen.queryByText("[Status:]")).not.toBeInTheDocument();
  });

  it("segmen sebelum `|` tak cocok label mana pun -> pesan, tak ada chip, teks dibiarkan", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await openStatus(user, bar);

    await user.type(bar.input, "Xyz|");
    expect(
      screen.getByText(
        `TR:core.datatable.search.option_not_found:${JSON.stringify({ text: "Xyz" })}`,
      ),
    ).toBeInTheDocument();
    expect(bar.input).toHaveValue("Xyz|");
    expect(valueChip("Xyz")).toBeUndefined();
  });

  it("ketikan sesudah chip hanya memfilter daftar; chip tetap, opsi terpilih tak tampil di daftar", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await openStatus(user, bar);

    await user.type(bar.input, "draft|sel");
    expect(bar.input).toHaveValue("sel");
    expect(valueChip("Draft")).toBeTruthy();
    expect(optionRow("Draft")).toBeUndefined();
    expect(optionRow("Selesai")).toBeTruthy();
  });

  it("tombol × pada chip menghapus nilai (opsi muncul lagi di daftar)", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await openStatus(user, bar);

    await user.type(bar.input, "draft|selesai|");
    await user.click(chipRemoveButton("Draft"));
    expect(valueChip("Draft")).toBeUndefined();
    expect(valueChip("Selesai")).toBeTruthy();
    expect(optionRow("Draft")).toBeTruthy();
  });

  it("Backspace di input kosong: langkah 1 menyorot chip terakhir, langkah 2 menghapusnya", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await openStatus(user, bar);

    await user.type(bar.input, "draft|selesai|");
    await user.keyboard("{Backspace}");
    expect(valueChip("Selesai").className).toContain("ring-destructive");
    expect(valueChip("Draft").className).not.toContain("ring-destructive");
    await user.keyboard("{Backspace}");
    expect(valueChip("Selesai")).toBeUndefined();
    expect(valueChip("Draft")).toBeTruthy();
  });

  it("ArrowLeft/ArrowRight memindah sorotan antar chip; Backspace/Delete menghapus chip yang tersorot (bukan hanya yang terakhir)", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await openStatus(user, bar);

    await user.type(bar.input, "draft|selesai|");
    await user.keyboard("{ArrowLeft}");
    expect(valueChip("Selesai").className).toContain("ring-destructive");
    await user.keyboard("{ArrowLeft}");
    expect(valueChip("Draft").className).toContain("ring-destructive");
    await user.keyboard("{ArrowRight}");
    expect(valueChip("Selesai").className).toContain("ring-destructive");
    await user.keyboard("{ArrowRight}"); // lewat ujung -> kembali ke input.
    expect(valueChip("Selesai").className).not.toContain("ring-destructive");

    await user.keyboard("{ArrowLeft}{ArrowLeft}{Delete}");
    expect(valueChip("Draft")).toBeUndefined();
    expect(valueChip("Selesai")).toBeTruthy();
  });

  it("mengetik melepas sorotan chip", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await openStatus(user, bar);

    await user.type(bar.input, "draft|");
    await user.keyboard("{ArrowLeft}");
    expect(valueChip("Draft").className).toContain("ring-destructive");
    await user.keyboard("x");
    expect(valueChip("Draft").className).not.toContain("ring-destructive");
  });

  it("Backspace di input kosong TANPA chip keluar dari mode value (perilaku lama)", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await openStatus(user, bar);

    await user.keyboard("{Backspace}");
    expect(screen.queryByText("[Status:]")).not.toBeInTheDocument();
  });

  it("`!` di awal tetap di input setelah konversi chip: `!draft|` -> chip + '!', badge Kecualikan, leaf '!='", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await openStatus(user, bar);

    await user.type(bar.input, "!draft|");
    expect(valueChip("Draft")).toBeTruthy();
    expect(bar.input).toHaveValue("!");
    expect(
      screen.getByText("TR:core.datatable.search.exclude_badge"),
    ).toBeInTheDocument();
    await user.keyboard("{Enter}{Enter}");
    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    expect(applied(bar)).toEqual({ k: "status", o: "!=", v: "draft" });
  });

  it("edit chip multi-value -> nilai tampil sbg CHIP (input kosong), tak ada di daftar opsi", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar({
      tree: {
        root: {
          k: "and",
          c: { x: { k: "status", o: "in", v: ["draft", "completed"] } },
        },
      },
    });

    await user.click(screen.getByText(/Status:/));
    expect(bar.input).toHaveValue("");
    expect(valueChip("Draft")).toBeTruthy();
    expect(valueChip("Selesai")).toBeTruthy();
    expect(optionRow("Draft")).toBeUndefined();
  });

  it("edit chip negasi (`!in`) -> chip + '!' di input", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar({
      tree: {
        root: {
          k: "and",
          c: { x: { k: "status", o: "!in", v: ["draft", "completed"] } },
        },
      },
    });

    await user.click(screen.getByText(/operator\.!in/));
    expect(bar.input).toHaveValue("!");
    expect(valueChip("Draft")).toBeTruthy();
  });

  it("boolean MAKSIMAL satu chip (backend hanya menerima '='/'!=' utk boolean): pilihan berikutnya menggantikan", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await openColumn(user, bar, "Aktif");

    await user.type(bar.input, "TR:core.datatable.yes|");
    expect(valueChip("TR:core.datatable.yes")).toBeTruthy();

    await user.type(bar.input, "TR:core.datatable.no|");
    expect(valueChip("TR:core.datatable.no")).toBeTruthy();
    expect(valueChip("TR:core.datatable.yes")).toBeUndefined();

    await user.keyboard("{Enter}"); // boolean tanpa `in`: Enter pertama = selesai + apply.
    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    expect(applied(bar)).toEqual({ k: "active", o: "=", v: false });
  });

  it("boolean (tanpa operator `in`): ketikan + Enter memilih DAN meng-apply sekaligus (Enter pertama)", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await openColumn(user, bar, "Aktif");

    await user.type(bar.input, "TR:core.datatable.yes");
    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    expect(applied(bar)).toEqual({ k: "active", o: "=", v: true });
    expect(screen.queryByText("[Aktif:]")).not.toBeInTheDocument();
  });

  it("boolean: pilih opsi lewat klik (chip) lalu Enter (kotak kosong) -> apply; tanpa chip Enter hanya keluar tanpa apply", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await openColumn(user, bar, "Aktif");

    await user.keyboard("{Enter}"); // tak ada nilai -> keluar saja.
    expect(screen.queryByText("[Aktif:]")).not.toBeInTheDocument();
    expect(bar.props.onTreeChange).not.toHaveBeenCalled();

    await typeInto(user, bar.input, "Aktif");
    await pickColumnSuggestion(user, "Aktif");
    await user.click(await screen.findByText("TR:core.datatable.no"));
    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    expect(applied(bar)).toEqual({ k: "active", o: "=", v: false });
  });

  it("date: Enter pada preset ter-highlight = chip; Enter selesai; Enter apply", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await openColumn(user, bar, "Dibuat");

    await user.keyboard("{ArrowDown}");
    await enterFinishApply(user);
    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    expect(applied(bar).o).toBe("in_period");
    // Nilai HARUS berisi periode nyata dari preset -- bukan value kosong dari
    // emisi-mount widget (`{period:"day", operator:"is"}` tanpa tanggal).
    const v = applied(bar).v;
    expect(v.startDate ?? v.year).toBeTruthy();
    expect(screen.queryByText("[Dibuat:]")).not.toBeInTheDocument();
  });

  describe("relation", () => {
    const elektronik = { id: 3, name: "Elektronik" };
    const furnitur = { id: 4, name: "Furnitur" };
    const openCategory = (user, bar) => openColumn(user, bar, "Kategori");

    it("klik record -> chip; ketik `furnitur|` (tampil di daftar) -> chip kedua; Enter Enter -> leaf 'in'", async () => {
      axiosPost.mockResolvedValue({ data: { data: [elektronik, furnitur] } });
      const user = userEvent.setup({ delay: null });
      const bar = renderBar();
      await openCategory(user, bar);

      await user.click(await screen.findByText("Elektronik"));
      expect(valueChip("Elektronik")).toBeTruthy();
      expect(bar.input).toHaveValue("");

      await user.type(bar.input, "furnitur|");
      expect(valueChip("Furnitur")).toBeTruthy();

      await user.keyboard("{Enter}{Enter}");
      await waitFor(() =>
        expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
      );
      expect(applied(bar)).toEqual({
        k: "category",
        o: "in",
        v: [elektronik, furnitur],
      });
    });

    it("label diketik LEBIH CEPAT dari debounce fetch -> di-resolve lewat fetch langsung ke endpoint yg sama", async () => {
      axiosPost.mockImplementation((_url, payload) =>
        Promise.resolve({
          data: {
            data: payload.search === "Elektronik" ? [elektronik] : [],
          },
        }),
      );
      const user = userEvent.setup({ delay: null });
      const bar = renderBar();
      await openCategory(user, bar);

      await user.type(bar.input, "Elektronik|");
      await waitFor(() => expect(valueChip("Elektronik")).toBeTruthy());
      expect(bar.input).toHaveValue("");
      expect(screen.queryByText(/option_not_found/)).not.toBeInTheDocument();

      await user.keyboard("{Enter}{Enter}");
      await waitFor(() =>
        expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
      );
      expect(applied(bar)).toEqual({ k: "category", o: "=", v: elektronik });
    });

    it("record yang pernah tampil tetap dikenali saat daftar sedang memuat ulang (Tab lalu `|`) -- regresi verifikasi browser: fetch ber-key baru mengosongkan options sementara", async () => {
      axiosPost.mockImplementation((_url, payload) =>
        payload.search === "Elektronik"
          ? new Promise(() => {}) // pending selamanya: daftar kosong.
          : Promise.resolve({ data: { data: [elektronik] } }),
      );
      const user = userEvent.setup({ delay: null });
      const bar = renderBar();
      await openCategory(user, bar);

      await user.type(bar.input, "ele");
      await screen.findByText("Elektronik");
      await user.keyboard("{Tab}");
      expect(bar.input).toHaveValue("Elektronik");
      // lewati debounce fetch (500ms) -> key baru -> options kosong.
      await act(async () => {
        await new Promise((r) => setTimeout(r, 700));
      });
      await user.keyboard("|");
      expect(valueChip("Elektronik")).toBeTruthy();
      expect(bar.input).toHaveValue("");
    });

    it("Enter dgn ketikan cocok yg belum ada di daftar -> di-resolve dulu lalu selesai", async () => {
      axiosPost.mockImplementation((_url, payload) =>
        Promise.resolve({
          data: {
            data: payload.search === "Elektronik" ? [elektronik] : [],
          },
        }),
      );
      const user = userEvent.setup({ delay: null });
      const bar = renderBar();
      await openCategory(user, bar);

      await user.type(bar.input, "Elektronik");
      await user.keyboard("{Enter}");
      await waitFor(() =>
        expect(screen.queryByText("[Kategori:]")).not.toBeInTheDocument(),
      );
      await user.keyboard("{Enter}");
      await waitFor(() =>
        expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
      );
      expect(applied(bar)).toEqual({ k: "category", o: "=", v: elektronik });
    });

    it("label yang memang tak ada di server -> pesan tampil, tak jadi chip", async () => {
      axiosPost.mockResolvedValue({ data: { data: [] } });
      const user = userEvent.setup({ delay: null });
      const bar = renderBar();
      await openCategory(user, bar);

      await user.type(bar.input, "Gaib|");
      await waitFor(() =>
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({ search: "Gaib" }),
        ),
      );
      expect(
        screen.getByText(
          `TR:core.datatable.search.option_not_found:${JSON.stringify({ text: "Gaib" })}`,
        ),
      ).toBeInTheDocument();
      expect(bar.input).toHaveValue("Gaib|");
    });

    it("dua record berlabel sama: mengetik label itu dua kali memilih KEDUANYA (yang belum terpilih)", async () => {
      const a = { id: 1, name: "Sparepart" };
      const b = { id: 2, name: "Sparepart" };
      axiosPost.mockResolvedValue({ data: { data: [a, b] } });
      const user = userEvent.setup({ delay: null });
      const bar = renderBar();
      await openCategory(user, bar);

      await screen.findAllByText("Sparepart");
      await user.type(bar.input, "sparepart|sparepart|");
      expect(screen.getAllByText("Sparepart").length).toBeGreaterThanOrEqual(2);
      await user.keyboard("{Enter}{Enter}");
      await waitFor(() =>
        expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
      );
      expect(applied(bar)).toEqual({ k: "category", o: "in", v: [a, b] });
    });
  });

  describe("pemisah `;` (semua tipe) dan `,` (selain number)", () => {
    it("list: `draft;selesai;` -> 2 chip; `,` juga pemisah", async () => {
      const user = userEvent.setup({ delay: null });
      const bar = renderBar();
      await openStatus(user, bar);

      await user.type(bar.input, "draft;");
      expect(valueChip("Draft")).toBeTruthy();
      await user.type(bar.input, "selesai,");
      expect(valueChip("Selesai")).toBeTruthy();
      expect(bar.input).toHaveValue("");
    });

    it("text: `a;b,c,` -> 3 chip; Enter Enter -> 'in'", async () => {
      const user = userEvent.setup({ delay: null });
      const bar = renderBar();
      await openColumn(user, bar, "Kode");

      await user.type(bar.input, "a;b,c,");
      expect(valueChip("a")).toBeTruthy();
      expect(valueChip("b")).toBeTruthy();
      expect(valueChip("c")).toBeTruthy();
      await user.keyboard("{Enter}{Enter}");
      await waitFor(() =>
        expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
      );
      expect(applied(bar)).toEqual({ k: "code", o: "in", v: ["a", "b", "c"] });
    });

    it("number: `;` pemisah, tapi `,` BUKAN (desimal) -> '10,5' tetap satu ketikan tanpa chip", async () => {
      const user = userEvent.setup({ delay: null });
      const bar = renderBar();
      await openColumn(user, bar, "Total");

      await user.type(bar.input, "10,5");
      expect(bar.input).toHaveValue("10,5");
      expect(valueChip("10")).toBeUndefined();
      await user.clear(bar.input);
      await user.type(bar.input, "100;200;");
      expect(valueChip("100")).toBeTruthy();
      expect(valueChip("200")).toBeTruthy();
    });

    it("paste dgn `;` (tanpa pemisah di ujung) -> segmen terakhir ikut jadi chip", async () => {
      const user = userEvent.setup({ delay: null });
      const bar = renderBar();
      await openColumn(user, bar, "Kode");

      await user.click(bar.input);
      await user.paste("a;b;c");
      expect(valueChip("c")).toBeTruthy();
      expect(bar.input).toHaveValue("");
    });

    it("relation: label yang memuat koma (`PT Maju, Tbk`) TIDAK dipecah -- Tab melengkapi, `;` lalu menjadikannya chip", async () => {
      const pt = { id: 7, name: "PT Maju, Tbk" };
      axiosPost.mockResolvedValue({ data: { data: [pt] } });
      const user = userEvent.setup({ delay: null });
      const bar = renderBar();
      await openColumn(user, bar, "Kategori");

      await screen.findByText("PT Maju, Tbk");
      await user.type(bar.input, "pt ma");
      await user.keyboard("{Tab}");
      expect(bar.input).toHaveValue("PT Maju, Tbk");
      expect(valueChip("PT Maju")).toBeUndefined();
      await user.keyboard(";");
      expect(valueChip("PT Maju, Tbk")).toBeTruthy();
      expect(bar.input).toHaveValue("");
    });
  });

  describe("text & number", () => {
    it("text: `a|b|` -> 2 chip; Enter Enter -> leaf 'in'", async () => {
      const user = userEvent.setup({ delay: null });
      const bar = renderBar();
      await openColumn(user, bar, "Kode");

      await user.type(bar.input, "a|b|");
      expect(valueChip("a")).toBeTruthy();
      expect(valueChip("b")).toBeTruthy();
      expect(bar.input).toHaveValue("");
      await user.keyboard("{Enter}{Enter}");
      await waitFor(() =>
        expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
      );
      expect(applied(bar)).toEqual({ k: "code", o: "in", v: ["a", "b"] });
    });

    it("text: satu nilai tanpa `|` + Enter -> 'matches' (perilaku lama tetap)", async () => {
      const user = userEvent.setup({ delay: null });
      const bar = renderBar();
      await openColumn(user, bar, "Kode");

      await user.type(bar.input, "abc");
      await user.keyboard("{Enter}{Enter}{Enter}"); // chip, selesai, apply
      await waitFor(() =>
        expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
      );
      expect(applied(bar)).toEqual({ k: "code", o: "matches", v: "abc" });
    });

    it("text: `!a|b|` -> '!in' (bukan '!matches \"a|b\"' spt jalur string lama)", async () => {
      const user = userEvent.setup({ delay: null });
      const bar = renderBar();
      await openColumn(user, bar, "Kode");

      await user.type(bar.input, "!a|b|");
      await user.keyboard("{Enter}{Enter}");
      await waitFor(() =>
        expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
      );
      expect(applied(bar)).toEqual({ k: "code", o: "!in", v: ["a", "b"] });
    });

    it("text: paste `a|b|c` -> tiga chip (segmen terakhir ikut jadi chip)", async () => {
      const user = userEvent.setup({ delay: null });
      const bar = renderBar();
      await openColumn(user, bar, "Kode");

      await user.click(bar.input);
      await user.paste("a|b|c");
      expect(valueChip("a")).toBeTruthy();
      expect(valueChip("b")).toBeTruthy();
      expect(valueChip("c")).toBeTruthy();
      expect(bar.input).toHaveValue("");
    });

    it("number: `100|200|` -> chip; Enter Enter -> 'in' [100, 200]", async () => {
      const user = userEvent.setup({ delay: null });
      const bar = renderBar();
      await openColumn(user, bar, "Total");

      await user.type(bar.input, "100|200|");
      expect(valueChip("100")).toBeTruthy();
      await user.keyboard("{Enter}{Enter}");
      await waitFor(() =>
        expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
      );
      expect(applied(bar)).toEqual({ k: "total", o: "in", v: [100, 200] });
    });

    it("number: segmen bukan angka sebelum `|` -> pesan, tak jadi chip; ekspresi tunggal (`>=500`) + Enter langsung selesai", async () => {
      const user = userEvent.setup({ delay: null });
      const bar = renderBar();
      await openColumn(user, bar, "Total");

      await user.type(bar.input, "abc|");
      expect(
        screen.getByText("TR:core.datatable.search.number_invalid"),
      ).toBeInTheDocument();
      expect(valueChip("abc")).toBeUndefined();

      await user.clear(bar.input);
      await user.type(bar.input, ">=500");
      await user.keyboard("{Enter}{Enter}");
      await waitFor(() =>
        expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
      );
      expect(applied(bar)).toEqual({ k: "total", o: ">=", v: 500 });
    });

    it("edit chip 'in' text -> nilai tampil sbg chip", async () => {
      const user = userEvent.setup({ delay: null });
      const bar = renderBar({
        tree: {
          root: {
            k: "and",
            c: { x: { k: "code", o: "in", v: ["a", "b"] } },
          },
        },
      });

      await user.click(screen.getByText(/Kode:/));
      expect(bar.input).toHaveValue("");
      expect(valueChip("a")).toBeTruthy();
      expect(valueChip("b")).toBeTruthy();
    });
  });
});

describe("SearchBar — revisi 7: Tab completion (Requirement 38)", () => {
  const openColumn = async (user, bar, typed) => {
    await typeInto(user, bar.input, typed);
    await pickColumnSuggestion(user, typed);
  };

  it("mode key: Tab memilih saran kolom ter-highlight (setara ':')", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await typeInto(user, bar.input, "Stat");
    await screen.findByText("TR:core.datatable.search.section.column");
    await user.keyboard("{Tab}");
    expect(screen.getByText("[Status:]")).toBeInTheDocument();
    expect(bar.input).toHaveFocus();
  });

  it("mode value list: Tab menulis label opsi ter-highlight ke input TANPA memilihnya; `|` lalu menjadikannya chip", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await openColumn(user, bar, "Status");

    await user.type(bar.input, "sel");
    await user.keyboard("{Tab}");
    expect(bar.input).toHaveValue("Selesai");
    expect(bar.input).toHaveFocus();
    expect(valueChip("Selesai")).toBeUndefined();
    await user.keyboard("|");
    expect(valueChip("Selesai")).toBeTruthy();
  });

  it("mode value: Tab mempertahankan awalan '!'", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await openColumn(user, bar, "Status");

    await user.type(bar.input, "!sel");
    await user.keyboard("{Tab}");
    expect(bar.input).toHaveValue("!Selesai");
  });

  it("mode value: input kosong -> Tab normal (tak menulis apa pun)", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await openColumn(user, bar, "Status");

    await user.keyboard("{Tab}");
    expect(bar.input).toHaveValue("");
    expect(valueChip("Draft")).toBeUndefined();
  });

  it("highlight default melompati opsi yang sudah jadi chip (Tab melengkapi opsi BELUM terpilih)", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await openColumn(user, bar, "Status");

    await user.click(await screen.findByText("Draft")); // chip Draft.
    await user.type(bar.input, "a"); // cocok Draft (checked) & Selesai.
    await user.keyboard("{Tab}");
    expect(bar.input).toHaveValue("Selesai");
  });

  it("relation: Tab melengkapi label record ter-highlight yang cocok dgn ketikan", async () => {
    axiosPost.mockResolvedValue({
      data: {
        data: [
          { id: 3, name: "Elektronik" },
          { id: 4, name: "Furnitur" },
        ],
      },
    });
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await typeInto(user, bar.input, "Kategori");
    await pickColumnSuggestion(user, "Kategori");

    await screen.findByText("Elektronik");
    await user.type(bar.input, "ele");
    await user.keyboard("{Tab}");
    expect(bar.input).toHaveValue("Elektronik");
  });

  it("date: Tab menulis label saran periode ter-highlight (mis. 'Q2' -> '<tahun> Q2')", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await openColumn(user, bar, "Dibuat");

    await user.type(bar.input, "Q2");
    await screen.findAllByText(/^Q2 \d{4}$/);
    await user.keyboard("{Tab}");
    expect(bar.input.value).toMatch(/^Q2 \d{4}$/);
  });
});

describe("SearchBar — feedback revisi 6: format tanggal ketik & serialisasi leaf tanggal (Requirement 30.3, 30.6)", () => {
  const applied = (bar) =>
    Object.values(bar.props.onTreeChange.mock.calls[0][0].root.c)[0];
  const openDate = async (user, bar) => {
    await typeInto(user, bar.input, "Dibuat");
    await pickColumnSuggestion(user, "Dibuat");
  };

  it.each([
    ["15/09/26", "2026-09-15"],
    ["15.09.2026", "2026-09-15"],
    ["2026/09/15", "2026-09-15"],
    ["15 Sep 2026", "2026-09-15"],
    ["15 September 2026", "2026-09-15"],
    ["Sep 15 2026", "2026-09-15"],
    ["September 15, 2026", "2026-09-15"],
  ])(
    "ketik '%s' + Enter -> leaf day, startDate string lokal '%s' (bukan Date/UTC ISO)",
    async (text, expected) => {
      const user = userEvent.setup({ delay: null });
      const bar = renderBar();
      await openDate(user, bar);

      await user.type(bar.input, text);
      await enterFinishApply(user);
      await waitFor(() =>
        expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
      );
      expect(applied(bar)).toEqual({
        k: "created_at",
        o: "in_period",
        v: { period: "day", operator: "is", startDate: expected },
      });
    },
  );

  it("rentang hari 'dd/MM/yyyy..dd/MM/yyyy' -> between, dua string lokal", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await openDate(user, bar);

    await user.type(bar.input, "01/01/2026..31/01/2026");
    await finishApplySymbol(user);
    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    expect(applied(bar).v).toEqual({
      period: "day",
      operator: "between",
      startDate: "2026-01-01",
      endDate: "2026-01-31",
    });
  });

  it("klik tanggal di kalender ter-embed -> startDate string lokal 'YYYY-MM-DD' (bukan ISO UTC)", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await openDate(user, bar);

    const grid = await screen.findByRole("grid");
    await user.click(within(grid).getByRole("button", { name: /^Today/ }));
    await user.keyboard("{Escape}");
    await clickApply(user);
    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    expect(applied(bar).v.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  // Revisi 8 (Requirement 45): audit date/datetime.
  it("kolom date: buka lalu Escape + Search TANPA memilih apa pun -> tak ada leaf kosong (emisi-mount widget bukan pilihan)", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await openDate(user, bar);
    await screen.findByRole("grid");

    await user.keyboard("{Escape}");
    await clickApply(user);

    const leaves = bar.props.onTreeChange.mock.calls.flatMap(([tree]) =>
      Object.values(tree?.root?.c ?? {}),
    );
    expect(leaves).toEqual([]);
  });

  it("pintasan 'Hari ini' widget di kolom date -> startDate hari ini TANPA jam (bukan jam sekarang)", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await openDate(user, bar);
    await screen.findByRole("grid");

    await user.click(
      screen.getByRole("button", {
        name: "TR:core.datatable.filter.dateselector.today.day",
      }),
    );
    await user.keyboard("{Escape}");
    await clickApply(user);
    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );

    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    expect(applied(bar).v.startDate).toBe(
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    );
  });

  describe("kolom datetime", () => {
    const datetimeColumns = {
      ...columns,
      updated_at: { name: "updated_at", title: "Diubah", type: "datetime" },
    };
    const openDatetime = async (user, bar) => {
      await typeInto(user, bar.input, "Diubah");
      await pickColumnSuggestion(user, "Diubah");
    };

    it.each([
      ["15/09/2026 14:30", "2026-09-15 14:30"],
      ["15 Sep 2026 08:05", "2026-09-15 08:05"],
      ["15/09/2026", "2026-09-15"],
      ["15/09/2026 00:00", "2026-09-15"],
    ])(
      "ketik '%s' + Enter -> startDate lokal '%s' (jam presisi-menit hanya bila bukan 00:00)",
      async (text, expected) => {
        const user = userEvent.setup({ delay: null });
        const bar = renderBar({ columns: datetimeColumns });
        await openDatetime(user, bar);

        await user.type(bar.input, text);
        await enterFinishApply(user);
        await waitFor(() =>
          expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
        );
        expect(applied(bar)).toEqual({
          k: "updated_at",
          o: "in_period",
          v: { period: "day", operator: "is", startDate: expected },
        });
      },
    );

    it("rentang berjam 'a..b' -> between, dua string lokal berjam", async () => {
      const user = userEvent.setup({ delay: null });
      const bar = renderBar({ columns: datetimeColumns });
      await openDatetime(user, bar);

      await user.type(bar.input, "15/09/2026 08:00..15/09/2026 17:00");
      await finishApplySymbol(user);
      await waitFor(() =>
        expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
      );
      expect(applied(bar).v).toEqual({
        period: "day",
        operator: "between",
        startDate: "2026-09-15 08:00",
        endDate: "2026-09-15 17:00",
      });
    });
  });
});

describe("SearchBar — revisi 8: tata letak area nilai & penanda chip yang diedit", () => {
  it("mode value + sudah ada chip lain -> area nilai berdasar lebar 24rem (basis-96): turun ke baris baru HANYA bila sisa ruang kurang, bukan selalu", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar({ tree: statusDraftTree });

    await typeInto(user, bar.input, "Kode");
    await pickColumnSuggestion(user, "Kode");
    const row = bar.input.parentElement;
    expect(row.className).toContain("basis-96");
    expect(row.className).toContain("flex-1");
    // TIDAK dipaksa satu baris penuh (`basis-full order-last` lama).
    expect(row.className).not.toContain("basis-full");
    expect(row.className).not.toContain("order-last");
  });

  it("mode value TANPA chip lain -> area nilai tetap satu baris dgn ikon (flex-1)", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();

    await typeInto(user, bar.input, "Kode");
    await pickColumnSuggestion(user, "Kode");
    const row = bar.input.parentElement;
    expect(row.className).not.toContain("basis-96");
    expect(row.className).toContain("flex-1");
  });

  it("chip filter yang sedang DIEDIT (mode value) DISEMBUNYIKAN dari daftar (bukan dipertahankan); muncul lagi setelah selesai", async () => {
    const user = userEvent.setup({ delay: null });
    const _bar = renderBar({
      tree: {
        root: {
          k: "and",
          c: {
            a: { k: "code", o: "matches", v: "abc" },
            b: { k: "status", o: "=", v: "draft" },
          },
        },
      },
    });

    expect(screen.getByText(/^Kode .*abc/)).toBeInTheDocument();
    await user.click(screen.getByText(/^Kode .*abc/));
    // Chip Kode hilang (nilainya sudah di kotak); penanda kolom tampil.
    expect(screen.queryByText(/^Kode .*abc/)).not.toBeInTheDocument();
    expect(screen.getByText("[Kode:]")).toBeInTheDocument();
    // chip lain tetap tampil.
    expect(screen.getByText(/Status: Draft/)).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.getByText(/^Kode .*abc/)).toBeInTheDocument();
    expect(document.querySelector("[data-editing]")).toBeNull();
  });
});

describe("SearchBar — revisi 8: navigasi panah chip utama (Requirement 44)", () => {
  const twoLeafTree = {
    root: {
      k: "and",
      c: {
        a: { k: "code", o: "matches", v: "abc" },
        b: { k: "status", o: "=", v: "draft" },
      },
    },
  };
  const chipSpan = (re) => screen.getByText(re).closest("span");
  const ringed = (re) => chipSpan(re).className.includes("ring-destructive");

  it("ArrowLeft dari input kosong menyorot chip TERAKHIR; ArrowLeft/Right menggeser; ArrowRight lewat ujung kembali ke input", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar({ tree: twoLeafTree });
    await user.click(bar.input);

    await user.keyboard("{ArrowLeft}");
    expect(ringed(/Status: Draft/)).toBe(true);
    expect(ringed(/^Kode TR:/)).toBe(false);
    await user.keyboard("{ArrowLeft}");
    expect(ringed(/^Kode TR:/)).toBe(true);
    await user.keyboard("{ArrowRight}");
    expect(ringed(/Status: Draft/)).toBe(true);
    await user.keyboard("{ArrowRight}");
    expect(ringed(/Status: Draft/)).toBe(false);
    expect(ringed(/^Kode TR:/)).toBe(false);
  });

  it("Backspace/Delete menghapus chip yang tersorot (bukan hanya yang terakhir)", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar({ tree: twoLeafTree });
    await user.click(bar.input);

    await user.keyboard("{ArrowLeft}{ArrowLeft}{Delete}");
    expect(screen.queryByText(/^Kode TR:/)).not.toBeInTheDocument();
    expect(screen.getByText(/Status: Draft/)).toBeInTheDocument();
  });

  it("Enter pada chip tersorot membuka editornya (mode value kolom itu)", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar({ tree: twoLeafTree });
    await user.click(bar.input);

    await user.keyboard("{ArrowLeft}{ArrowLeft}{Enter}");
    expect(screen.getByText("[Kode:]")).toBeInTheDocument();
    expect(bar.input).toHaveValue("abc");
  });

  it("ArrowDown TETAP memfokuskan Panel (hanya kiri/kanan yang menavigasi chip)", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar({ tree: twoLeafTree });
    await user.click(bar.input);
    await screen.findByText("TR:core.datatable.search.section.column");

    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).not.toBe(bar.input);
    expect(ringed(/Status: Draft/)).toBe(false);
  });

  it("tanpa chip: ArrowLeft/Right tetap ke Panel (perilaku lama)", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await user.click(bar.input);
    await screen.findByText("TR:core.datatable.search.section.column");

    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).not.toBe(bar.input);
  });
});

describe("SearchBar — revisi 8: edit chip nilai text (Requirement 41)", () => {
  const applied = (bar) =>
    Object.values(bar.props.onTreeChange.mock.calls[0][0].root.c)[0];
  const openKode = async (user, bar) => {
    await typeInto(user, bar.input, "Kode");
    await pickColumnSuggestion(user, "Kode");
  };
  const chipButton = (label) => screen.getByRole("button", { name: label });

  it("klik chip text -> teks dimuat ke input, chip DISEMBUNYIKAN; hasil edit MENGGANTIKAN chip di posisi yang sama", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await openKode(user, bar);

    await user.type(bar.input, "abc|def|");
    await user.click(chipButton("abc"));
    expect(bar.input).toHaveValue("abc");
    // Chip yg diedit tak tampil (tak ada dua "salinan" nilai yg sama).
    expect(valueChip("abc")).toBeUndefined();
    expect(valueChip("def")).toBeTruthy();

    await user.type(bar.input, "X|");
    expect(valueChip("abc")).toBeUndefined();
    expect(valueChip("abcX")).toBeTruthy();
    // posisi TETAP (abcX sebelum def).
    expect(
      valueChip("abcX").compareDocumentPosition(valueChip("def")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("Enter saat mengedit menggantikan chip lalu menyelesaikan (leaf memakai nilai baru)", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await openKode(user, bar);

    await user.type(bar.input, "abc|def|");
    await user.click(chipButton("abc"));
    await user.clear(bar.input);
    await user.type(bar.input, "xyz");
    await user.keyboard("{Enter}{Enter}{Enter}");
    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    expect(applied(bar)).toEqual({ k: "code", o: "in", v: ["xyz", "def"] });
  });

  it("mengosongkan input lalu Enter MENGHAPUS chip yang diedit", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await openKode(user, bar);

    await user.type(bar.input, "abc|def|");
    await user.click(chipButton("abc"));
    await user.clear(bar.input);
    await user.keyboard("{Enter}{Enter}");
    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    expect(applied(bar)).toEqual({ k: "code", o: "matches", v: "def" });
  });

  it("Escape membuang edit: chip lama utuh (tak ada data hilang)", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await openKode(user, bar);

    await user.type(bar.input, "abc|def|");
    await user.click(chipButton("abc"));
    await user.clear(bar.input);
    await user.type(bar.input, "zzz");
    await user.keyboard("{Escape}");
    await clickApply(user);
    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    expect(applied(bar)).toEqual({ k: "code", o: "in", v: ["abc", "def"] });
  });

  it("chip tersorot (ArrowLeft) + Enter -> mode edit chip itu", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await openKode(user, bar);

    await user.type(bar.input, "abc|def|");
    await user.keyboard("{ArrowLeft}{Enter}");
    expect(bar.input).toHaveValue("def");
    expect(valueChip("def")).toBeUndefined();
    expect(valueChip("abc")).toBeTruthy();
  });

  it("ketikan yang sedang ada TIDAK hilang saat memilih chip lain untuk diedit (jadi chip dulu)", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await openKode(user, bar);

    await user.type(bar.input, "abc|def|ghi");
    await user.click(chipButton("abc"));
    expect(valueChip("ghi")).toBeTruthy();
    expect(bar.input).toHaveValue("abc");
  });

  it("chip nilai non-text (list) TIDAK berupa tombol edit", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await typeInto(user, bar.input, "Status");
    await pickColumnSuggestion(user, "Status");
    await user.type(bar.input, "draft|");
    expect(screen.queryByRole("button", { name: "Draft" })).toBeNull();
  });
});

describe("SearchBar — revisi 8: opsi Diisi / Tidak diisi (`set`/`!set`) semua tipe kolom (Requirement 40)", () => {
  const SET = "TR:core.datatable.filter.operator.set";
  const NOT_SET = "TR:core.datatable.filter.operator.!set";
  const applied = (bar) =>
    Object.values(bar.props.onTreeChange.mock.calls[0][0].root.c)[0];
  const open = async (user, bar, name) => {
    await typeInto(user, bar.input, name);
    await pickColumnSuggestion(user, name);
  };

  it.each([
    ["Kode", "text"],
    ["Total", "number"],
    ["Status", "list"],
    ["Aktif", "boolean"],
    ["Dibuat", "date"],
    ["Kategori", "relation"],
  ])("kolom %s (%s): opsi Diisi & Tidak diisi tampil", async (name) => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await open(user, bar, name);

    expect(optionRow(SET)).toBeTruthy();
    expect(optionRow(NOT_SET)).toBeTruthy();
  });

  it("klik 'Diisi' -> leaf {o:'set'} TANPA value + chip 'Kolom: Diisi'; klik tidak otomatis apply", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await open(user, bar, "Kode");

    await user.click(optionRow(SET));
    expect(bar.props.onTreeChange).not.toHaveBeenCalled();
    expect(screen.getByText(`Kode: ${SET}`)).toBeInTheDocument();
    expect(screen.queryByText("[Kode:]")).not.toBeInTheDocument();
    await clickApply(user);
    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    const leaf = applied(bar);
    expect(leaf.k).toBe("code");
    expect(leaf.o).toBe("set");
    expect("v" in leaf && leaf.v !== undefined).toBe(false);
  });

  it("'!' di awal membalik pilihan: '!' + klik 'Diisi' -> '!set'", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await open(user, bar, "Status");

    await user.type(bar.input, "!");
    await user.click(optionRow(SET));
    await clickApply(user);
    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    expect(applied(bar).o).toBe("!set");
  });

  it("text: ArrowDown menyorot opsi pertama ('Diisi') & Enter memilihnya + langsung meng-apply (tanpa operator `in`)", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await open(user, bar, "Kode");

    await user.keyboard("{ArrowDown}{Enter}");
    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    expect(applied(bar)).toMatchObject({ k: "code", o: "set" });
    expect(screen.queryByText("[Kode:]")).not.toBeInTheDocument();
  });

  it("text: tanpa panah Enter tetap = selesai (opsi Diisi tak dipilih diam2)", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await open(user, bar, "Kode");

    await user.type(bar.input, "abc");
    await user.keyboard("{Enter}{Enter}{Enter}");
    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    expect(applied(bar)).toEqual({ k: "code", o: "matches", v: "abc" });
  });

  it("date: klik 'Tidak diisi' -> '!set'; relation: klik 'Diisi' -> 'set' pada nama relasi", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await open(user, bar, "Dibuat");
    await user.click(optionRow(NOT_SET));

    await open(user, bar, "Kategori");
    await user.click(optionRow(SET));
    await clickApply(user);
    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    const leaves = Object.values(
      bar.props.onTreeChange.mock.calls[0][0].root.c,
    );
    expect(leaves).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ k: "created_at", o: "!set" }),
        expect.objectContaining({ k: "category", o: "set" }),
      ]),
    );
  });

  it("list: opsi 'Diisi' tersaring oleh ketikan & tak menggeser aturan Enter (Enter memilih opsi ter-highlight yang cocok)", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await open(user, bar, "Status");

    await user.type(bar.input, "sel");
    expect(optionRow(SET)).toBeUndefined();
    await user.keyboard("{Enter}");
    expect(valueChip("Selesai")).toBeTruthy();
  });

  it("edit chip 'set' membuka mode value kolom itu (tanpa chip nilai)", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar({
      tree: { root: { k: "and", c: { a: { k: "code", o: "set" } } } },
    });

    await user.click(screen.getByText(`Kode: ${SET}`));
    expect(screen.getByText("[Kode:]")).toBeInTheDocument();
    expect(bar.input).toHaveValue("");
    expect(optionRow(NOT_SET)).toBeTruthy();
  });
});

describe("SearchBar — revisi 9: Enter chip dulu, klik menutup, edit chip via keyboard, penanda kolom, tips panel", () => {
  const applied = (bar) =>
    Object.values(bar.props.onTreeChange.mock.calls[0][0].root.c)[0];
  const open = async (user, bar, name) => {
    await typeInto(user, bar.input, name);
    await pickColumnSuggestion(user, name);
  };
  const twoLeafTree = {
    root: {
      k: "and",
      c: {
        a: { k: "code", o: "matches", v: "abc" },
        b: { k: "status", o: "=", v: "draft" },
      },
    },
  };

  it("text: Enter pertama mengubah ketikan jadi chip (dropdown tetap terbuka, input kosong); Enter kedua menyelesaikan; Enter ketiga meng-apply", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await open(user, bar, "Kode");

    await user.type(bar.input, "abc");
    await user.keyboard("{Enter}");
    expect(valueChip("abc")).toBeTruthy();
    expect(bar.input).toHaveValue("");
    expect(screen.getByText("[Kode:]")).toBeInTheDocument();
    expect(bar.props.onTreeChange).not.toHaveBeenCalled();

    await user.keyboard("{Enter}");
    expect(screen.queryByText("[Kode:]")).not.toBeInTheDocument();
    expect(bar.props.onTreeChange).not.toHaveBeenCalled();

    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    expect(applied(bar)).toEqual({ k: "code", o: "matches", v: "abc" });
  });

  it("number: Enter pada ketikan bukan angka -> pesan, TIDAK jadi chip; '>=5' langsung selesai", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await open(user, bar, "Total");

    await user.type(bar.input, "abc");
    await user.keyboard("{Enter}");
    expect(
      screen.getByText("TR:core.datatable.search.number_invalid"),
    ).toBeInTheDocument();
    expect(valueChip("abc")).toBeUndefined();

    await user.clear(bar.input);
    await user.type(bar.input, ">=5");
    await user.keyboard("{Enter}");
    // Nilai bersimbol = satu-satunya nilai -> LANGSUNG selesai (bukan chip).
    expect(valueChip(">=5")).toBeUndefined();
    expect(screen.queryByText("[Total:]")).not.toBeInTheDocument();
    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    expect(applied(bar)).toEqual({ k: "total", o: ">=", v: 5 });
  });

  it("boolean: KLIK opsi = komit leaf + tutup dropdown (tanpa Enter); Enter (tertutup) meng-apply", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await open(user, bar, "Aktif");

    await user.click(await screen.findByText("TR:core.datatable.no"));
    expect(screen.queryByText("[Aktif:]")).not.toBeInTheDocument();
    expect(bar.props.onTreeChange).not.toHaveBeenCalled();

    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    expect(applied(bar)).toEqual({ k: "active", o: "=", v: false });
  });

  it("date: KLIK preset = menambah chip nilai (dropdown tetap terbuka, revisi 11)", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await open(user, bar, "Dibuat");

    await user.click(
      await screen.findByText("TR:core.datatable.search.period.this_month"),
    );
    // Revisi 11: klik preset MENAMBAH chip nilai; dropdown & mode value tetap.
    expect(screen.getByText("[Dibuat:]")).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /search\.remove_chip/ }),
    ).toHaveLength(1);
    expect(
      screen.getByText("TR:core.datatable.search.period.last_month"),
    ).toBeInTheDocument();
    expect(bar.props.onTreeChange).not.toHaveBeenCalled();
  });

  it("KLIK 'Diisi' (semua tipe) = komit leaf `set` + tutup dropdown", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await open(user, bar, "Kode");

    await user.click(optionRow("TR:core.datatable.filter.operator.set"));
    expect(screen.queryByText("[Kode:]")).not.toBeInTheDocument();
    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    expect(applied(bar)).toMatchObject({ k: "code", o: "set" });
  });

  it("penanda kolom yang sedang diatur nilainya tampil tegas (badge kontras tinggi, tebal)", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await open(user, bar, "Kode");

    const marker = screen.getByText("[Kode:]");
    expect(marker.className).toContain("bg-foreground");
    expect(marker.className).toContain("text-background");
    expect(marker.className).toContain("font-semibold");
  });

  it("chip filter tersorot panah + SPACE -> masuk edit (mode value kolomnya)", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar({ tree: twoLeafTree });
    await user.click(bar.input);

    await user.keyboard("{ArrowLeft}{ArrowLeft} ");
    expect(screen.getByText("[Kode:]")).toBeInTheDocument();
    expect(bar.input).toHaveValue("abc");
  });

  it("chip group tersorot panah + Enter/Space -> editor group terbuka", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar({
      groupOptions,
      group: [{ column: "created_at", granularity: "month", range: null }],
    });
    await user.click(bar.input);

    // Panel (kolom Group) juga punya Select granularity yg sama -- yg diuji
    // di sini: editor chip (popover) MENAMBAH satu editor lagi.
    const granularitySelects = () =>
      screen.queryAllByRole("combobox", {
        name: "TR:core.datatable.group_levels.granularity",
      });
    const before = granularitySelects().length;
    await user.keyboard("{ArrowLeft} ");
    await waitFor(() =>
      expect(granularitySelects().length).toBeGreaterThan(before),
    );
  });

  it("chip nilai text tersorot + Space/Enter -> masuk edit (teks dimuat ke input, chip bertanda)", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await open(user, bar, "Kode");
    await user.type(bar.input, "abc|def|");

    await user.keyboard("{ArrowLeft} ");
    expect(bar.input).toHaveValue("def");
    expect(valueChip("abc")).toBeTruthy();
  });

  it("chip nilai NUMBER tersorot + Enter -> masuk edit", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await open(user, bar, "Total");
    await user.type(bar.input, "100|200|");

    await user.keyboard("{ArrowLeft}{Enter}");
    expect(bar.input).toHaveValue("200");
  });

  it("chip nilai LIST tersorot + Enter -> chip dilepas, labelnya dimuat ke input", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await open(user, bar, "Status");
    await user.click(await screen.findByText("Draft"));
    expect(valueChip("Draft")).toBeTruthy();

    await user.keyboard("{ArrowLeft}{Enter}");
    expect(valueChip("Draft")).toBeUndefined();
    expect(bar.input).toHaveValue("Draft");
  });

  it("Panel (input kosong): tips tampil dgn kontras tinggi; tanpa chip -> tips chip tak tampil", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await user.click(bar.input);
    await screen.findByText("TR:core.datatable.search.section.column");

    const legend = screen.getByTestId("search-legend");
    expect(
      within(legend).getByText("TR:core.datatable.search.legend.column_pick"),
    ).toBeInTheDocument();
    expect(
      within(legend).queryByText("TR:core.datatable.search.legend.chip_nav"),
    ).not.toBeInTheDocument();
    expect(legend.querySelector("ul").className).toContain(
      "text-foreground/90",
    );
  });

  it("Panel dengan chip: tips 'sorot chip'; setelah chip tersorot (←) tips berganti ke pindah/edit/hapus chip", async () => {
    const user = userEvent.setup({ delay: null });
    const withChips = renderBar({ tree: twoLeafTree });
    await user.click(withChips.input);
    await screen.findByText("TR:core.datatable.search.section.column");
    expect(
      within(screen.getByTestId("search-legend")).getByText(
        "TR:core.datatable.search.legend.chip_focus_filter",
      ),
    ).toBeInTheDocument();

    await user.keyboard("{ArrowLeft}");
    const legend = within(screen.getByTestId("search-legend"));
    for (const id of ["chip_nav", "chip_edit", "chip_remove"]) {
      expect(
        legend.getByText(`TR:core.datatable.search.legend.${id}`),
      ).toBeInTheDocument();
    }
  });
});

describe("SearchBar — revisi 9: pilih tanggal di widget mengisi nilai; saran meniru format; format chip", () => {
  const applied = (bar) =>
    Object.values(bar.props.onTreeChange.mock.calls[0][0].root.c)[0];
  const open = async (user, bar, name) => {
    await typeInto(user, bar.input, name);
    await pickColumnSuggestion(user, name);
  };
  const datetimeColumns = {
    ...columns,
    updated_at: { name: "updated_at", title: "Diubah", type: "datetime" },
  };
  const todayCell = async () =>
    within(await screen.findByRole("grid")).getByRole("button", {
      name: /^Today/,
    });
  const year = new Date().getFullYear();
  const yy = String(year).slice(-2);

  it("klik hari di widget (kolom date) -> jadi chip nilai (dropdown tetap terbuka); Enter selesai, Enter apply", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await open(user, bar, "Dibuat");

    await user.click(await todayCell());
    // Revisi 11: klik sel menambah CHIP nilai (kotak search tetap kosong).
    await waitFor(() =>
      expect(
        screen.getAllByRole("button", { name: /search\.remove_chip/ }),
      ).toHaveLength(1),
    );
    expect(bar.input).toHaveValue("");
    // Belum komit ke leaf: mode value & widget masih ada.
    expect(screen.getByText("[Dibuat:]")).toBeInTheDocument();
    expect(screen.getByRole("grid")).toBeInTheDocument();
    expect(bar.props.onTreeChange).not.toHaveBeenCalled();
    // Fokus dikembalikan ke input (sel kalender mencurinya).
    await waitFor(() => expect(bar.input).toHaveFocus());

    await user.keyboard("{Enter}");
    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    expect(applied(bar).o).toBe("in_period");
    expect(applied(bar).v.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  // Kedua test di bawah memakai tanggal tetap 15 September 2026, sedangkan
  // widget kalender membuka BULAN BERJALAN. Keduanya hijau sepanjang September
  // 2026 lalu merah serentak pada 1 Oktober, di lokal maupun CI, tanpa satu
  // baris kode pun berubah. Waktu dibekukan agar hasilnya tidak bergantung
  // kapan suite dijalankan.
  //
  // Catatan: bahwa kalender tidak membuka bulan dari nilai yang sedang diedit
  // juga terasa di aplikasi — membuka chip tanggal lama menampilkan bulan ini,
  // bukan bulan tanggal tersebut. Memperbaikinya menyentuh komponen yang
  // dipakai banyak halaman, jadi digarap terpisah.
  it("membuka chip tanggal utk diedit TIDAK auto-komit (emisi widget yg sama dgn prefill diabaikan)", async () => {
    // shouldAdvanceTime: userEvent memakai timer internal; tanpa ini
    // interaksi menggantung. Dipulihkan di akhir test agar tidak bocor ke
    // test lain dalam berkas yang sama.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-09-15T08:00:00"));
    const user = userEvent.setup({ delay: null });
    const bar = renderBar({
      tree: {
        root: {
          k: "and",
          c: {
            a: {
              k: "created_at",
              o: "in_period",
              v: { period: "day", operator: "is", startDate: "2026-09-15" },
            },
          },
        },
      },
    });

    await user.click(screen.getByText(/^Dibuat: 15 Sep 2026$/));
    expect(await screen.findByRole("grid")).toBeInTheDocument();
    expect(screen.getByText("[Dibuat:]")).toBeInTheDocument();
    expect(bar.props.onTreeChange).not.toHaveBeenCalled();
    // Revisi 12b: SATU nilai langsung dikonversi ke TEKS di kotak (bukan
    // chip), widget menandai hari yg sama.
    expect(bar.input).toHaveValue("15 Sep 2026");
    expect(valueChip("15 Sep 2026")).toBeUndefined();
    expect(selectedStateOfDay("2026-09-15")).toBe("true");
  });

  it("datetime: pintasan 'Hari ini' (mode multi) = seluruh hari tanpa jam -> chip; selesai via Enter, apply via Enter", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar({ columns: datetimeColumns });
    await open(user, bar, "Diubah");

    await user.click(
      screen.getByRole("button", {
        name: "TR:core.datatable.filter.dateselector.today.day",
      }),
    );
    // Mode multi: pintasan = seluruh hari (tanpa jam) -> chip, masih di mode value.
    expect(screen.getByText("[Diubah:]")).toBeInTheDocument();
    expect(bar.props.onTreeChange).not.toHaveBeenCalled();
    await user.keyboard("{Enter}");
    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    expect(applied(bar).v.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("saran meniru format ketikan: 'Jan <yy>' -> Jan <yy>, Jan <yy-1>, Jan <yy+1> ... (ketikan paling atas)", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await open(user, bar, "Dibuat");

    await user.type(bar.input, `Jan ${yy}`);
    const first = await screen.findByText(`Jan ${yy}`);
    expect(first).toBeInTheDocument();
    expect(
      screen.getByText(`Jan ${String(year - 1).slice(-2)}`),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`Jan ${String(year + 1).slice(-2)}`),
    ).toBeInTheDocument();
    // ketikan = saran pertama (urutan DOM)
    const options = screen.getAllByRole("option");
    expect(options[0].textContent).toBe(`Jan ${yy}`);
    expect(options[1].textContent).toBe(`Jan ${String(year - 1).slice(-2)}`);
  });

  it("ArrowDown ke saran kedua + Enter -> yang DIKOMIT saran itu (bukan ketikan mentah)", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await open(user, bar, "Dibuat");

    await user.type(bar.input, `Jan ${yy}`);
    await screen.findByText(`Jan ${String(year - 1).slice(-2)}`);
    await user.keyboard("{ArrowDown}{Enter}");
    await user.keyboard("{Enter}");
    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    expect(applied(bar).v).toMatchObject({
      period: "month",
      year: year - 1,
      month: 0,
    });
  });

  it("'Kuartal' tanpa angka -> Kuartal 1-4 di tahun sistem; Enter pada saran pertama (kuartal berjalan)", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await open(user, bar, "Dibuat");

    await user.type(bar.input, "Kuartal");
    const currentQuarter = Math.floor(new Date().getMonth() / 3) + 1;
    expect(
      await screen.findByText(`Kuartal ${currentQuarter} ${year}`),
    ).toBeInTheDocument();
    await enterFinishApply(user);
    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    expect(applied(bar).v).toMatchObject({
      period: "quarter",
      year,
      quarter: currentQuarter - 1,
    });
  });

  it("chip tanggal memakai format 'dd MMM yyyy' (+ ' HH:mm' bila ada jam)", () => {
    renderBar({
      columns: datetimeColumns,
      tree: {
        root: {
          k: "and",
          c: {
            a: {
              k: "updated_at",
              o: "in_period",
              v: {
                period: "day",
                operator: "is",
                startDate: "2026-09-21 19:35",
              },
            },
            b: {
              k: "created_at",
              o: "in_period",
              v: { period: "month", operator: "is", year: 2026, month: 8 },
            },
          },
        },
      },
    });
    expect(screen.getByText("Diubah: 21 Sep 2026 19:35")).toBeInTheDocument();
    expect(screen.getByText("Dibuat: Sep 2026")).toBeInTheDocument();
  });
});

describe("SearchBar — revisi 10: dropdown date 2 kolom & sinkron simbol/nilai search box <-> widget (Requirement 56)", () => {
  const applied = (bar) =>
    Object.values(bar.props.onTreeChange.mock.calls[0][0].root.c)[0];
  const open = async (user, bar, name) => {
    await typeInto(user, bar.input, name);
    await pickColumnSuggestion(user, name);
  };
  const OP = (op) => `TR:core.datatable.filter.dateselector.subop.${op}`;
  const PERIOD = (p) => `TR:core.datatable.filter.period.unit.${p}`;
  // Field "Kondisi" = combobox pertama widget, "Periode" = kedua.
  const kondisi = async () => (await screen.findAllByRole("combobox"))[0];
  const periode = async () => (await screen.findAllByRole("combobox"))[1];
  const chooseKondisi = async (user, op) => {
    await user.click(await kondisi());
    await user.click(await screen.findByRole("option", { name: OP(op) }));
  };

  it("layout 2 kolom: saran di kiri, DateSelector di kanan, tips tetap di bawah (selebar penuh)", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await open(user, bar, "Dibuat");

    const grid = await screen.findByRole("grid");
    const widgetColumn = grid.closest("div.md\\:border-l");
    expect(widgetColumn).toBeTruthy();
    const twoCol = widgetColumn.parentElement;
    expect(twoCol.className).toContain("md:flex");
    // kolom kiri = saran (preset) di dalam pembungkus yg sama.
    const leftColumn = twoCol.firstElementChild;
    expect(leftColumn).not.toBe(widgetColumn);
    expect(
      within(leftColumn).getByText(
        "TR:core.datatable.search.period.this_month",
      ),
    ).toBeInTheDocument();
    // tips = sibling SETELAH baris 2 kolom (bukan di dalam salah satu kolom).
    const legend = screen.getByTestId("search-legend");
    expect(twoCol.nextElementSibling).toBe(legend);
    expect(twoCol.contains(legend)).toBe(false);
  });

  it("ketik simbol '>=' -> field Kondisi widget jadi 'on-or-after'", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await open(user, bar, "Dibuat");

    await user.type(bar.input, ">=");
    await waitFor(async () =>
      expect((await kondisi()).textContent).toContain(OP("on-or-after")),
    );
    await user.clear(bar.input);
    await user.type(bar.input, "<");
    await waitFor(async () =>
      expect((await kondisi()).textContent).toContain(OP("before")),
    );
    await user.clear(bar.input);
    await user.type(bar.input, "a..b");
    await waitFor(async () =>
      expect((await kondisi()).textContent).toContain(OP("between")),
    );
  });

  it("ketik '>= Q2 2026' -> Kondisi on-or-after + Periode kuartal (nilai ikut tersinkron), belum komit", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await open(user, bar, "Dibuat");

    await user.type(bar.input, ">= Q2 2026");
    await waitFor(async () => {
      expect((await kondisi()).textContent).toContain(OP("on-or-after"));
      expect((await periode()).textContent).toContain(PERIOD("quarter"));
    });
    expect(screen.getByText("[Dibuat:]")).toBeInTheDocument();
    expect(bar.props.onTreeChange).not.toHaveBeenCalled();
    // Enter mengomit nilai yg SAMA dgn yg tampil di widget.
    await finishApplySymbol(user);
    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    expect(applied(bar).v).toMatchObject({
      period: "quarter",
      operator: "on-or-after",
      year: 2026,
      quarter: 1,
    });
  });

  it("ubah Kondisi di widget -> simbol tertulis di search box (nilai lama dikosongkan widget); ganti lagi -> simbol berganti", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await open(user, bar, "Dibuat");

    await chooseKondisi(user, "after");
    await waitFor(() => expect(bar.input).toHaveValue(">"));
    await chooseKondisi(user, "on-or-before");
    await waitFor(() => expect(bar.input).toHaveValue("<="));
    await chooseKondisi(user, "between");
    await waitFor(() => expect(bar.input).toHaveValue(".."));
    await chooseKondisi(user, "is");
    await waitFor(() => expect(bar.input).toHaveValue(""));
    expect(bar.props.onTreeChange).not.toHaveBeenCalled();
  });

  it("awalan '!' dipertahankan saat widget menulis ke search box", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await open(user, bar, "Dibuat");

    await user.type(bar.input, "!");
    await chooseKondisi(user, "before");
    await waitFor(() => expect(bar.input).toHaveValue("!<"));
  });

  it("Kondisi 'after' lalu klik hari -> teks '>dd MMM yyyy'; Enter mengomit leaf 'after'", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await open(user, bar, "Dibuat");

    await chooseKondisi(user, "after");
    const grid = await screen.findByRole("grid");
    await user.click(within(grid).getByRole("button", { name: /^Today/ }));
    await waitFor(() =>
      expect(bar.input.value).toMatch(/^>\d{2} [A-Za-z]{3} \d{4}$/),
    );
    await finishApplySymbol(user);
    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    expect(applied(bar).v).toMatchObject({ period: "day", operator: "after" });
  });

  it("simbol '>' berdiri sendiri + Enter -> TIDAK diam-diam memilih preset/'Diisi' pertama; Enter = selesai tanpa komit", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await open(user, bar, "Dibuat");

    await user.type(bar.input, ">");
    await user.keyboard("{Enter}");
    expect(bar.props.onTreeChange).not.toHaveBeenCalled();
    expect(screen.queryByText("[Dibuat:]")).not.toBeInTheDocument();
    // tak ada chip yg terbentuk
    expect(screen.queryByText(/^Dibuat/)).not.toBeInTheDocument();
  });

  it("Enter pada input date KOSONG (tanpa niat) tidak mengomit preset pertama; Enter = selesai", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await open(user, bar, "Dibuat");

    await user.keyboard("{Enter}");
    expect(screen.queryByText("[Dibuat:]")).not.toBeInTheDocument();
    expect(bar.props.onTreeChange).not.toHaveBeenCalled();
    expect(screen.queryByText(/^Dibuat:/)).not.toBeInTheDocument();
  });

  it("saran ikut bersimbol: '>= Jan' -> '>=Jan <tahun>'; klik saran = langsung selesai dgn operator on-or-after", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await open(user, bar, "Dibuat");

    await user.type(bar.input, ">= Jan");
    const year = new Date().getFullYear();
    await user.click(await screen.findByText(`>=Jan ${year}`));
    // Revisi 12b: saran bersimbol = satu-satunya nilai -> langsung selesai
    // (bukan chip); Enter berikutnya (tertutup) meng-apply.
    expect(screen.queryByText("[Dibuat:]")).not.toBeInTheDocument();
    expect(valueChip(`>=Jan ${year}`)).toBeUndefined();
    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    expect(applied(bar).v).toMatchObject({
      period: "month",
      operator: "on-or-after",
      year,
      month: 0,
    });
  });

  it("simbol berdiri sendiri: daftar kiri TIDAK kosong -- preset ikut bersimbol & membawa operator; Diisi/Tidak diisi tetap ada", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await open(user, bar, "Dibuat");

    await user.type(bar.input, ">");
    // label memakai <mark> (highlight) -> cari lewat nama aksesibel opsi.
    const preset = await screen.findByRole("option", {
      name: ">TR:core.datatable.search.period.this_month",
    });
    expect(
      screen.getByText("TR:core.datatable.filter.operator.set"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("TR:core.form.not_found"),
    ).not.toBeInTheDocument();

    // Preset bersimbol = satu-satunya nilai -> klik langsung selesai.
    await user.click(preset);
    expect(screen.queryByText("[Dibuat:]")).not.toBeInTheDocument();
    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    expect(applied(bar).v).toMatchObject({
      period: "month",
      operator: "after",
    });
  });

  it("rentang 'a..b': kolom kiri berisi saran rentang (bukan 'tidak ada hasil'); Enter mengomit saran pertama", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await open(user, bar, "Dibuat");

    await user.type(bar.input, "Q2 2026..Q4 2026");
    expect(await screen.findByText("Q2 2026..Q4 2026")).toBeInTheDocument();
    expect(screen.getByText("Q2 2026..Q4 2027")).toBeInTheDocument();
    expect(
      screen.queryByText("TR:core.form.not_found"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("TR:core.datatable.filter.operator.set"),
    ).toBeInTheDocument();
    await waitFor(async () =>
      expect((await kondisi()).textContent).toContain(OP("between")),
    );

    await user.keyboard("{ArrowDown}{Enter}");
    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    expect(applied(bar).v).toMatchObject({
      period: "quarter",
      operator: "between",
      rangeStart: { year: 2026, value: 1 },
      rangeEnd: { year: 2027, value: 3 },
    });
  });

  it("rentang campuran 'Jan 2026..2027': Periode = bulan, Kondisi = di antara; Enter mengomit Jan 2026 - Des 2027", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await open(user, bar, "Dibuat");

    await user.type(bar.input, "Jan 2026..2027");
    await waitFor(async () => {
      expect((await kondisi()).textContent).toContain(OP("between"));
      expect((await periode()).textContent).toContain(PERIOD("month"));
    });
    // teks TIDAK ditimpa widget (nilainya sudah setara)
    expect(bar.input).toHaveValue("Jan 2026..2027");
    expect(await screen.findByText("Jan 2026..2027")).toBeInTheDocument();

    await finishApplySymbol(user);
    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    expect(applied(bar).v).toMatchObject({
      period: "month",
      operator: "between",
      rangeStart: { year: 2026, value: 0 },
      rangeEnd: { year: 2027, value: 11 },
    });
  });

  it("rentang 'Jan 2026..Mar': saran melengkapi tahun ujung awal (Mar 2026, Mar 2027)", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await open(user, bar, "Dibuat");

    await user.type(bar.input, "Jan 2026..Mar");
    expect(await screen.findByText("Jan 2026..Mar 2026")).toBeInTheDocument();
    expect(screen.getByText("Jan 2026..Mar 2027")).toBeInTheDocument();
    await finishApplySymbol(user);
    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    expect(applied(bar).v).toMatchObject({
      period: "month",
      rangeStart: { year: 2026, value: 0 },
      rangeEnd: { year: 2026, value: 2 },
    });
  });

  it("rentang '..' tanpa preset (preset berkondisi 'is' tak relevan); Diisi/Tidak diisi tetap", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await open(user, bar, "Dibuat");

    await user.type(bar.input, "..");
    await screen.findByText("TR:core.datatable.filter.operator.set");
    expect(
      screen.queryByText("TR:core.datatable.search.period.this_month"),
    ).not.toBeInTheDocument();
  });

  it("Tab melengkapi saran & ikut menyinkronkan widget", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await open(user, bar, "Dibuat");

    await user.type(bar.input, ">Q2");
    await screen.findAllByText(/^>Q2 \d{4}$/);
    await user.keyboard("{Tab}");
    expect(bar.input.value).toMatch(/^>Q2 \d{4}$/);
    await waitFor(async () => {
      expect((await kondisi()).textContent).toContain(OP("after"));
      expect((await periode()).textContent).toContain(PERIOD("quarter"));
    });
  });

  // Lihat catatan pembekuan waktu di atas test chip tanggal.
  it("teks tak terparse mengosongkan pilihan widget (operator tetap); teks valid mengisinya lagi", async () => {
    // shouldAdvanceTime: userEvent memakai timer internal; tanpa ini
    // interaksi menggantung. Dipulihkan di akhir test agar tidak bocor ke
    // test lain dalam berkas yang sama.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-09-15T08:00:00"));
    const user = userEvent.setup({ delay: null });
    const bar = renderBar();
    await open(user, bar, "Dibuat");

    const day15Selected = () => selectedStateOfDay("2026-09-15") === "true";

    await user.type(bar.input, "<15/09/2026");
    await waitFor(async () =>
      expect((await kondisi()).textContent).toContain(OP("before")),
    );
    await waitFor(() => expect(day15Selected()).toBe(true));

    await user.type(bar.input, "x");
    await waitFor(() => expect(day15Selected()).toBe(false));
    expect((await kondisi()).textContent).toContain(OP("before"));

    await user.keyboard("{Backspace}");
    await waitFor(() => expect(day15Selected()).toBe(true));
  });

  it("edit chip tanggal negasi: kotak memuat teks '!>nilai', Kondisi widget sesuai operator", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar({
      tree: {
        root: {
          k: "and",
          c: {
            a: {
              k: "created_at",
              o: "!in_period",
              v: {
                period: "day",
                operator: "after",
                startDate: "2026-09-15",
              },
            },
          },
        },
      },
    });

    await user.click(screen.getByText(/^Dibuat/));
    // Revisi 12b: satu nilai (bersimbol) langsung jadi TEKS di kotak,
    // lengkap dgn `!` (negasi) & simbol.
    await waitFor(() => expect(bar.input).toHaveValue("!>15 Sep 2026"));
    expect(valueChip(">15 Sep 2026")).toBeUndefined();
    expect((await kondisi()).textContent).toContain(OP("after"));
    expect(bar.props.onTreeChange).not.toHaveBeenCalled();
  });

  it("datetime: teks berjam (kondisi tunggal `>=`) menyinkronkan pemilih jam widget", async () => {
    const user = userEvent.setup({ delay: null });
    const bar = renderBar({
      columns: {
        ...columns,
        updated_at: { name: "updated_at", title: "Diubah", type: "datetime" },
      },
    });
    await open(user, bar, "Diubah");

    // Mode multi ("Pada") menyembunyikan pemilih jam; jam hanya via kondisi
    // tunggal (mis. `>=`).
    await user.type(bar.input, ">=15/09/2026 14:30");
    expect(await screen.findByText("14:30")).toBeInTheDocument();
    await finishApplySymbol(user);
    await waitFor(() =>
      expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
    );
    expect(applied(bar).v).toMatchObject({
      operator: "on-or-after",
      startDate: "2026-09-15 14:30",
    });
  });
});

describe(
  "SearchBar — revisi 11: banyak nilai (`in`) date/datetime (Requirement 57-60)",
  { timeout: 60000 },
  () => {
    const applied = (bar) =>
      Object.values(bar.props.onTreeChange.mock.calls[0][0].root.c)[0];
    const open = async (user, bar, name = "Dibuat") => {
      await typeInto(user, bar.input, name);
      await pickColumnSuggestion(user, name);
    };
    const OP = (op) => `TR:core.datatable.filter.dateselector.subop.${op}`;
    const NOTICE = (key, params) =>
      params
        ? `TR:core.datatable.search.${key}:${JSON.stringify(params)}`
        : `TR:core.datatable.search.${key}`;
    const kondisi = async () => (await screen.findAllByRole("combobox"))[0];
    // Label semua chip nilai (urutan tampil) dari tombol hapusnya.
    const chipLabels = () =>
      screen
        .queryAllByRole("button", { name: /search\.remove_chip/ })
        .map(
          (b) =>
            JSON.parse(b.getAttribute("aria-label").replace(/^TR:[^:]+:/, ""))
              .label,
        )
        .filter((label) => !label.startsWith("Dibuat"));
    const periode = async () => (await screen.findAllByRole("combobox"))[1];
    // Widget mengikuti Periode chip terakhir (mis. bulan/tahun) -> kalender hari
    // (role grid) baru ada setelah Periode dipindah ke "Hari".
    const showDayGrid = async (user) => {
      await user.click(await periode());
      await user.click(
        await screen.findByRole("option", {
          name: "TR:core.datatable.filter.period.unit.day",
        }),
      );
      await screen.findByRole("grid");
    };
    const cells = () => within(screen.getByRole("grid")).getAllByRole("button");
    const selectedCell = (cell) =>
      cell.closest("td").getAttribute("aria-selected") === "true";
    const todayCell = () =>
      within(screen.getByRole("grid")).getByRole("button", { name: /^Today/ });
    const pad = (n) => String(n).padStart(2, "0");

    const inTree = {
      root: {
        k: "and",
        c: {
          a: {
            k: "created_at",
            o: "in_period",
            v: [
              { period: "month", operator: "is", year: 2026, month: 8 },
              { period: "month", operator: "is", year: 2026, month: 10 },
            ],
          },
        },
      },
    };

    it("ketik `Sep 2026|Nov 2026|` -> dua chip nilai (kotak kosong); Enter selesai, Enter apply -> leaf 'in_period' ber-`v` daftar dua periode", async () => {
      const user = userEvent.setup({ delay: null });
      const bar = renderBar();
      await open(user, bar);

      await pasteText(user, bar.input, "Sep 2026|Nov 2026|");
      expect(chipLabels()).toEqual(["Sep 2026", "Nov 2026"]);
      expect(bar.input).toHaveValue("");
      expect(bar.props.onTreeChange).not.toHaveBeenCalled();

      await user.keyboard("{Enter}");
      await user.keyboard("{Enter}");
      await waitFor(() =>
        expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
      );
      expect(applied(bar)).toEqual({
        k: "created_at",
        o: "in_period",
        v: [
          { period: "month", operator: "is", year: 2026, month: 8 },
          { period: "month", operator: "is", year: 2026, month: 10 },
        ],
      });
    });

    it("awalan '!' + dua nilai -> '!in_period' ber-`v` daftar", async () => {
      const user = userEvent.setup({ delay: null });
      const bar = renderBar();
      await open(user, bar);

      await user.type(bar.input, "!Sep 2026|Nov 2026|");
      await user.keyboard("{Enter}");
      await user.keyboard("{Enter}");
      await waitFor(() =>
        expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
      );
      expect(applied(bar).o).toBe("!in_period");
      expect(applied(bar).v).toHaveLength(2);
    });

    it("pemisah ';' juga berlaku; koma BUKAN pemisah utk tanggal", async () => {
      const user = userEvent.setup({ delay: null });
      const bar = renderBar();
      await open(user, bar);

      await pasteText(user, bar.input, "Sep 2026,");
      expect(chipLabels()).toEqual([]);
      expect(bar.input).toHaveValue("Sep 2026,");
      await user.clear(bar.input);

      await pasteText(user, bar.input, "Sep 2026;Nov 2026;");
      expect(chipLabels()).toEqual(["Sep 2026", "Nov 2026"]);
    });

    it("satu nilai = 'in_period' ber-`v` OBJEK (bukan daftar); nilai bersimbol (`>=2027`) langsung selesai", async () => {
      const user = userEvent.setup({ delay: null });
      const bar = renderBar();
      await open(user, bar);

      // Nilai bersimbol: separator langsung membentuknya & SELESAI (tanpa chip).
      await user.type(bar.input, ">=2027|");
      expect(chipLabels()).toEqual([]);
      expect(screen.queryByText("[Dibuat:]")).not.toBeInTheDocument();
      await user.keyboard("{Enter}");
      await waitFor(() =>
        expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
      );
      expect(applied(bar)).toEqual({
        k: "created_at",
        o: "in_period",
        v: { period: "year", operator: "on-or-after", year: 2027 },
      });
    });

    it("Enter dgn ketikan -> chip (dropdown tetap terbuka); Enter kosong -> selesai; duplikat tak menambah chip", async () => {
      const user = userEvent.setup({ delay: null });
      const bar = renderBar();
      await open(user, bar);

      await pasteText(user, bar.input, "Sep 2026");
      await user.keyboard("{Enter}");
      expect(chipLabels()).toEqual(["Sep 2026"]);
      expect(screen.getByTestId("search-legend")).toBeInTheDocument();

      await user.paste("Sep 2026");
      await user.keyboard("{Enter}");
      expect(chipLabels()).toEqual(["Sep 2026"]);

      await user.keyboard("{Enter}");
      expect(screen.queryByText("[Dibuat:]")).not.toBeInTheDocument();
      expect(bar.props.onTreeChange).not.toHaveBeenCalled();
    });

    it("klik preset berturut-turut menambah chip (dropdown tetap terbuka)", async () => {
      const user = userEvent.setup({ delay: null });
      const bar = renderBar();
      await open(user, bar);

      await user.click(
        await screen.findByText("TR:core.datatable.search.period.this_month"),
      );
      await user.click(
        await screen.findByText("TR:core.datatable.search.period.this_year"),
      );
      expect(chipLabels()).toHaveLength(2);
      expect(screen.getByText("[Dibuat:]")).toBeInTheDocument();
    });

    it("klik sel di widget menambah chip; klik sel terpilih melepasnya", async () => {
      const user = userEvent.setup({ delay: null });
      const bar = renderBar();
      await open(user, bar);
      await screen.findByRole("grid");

      await user.click(cells()[10]);
      await user.click(cells()[12]);
      await waitFor(() => expect(chipLabels()).toHaveLength(2));
      expect(bar.input).toHaveValue("");
      expect(selectedCell(cells()[10])).toBe(true);
      expect(selectedCell(cells()[12])).toBe(true);

      await user.click(cells()[10]);
      await waitFor(() => expect(chipLabels()).toHaveLength(1));
      expect(selectedCell(cells()[10])).toBe(false);
      expect(selectedCell(cells()[12])).toBe(true);
    });

    it("hapus chip lewat x -> sel widget dilepas", async () => {
      const user = userEvent.setup({ delay: null });
      const bar = renderBar();
      await open(user, bar);
      await screen.findByRole("grid");

      await user.click(cells()[10]);
      await user.click(cells()[12]);
      await waitFor(() => expect(chipLabels()).toHaveLength(2));

      await user.click(
        screen.getAllByRole("button", { name: /search\.remove_chip/ })[0],
      );
      await waitFor(() => expect(chipLabels()).toHaveLength(1));
      expect(selectedCell(cells()[10]) && selectedCell(cells()[12])).toBe(
        false,
      );
    });

    it("ketikan 'Pada' dipratinjau di widget (sel ditandai, belum jadi chip); klik sel itu mengosongkan ketikan", async () => {
      const user = userEvent.setup({ delay: null });
      const bar = renderBar();
      await open(user, bar);
      await screen.findByRole("grid");

      const now = new Date();
      await pasteText(
        user,
        bar.input,
        `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`,
      );
      await waitFor(() => expect(selectedCell(todayCell())).toBe(true));
      expect(chipLabels()).toEqual([]);

      await user.click(todayCell());
      await waitFor(
        () => {
          expect(bar.input).toHaveValue("");
          expect(chipLabels()).toEqual([]);
          expect(selectedCell(todayCell())).toBe(false);
        },
        { timeout: 5000 },
      );
    });

    it("ketikan ditambah klik sel lain -> keduanya jadi chip (gabungan)", async () => {
      const user = userEvent.setup({ delay: null });
      const bar = renderBar();
      await open(user, bar);
      await screen.findByRole("grid");

      const now = new Date();
      await pasteText(
        user,
        bar.input,
        `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`,
      );
      await waitFor(() => expect(selectedCell(todayCell())).toBe(true));
      // Sel DALAM bulan yg tampil (bukan hari "outside" bulan lain -- klik hari
      // outside ikut memindah bulan kalender & rawan race saat suite penuh).
      const monthRe = new RegExp(
        now.toLocaleString("en-US", { month: "long" }),
      );
      const other = cells().find(
        (c) =>
          monthRe.test(c.getAttribute("aria-label") ?? "") &&
          !selectedCell(c) &&
          !/^Today/.test(c.getAttribute("aria-label") ?? ""),
      );
      await user.click(other);
      await waitFor(() => expect(chipLabels()).toHaveLength(2), {
        timeout: 5000,
      });
      expect(bar.input).toHaveValue("");
    });

    it("chip 'Pada' + simbol diketik -> DITOLAK (kotak tak berubah) + pesan; chip TIDAK dihapus", async () => {
      const user = userEvent.setup({ delay: null });
      const bar = renderBar();
      await open(user, bar);

      await pasteText(user, bar.input, "Sep 2026|");
      await user.type(bar.input, ">");
      expect(bar.input).toHaveValue("");
      expect(
        screen.getByText(NOTICE("chip_symbol_with_chips")),
      ).toBeInTheDocument();
      expect(chipLabels()).toEqual(["Sep 2026"]);

      // `..` di tengah ketikan juga ditolak; nilai polos tetap boleh.
      await user.type(bar.input, "2027");
      expect(bar.input).toHaveValue("2027");
      // satu titik boleh (bukan simbol); titik kedua (`..`) ditolak.
      await user.type(bar.input, "..");
      expect(bar.input).toHaveValue("2027.");
    });

    it("nilai bersimbol date (`>=2027`) = satu-satunya nilai: langsung selesai via Enter, separator, atau klik saran/preset; chip utama tampil", async () => {
      const user = userEvent.setup({ delay: null });
      const bar = renderBar();
      await open(user, bar);

      await user.type(bar.input, ">=2027{Enter}");
      expect(screen.queryByText("[Dibuat:]")).not.toBeInTheDocument();
      expect(screen.getByText(/^Dibuat .*>=2027/)).toBeInTheDocument();
      expect(bar.props.onTreeChange).not.toHaveBeenCalled();
    });

    it("negasi `!` tetap boleh di awal walau ada chip (bukan simbol nilai)", async () => {
      const user = userEvent.setup({ delay: null });
      const bar = renderBar();
      await open(user, bar);

      await pasteText(user, bar.input, "Sep 2026|");
      await user.type(bar.input, "!");
      expect(bar.input).toHaveValue("!");
      await user.paste("Nov 2026|");
      expect(chipLabels()).toEqual(["Sep 2026", "Nov 2026"]);
    });

    it("Kondisi selain Pada dinonaktifkan di widget saat >= 2 chip", async () => {
      const user = userEvent.setup({ delay: null });
      const bar = renderBar();
      await open(user, bar);

      await pasteText(user, bar.input, "Sep 2026|Nov 2026|");
      await user.click(await kondisi());
      for (const op of ["after", "before", "between"]) {
        expect(
          await screen.findByRole("option", { name: OP(op) }),
        ).toHaveAttribute("aria-disabled", "true");
      }
    });

    it("ganti Kondisi widget dgn satu chip 'Pada' -> chip dilepas & simbol tertulis; ganti balik ke Pada mengosongkan simbol", async () => {
      const user = userEvent.setup({ delay: null });
      const bar = renderBar();
      await open(user, bar);

      await pasteText(user, bar.input, "Sep 2026|");
      expect(chipLabels()).toEqual(["Sep 2026"]);
      await user.click(await kondisi());
      await user.click(
        await screen.findByRole("option", { name: OP("after") }),
      );
      await waitFor(() => expect(bar.input).toHaveValue(">"));
      expect(chipLabels()).toEqual([]);

      await user.click(await kondisi());
      await user.click(await screen.findByRole("option", { name: OP("is") }));
      await waitFor(() => expect(bar.input).toHaveValue(""));
    });

    it("nilai bersimbol di kotak + klik sel widget (kondisi tunggal) -> teks diganti nilai baru", async () => {
      const user = userEvent.setup({ delay: null });
      const bar = renderBar();
      await open(user, bar);

      await user.type(bar.input, ">=2027");
      // Ganti Periode ke Hari (kondisi tunggal: pilihan lama dibersihkan widget).
      await showDayGrid(user);
      await waitFor(() => expect(bar.input).toHaveValue(">="));
      await user.click(cells()[12]);
      await waitFor(() =>
        expect(bar.input.value).toMatch(/^>=\d{2} [A-Za-z]{3} \d{4}$/),
      );
      expect(chipLabels()).toEqual([]);
    });

    it("batas 20 nilai: yang ke-21 ditolak dgn pesan (ketik & klik sel widget), 20 chip tetap", async () => {
      const user = userEvent.setup({ delay: null });
      const bar = renderBar();
      await open(user, bar);

      await user.click(bar.input);
      await user.paste(
        Array.from({ length: 20 }, (_, i) => `${2001 + i}`).join("|") + "|",
      );
      expect(chipLabels()).toHaveLength(20);

      await user.type(bar.input, "2030|");
      expect(chipLabels()).toHaveLength(20);
      expect(
        screen.getByText(NOTICE("date_limit", { max: 20 })),
      ).toBeInTheDocument();

      await user.clear(bar.input);
      await showDayGrid(user);
      await user.click(cells()[12]);
      expect(chipLabels()).toHaveLength(20);
      expect(
        screen.getByText(NOTICE("date_limit", { max: 20 })),
      ).toBeInTheDocument();
    });

    it("teks tak dikenali: 'xyz|' & Enter -> pesan date_invalid, tak jadi chip", async () => {
      const user = userEvent.setup({ delay: null });
      const bar = renderBar();
      await open(user, bar);

      await user.type(bar.input, "xyz|");
      expect(
        screen.getByText(NOTICE("date_invalid", { text: "xyz" })),
      ).toBeInTheDocument();
      expect(chipLabels()).toEqual([]);

      await user.clear(bar.input);
      await user.type(bar.input, "xyz");
      await user.keyboard("{Enter}");
      expect(
        screen.getByText(NOTICE("date_invalid", { text: "xyz" })),
      ).toBeInTheDocument();
      expect(screen.getByText("[Dibuat:]")).toBeInTheDocument();
    });

    it("chip utama 'in_period' daftar berlabel 'Kolom: a, b'", () => {
      renderBar({ tree: inTree });
      expect(
        screen.getByText("Dibuat: Sep 2026, Nov 2026"),
      ).toBeInTheDocument();
    });

    it("edit chip utama 'in_period' daftar: nilai dimuat sbg chip; hapus satu lalu selesai -> leaf 'in_period' ber-`v` objek (satu nilai)", async () => {
      const user = userEvent.setup({ delay: null });
      const bar = renderBar({ tree: inTree });

      await user.click(screen.getByText(/^Dibuat: Sep 2026, Nov 2026$/));
      expect(await screen.findByTestId("search-legend")).toBeInTheDocument();
      expect(chipLabels()).toEqual(["Sep 2026", "Nov 2026"]);
      expect(bar.input).toHaveValue("");
      expect(bar.props.onTreeChange).not.toHaveBeenCalled();

      await user.click(
        screen.getByRole("button", {
          name: 'TR:core.datatable.search.remove_chip:{"label":"Nov 2026"}',
        }),
      );
      await waitFor(() => expect(chipLabels()).toEqual(["Sep 2026"]));
      await user.keyboard("{Enter}");
      await user.keyboard("{Enter}");
      await waitFor(() =>
        expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
      );
      expect(applied(bar)).toEqual({
        k: "created_at",
        o: "in_period",
        v: { period: "month", operator: "is", year: 2026, month: 8 },
      });
    });

    it("edit chip utama '!in_period' daftar: '!' tetap di kotak & dua chip nilai; sisa satu nilai -> '!in_period' objek", async () => {
      const user = userEvent.setup({ delay: null });
      const bar = renderBar({
        tree: {
          root: {
            k: "and",
            c: { a: { ...inTree.root.c.a, o: "!in_period" } },
          },
        },
      });

      await user.click(screen.getByText(/^Dibuat/));
      await waitFor(() => expect(bar.input).toHaveValue("!"));
      expect(chipLabels()).toEqual(["Sep 2026", "Nov 2026"]);
      await user.click(
        screen.getByRole("button", {
          name: 'TR:core.datatable.search.remove_chip:{"label":"Nov 2026"}',
        }),
      );
      await user.keyboard("{Enter}");
      await user.keyboard("{Enter}");
      await waitFor(() =>
        expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
      );
      expect(applied(bar).o).toBe("!in_period");
      expect(applied(bar).v).toEqual({
        period: "month",
        operator: "is",
        year: 2026,
        month: 8,
      });
    });

    it("klik chip nilai utk diedit: ketikan baru menggantikan chip itu di posisinya", async () => {
      const user = userEvent.setup({ delay: null });
      const bar = renderBar();
      await open(user, bar);

      await pasteText(user, bar.input, "Sep 2026|Nov 2026|");
      await user.click(screen.getByRole("button", { name: "Sep 2026" }));
      expect(bar.input).toHaveValue("Sep 2026");

      await user.clear(bar.input);
      await user.paste("Jan 2026");
      await user.keyboard("{Enter}");
      expect(chipLabels()).toEqual(["Jan 2026", "Nov 2026"]);
      expect(bar.input).toHaveValue("");
    });

    it("Escape saat mengedit chip membuang edit (chip lama utuh); Escape lalu Search mengomit chip", async () => {
      const user = userEvent.setup({ delay: null });
      const bar = renderBar();
      await open(user, bar);

      await pasteText(user, bar.input, "Sep 2026|Nov 2026|");
      await user.click(screen.getByRole("button", { name: "Sep 2026" }));
      await user.clear(bar.input);
      await user.paste("Jan 2026");
      await user.keyboard("{Escape}");
      await clickApply(user);
      await waitFor(() =>
        expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
      );
      expect(applied(bar).v.map((p) => p.month)).toEqual([8, 10]);
    });

    it("Backspace di kotak kosong menyorot chip terakhir lalu menghapusnya (2 langkah)", async () => {
      const user = userEvent.setup({ delay: null });
      const bar = renderBar();
      await open(user, bar);

      await pasteText(user, bar.input, "Sep 2026|Nov 2026|");
      await user.keyboard("{Backspace}");
      expect(chipLabels()).toEqual(["Sep 2026", "Nov 2026"]);
      await user.keyboard("{Backspace}");
      expect(chipLabels()).toEqual(["Sep 2026"]);
    });
  },
);

describe(
  "SearchBar — revisi 12: aturan daftar, edit menyembunyikan chip, negasi, kembali ke kotak, tips, opsi status",
  { timeout: 60000 },
  () => {
    const applied = (bar) =>
      Object.values(bar.props.onTreeChange.mock.calls[0][0].root.c)[0];
    const open = async (user, bar, name) => {
      await typeInto(user, bar.input, name);
      await pickColumnSuggestion(user, name);
    };
    const NOTICE = (key) => `TR:core.datatable.search.${key}`;
    const LEGEND = (id) => `TR:core.datatable.search.legend.${id}`;
    const legend = () => within(screen.getByTestId("search-legend"));
    // Label chip nilai (urutan tampil) dari tombol hapusnya, tanpa chip utama.
    const chipLabels = () =>
      screen
        .queryAllByRole("button", { name: /search\.remove_chip/ })
        .map(
          (b) =>
            JSON.parse(b.getAttribute("aria-label").replace(/^TR:[^:]+:/, ""))
              .label,
        )
        .filter((label) => !label.startsWith("Total"));

    describe("number: satu nilai bersimbol ATAU banyak nilai polos", () => {
      it("ada chip polos -> simbol (`>`, `..`) DITOLAK + pesan; nilai polos & negasi boleh", async () => {
        const user = userEvent.setup({ delay: null });
        const bar = renderBar();
        await open(user, bar, "Total");

        await user.type(bar.input, "1|");
        await user.type(bar.input, ">");
        expect(bar.input).toHaveValue("");
        expect(
          screen.getByText(NOTICE("chip_symbol_with_chips")),
        ).toBeInTheDocument();

        await user.type(bar.input, "1..");
        expect(bar.input).toHaveValue("1.");
        await user.clear(bar.input);
        await user.type(bar.input, "!2|");
        expect(chipLabels()).toEqual(["1", "2"]);
      });

      it("chip pertama bersimbol = satu-satunya nilai -> LANGSUNG selesai (bukan chip); Enter berikutnya meng-apply", async () => {
        const user = userEvent.setup({ delay: null });
        const bar = renderBar();
        await open(user, bar, "Total");

        await user.type(bar.input, ">5{Enter}");
        expect(chipLabels()).toEqual([]);
        expect(screen.queryByText("[Total:]")).not.toBeInTheDocument();
        expect(screen.getByText(/^Total .*5/)).toBeInTheDocument();
        expect(bar.props.onTreeChange).not.toHaveBeenCalled();

        await user.keyboard("{Enter}");
        await waitFor(() =>
          expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
        );
        expect(applied(bar)).toEqual({ k: "total", o: ">", v: 5 });
      });

      it("rentang `1..5` juga langsung selesai; edit chip-nya memuat TEKS `1..5` di kotak (bukan chip)", async () => {
        const user = userEvent.setup({ delay: null });
        const bar = renderBar();
        await open(user, bar, "Total");

        await user.type(bar.input, "1..5{Enter}");
        expect(screen.queryByText("[Total:]")).not.toBeInTheDocument();

        await user.click(screen.getByText(/^Total/));
        expect(bar.input).toHaveValue("1..5");
        expect(chipLabels()).toEqual([]);
        // Enter lagi (tanpa ubah) -> selesai lagi dgn nilai sama.
        await user.keyboard("{Enter}");
        expect(screen.queryByText("[Total:]")).not.toBeInTheDocument();
      });

      it("tempel `1|>5|` (banyak segmen + simbol) ditolak utuh", async () => {
        const user = userEvent.setup({ delay: null });
        const bar = renderBar();
        await open(user, bar, "Total");

        await user.click(bar.input);
        await user.paste("1|>5|");
        expect(chipLabels()).toEqual([]);
        expect(
          screen.getByText(NOTICE("chip_symbol_with_chips")),
        ).toBeInTheDocument();
      });
    });

    describe("chip yang sedang diedit disembunyikan", () => {
      it("chip filter utama: hilang selama mode edit (kolom sama tak tampak 'ganda'), kembali dgn nilai baru setelah selesai", async () => {
        const user = userEvent.setup({ delay: null });
        const bar = renderBar({
          tree: {
            root: { k: "and", c: { a: { k: "code", o: "matches", v: "abc" } } },
          },
        });

        await user.click(screen.getByText(/^Kode .*abc/));
        expect(screen.queryByText(/^Kode .*abc/)).not.toBeInTheDocument();
        expect(bar.input).toHaveValue("abc");

        await user.clear(bar.input);
        await user.type(bar.input, "xyz");
        await user.keyboard("{Enter}{Enter}");
        expect(screen.getByText(/^Kode .*xyz/)).toBeInTheDocument();
        expect(screen.queryByText(/^Kode .*abc/)).not.toBeInTheDocument();
      });

      it("chip nilai date: hilang dari daftar saat diedit; teksnya dimuat ke kotak", async () => {
        const user = userEvent.setup({ delay: null });
        const bar = renderBar();
        await open(user, bar, "Dibuat");

        await pasteText(user, bar.input, "Sep 2026|Nov 2026|");
        await user.click(screen.getByRole("button", { name: "Sep 2026" }));
        expect(bar.input).toHaveValue("Sep 2026");
        expect(
          screen.queryByRole("button", { name: "Sep 2026" }),
        ).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Nov 2026" })).toBeTruthy();
      });
    });

    describe("negasi: tanda visual saat mode value", () => {
      it("`!` -> penanda kolom merah & chip nilai data-excluded (chip TIDAK merah); tanpa `!` kembali normal", async () => {
        const user = userEvent.setup({ delay: null });
        const bar = renderBar();
        await open(user, bar, "Total");

        const badge = screen.getByText("[Total:]");
        expect(badge.className).toContain("bg-foreground");

        await user.type(bar.input, "!5|");
        expect(badge.className).toContain("bg-destructive");
        expect(badge.querySelector("svg")).not.toBeNull();
        const chip = valueChip("5");
        expect(chip).toHaveAttribute("data-excluded", "true");
        expect(chip.className).not.toContain("destructive");

        await user.clear(bar.input);
        expect(badge.className).toContain("bg-foreground");
        expect(valueChip("5")).not.toHaveAttribute("data-excluded");
      });

      it("mengedit leaf bernegasi: penanda merah sejak awal (`!` dimuat ke kotak)", async () => {
        const user = userEvent.setup({ delay: null });
        renderBar({
          tree: {
            root: { k: "and", c: { a: { k: "total", o: "!in", v: [1, 2] } } },
          },
        });

        await user.click(screen.getByText(/^Total/));
        const badge = await screen.findByText("[Total:]");
        expect(badge.className).toContain("bg-destructive");
        expect(valueChip("1")).toHaveAttribute("data-excluded", "true");
      });
    });

    describe("panah atas di opsi pertama = kembali ke kotak search", () => {
      it("list: ↓ menyorot opsi pertama, ↑ menyembunyikannya lagi -> Enter = SELESAI (tak memilih opsi)", async () => {
        const user = userEvent.setup({ delay: null });
        const bar = renderBar();
        await open(user, bar, "Status");

        await user.keyboard("{ArrowDown}");
        expect(legend().getByText(LEGEND("option_pick"))).toBeInTheDocument();
        await user.keyboard("{ArrowUp}");
        // kembali ke kotak: tips kotak, bukan tips opsi
        expect(
          legend().queryByText(LEGEND("option_pick")),
        ).not.toBeInTheDocument();
        expect(
          legend().getByText(LEGEND("enter_finish_empty")),
        ).toBeInTheDocument();

        await user.keyboard("{Enter}");
        expect(screen.queryByText("[Status:]")).not.toBeInTheDocument();
        expect(valueChip("Draft")).toBeUndefined();
      });

      it("↑ TIDAK memutar ke opsi terakhir; ↓ lagi memunculkan opsi pertama", async () => {
        const user = userEvent.setup({ delay: null });
        const bar = renderBar();
        await open(user, bar, "Status");

        await user.keyboard("{ArrowDown}{ArrowUp}{ArrowDown}{Enter}");
        // Enter memilih opsi PERTAMA (Draft), bukan yang terakhir.
        expect(valueChip("Draft")).toBeTruthy();
        expect(valueChip("Selesai")).toBeUndefined();
      });

      it("dgn ketikan: ↑ di opsi pertama menonaktifkan pilih-opsi; Enter memakai ketikan apa adanya", async () => {
        const user = userEvent.setup({ delay: null });
        const bar = renderBar();
        await open(user, bar, "Status");

        await user.type(bar.input, "dr");
        expect(legend().getByText(LEGEND("option_pick"))).toBeInTheDocument();
        await user.keyboard("{ArrowUp}");
        expect(
          legend().queryByText(LEGEND("option_pick")),
        ).not.toBeInTheDocument();
        // mengetik lagi mengaktifkan kembali sorotan opsi
        await user.type(bar.input, "a");
        expect(legend().getByText(LEGEND("option_pick"))).toBeInTheDocument();
      });

      it("Panel: ↑ di item pertama mengembalikan fokus ke kotak search", async () => {
        const user = userEvent.setup({ delay: null });
        const bar = renderBar();
        await user.click(bar.input);
        await screen.findByText("TR:core.datatable.search.section.column");

        await user.keyboard("{ArrowDown}");
        expect(bar.input).not.toHaveFocus();
        await user.keyboard("{ArrowUp}");
        expect(bar.input).toHaveFocus();
      });
    });

    describe("tips mengikuti kondisi", () => {
      it("kotak kosong -> ketik -> chip tersorot: Enter berganti fungsi di tips", async () => {
        const user = userEvent.setup({ delay: null });
        const bar = renderBar();
        await open(user, bar, "Kode");

        expect(
          legend().getByText(LEGEND("enter_finish_empty")),
        ).toBeInTheDocument();

        await user.type(bar.input, "abc");
        expect(legend().getByText(LEGEND("enter_chip"))).toBeInTheDocument();
        expect(
          legend().queryByText(LEGEND("enter_finish_empty")),
        ).not.toBeInTheDocument();

        await user.keyboard("{Enter}");
        expect(legend().getByText(LEGEND("enter_finish"))).toBeInTheDocument();

        await user.keyboard("{ArrowLeft}");
        expect(legend().getByText(LEGEND("chip_edit"))).toBeInTheDocument();
        expect(legend().getByText(LEGEND("chip_remove"))).toBeInTheDocument();
        expect(
          legend().queryByText(LEGEND("enter_finish")),
        ).not.toBeInTheDocument();
      });

      it("mode kecualikan: tips 'aktif'; ada chip polos (number): simbol dikunci; ketikan bersimbol: Enter langsung selesai", async () => {
        const user = userEvent.setup({ delay: null });
        const bar = renderBar();
        await open(user, bar, "Total");

        await user.type(bar.input, "!");
        expect(legend().getByText(LEGEND("exclude_on"))).toBeInTheDocument();
        await user.clear(bar.input);

        await user.type(bar.input, "1|");
        expect(legend().getByText(LEGEND("lock_plain"))).toBeInTheDocument();
        expect(legend().queryByText(LEGEND("compare"))).not.toBeInTheDocument();

        await user.click(
          screen.getByRole("button", {
            name: 'TR:core.datatable.search.remove_chip:{"label":"1"}',
          }),
        );
        // Ketikan bersimbol: Enter = langsung selesai (bukan jadi chip).
        await user.type(bar.input, ">5");
        expect(
          legend().getByText(LEGEND("enter_symbol_finish")),
        ).toBeInTheDocument();
        expect(
          legend().queryByText(LEGEND("enter_chip")),
        ).not.toBeInTheDocument();
      });

      it("mengedit chip nilai: tips 'simpan hasil edit'", async () => {
        const user = userEvent.setup({ delay: null });
        const bar = renderBar();
        await open(user, bar, "Kode");

        await user.type(bar.input, "abc|def|");
        await user.click(screen.getByRole("button", { name: "abc" }));
        expect(legend().getByText(LEGEND("editing_note"))).toBeInTheDocument();
        await user.clear(bar.input);
        expect(
          legend().getByText(LEGEND("enter_edit_save")),
        ).toBeInTheDocument();
      });

      it("Panel: tips fokus kotak vs fokus item Panel; saran ketikan punya tips sendiri", async () => {
        const user = userEvent.setup({ delay: null });
        const bar = renderBar();
        await user.click(bar.input);
        await screen.findByText("TR:core.datatable.search.section.column");
        expect(legend().getByText(LEGEND("panel_enter"))).toBeInTheDocument();

        await user.keyboard("{ArrowDown}");
        expect(legend().getByText(LEGEND("panel_back"))).toBeInTheDocument();
        expect(
          legend().queryByText(LEGEND("panel_enter")),
        ).not.toBeInTheDocument();

        await user.keyboard("{ArrowUp}");
        await user.type(bar.input, "Kod");
        expect(legend().getByText(LEGEND("suggest_pick"))).toBeInTheDocument();
      });

      it("date: fokus di widget kalender -> tips navigasi kalender", async () => {
        const user = userEvent.setup({ delay: null });
        const bar = renderBar();
        await open(user, bar, "Dibuat");
        const grid = await screen.findByRole("grid");

        await act(async () => {
          within(grid).getAllByRole("button")[10].focus();
        });
        expect(legend().getByText(LEGEND("widget_nav"))).toBeInTheDocument();
        await act(async () => {
          bar.input.focus();
        });
        expect(
          legend().queryByText(LEGEND("widget_nav")),
        ).not.toBeInTheDocument();
      });
    });

    describe("kolom formStatus/formStatuses: opsi dari configColumns / enum", () => {
      const statusColumns = {
        ...columns,
        docStatus: {
          name: "docStatus",
          title: "Approval",
          type: "formStatuses",
          options: [
            { value: "draft", label: "Draft" },
            { value: "approved", label: "Disetujui" },
          ],
        },
      };

      it("formStatuses satu nilai -> leaf `in` (bukan `=`: backend hanya has/!has/in/!in)", async () => {
        const user = userEvent.setup({ delay: null });
        const bar = renderBar({ columns: statusColumns });
        await open(user, bar, "Approval");

        await user.click(await screen.findByText("Draft"));
        await user.keyboard("{Enter}{Enter}");
        await waitFor(() =>
          expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
        );
        expect(applied(bar)).toEqual({
          k: "docStatus",
          o: "in",
          v: ["draft"],
        });
      });

      it("formStatuses bernegasi -> `!in`; dua nilai -> `in` berisi keduanya", async () => {
        const user = userEvent.setup({ delay: null });
        const bar = renderBar({ columns: statusColumns });
        await open(user, bar, "Approval");

        await user.type(bar.input, "!");
        await user.click(await screen.findByText("Draft"));
        await user.keyboard("{Enter}{Enter}");
        await waitFor(() =>
          expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
        );
        expect(applied(bar)).toEqual({
          k: "docStatus",
          o: "!in",
          v: ["draft"],
        });
      });

      it("formStatus tunggal tetap `=`", async () => {
        const user = userEvent.setup({ delay: null });
        const bar = renderBar();
        await open(user, bar, "Status");

        await user.click(await screen.findByText("Draft"));
        await user.keyboard("{Enter}{Enter}");
        await waitFor(() =>
          expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
        );
        expect(applied(bar)).toEqual({ k: "status", o: "=", v: "draft" });
      });

      it("edit leaf `has` (dari Builder) memuat nilainya sbg chip", async () => {
        const user = userEvent.setup({ delay: null });
        renderBar({
          columns: statusColumns,
          tree: {
            root: {
              k: "and",
              c: { a: { k: "docStatus", o: "!has", v: ["draft", "approved"] } },
            },
          },
        });

        await user.click(screen.getByText(/^Approval/));
        const badge = await screen.findByText("[Approval:]");
        expect(badge.className).toContain("bg-destructive");
        expect(valueChip("Draft")).toBeTruthy();
        expect(valueChip("Disetujui")).toBeTruthy();
      });
    });
  },
);

describe(
  "SearchBar — revisi 13: saran nilai per kolom, opsi urut abjad + BadgeStatus, tombol muted",
  { timeout: 60000 },
  () => {
    const applied = (bar) =>
      Object.values(bar.props.onTreeChange.mock.calls[0][0].root.c)[0];
    const suggestionRow = (text) =>
      screen.queryAllByRole("option").find((el) => el.textContent === text);
    const waitRow = async (text) => {
      await waitFor(() => expect(suggestionRow(text)).toBeTruthy(), {
        timeout: 3000,
      });
      return suggestionRow(text);
    };

    it("tombol Search & chevron tampil sbg tombol (bg-muted)", () => {
      renderBar();
      for (const name of ["apply_search", "open_panel"]) {
        const button = screen.getByRole("button", {
          name: `TR:core.datatable.search.${name}`,
        });
        expect(button.className).toContain("bg-muted");
      }
    });

    it("ketik judul kolom 'status' -> saran nilai kolom itu (badge, urut abjad); klik -> chip + leaf `=`", async () => {
      const user = userEvent.setup({ delay: null });
      const bar = renderBar();
      await typeInto(user, bar.input, "status");

      const draft = await waitRow("Status: Draft");
      const done = await waitRow("Status: Selesai");
      expect(draft.querySelector(".badge")).not.toBeNull();
      expect(
        screen.queryAllByRole("option").map((el) => el.textContent),
      ).toEqual(expect.arrayContaining(["Status: Draft", "Status: Selesai"]));
      const rows = screen.queryAllByRole("option");
      expect(rows.indexOf(draft)).toBeLessThan(rows.indexOf(done));

      await user.click(done);
      expect(bar.input).toHaveValue("");
      await clickApply(user);
      await waitFor(() =>
        expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
      );
      expect(applied(bar)).toEqual({ k: "status", o: "=", v: "completed" });
    });

    it("'status sel' (dan 'sel status') -> hanya 'Status: Selesai'", async () => {
      const user = userEvent.setup({ delay: null });
      const bar = renderBar();
      await typeInto(user, bar.input, "status sel");

      await waitRow("Status: Selesai");
      expect(suggestionRow("Status: Draft")).toBeUndefined();

      await user.clear(bar.input);
      await user.type(bar.input, "sel status");
      await waitRow("Status: Selesai");
      expect(suggestionRow("Status: Draft")).toBeUndefined();
    });

    it("boolean: 'aktif' -> Ya & Tidak; klik 'Ya' -> leaf `=` true", async () => {
      const user = userEvent.setup({ delay: null });
      const bar = renderBar();
      await typeInto(user, bar.input, "aktif");

      await waitRow("Aktif: TR:core.datatable.no");
      await user.click(await waitRow("Aktif: TR:core.datatable.yes"));
      await clickApply(user);
      await waitFor(() =>
        expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
      );
      expect(applied(bar)).toEqual({ k: "active", o: "=", v: true });
    });

    it("date: 'dibuat' -> preset periode; klik 'bulan ini' -> leaf in_period bulan berjalan", async () => {
      const user = userEvent.setup({ delay: null });
      const bar = renderBar();
      await typeInto(user, bar.input, "dibuat");

      await user.click(
        await waitRow("Dibuat: TR:core.datatable.search.period.this_month"),
      );
      await clickApply(user);
      await waitFor(() =>
        expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
      );
      const now = new Date();
      expect(applied(bar)).toEqual({
        k: "created_at",
        o: "in_period",
        v: {
          period: "month",
          operator: "is",
          year: now.getFullYear(),
          month: now.getMonth(),
        },
      });
    });

    it("number: 'total 500' -> saran 'Total: 500'; klik -> leaf `=` 500", async () => {
      const user = userEvent.setup({ delay: null });
      const bar = renderBar();
      await typeInto(user, bar.input, "total 500");

      await user.click(await waitRow("Total: 500"));
      await clickApply(user);
      await waitFor(() =>
        expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
      );
      expect(applied(bar)).toEqual({ k: "total", o: "=", v: 500 });
    });

    it("relation: 'kategori elek' -> fetch (search 'elek') lalu 'Kategori: Elektronik'; klik -> leaf `=` record", async () => {
      const elektronik = { id: 3, name: "Elektronik" };
      axiosPost.mockImplementation((_url, payload) =>
        Promise.resolve({
          data: { data: payload.search === "elek" ? [elektronik] : [] },
        }),
      );
      const user = userEvent.setup({ delay: null });
      const bar = renderBar();
      await typeInto(user, bar.input, "kategori elek");

      await user.click(await waitRow("Kategori: Elektronik"));
      expect(bar.input).toHaveValue("");
      await clickApply(user);
      await waitFor(() =>
        expect(bar.props.onTreeChange).toHaveBeenCalledTimes(1),
      );
      expect(applied(bar)).toEqual({
        k: "category",
        o: "=",
        v: elektronik,
      });
    });

    it("tanpa menyebut kolom relation -> tak ada fetch record", async () => {
      const user = userEvent.setup({ delay: null });
      const bar = renderBar();
      await typeInto(user, bar.input, "status");
      await waitRow("Status: Draft");
      await new Promise((resolve) => setTimeout(resolve, 700));
      expect(axiosPost).not.toHaveBeenCalled();
    });

    describe("daftar nilai kolom status", () => {
      const unsorted = {
        ...columns,
        status: {
          ...columns.status,
          options: [
            { value: "completed", label: "Selesai" },
            { value: "draft", label: "Draft" },
            { value: "approved", label: "Disetujui" },
          ],
        },
      };

      it("opsi urut abjad label & dirender sbg badge", async () => {
        const user = userEvent.setup({ delay: null });
        const bar = renderBar({ columns: unsorted });
        await typeInto(user, bar.input, "Status");
        await pickColumnSuggestion(user, "Status");

        await screen.findByText("Disetujui");
        const rows = screen
          .queryAllByRole("option")
          .filter((el) =>
            ["Disetujui", "Draft", "Selesai"].includes(el.textContent),
          );
        expect(rows.map((el) => el.textContent)).toEqual([
          "Disetujui",
          "Draft",
          "Selesai",
        ]);
        expect(rows.every((el) => el.querySelector(".badge"))).toBe(true);
      });
    });
  },
);

describe(
  "SearchBar — revisi 15: 'tidak ada hasil' tak kontradiktif dgn opsi Diisi/Tidak diisi",
  { timeout: 60000 },
  () => {
    const SET = "TR:core.datatable.filter.operator.set";
    const NOT_FOUND = "TR:core.form.not_found";
    const open = async (user, bar, name) => {
      await typeInto(user, bar.input, name);
      await pickColumnSuggestion(user, name);
    };
    // Baris opsi (cmdk) berlabel persis `text` -- <mark> highlight tak memecah textContent.
    const hasOption = (text) =>
      screen.queryAllByRole("option").some((el) => el.textContent === text);

    it("boolean: ketikan cocok HANYA dgn Diisi/Tidak diisi -> opsi itu tampil, TANPA 'tidak ada hasil'", async () => {
      const user = userEvent.setup({ delay: null });
      const bar = renderBar();
      await open(user, bar, "Aktif");

      // Ya/Tidak (label mock `TR:core.datatable.yes/no`) tak memuat "set".
      await user.type(bar.input, "set");

      await waitFor(() => expect(hasOption(SET)).toBe(true));
      expect(hasOption("TR:core.datatable.yes")).toBe(false);
      expect(screen.queryByText(NOT_FOUND)).not.toBeInTheDocument();
    });

    it("boolean: ketikan tak cocok apa pun -> 'tidak ada hasil' bawaan, tanpa opsi Diisi/Tidak diisi", async () => {
      const user = userEvent.setup({ delay: null });
      const bar = renderBar();
      await open(user, bar, "Aktif");

      await user.type(bar.input, "zzz");

      expect(await screen.findByText(NOT_FOUND)).toBeInTheDocument();
      expect(hasOption(SET)).toBe(false);
    });

    it("relation: server tak mengembalikan record utk ketikan yg cocok Diisi -> hanya opsi Diisi/Tidak diisi, tanpa 'tidak ada hasil'", async () => {
      axiosPost.mockResolvedValue({ data: { data: [] } });
      const user = userEvent.setup({ delay: null });
      const bar = renderBar();
      await open(user, bar, "Kategori");

      await user.type(bar.input, "set");

      await waitFor(() => expect(hasOption(SET)).toBe(true));
      expect(screen.queryByText(NOT_FOUND)).not.toBeInTheDocument();
    });

    it("list: semua opsi sudah jadi chip & kotak kosong -> hanya Diisi/Tidak diisi, tanpa 'tidak ada hasil'", async () => {
      const user = userEvent.setup({ delay: null });
      const bar = renderBar();
      await open(user, bar, "Status");

      await user.click(await screen.findByText("Draft"));
      await user.click(await screen.findByText("Selesai"));

      await waitFor(() => expect(hasOption("Draft")).toBe(false));
      expect(hasOption("Selesai")).toBe(false);
      expect(hasOption(SET)).toBe(true);
      expect(screen.queryByText(NOT_FOUND)).not.toBeInTheDocument();
    });
  },
);
