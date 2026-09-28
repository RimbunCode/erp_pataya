import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

vi.mock("@inertiajs/react", () => ({
  usePage: () => ({
    props: { preferences: { default_number_format: "#,###" } },
  }),
}));

import {
  GroupHeaderCard,
  GroupHeaderRow,
  GroupNodeStatusCard,
  GroupNodeStatusRow,
} from "./GroupHeaderRow";

// Header grup desktop = <tr> di tabel: dibungkus <table><tbody>.
const renderRow = (props) =>
  render(
    <table>
      <tbody>
        <GroupHeaderRow
          depth={0}
          isOpen={false}
          onToggle={() => {}}
          pager={null}
          aggregates={[]}
          showedColumns={[]}
          {...props}
        />
      </tbody>
    </table>,
  );

const item = (over = {}) => ({
  key: "fruit",
  raw: "fruit",
  count: 2,
  aggregates: {},
  ...over,
});

// Label header grup harus mengikuti aturan render per-type Cell.jsx, bukan cuma
// raw value (gap ditemukan lewat pertanyaan user: dulu label SELALU pakai
// cabang "string" apapun type kolomnya). Dipindah dari Table2.rtl.test.jsx.
describe("GroupHeaderRow — label type-aware (GroupLabel)", () => {
  it("count dari deskriptor dan nilai string tampil", () => {
    renderRow({ item: item({ count: 10 }), level: { type: "string" } });

    expect(screen.getByText("fruit")).toBeInTheDocument();
    expect(screen.getByText("(10)")).toBeInTheDocument();
  });

  it("grup NULL (key 'null') tidak crash & tampil 'Tanpa Nilai' dgn count benar", () => {
    expect(() =>
      renderRow({
        item: item({ key: "null", raw: null, count: 2 }),
        level: { type: "string" },
      }),
    ).not.toThrow();

    expect(
      screen.getByText("TR:core.datatable.no_group_value"),
    ).toBeInTheDocument();
    expect(screen.getByText("(2)")).toBeInTheDocument();
  });

  it("date granularity=day: format locale-aware (PPP), bukan raw ISO string", () => {
    renderRow({
      item: item({ key: "2026-01-15", raw: "2026-01-15" }),
      level: { type: "date", granularity: "day" },
    });

    expect(screen.getByText(/January 15th, 2026/)).toBeInTheDocument();
    expect(screen.queryByText("2026-01-15")).not.toBeInTheDocument();
  });

  it("date granularity month -> 'January 2026'", () => {
    renderRow({
      item: item({ key: "2026-01", raw: "2026-01" }),
      level: { type: "date", granularity: "month" },
    });

    expect(screen.getByText("January 2026")).toBeInTheDocument();
  });

  it("date granularity quarter/half/year", () => {
    const { unmount: unmountQ } = renderRow({
      item: item({ key: "2026-Q1", raw: "2026-Q1" }),
      level: { type: "date", granularity: "quarter" },
    });
    expect(
      screen.getByText("TR:core.datatable.granularity.quarter 1 2026"),
    ).toBeInTheDocument();
    unmountQ();

    const { unmount: unmountH } = renderRow({
      item: item({ key: "2026-H1", raw: "2026-H1" }),
      level: { type: "date", granularity: "half" },
    });
    expect(
      screen.getByText("TR:core.datatable.granularity.half 1 2026"),
    ).toBeInTheDocument();
    unmountH();

    renderRow({
      item: item({ key: "2026", raw: "2026" }),
      level: { type: "date", granularity: "year" },
    });
    expect(screen.getByText("2026")).toBeInTheDocument();
  });

  it("number: format dgn group separator, bukan raw angka", () => {
    renderRow({
      item: item({ key: "1500", raw: 1500 }),
      level: { type: "number" },
    });

    expect(screen.getByText("1,500")).toBeInTheDocument();
  });

  it("number: value 0 (falsy tapi valid) TIDAK dianggap 'tanpa nilai'", () => {
    renderRow({ item: item({ key: "0", raw: 0 }), level: { type: "number" } });

    expect(screen.getByText("0")).toBeInTheDocument();
    expect(
      screen.queryByText(/TR:core.datatable.no_group_value/),
    ).not.toBeInTheDocument();
  });

  it("number dgn range: label rentang 'lower - upper' (batas bawah bucket dari backend)", () => {
    renderRow({
      item: item({ key: "100", raw: 100, count: 2 }),
      level: { type: "number", range: 100 },
    });

    expect(screen.getByText("100 - 200")).toBeInTheDocument();
    expect(screen.getByText("(2)")).toBeInTheDocument();
  });

  it("boolean: label Ya/Tidak (terjemahan) dari key; false TIDAK dianggap 'tanpa nilai'", () => {
    const { unmount } = renderRow({
      item: item({ key: "true", raw: 1 }),
      level: { type: "boolean" },
    });
    expect(screen.getByText("TR:core.datatable.yes")).toBeInTheDocument();
    unmount();

    renderRow({
      item: item({ key: "false", raw: 0 }),
      level: { type: "boolean" },
    });
    expect(screen.getByText("TR:core.datatable.no")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/TR:core.datatable.no_group_value/),
    ).not.toBeInTheDocument();
  });

  it("boolean dengan column.parse -- parse menang atas fallback Ya/Tidak generik", () => {
    renderRow({
      item: item({ key: "true", raw: 1 }),
      level: { type: "boolean" },
      columnMeta: { parse: { true: "Aktif", false: "Nonaktif" } },
    });

    expect(screen.getByText("Aktif")).toBeInTheDocument();
    expect(screen.queryByText("TR:core.datatable.yes")).not.toBeInTheDocument();
  });

  it("formStatus: BadgeStatus (label terjemahan status.<value>), bukan raw value", () => {
    renderRow({
      item: item({ key: "draft", raw: "draft" }),
      level: { type: "formStatus" },
    });

    expect(screen.getByText("TR:status.draft")).toBeInTheDocument();
    expect(screen.queryByText("draft")).not.toBeInTheDocument();
  });

  it("formStatuses: 1 BadgeStatus per elemen dari key JSON ringkas", () => {
    renderRow({
      item: item({
        key: '["approved","pending"]',
        raw: ['["approved", "pending"]', '["approved","pending"]'],
        count: 2,
      }),
      level: { type: "formStatuses" },
    });

    expect(screen.getByText("TR:status.approved")).toBeInTheDocument();
    expect(screen.getByText("TR:status.pending")).toBeInTheDocument();
    expect(screen.getByText("(2)")).toBeInTheDocument();
  });

  it("relation: render via convertTemplateLink dari label (nama relasi), bukan [object Object]", () => {
    renderRow({
      item: item({
        key: "10",
        raw: 10,
        label: { id: 10, name: "Acme Corp", templateLink: ":name" },
      }),
      level: { type: "relation" },
    });

    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
  });

  it("relation: grup tanpa relasi tertaut (key 'null') dianggap 'tanpa nilai'", () => {
    renderRow({
      item: item({ key: "null", raw: null, label: null, count: 1 }),
      level: { type: "relation" },
    });

    expect(
      screen.getByText("TR:core.datatable.no_group_value"),
    ).toBeInTheDocument();
  });

  it("html: render HTML sesuai Cell (dangerouslySetInnerHTML), bukan teks mentah", () => {
    renderRow({
      item: item({ key: "<b>Penting</b>", raw: "<b>Penting</b>" }),
      level: { type: "html" },
    });

    const bold = screen.getByText("Penting");
    expect(bold.tagName).toBe("B");
  });
});

describe("GroupHeaderRow — struktur, agregat, interaksi", () => {
  const columns = [
    { name: "name", type: "string" },
    { name: "qty", type: "number", numberFormat: "#,###" },
    { name: "note", type: "string" },
    {
      name: "total",
      type: "currency",
      numberFormat: "#,###",
      currencyCode: { symbol: "Rp" },
    },
  ];
  const aggregates = [
    { column: "qty", fn: "sum" },
    { column: "total", fn: "avg" },
  ];
  const groupItem = item({ aggregates: { qty: 1500, total: 2500 } });

  // Sel label ber-role="button" (bisa di-toggle), jadi BUKAN role "cell" -- ambil
  // semua <td> langsung supaya sel label ikut terhitung.
  const cells = () => Array.from(document.querySelectorAll("tbody tr td"));

  it("sel label span sampai sebelum kolom agregat pertama; satu sel per kolom sisa (agregat sejajar kolomnya)", () => {
    renderRow({
      item: groupItem,
      level: { type: "string" },
      aggregates,
      showedColumns: columns,
    });

    const all = cells();
    expect(all).toHaveLength(4); // label + qty + note + total
    expect(all[0].style.gridColumn).toBe("span 1");
    expect(all[1]).toHaveTextContent("1,500"); // qty
    expect(all[2]).toHaveTextContent(""); // note: bukan kolom agregat -> kosong
    expect(all[3]).toHaveTextContent("Rp 2,500"); // total: currency + simbol
  });

  it("kolom pemilih & aksi di depan menambah span label", () => {
    renderRow({
      item: groupItem,
      level: { type: "string" },
      aggregates,
      showedColumns: columns,
      selectable: true,
      actions: true,
    });

    expect(cells()[0].style.gridColumn).toBe("span 3");
  });

  it("tooltip (title) sel agregat = nama fungsinya", () => {
    renderRow({
      item: groupItem,
      level: { type: "string" },
      aggregates,
      showedColumns: columns,
    });

    expect(cells()[1]).toHaveAttribute(
      "title",
      "TR:core.datatable.aggregate.sum",
    );
    expect(cells()[3]).toHaveAttribute(
      "title",
      "TR:core.datatable.aggregate.avg",
    );
    expect(cells()[2]).not.toHaveAttribute("title");
  });

  it("agregat semua-NULL (null) -> sel kosong, bukan '0'", () => {
    renderRow({
      item: item({ aggregates: { qty: null, total: null } }),
      level: { type: "string" },
      aggregates,
      showedColumns: columns,
    });

    expect(cells()[1]).toHaveTextContent("");
    expect(cells()[3]).toHaveTextContent("");
  });

  it("kolom agregat DISEMBUNYIKAN user tidak dirender; tanpa agregat tampil -> satu sel span penuh", () => {
    renderRow({
      item: groupItem,
      level: { type: "string" },
      aggregates,
      showedColumns: [columns[0], columns[2]], // qty & total tak tampil
    });

    const all = cells();
    expect(all).toHaveLength(1);
    expect(all[0].style.gridColumn).toBe("span 2");
  });

  it("indent per depth (16px per level)", () => {
    renderRow({ item: groupItem, level: { type: "string" }, depth: 2 });

    expect(cells()[0].style.paddingLeft).toMatch(/32px/);
    expect(cells()[0].style.paddingLeft).toMatch(/1\.25rem/);
  });

  it("klik header memanggil onToggle; aria-expanded mengikuti isOpen; chevron berganti", async () => {
    const user = userEvent.setup({ delay: null });
    const onToggle = vi.fn();
    const { rerender } = renderRow({
      item: groupItem,
      level: { type: "string" },
      onToggle,
    });

    const header = screen.getByRole("button");
    expect(header).toHaveAttribute("aria-expanded", "false");
    await user.click(header);
    expect(onToggle).toHaveBeenCalledTimes(1);

    rerender(
      <table>
        <tbody>
          <GroupHeaderRow
            item={groupItem}
            depth={0}
            level={{ type: "string" }}
            isOpen
            onToggle={onToggle}
            pager={null}
            aggregates={[]}
            showedColumns={[]}
          />
        </tbody>
      </table>,
    );
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fokus header memanggil onPrefetch langsung (niat eksplisit, bukan hover-intent)", () => {
    const onPrefetch = vi.fn();
    renderRow({
      item: groupItem,
      level: { type: "string" },
      onPrefetch,
    });

    screen.getByRole("button").focus();
    expect(onPrefetch).toHaveBeenCalledTimes(1);
  });

  it("hover header memanggil onPrefetch SETELAH hover-intent delay (150ms), bukan instan -- cegah badai request saat mouse cuma lewat", () => {
    vi.useFakeTimers();
    const onPrefetch = vi.fn();
    renderRow({
      item: groupItem,
      level: { type: "string" },
      onPrefetch,
    });
    const button = screen.getByRole("button");

    fireEvent.mouseEnter(button);
    expect(onPrefetch).not.toHaveBeenCalled();

    vi.advanceTimersByTime(150);
    expect(onPrefetch).toHaveBeenCalledTimes(1);
  });

  it("mouseEnter lalu mouseLeave sebelum delay selesai -> onPrefetch TIDAK pernah dipanggil (mouse cuma lewat)", () => {
    vi.useFakeTimers();
    const onPrefetch = vi.fn();
    renderRow({
      item: groupItem,
      level: { type: "string" },
      onPrefetch,
    });
    const button = screen.getByRole("button");

    fireEvent.mouseEnter(button);
    vi.advanceTimersByTime(100);
    fireEvent.mouseLeave(button);
    vi.advanceTimersByTime(1000);

    expect(onPrefetch).not.toHaveBeenCalled();
  });

  it("sticky (Requirement 21.9): sel label & sel agregat SATU BARIS menempel (position:sticky) dgn top/z-index SAMA", () => {
    renderRow({
      item: groupItem,
      level: { type: "string" },
      depth: 1,
      aggregates,
      showedColumns: columns,
    });

    const [label, ...trailing] = cells();
    for (const cell of cells()) {
      expect(cell.style.position).toBe("sticky");
    }
    for (const cell of trailing) {
      expect(cell.style.top).toBe(label.style.top);
      expect(cell.style.zIndex).toBe(label.style.zIndex);
    }
  });

  it("sticky: `top`/`zIndex` SAMA di SEMUA depth -- BUKAN breadcrumb bertumpuk (dicoba & gagal, lihat komentar GroupHeaderRow.jsx: table.css `display:contents` bikin semua td FLAT, header sibling ikut nempel salah posisi)", () => {
    const shallow = renderRow({
      item: groupItem,
      level: { type: "string" },
      depth: 1,
    });
    const shallowCell = shallow.container.querySelector("td");
    shallow.unmount();

    const deeper = renderRow({
      item: groupItem,
      level: { type: "string" },
      depth: 2,
    });
    const deeperCell = deeper.container.querySelector("td");

    expect(deeperCell.style.top).toBe(shallowCell.style.top);
    expect(deeperCell.style.zIndex).toBe(shallowCell.style.zIndex);
  });

  it("keyboard: Enter & Spasi pada header menoggle", async () => {
    const user = userEvent.setup({ delay: null });
    const onToggle = vi.fn();
    renderRow({ item: groupItem, level: { type: "string" }, onToggle });

    screen.getByRole("button").focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");

    expect(onToggle).toHaveBeenCalledTimes(2);
  });

  it("elemen pager di header tidak ikut men-toggle (Enter pada tombol pager)", async () => {
    const user = userEvent.setup({ delay: null });
    const onToggle = vi.fn();
    renderRow({
      item: groupItem,
      level: { type: "string" },
      onToggle,
      // Seperti GroupPager sungguhan: klik di dalamnya TIDAK boleh merambat ke header.
      pager: (
        <span onClick={(event) => event.stopPropagation()}>
          <button type="button">pager</button>
        </span>
      ),
    });

    screen.getByRole("button", { name: "pager" }).focus();
    await user.keyboard("{Enter}");

    expect(onToggle).not.toHaveBeenCalled();
  });
});

describe("GroupHeaderCard (mobile)", () => {
  it("menampilkan label, count, dan agregat sbg teks kecil `Judul: nilai` per kolom", () => {
    render(
      <GroupHeaderCard
        item={item({ aggregates: { qty: 1500, total: null } })}
        depth={1}
        level={{ type: "string" }}
        isOpen={false}
        onToggle={() => {}}
        pager={null}
        aggregates={[
          { column: "qty", fn: "sum" },
          { column: "total", fn: "avg" },
        ]}
        columns={{
          qty: {
            name: "qty",
            title: "Qty",
            type: "number",
            numberFormat: "#,###",
          },
          total: { name: "total", title: "Total", type: "number" },
        }}
      />,
    );

    expect(screen.getByText("fruit")).toBeInTheDocument();
    expect(screen.getByText("(2)")).toBeInTheDocument();
    expect(screen.getByText("Qty: 1,500")).toBeInTheDocument();
    // Agregat null tak ditampilkan.
    expect(screen.queryByText(/Total:/)).not.toBeInTheDocument();
  });

  it("klik kartu menoggle & indent bertambah per depth", async () => {
    const user = userEvent.setup({ delay: null });
    const onToggle = vi.fn();
    const { container } = render(
      <GroupHeaderCard
        item={item()}
        depth={2}
        level={{ type: "string" }}
        isOpen={false}
        onToggle={onToggle}
        pager={null}
        aggregates={[]}
        columns={{}}
      />,
    );

    await user.click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(container.firstChild.style.paddingLeft).toMatch(/32px/);
    expect(container.firstChild.style.paddingLeft).toMatch(/0\.75rem/);
  });
});

describe("baris status node (loading / error)", () => {
  it("loading = ikon berputar + teks 'Memuat' (bukan skeleton), role=status", () => {
    const { container } = render(<GroupNodeStatusCard depth={0} />);

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("TR:core.datatable.group_loading");
    expect(status.querySelector("svg.animate-spin")).toBeTruthy();
    expect(container.querySelector(".animate-pulse")).toBeNull();
  });

  it("desktop: loading = ikon + teks (role=status), span penuh & indent", () => {
    render(
      <table>
        <tbody>
          <GroupNodeStatusRow depth={1} colSpan={5} />
        </tbody>
      </table>,
    );

    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    const cell = screen.getByRole("cell");
    expect(cell.style.gridColumn).toBe("span 5");
    // jsdom menormalkan urutan operand calc(): cukup pastikan indent 16px + basis 1.25rem.
    expect(cell.style.paddingLeft).toMatch(/16px/);
    expect(cell.style.paddingLeft).toMatch(/1\.25rem/);
  });

  it("desktop: error = pesan + 'Coba lagi' yang memanggil onRetry", async () => {
    const user = userEvent.setup({ delay: null });
    const onRetry = vi.fn();
    render(
      <table>
        <tbody>
          <GroupNodeStatusRow depth={1} colSpan={3} error onRetry={onRetry} />
        </tbody>
      </table>,
    );

    const alert = screen.getByRole("alert");
    expect(
      within(alert).getByText("TR:core.datatable.group_error"),
    ).toBeInTheDocument();
    await user.click(
      within(alert).getByRole("button", {
        name: "TR:core.datatable.group_retry",
      }),
    );
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("mobile: kartu loading & error", async () => {
    const user = userEvent.setup({ delay: null });
    const onRetry = vi.fn();
    const { rerender } = render(<GroupNodeStatusCard depth={1} />);
    expect(screen.getByRole("status")).toBeInTheDocument();

    rerender(<GroupNodeStatusCard depth={1} error onRetry={onRetry} />);
    await user.click(
      screen.getByRole("button", { name: "TR:core.datatable.group_retry" }),
    );
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
