import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DATATABLE_COLUMNS_KEY, convertColWidth } from "./Table";
import { getFromLocalStorage, saveToLocalStorage } from "@/lib/utils";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

// Header (drag-sort dnd-kit, resize-handle mouse tracking, dropdown sort UI)
// sudah dites terpisah di Header.rtl.test.jsx -- di sini di-stub (pola sama
// dgn Table2.rtl.test.jsx) supaya test ini fokus ke logic milik Table
// sendiri: rendering sel (plain/parse/parseTrans/cell render-prop),
// selectable/actions, empty state, dan pemetaan createHeaders (urutan +
// visibility kolom dari localStorage). Stub tetap merender DialogTrigger
// ASLI (dibungkus <Dialog> oleh Table sendiri) supaya alur buka
// ColumnsFilter -> apply tetap bisa diuji end-to-end tanpa mock ColumnsFilter.
vi.mock("./Header", async () => {
  const { DialogTrigger } = await import("../ui/dialog");
  return {
    default: ({ id, title, setSort, resetSorting, options, setOptions }) => (
      <th data-testid={`header-${id}`}>
        <span>{title}</span>
        {setSort && (
          <button type="button" onClick={() => setSort(id)}>
            sort-{id}
          </button>
        )}
        {resetSorting && (
          <button type="button" onClick={resetSorting}>
            reset-sort-{id}
          </button>
        )}
        <span data-testid={`options-${id}`}>{JSON.stringify(options)}</span>
        <button type="button" onClick={() => setOptions({ page: 99 })}>
          set-options-{id}
        </button>
        <DialogTrigger asChild>
          <button type="button">columns-trigger-{id}</button>
        </DialogTrigger>
      </th>
    ),
  };
});

import Table from "./Table";

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  localStorage.clear();
});

const findRowByText = (text) => screen.getByText(text).closest("tr");

describe("Table / convertColWidth (unit)", () => {
  it("'grow' dikonversi jadi '1fr'", () => {
    expect(convertColWidth("grow")).toBe("1fr");
  });

  it("'fit' dikonversi jadi 'max-content'", () => {
    expect(convertColWidth("fit")).toBe("max-content");
  });

  it("nilai custom (mis. '200px') diteruskan apa adanya", () => {
    expect(convertColWidth("200px")).toBe("200px");
  });

  it("falsy/undefined jadi default 'minmax(0px, 1fr)'", () => {
    expect(convertColWidth(undefined)).toBe("minmax(0px, 1fr)");
    expect(convertColWidth(null)).toBe("minmax(0px, 1fr)");
    expect(convertColWidth("")).toBe("minmax(0px, 1fr)");
  });
});

describe("Table / rendering sel", () => {
  const columns = [
    { name: "name", title: "Name" },
    { name: "qty", title: "Qty", parse: { 1: "Satu", 2: "Dua" } },
    { name: "status", title: "Status", parseTrans: "status" },
    {
      name: "badge",
      title: "Badge",
      cell: ({ dataRow, valueCell }) =>
        dataRow.id === 1 ? <span className="custom">{valueCell}</span> : null,
    },
  ];
  const data = [
    { id: 1, name: "Budi", qty: 1, status: "A", badge: "x" },
    { id: 2, name: "Siti", qty: 5, status: "I", badge: "y" },
  ];

  it("merender title kolom sebagai header", () => {
    render(<Table columns={columns} data={data} />);
    expect(screen.getByTestId("header-name")).toBeInTheDocument();
    expect(screen.getByTestId("header-qty")).toBeInTheDocument();
  });

  it("merender nilai sel plain dari row[name]", () => {
    render(<Table columns={columns} data={data} />);
    expect(screen.getByText("Budi")).toBeInTheDocument();
    expect(screen.getByText("Siti")).toBeInTheDocument();
  });

  it("kolom dgn `parse` merender label yang dipetakan", () => {
    render(<Table columns={columns} data={data} />);
    expect(screen.getByText("Satu")).toBeInTheDocument();
  });

  it("kolom dgn `parse` tanpa mapping cocok merender string kosong", () => {
    render(<Table columns={columns} data={data} />);
    const row2 = findRowByText("Siti");
    const qtyCell = row2.querySelectorAll("td")[1];
    expect(qtyCell.textContent).toBe("");
  });

  it("kolom dgn `parseTrans` merender hasil t(`${parseTrans}.${value}`)", () => {
    render(<Table columns={columns} data={data} />);
    expect(screen.getByText("TR:status.A")).toBeInTheDocument();
    expect(screen.getByText("TR:status.I")).toBeInTheDocument();
  });

  it("kolom dgn `cell` render-prop yg mengembalikan elemen: className asli digabung className tambahan dari Table", () => {
    render(<Table columns={columns} data={data} />);
    const badge = screen.getByText("x");
    // cn() pakai tailwind-merge -- "text-ellipsis" & "truncate" satu grup
    // (text-overflow), jadi yg terakhir ("truncate") menang & "text-ellipsis"
    // di-drop. className asli ("custom") tetap dipertahankan.
    expect(badge).toHaveClass("custom", "truncate");
    expect(badge).not.toHaveClass("text-ellipsis");
  });

  it("kolom dgn `cell` render-prop yg mengembalikan falsy: fallback ke rendering default (plain span)", () => {
    render(<Table columns={columns} data={data} />);
    // row kedua (id=2): cell() balikin null -> fallback pakai row.badge = "y"
    const row2 = findRowByText("Siti");
    expect(within(row2).getByText("y")).toBeInTheDocument();
  });
});

describe("Table / empty state", () => {
  it("merender NoDataImg (svg) di 1 baris tbody saat data kosong (header tetap dirender)", () => {
    render(<Table columns={[{ name: "name", title: "Name" }]} data={[]} />);
    // header tetap dirender walau data kosong -- Table cuma cabang beda di tbody
    expect(screen.getByTestId("header-name")).toBeInTheDocument();
    expect(document.querySelectorAll("tbody tr")).toHaveLength(1);
    expect(document.querySelector("svg")).toBeInTheDocument();
  });
});

describe("Table / selectable", () => {
  const columns = [{ name: "name", title: "Name" }];
  const data = [
    { id: 1, name: "Budi" },
    { id: 2, name: "Siti" },
  ];

  it("tidak merender checkbox saat selectable=false", () => {
    render(<Table columns={columns} data={data} />);
    expect(screen.queryAllByRole("forminput")).toHaveLength(0);
  });

  it("selectable=true merender 1 checkbox header + 1 per baris, semua unchecked awalnya", () => {
    render(<Table columns={columns} data={data} selectable />);
    const boxes = screen.getAllByRole("forminput");
    expect(boxes).toHaveLength(3);
    boxes.forEach((b) => expect(b).toHaveAttribute("data-state", "unchecked"));
  });

  it("klik checkbox header (select all) menandai semua baris + header jadi checked", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Table columns={columns} data={data} selectable />);

    const [headerCb] = screen.getAllByRole("forminput");
    await user.click(headerCb);

    screen
      .getAllByRole("forminput")
      .forEach((b) => expect(b).toHaveAttribute("data-state", "checked"));
  });

  it("klik checkbox 1 baris hanya menandai baris itu, header tetap unchecked", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Table columns={columns} data={data} selectable />);

    const [headerCb, row1Cb, row2Cb] = screen.getAllByRole("forminput");
    await user.click(row1Cb);

    expect(row1Cb).toHaveAttribute("data-state", "checked");
    expect(row2Cb).toHaveAttribute("data-state", "unchecked");
    expect(headerCb).toHaveAttribute("data-state", "unchecked");
  });
});

describe("Table / actions", () => {
  it("kolom actions merender render-prop dgn dataRow yg benar per baris", () => {
    const columns = [{ name: "name", title: "Name" }];
    const data = [
      { id: 1, name: "Budi" },
      { id: 2, name: "Siti" },
    ];
    render(
      <Table
        columns={columns}
        data={data}
        actions={({ dataRow }) => (
          <button type="button">Edit-{dataRow.id}</button>
        )}
      />,
    );
    expect(screen.getByRole("button", { name: "Edit-1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit-2" })).toBeInTheDocument();
    expect(screen.getByText("TR:core.datatable.action")).toBeInTheDocument();
  });
});

describe("Table / createHeaders: urutan & visibility kolom dari localStorage", () => {
  const headers = [
    { name: "name", title: "Name" },
    { name: "status", title: "Status" },
    { name: "extra", title: "Extra" },
  ];

  const visibleHeaderIds = () =>
    Array.from(document.querySelectorAll('[data-testid^="header-"]')).map(
      (th) => th.dataset.testid,
    );

  it("tanpa localStorage tersimpan: urutan & visibility default (semua tampil, urutan asli)", () => {
    render(<Table columns={headers} data={[]} />);
    expect(visibleHeaderIds()).toEqual([
      "header-name",
      "header-status",
      "header-extra",
    ]);
  });

  it("dgn localStorage: kolom di-reorder & show=false disembunyikan; entri cookie yg sudah tidak ada di headers diabaikan", () => {
    saveToLocalStorage(
      DATATABLE_COLUMNS_KEY,
      [
        { name: "status", show: false },
        { name: "ghost", show: true }, // sudah tidak ada di `headers` -- harus di-skip tanpa crash
        { name: "name", show: true },
      ],
      7,
    );

    render(<Table columns={headers} data={[]} />);

    // status disembunyikan total (bukan cuma style) -- tidak ada di DOM
    expect(screen.queryByTestId("header-status")).not.toBeInTheDocument();
    // sisanya tampil sesuai urutan filter([status(hidden), name, extra]) => name, extra
    expect(visibleHeaderIds()).toEqual(["header-name", "header-extra"]);
  });
});

describe("Table / integrasi ColumnsFilter (buka dialog -> toggle -> apply)", () => {
  it("apply menyembunyikan kolom yg di-uncheck dan menyimpan state ke localStorage", async () => {
    const user = userEvent.setup({ delay: null });
    const columns = [
      { name: "name", title: "Name" },
      { name: "status", title: "Status" },
    ];
    render(<Table columns={columns} data={[]} />);

    expect(screen.getByTestId("header-status")).toBeInTheDocument();

    await user.click(screen.getByText("columns-trigger-name"));
    await user.click(screen.getByLabelText("Status"));
    await user.click(screen.getByText("TR:core.datatable.columns.apply"));

    expect(screen.queryByTestId("header-status")).not.toBeInTheDocument();
    expect(screen.getByTestId("header-name")).toBeInTheDocument();

    const saved = getFromLocalStorage(DATATABLE_COLUMNS_KEY);
    expect(saved).toEqual([
      { name: "name", show: true },
      { name: "status", show: false },
    ]);
  });
});

describe("Table / update prop `data`", () => {
  it("rerender dgn prop data baru memperbarui baris yg dirender", () => {
    const columns = [{ name: "name", title: "Name" }];
    const { rerender } = render(
      <Table columns={columns} data={[{ id: 1, name: "Budi" }]} />,
    );
    expect(screen.getByText("Budi")).toBeInTheDocument();

    rerender(<Table columns={columns} data={[{ id: 2, name: "Rahmad" }]} />);

    expect(screen.queryByText("Budi")).not.toBeInTheDocument();
    expect(screen.getByText("Rahmad")).toBeInTheDocument();
  });
});

describe("Table / mode uncontrolled & rerender jumlah kolom", () => {
  // FIX: prop `options` tidak lagi didefaultkan ke literal objek baru `{}`
  // (default param dihapus, jadi `initialOptions` benar-benar `undefined`
  // saat pemanggil tidak memberi prop). `const options = initialOptions ??
  // _options` kini jatuh ke state internal `_options` sesuai maksud desain,
  // sehingga tanpa prop `options`/`onOptionsChanged`, `setOptions(...)`
  // mengubah state internal DAN terlihat di render berikutnya (mode
  // uncontrolled berfungsi).
  it("tanpa prop options & onOptionsChanged, setOptions() terlihat di render berikutnya (mode uncontrolled)", async () => {
    const user = userEvent.setup({ delay: null });
    const columns = [{ name: "name", title: "Name" }];
    render(<Table columns={columns} data={[]} />);

    expect(screen.getByTestId("options-name").textContent).toBe(
      JSON.stringify({
        page: 1,
        sort: { key: null, order: null },
        search: {},
      }),
    );

    await user.click(screen.getByText("set-options-name"));

    expect(screen.getByTestId("options-name").textContent).toBe(
      JSON.stringify({ page: 99 }),
    );
  });

  // FIX: ref per-kolom tidak lagi dibuat lewat `useRef()` di dalam
  // `createHeaders` (helper biasa, bukan hook). Ref dikelola lewat
  // `useRef(new Map())` di level komponen Table dan diambil/dibuat per key
  // kolom, sementara `useState(() => createHeaders(headers, columnRefs))`
  // pakai lazy initializer sehingga `createHeaders` cuma dieksekusi saat
  // mount. Jumlah hook Table jadi konsisten antar render, jadi rerender
  // dgn jumlah kolom (headers.length) berbeda pada instance yang sama
  // TIDAK melempar error hooks-order React.
  it("rerender dgn jumlah kolom (headers.length) berbeda tidak crash", () => {
    const twoCols = [
      { name: "a", title: "A" },
      { name: "b", title: "B" },
    ];
    const threeCols = [...twoCols, { name: "c", title: "C" }];

    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const { rerender } = render(<Table columns={twoCols} data={[]} />);

    expect(() =>
      rerender(<Table columns={threeCols} data={[]} />),
    ).not.toThrow();

    consoleError.mockRestore();
  });
});
