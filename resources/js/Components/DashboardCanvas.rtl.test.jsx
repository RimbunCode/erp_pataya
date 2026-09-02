import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";

// DashboardBlock adalah router type -> komponen block (ChartBlock,
// SectionBlock, dst) yang masing-masing punya dependency berat sendiri
// (WidgetLinkModel, TipTap, dll) dan sudah punya test routing sendiri di
// DashboardBlock.rtl.test.jsx. Di sini distub jadi placeholder yang
// menangkap props yang diterima -- supaya test fokus ke logic
// DashboardCanvas SENDIRI: grid layout, toolbar per-block (grip/edit/menu/
// delete), insert/delete/move/resize/duplicate/eject, dan drag-and-drop
// reorder/nesting -- bukan re-test implementasi tiap block anak. Pola sama
// seperti DashboardBlock.rtl.test.jsx menstub DashboardBlocks/*.
const captured = {};
vi.mock("@/Components/DashboardBlock", () => ({
  default: (props) => {
    const key = props.block.ref ?? props.block.id ?? "unknown";
    captured[key] = props;
    return <div data-testid={`stub-block-${key}`}>{props.block.type}</div>;
  },
}));

// DndContext ASLI dipertahankan (SortableContext/useSortable di
// SortableBlock butuh context yang valid dari situ) -- hanya dibungkus utk
// menangkap referensi onDragStart/onDragOver/onDragEnd ASLI (closure milik
// DashboardCanvas, bukan reimplementasi test) supaya bisa dipanggil manual
// dgn objek {active, over} palsu. Simulasi drag pointer fisik di jsdom
// (PointerSensor + activationConstraint distance) rapuh/flaky, jadi
// dihindari sesuai pedoman drag-and-drop di proyek ini -- lihat pola sama
// di DashboardBlocks/ColumnOrderPicker.rtl.test.jsx.
const dnd = {};
vi.mock("@dnd-kit/core", async () => {
  const actual = await vi.importActual("@dnd-kit/core");
  return {
    ...actual,
    DndContext: (props) => {
      dnd.onDragStart = props.onDragStart;
      dnd.onDragOver = props.onDragOver;
      dnd.onDragEnd = props.onDragEnd;
      return <actual.DndContext {...props} />;
    },
  };
});

import DashboardCanvas from "./DashboardCanvas";

const makeBlock = (overrides = {}) => ({
  ref: "b",
  type: "text",
  config: {},
  width: 12,
  children: [],
  ...overrides,
});

const blockWrapper = (ref) =>
  screen.getByTestId(`stub-block-${ref}`).closest("[data-col-span]");

const iconButton = (scope, iconClass) =>
  scope.querySelector(`.${iconClass}`)?.closest("button");

async function openMenu(user, ref) {
  await user.click(iconButton(blockWrapper(ref), "lucide-ellipsis"));
}

beforeEach(() => {
  for (const key of Object.keys(captured)) delete captured[key];
  dnd.onDragStart = undefined;
  dnd.onDragOver = undefined;
  dnd.onDragEnd = undefined;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DashboardCanvas — render dasar", () => {
  it("widgets kosong + canEdit=true menampilkan tombol 'Tambah block pertama'", () => {
    render(<DashboardCanvas widgets={[]} canEdit onChange={vi.fn()} />);

    expect(
      screen.getByRole("button", { name: /Tambah block pertama/ }),
    ).toBeInTheDocument();
  });

  it("widgets kosong + canEdit=false tidak menampilkan apapun (grid kosong)", () => {
    const { container } = render(
      <DashboardCanvas widgets={[]} canEdit={false} onChange={vi.fn()} />,
    );

    expect(screen.queryByText("Tambah block pertama")).not.toBeInTheDocument();
    expect(
      container.querySelector("[data-dashboard-grid]"),
    ).toBeEmptyDOMElement();
  });

  it("merender satu stub block per widget sesuai urutan, tanpa crash", () => {
    const widgets = [
      makeBlock({ ref: "a", type: "text" }),
      makeBlock({ ref: "b", type: "chart" }),
      makeBlock({ ref: "c", type: "section" }),
    ];
    render(<DashboardCanvas widgets={widgets} canEdit onChange={vi.fn()} />);

    const stubs = screen.getAllByTestId(/^stub-block-/);
    expect(stubs.map((n) => n.dataset.testid)).toEqual([
      "stub-block-a",
      "stub-block-b",
      "stub-block-c",
    ]);
  });

  it("fallback ke block.id sbg key saat block.ref tidak ada", () => {
    const widgets = [
      { id: 42, type: "text", config: {}, width: 12, children: [] },
    ];
    render(<DashboardCanvas widgets={widgets} canEdit onChange={vi.fn()} />);

    expect(screen.getByTestId("stub-block-42")).toBeInTheDocument();
  });
});

describe("DashboardCanvas — toolbar per-block (canEdit)", () => {
  it("canEdit=false tidak merender toolbar apapun (grip/edit/menu/delete)", () => {
    const widgets = [makeBlock({ ref: "a", type: "text" })];
    render(
      <DashboardCanvas widgets={widgets} canEdit={false} onChange={vi.fn()} />,
    );

    expect(blockWrapper("a").querySelectorAll("button")).toHaveLength(0);
  });

  it("canEdit=true merender grip (drag handle), tombol Edit, menu '...', dan tombol Hapus", () => {
    const widgets = [makeBlock({ ref: "a", type: "text" })];
    render(<DashboardCanvas widgets={widgets} canEdit onChange={vi.fn()} />);

    const wrapper = blockWrapper("a");
    expect(iconButton(wrapper, "lucide-grip-vertical")).toBeInTheDocument();
    expect(iconButton(wrapper, "lucide-pencil")).toBeInTheDocument();
    expect(iconButton(wrapper, "lucide-ellipsis")).toBeInTheDocument();
    expect(iconButton(wrapper, "lucide-x")).toBeInTheDocument();
  });

  it("tipe yang TIDAK ada di EDITABLE_BLOCK_TYPES (mis. link_card_item) tidak merender tombol Edit", () => {
    const widgets = [makeBlock({ ref: "a", type: "link_card_item" })];
    render(<DashboardCanvas widgets={widgets} canEdit onChange={vi.fn()} />);

    expect(iconButton(blockWrapper("a"), "lucide-pencil")).toBeUndefined();
  });

  it("klik tombol Edit membuka Dialog config -- editOpen jadi true (terlihat setelah rerender)", async () => {
    const widgets = [makeBlock({ ref: "a", type: "text" })];
    const onChange = vi.fn();
    const { rerender } = render(
      <DashboardCanvas widgets={widgets} canEdit onChange={onChange} />,
    );
    expect(captured.a.editOpen).toBe(false);

    const user = userEvent.setup({ delay: null });
    await user.click(iconButton(blockWrapper("a"), "lucide-pencil"));
    rerender(<DashboardCanvas widgets={widgets} canEdit onChange={onChange} />);

    expect(captured.a.editOpen).toBe(true);
  });

  it("klik Hapus pada block TANPA children langsung memanggil onChange tanpa konfirmasi", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    const onChange = vi.fn();
    const widgets = [
      makeBlock({ ref: "a", type: "text" }),
      makeBlock({ ref: "b", type: "text" }),
    ];
    render(<DashboardCanvas widgets={widgets} canEdit onChange={onChange} />);

    const user = userEvent.setup({ delay: null });
    await user.click(iconButton(blockWrapper("a"), "lucide-x"));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith([widgets[1]]);
  });

  it("klik Hapus pada block DENGAN children menampilkan window.confirm -- batal (false) tidak memanggil onChange", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const onChange = vi.fn();
    const widgets = [
      makeBlock({
        ref: "a",
        type: "section",
        children: [makeBlock({ ref: "child" })],
      }),
    ];
    render(<DashboardCanvas widgets={widgets} canEdit onChange={onChange} />);

    const user = userEvent.setup({ delay: null });
    await user.click(iconButton(blockWrapper("a"), "lucide-x"));

    expect(window.confirm).toHaveBeenCalledWith(
      "Hapus block ini beserta seluruh isinya?",
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it("klik Hapus pada block DENGAN children -- confirm true melanjutkan hapus", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const onChange = vi.fn();
    const widgets = [
      makeBlock({
        ref: "a",
        type: "section",
        children: [makeBlock({ ref: "child" })],
      }),
      makeBlock({ ref: "b" }),
    ];
    render(<DashboardCanvas widgets={widgets} canEdit onChange={onChange} />);

    const user = userEvent.setup({ delay: null });
    await user.click(iconButton(blockWrapper("a"), "lucide-x"));

    expect(onChange).toHaveBeenCalledWith([widgets[1]]);
  });

  it("ResizeHandle (drag-to-resize) dirender utk tipe biasa saat canEdit, TIDAK utk tipe spacer", () => {
    const widgets = [
      makeBlock({ ref: "a", type: "text" }),
      makeBlock({ ref: "b", type: "spacer" }),
    ];
    render(<DashboardCanvas widgets={widgets} canEdit onChange={vi.fn()} />);

    expect(
      blockWrapper("a").querySelector(".cursor-col-resize"),
    ).toBeInTheDocument();
    expect(
      blockWrapper("b").querySelector(".cursor-col-resize"),
    ).not.toBeInTheDocument();
  });
});

describe("DashboardCanvas — BlockActionsMenu ('...')", () => {
  it("klik Expand menambah width block +1 step", async () => {
    const onChange = vi.fn();
    const widgets = [makeBlock({ ref: "a", width: 6 })];
    render(<DashboardCanvas widgets={widgets} canEdit onChange={onChange} />);

    const user = userEvent.setup({ delay: null });
    await openMenu(user, "a");
    await user.click(screen.getByRole("menuitem", { name: /Expand/ }));

    expect(onChange).toHaveBeenCalledWith([{ ...widgets[0], width: 7 }]);
  });

  it("klik Shrink mengurangi width block -1 step", async () => {
    const onChange = vi.fn();
    const widgets = [makeBlock({ ref: "a", width: 6 })];
    render(<DashboardCanvas widgets={widgets} canEdit onChange={onChange} />);

    const user = userEvent.setup({ delay: null });
    await openMenu(user, "a");
    await user.click(screen.getByRole("menuitem", { name: /Shrink/ }));

    expect(onChange).toHaveBeenCalledWith([{ ...widgets[0], width: 5 }]);
  });

  it("Shrink pada width=minWidth ditandai data-disabled; resizeBlock tetap clamp ke minWidth (tidak turun lebih jauh)", async () => {
    const onChange = vi.fn();
    const widgets = [makeBlock({ ref: "a", type: "text", width: 3 })];
    render(<DashboardCanvas widgets={widgets} canEdit onChange={onChange} />);

    const user = userEvent.setup({ delay: null });
    await openMenu(user, "a");
    const shrinkItem = screen.getByRole("menuitem", { name: /Shrink/ });
    expect(shrinkItem).toHaveAttribute("data-disabled");

    // Catatan: Radix MenuItem TIDAK memblokir prop `onClick` konsumen saat
    // disabled (hanya `onSelect` internal & fokus/keyboard yang diblok --
    // lihat handleSelect() di @radix-ui/react-menu). Pencegahan klik
    // sungguhan di produksi murni via CSS `data-disabled:pointer-events-none`
    // (Tailwind), yang TIDAK aktif di jsdom test env ini (tanpa stylesheet
    // ter-load). onClick tetap terpanggil, tapi resizeBlock() sendiri
    // meng-clamp Math.max(minWidth, ...) -- hasil akhir tetap SAMA (aman),
    // bukan turun di bawah minWidth.
    await user.click(shrinkItem);

    expect(onChange).toHaveBeenCalledWith([{ ...widgets[0], width: 3 }]);
  });

  it("tipe 'shortcut' boleh shrink sampai MIN_WIDTH_BY_TYPE=1 (lebih kecil dari tipe lain)", async () => {
    const onChange = vi.fn();
    const widgets = [makeBlock({ ref: "a", type: "shortcut", width: 3 })];
    render(<DashboardCanvas widgets={widgets} canEdit onChange={onChange} />);

    const user = userEvent.setup({ delay: null });
    await openMenu(user, "a");
    await user.click(screen.getByRole("menuitem", { name: /Shrink/ }));

    expect(onChange).toHaveBeenCalledWith([{ ...widgets[0], width: 2 }]);
  });

  it("Expand pada width=MAX_WIDTH ditandai data-disabled; resizeBlock tetap clamp ke MAX_WIDTH (lihat catatan di test Shrink)", async () => {
    const onChange = vi.fn();
    const widgets = [makeBlock({ ref: "a", width: 12 })];
    render(<DashboardCanvas widgets={widgets} canEdit onChange={onChange} />);

    const user = userEvent.setup({ delay: null });
    await openMenu(user, "a");
    const expandItem = screen.getByRole("menuitem", { name: /Expand/ });
    expect(expandItem).toHaveAttribute("data-disabled");

    await user.click(expandItem);

    expect(onChange).toHaveBeenCalledWith([{ ...widgets[0], width: 12 }]);
  });

  it("tipe 'spacer' (hideResize) tidak menampilkan menu item Expand/Shrink sama sekali", async () => {
    const widgets = [makeBlock({ ref: "a", type: "spacer", width: 12 })];
    render(<DashboardCanvas widgets={widgets} canEdit onChange={vi.fn()} />);

    const user = userEvent.setup({ delay: null });
    await openMenu(user, "a");

    expect(
      screen.queryByRole("menuitem", { name: /Expand/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /Shrink/ }),
    ).not.toBeInTheDocument();
  });

  it("Move Up disabled di block pertama -- klik tidak memanggil onChange", async () => {
    const onChange = vi.fn();
    const widgets = [makeBlock({ ref: "a" }), makeBlock({ ref: "b" })];
    render(<DashboardCanvas widgets={widgets} canEdit onChange={onChange} />);

    const user = userEvent.setup({ delay: null });
    await openMenu(user, "a");
    await user.click(screen.getByRole("menuitem", { name: "Move Up" }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("Move Down disabled di block terakhir -- klik tidak memanggil onChange", async () => {
    const onChange = vi.fn();
    const widgets = [makeBlock({ ref: "a" }), makeBlock({ ref: "b" })];
    render(<DashboardCanvas widgets={widgets} canEdit onChange={onChange} />);

    const user = userEvent.setup({ delay: null });
    await openMenu(user, "b");
    await user.click(screen.getByRole("menuitem", { name: "Move Down" }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("klik Move Down memindahkan block satu posisi ke bawah (arrayMove)", async () => {
    const onChange = vi.fn();
    const widgets = [
      makeBlock({ ref: "a" }),
      makeBlock({ ref: "b" }),
      makeBlock({ ref: "c" }),
    ];
    render(<DashboardCanvas widgets={widgets} canEdit onChange={onChange} />);

    const user = userEvent.setup({ delay: null });
    await openMenu(user, "a");
    await user.click(screen.getByRole("menuitem", { name: "Move Down" }));

    expect(onChange).toHaveBeenCalledWith([widgets[1], widgets[0], widgets[2]]);
  });

  it("klik Move Up memindahkan block satu posisi ke atas", async () => {
    const onChange = vi.fn();
    const widgets = [
      makeBlock({ ref: "a" }),
      makeBlock({ ref: "b" }),
      makeBlock({ ref: "c" }),
    ];
    render(<DashboardCanvas widgets={widgets} canEdit onChange={onChange} />);

    const user = userEvent.setup({ delay: null });
    await openMenu(user, "b");
    await user.click(screen.getByRole("menuitem", { name: "Move Up" }));

    expect(onChange).toHaveBeenCalledWith([widgets[1], widgets[0], widgets[2]]);
  });

  it("klik Duplicate menyisipkan clone tepat setelah block asli, dgn ref baru & isNew=false", async () => {
    const onChange = vi.fn();
    const widgets = [
      makeBlock({ ref: "a", type: "chart", width: 6 }),
      makeBlock({ ref: "b" }),
    ];
    render(<DashboardCanvas widgets={widgets} canEdit onChange={onChange} />);

    const user = userEvent.setup({ delay: null });
    await openMenu(user, "a");
    await user.click(screen.getByRole("menuitem", { name: "Duplicate" }));

    const next = onChange.mock.calls[0][0];
    expect(next).toHaveLength(3);
    expect(next[0]).toEqual(widgets[0]);
    expect(next[1]).toMatchObject({ type: "chart", width: 6, isNew: false });
    expect(next[1].ref).not.toBe("a");
    expect(next[1].id).toBeUndefined();
    expect(next[2]).toEqual(widgets[1]);
  });

  it("menu item 'Keluarkan dari Section' TIDAK dirender saat prop onEjectBlock tidak diberikan", async () => {
    const widgets = [makeBlock({ ref: "a" })];
    render(<DashboardCanvas widgets={widgets} canEdit onChange={vi.fn()} />);

    const user = userEvent.setup({ delay: null });
    await openMenu(user, "a");

    expect(
      screen.queryByRole("menuitem", { name: /Keluarkan dari Section/ }),
    ).not.toBeInTheDocument();
  });

  it("klik 'Keluarkan dari Section' memanggil onEjectBlock dgn block ybs (saat prop diberikan)", async () => {
    const onEjectBlock = vi.fn();
    const widgets = [makeBlock({ ref: "a" })];
    render(
      <DashboardCanvas
        widgets={widgets}
        canEdit
        onChange={vi.fn()}
        onEjectBlock={onEjectBlock}
      />,
    );

    const user = userEvent.setup({ delay: null });
    await openMenu(user, "a");
    await user.click(
      screen.getByRole("menuitem", { name: /Keluarkan dari Section/ }),
    );

    expect(onEjectBlock).toHaveBeenCalledWith(widgets[0]);
  });
});

describe("DashboardCanvas — grid span per breakpoint (spanFor)", () => {
  it("width=5 -> sm=3, md=6, lg=5 (contoh persis di JSDoc spanFor)", () => {
    const widgets = [makeBlock({ ref: "a", width: 5 })];
    render(<DashboardCanvas widgets={widgets} canEdit onChange={vi.fn()} />);
    const wrapper = blockWrapper("a");

    expect(wrapper.style.getPropertyValue("--col-span-sm")).toBe("3");
    expect(wrapper.style.getPropertyValue("--col-span-md")).toBe("6");
    expect(wrapper.style.getPropertyValue("--col-span-lg")).toBe("5");
  });

  it("width=2 di mobile (3 kolom) tidak habis dibagi -- dipaksa full-width (span 3), bukan 1.5", () => {
    const widgets = [makeBlock({ ref: "a", width: 2 })];
    render(<DashboardCanvas widgets={widgets} canEdit onChange={vi.fn()} />);

    expect(blockWrapper("a").style.getPropertyValue("--col-span-sm")).toBe("3");
  });

  it("width tidak diisi (undefined) -> full width di semua breakpoint (sm=3, md=6, lg=12)", () => {
    const widgets = [{ ref: "a", type: "text", config: {}, children: [] }];
    render(<DashboardCanvas widgets={widgets} canEdit onChange={vi.fn()} />);
    const wrapper = blockWrapper("a");

    expect(wrapper.style.getPropertyValue("--col-span-sm")).toBe("3");
    expect(wrapper.style.getPropertyValue("--col-span-md")).toBe("6");
    expect(wrapper.style.getPropertyValue("--col-span-lg")).toBe("12");
    expect(wrapper.dataset.colSpan).toBe("12");
  });

  it("tipe 'spacer' selalu dipaksa MAX_WIDTH walau block.width kecil -- data-col-span=12", () => {
    const widgets = [makeBlock({ ref: "a", type: "spacer", width: 3 })];
    render(<DashboardCanvas widgets={widgets} canEdit onChange={vi.fn()} />);
    const wrapper = blockWrapper("a");

    expect(wrapper.dataset.colSpan).toBe("12");
    expect(wrapper.style.getPropertyValue("--col-span-lg")).toBe("12");
  });
});

describe("DashboardCanvas — insert block", () => {
  it("popover BlockTypeOptions di depth=0 menampilkan opsi Section", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <DashboardCanvas widgets={[]} canEdit onChange={vi.fn()} depth={0} />,
    );
    await user.click(
      screen.getByRole("button", { name: /Tambah block pertama/ }),
    );

    expect(screen.getByRole("button", { name: "Section" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Text" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Number Card" }),
    ).toBeInTheDocument();
  });

  it("popover BlockTypeOptions di depth>0 (nested dalam Section) TIDAK menampilkan opsi Section", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <DashboardCanvas widgets={[]} canEdit onChange={vi.fn()} depth={1} />,
    );
    await user.click(
      screen.getByRole("button", { name: /Tambah block pertama/ }),
    );

    expect(
      screen.queryByRole("button", { name: "Section" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Text" })).toBeInTheDocument();
  });

  it("pilih 'Text' dari empty-state menyisipkan block baru dgn defaultConfigFor('text'), width 12, isNew true", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(<DashboardCanvas widgets={[]} canEdit onChange={onChange} />);
    await user.click(
      screen.getByRole("button", { name: /Tambah block pertama/ }),
    );
    await user.click(screen.getByRole("button", { name: "Text" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0];
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({
      type: "text",
      config: { json: null, html: "" },
      width: 12,
      children: [],
      isNew: true,
    });
    expect(next[0].ref).toEqual(expect.stringMatching(/^local-/));
  });

  it("tipe 'shortcut' disisipkan dgn default width 3 (DEFAULT_WIDTH_BY_TYPE) & config shortcut", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(<DashboardCanvas widgets={[]} canEdit onChange={onChange} />);
    await user.click(
      screen.getByRole("button", { name: /Tambah block pertama/ }),
    );
    await user.click(screen.getByRole("button", { name: "Shortcut" }));

    const next = onChange.mock.calls[0][0];
    expect(next[0]).toMatchObject({
      type: "shortcut",
      width: 3,
      config: {
        icon: null,
        link_type: "menu_item",
        link_to: "",
        background_color: null,
        foreground_color: null,
        stats_filter: null,
      },
    });
  });

  it("InsertBlockButton 'sesudah' pada block pertama menyisipkan block baru tepat setelahnya (index+1)", async () => {
    const onChange = vi.fn();
    const widgets = [makeBlock({ ref: "a" })];
    const user = userEvent.setup({ delay: null });
    render(<DashboardCanvas widgets={widgets} canEdit onChange={onChange} />);

    await user.click(
      screen.getByRole("button", { name: "Sisipkan block sesudah" }),
    );
    await user.click(screen.getByRole("button", { name: "Chart" }));

    const next = onChange.mock.calls[0][0];
    expect(next).toHaveLength(2);
    expect(next[0]).toEqual(widgets[0]);
    expect(next[1]).toMatchObject({ type: "chart" });
  });

  it("InsertBlockButton 'sebelum' hanya ada di block pertama, menyisipkan di index 0", async () => {
    const onChange = vi.fn();
    const widgets = [makeBlock({ ref: "a" }), makeBlock({ ref: "b" })];
    const user = userEvent.setup({ delay: null });
    render(<DashboardCanvas widgets={widgets} canEdit onChange={onChange} />);

    expect(
      screen.getAllByRole("button", { name: "Sisipkan block sebelum" }),
    ).toHaveLength(1);

    await user.click(
      screen.getByRole("button", { name: "Sisipkan block sebelum" }),
    );
    await user.click(screen.getByRole("button", { name: "Spacer" }));

    const next = onChange.mock.calls[0][0];
    expect(next).toHaveLength(3);
    expect(next[0]).toMatchObject({ type: "spacer" });
    expect(next[1]).toEqual(widgets[0]);
    expect(next[2]).toEqual(widgets[1]);
  });

  it("setiap block (bukan cuma yg pertama) punya tombol 'Sisipkan block sesudah'", () => {
    const widgets = [
      makeBlock({ ref: "a" }),
      makeBlock({ ref: "b" }),
      makeBlock({ ref: "c" }),
    ];
    render(<DashboardCanvas widgets={widgets} canEdit onChange={vi.fn()} />);

    expect(
      screen.getAllByRole("button", { name: "Sisipkan block sesudah" }),
    ).toHaveLength(3);
  });

  it("insertBlock menandai block baru utk auto-buka Dialog edit -- terlihat setelah rerender dgn widgets terbaru", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup({ delay: null });
    const { rerender } = render(
      <DashboardCanvas widgets={[]} canEdit onChange={onChange} />,
    );
    await user.click(
      screen.getByRole("button", { name: /Tambah block pertama/ }),
    );
    await user.click(screen.getByRole("button", { name: "Text" }));

    const next = onChange.mock.calls[0][0];
    rerender(<DashboardCanvas widgets={next} canEdit onChange={onChange} />);

    expect(captured[next[0].ref].editOpen).toBe(true);
  });

  it("canEdit=false tidak merender tombol insert apapun (before/after)", () => {
    const widgets = [makeBlock({ ref: "a" })];
    render(
      <DashboardCanvas widgets={widgets} canEdit={false} onChange={vi.fn()} />,
    );

    expect(
      screen.queryByRole("button", { name: /Sisipkan block/ }),
    ).not.toBeInTheDocument();
  });
});

describe("DashboardCanvas — ejectFromSection (onEjectChild diteruskan ke DashboardBlock utk SectionBlock)", () => {
  it("memanggil onEjectChild(child) memindahkan child keluar dari section.children ke akhir array root", () => {
    const onChange = vi.fn();
    const child = makeBlock({ ref: "child", type: "text" });
    const child2 = makeBlock({ ref: "child2", type: "text" });
    const section = makeBlock({
      ref: "sec",
      type: "section",
      children: [child, child2],
    });
    const widgets = [section, makeBlock({ ref: "other" })];
    render(<DashboardCanvas widgets={widgets} canEdit onChange={onChange} />);

    act(() => {
      captured.sec.onEjectChild(child);
    });

    expect(onChange).toHaveBeenCalledWith([
      { ...section, children: [child2] },
      widgets[1],
      child,
    ]);
  });
});

describe("DashboardCanvas — drag-and-drop (handler asli dipanggil manual, tanpa simulasi pointer fisik)", () => {
  it("drag root block ke posisi lain memanggil onChange dgn arrayMove(oldIndex, newIndex)", () => {
    const onChange = vi.fn();
    const widgets = [
      makeBlock({ ref: "a" }),
      makeBlock({ ref: "b" }),
      makeBlock({ ref: "c" }),
    ];
    render(<DashboardCanvas widgets={widgets} canEdit onChange={onChange} />);

    expect(dnd.onDragEnd).toBeInstanceOf(Function);
    act(() => {
      dnd.onDragEnd({ active: { id: "a" }, over: { id: "c" } });
    });

    expect(onChange).toHaveBeenCalledWith([widgets[1], widgets[2], widgets[0]]);
  });

  it("drop tanpa target valid (over null) tidak memanggil onChange", () => {
    const onChange = vi.fn();
    const widgets = [makeBlock({ ref: "a" }), makeBlock({ ref: "b" })];
    render(<DashboardCanvas widgets={widgets} canEdit onChange={onChange} />);

    act(() => {
      dnd.onDragEnd({ active: { id: "a" }, over: null });
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("drop di posisi yg sama (active.id === over.id) tidak memanggil onChange", () => {
    const onChange = vi.fn();
    const widgets = [makeBlock({ ref: "a" }), makeBlock({ ref: "b" })];
    render(<DashboardCanvas widgets={widgets} canEdit onChange={onChange} />);

    act(() => {
      dnd.onDragEnd({ active: { id: "a" }, over: { id: "a" } });
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("active/over id yg tidak ada di widgets (bukan item, bukan section-footer) tidak memanggil onChange", () => {
    const onChange = vi.fn();
    const widgets = [makeBlock({ ref: "a" }), makeBlock({ ref: "b" })];
    render(<DashboardCanvas widgets={widgets} canEdit onChange={onChange} />);

    act(() => {
      dnd.onDragEnd({ active: { id: "ghost" }, over: { id: "b" } });
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("drop block non-section ke 'section-footer:<ref>' memindahkannya jadi children section tsb (drag-to-nest)", () => {
    const onChange = vi.fn();
    const section = makeBlock({ ref: "sec", type: "section", children: [] });
    const chart = makeBlock({ ref: "chart1", type: "chart" });
    const widgets = [section, chart];
    render(<DashboardCanvas widgets={widgets} canEdit onChange={onChange} />);

    act(() => {
      dnd.onDragEnd({
        active: { id: "chart1" },
        over: { id: "section-footer:sec" },
      });
    });

    expect(onChange).toHaveBeenCalledWith([{ ...section, children: [chart] }]);
  });

  it("drop SECTION lain ke 'section-footer:<ref>' diabaikan -- section tidak boleh nested di section", () => {
    const onChange = vi.fn();
    const sectionA = makeBlock({ ref: "secA", type: "section", children: [] });
    const sectionB = makeBlock({ ref: "secB", type: "section", children: [] });
    render(
      <DashboardCanvas
        widgets={[sectionA, sectionB]}
        canEdit
        onChange={onChange}
      />,
    );

    act(() => {
      dnd.onDragEnd({
        active: { id: "secB" },
        over: { id: "section-footer:secA" },
      });
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("'section-footer:' menunjuk ref yg tidak ada di widgets diabaikan", () => {
    const onChange = vi.fn();
    const widgets = [makeBlock({ ref: "a", type: "chart" })];
    render(<DashboardCanvas widgets={widgets} canEdit onChange={onChange} />);

    act(() => {
      dnd.onDragEnd({
        active: { id: "a" },
        over: { id: "section-footer:tidak-ada" },
      });
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  describe("link_card_item (pindah/reorder di dalam atau antar Link Card)", () => {
    const makeCard = (ref, itemRefs) =>
      makeBlock({
        ref,
        type: "link_card",
        children: itemRefs.map((r) =>
          makeBlock({ ref: r, type: "link_card_item" }),
        ),
      });

    it("drop item ke footer card ASAL SENDIRI adalah no-op", () => {
      const onChange = vi.fn();
      const card = makeCard("card1", ["i1", "i2"]);
      render(<DashboardCanvas widgets={[card]} canEdit onChange={onChange} />);

      act(() => {
        dnd.onDragEnd({
          active: { id: "i1" },
          over: { id: "link-card-footer:card1" },
        });
      });

      expect(onChange).not.toHaveBeenCalled();
    });

    it("drop item ke footer card LAIN memindahkan item ke akhir children card tujuan", () => {
      const onChange = vi.fn();
      const cardA = makeCard("cardA", ["i1"]);
      const cardB = makeCard("cardB", ["j1"]);
      render(
        <DashboardCanvas
          widgets={[cardA, cardB]}
          canEdit
          onChange={onChange}
        />,
      );

      act(() => {
        dnd.onDragEnd({
          active: { id: "i1" },
          over: { id: "link-card-footer:cardB" },
        });
      });

      expect(onChange).toHaveBeenCalledWith([
        { ...cardA, children: [] },
        { ...cardB, children: [cardB.children[0], cardA.children[0]] },
      ]);
    });

    it("drop item ke item lain DALAM card yg sama -- reorder", () => {
      const onChange = vi.fn();
      const card = makeCard("card1", ["i1", "i2", "i3"]);
      const [i1, i2, i3] = card.children;
      render(<DashboardCanvas widgets={[card]} canEdit onChange={onChange} />);

      act(() => {
        dnd.onDragEnd({ active: { id: "i3" }, over: { id: "i1" } });
      });

      expect(onChange).toHaveBeenCalledWith([
        { ...card, children: [i3, i1, i2] },
      ]);
    });

    it("drop item ke item DALAM card lain -- pindah card & masuk di posisi item target", () => {
      const onChange = vi.fn();
      const cardA = makeCard("cardA", ["i1"]);
      const cardB = makeCard("cardB", ["j1", "j2"]);
      const [i1] = cardA.children;
      const [j1, j2] = cardB.children;
      render(
        <DashboardCanvas
          widgets={[cardA, cardB]}
          canEdit
          onChange={onChange}
        />,
      );

      act(() => {
        dnd.onDragEnd({ active: { id: "i1" }, over: { id: "j2" } });
      });

      expect(onChange).toHaveBeenCalledWith([
        { ...cardA, children: [] },
        { ...cardB, children: [j1, i1, j2] },
      ]);
    });

    it("over.id yg bukan footer & bukan item valid (findItemLocation gagal) -- tidak memanggil onChange", () => {
      const onChange = vi.fn();
      const card = makeCard("card1", ["i1"]);
      render(<DashboardCanvas widgets={[card]} canEdit onChange={onChange} />);

      act(() => {
        dnd.onDragEnd({ active: { id: "i1" }, over: { id: "ghost-block" } });
      });

      expect(onChange).not.toHaveBeenCalled();
    });
  });
});

describe("DashboardCanvas — state drag internal (isDragActive/activeDragType/isDropTarget)", () => {
  it("dragStart pd root block set isDragActive & activeDragType sesuai tipe block yg diseret", () => {
    const widgets = [
      makeBlock({ ref: "a", type: "chart" }),
      makeBlock({ ref: "b" }),
    ];
    render(<DashboardCanvas widgets={widgets} canEdit onChange={vi.fn()} />);

    expect(captured.a.isDragActive).toBe(false);
    expect(captured.a.activeDragType).toBeNull();

    act(() => {
      dnd.onDragStart({ active: { id: "a" } });
    });

    expect(captured.a.isDragActive).toBe(true);
    expect(captured.a.activeDragType).toBe("chart");
  });

  it("dragStart pd link_card_item me-resolve activeDragType via findItemLocation (bukan widget root)", () => {
    const card = makeBlock({
      ref: "card1",
      type: "link_card",
      children: [makeBlock({ ref: "i1", type: "link_card_item" })],
    });
    render(<DashboardCanvas widgets={[card]} canEdit onChange={vi.fn()} />);

    act(() => {
      dnd.onDragStart({ active: { id: "i1" } });
    });

    expect(captured.card1.activeDragType).toBe("link_card_item");
  });

  it("dragOver menambahkan class highlight drop-target hanya pd block yg SEDANG di-hover", () => {
    const widgets = [makeBlock({ ref: "a" }), makeBlock({ ref: "b" })];
    render(<DashboardCanvas widgets={widgets} canEdit onChange={vi.fn()} />);

    act(() => {
      dnd.onDragStart({ active: { id: "a" } });
      dnd.onDragOver({ over: { id: "b" } });
    });

    expect(blockWrapper("b").className).toContain("border-primary");
    expect(blockWrapper("a").className).not.toContain("border-primary");
  });

  it("dragEnd mereset isDragActive/activeDragType/overId (highlight hilang)", () => {
    const widgets = [makeBlock({ ref: "a" }), makeBlock({ ref: "b" })];
    render(<DashboardCanvas widgets={widgets} canEdit onChange={vi.fn()} />);

    act(() => {
      dnd.onDragStart({ active: { id: "a" } });
      dnd.onDragOver({ over: { id: "b" } });
    });
    expect(blockWrapper("b").className).toContain("border-primary");

    act(() => {
      dnd.onDragEnd({ active: { id: "a" }, over: { id: "b" } });
    });

    expect(blockWrapper("b").className).not.toContain("border-primary");
    expect(captured.a.isDragActive).toBe(false);
    expect(captured.a.activeDragType).toBeNull();
  });
});
