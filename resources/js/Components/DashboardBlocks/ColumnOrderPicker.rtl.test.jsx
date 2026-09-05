import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

// DndContext ASLI dipertahankan (SortableContext/useSortable di
// SelectedColumnRow butuh context yang valid dari situ) -- hanya
// dibungkus utk menangkap referensi onDragEnd ASLI (closure milik
// komponen, bukan reimplementasi test) supaya bisa dipanggil manual dgn
// objek {active, over} palsu. Simulasi drag pointer fisik di jsdom
// (PointerSensor + activationConstraint distance) rapuh/flaky, jadi
// dihindari sesuai pedoman drag-and-drop di proyek ini -- lihat CLAUDE.md.
let capturedOnDragEnd;
vi.mock("@dnd-kit/core", async () => {
  const actual = await vi.importActual("@dnd-kit/core");
  return {
    ...actual,
    DndContext: (props) => {
      capturedOnDragEnd = props.onDragEnd;
      return <actual.DndContext {...props} />;
    },
  };
});

import ColumnOrderPicker from "./ColumnOrderPicker";

const columns = [
  { name: "name", title: "Nama", type: "string" },
  { name: "status", titleTrans: "core.status", type: "string" },
  { name: "code", title: "Kode", type: "string" },
  { name: "children", title: "Anak", type: "relations" },
  { name: "route", title: "Route", type: "string" },
  { name: "secret", title: "Rahasia", type: "string", hidden: true },
];

function renderPicker(props = {}) {
  const onChange = props.onChange ?? vi.fn();
  const utils = render(
    <ColumnOrderPicker
      columns={columns}
      value={[]}
      {...props}
      onChange={onChange}
    />,
  );
  return { ...utils, onChange };
}

const addButton = () =>
  screen.getByRole("button", {
    name: "TR:core.formtable.add_or_remove_columns",
  });

const applyButton = () =>
  screen.getByRole("button", { name: "TR:core.formtable.apply" });

const selectAllButton = () =>
  screen.getByRole("button", { name: "TR:core.formtable.select_all" });

describe("ColumnOrderPicker — daftar kolom terpilih", () => {
  it("menampilkan pesan placeholder & tombol tambah saat belum ada kolom dipilih", () => {
    renderPicker({ value: [] });

    expect(
      screen.getByText(
        "Belum ada kolom dipilih — pilih minimal satu kolom untuk ditampilkan.",
      ),
    ).toBeInTheDocument();
    expect(addButton()).toBeInTheDocument();
  });

  it("merender baris utk tiap kolom terpilih SESUAI URUTAN value, dgn label title/titleTrans", () => {
    renderPicker({ value: ["status", "name"] });

    const rows = screen
      .getAllByLabelText("Hapus kolom")
      .map((btn) => btn.closest("div"));
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("TR:core.status")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Nama")).toBeInTheDocument();
  });

  it("mengabaikan nama di value yg tidak ada di daftar columns (kolom sudah dihapus/rename)", () => {
    renderPicker({ value: ["name", "kolom_hantu"] });

    expect(screen.getAllByLabelText("Hapus kolom")).toHaveLength(1);
    expect(screen.getByText("Nama")).toBeInTheDocument();
  });

  it("mengabaikan nama di value yg mengarah ke kolom TIDAK selectable (type relations/hidden/meta)", () => {
    renderPicker({ value: ["name", "children", "route", "secret"] });

    // Hanya "name" yg lolos isSelectableColumn -- 3 lainnya (type relations,
    // meta append "route", dan hidden) difilter keluar dari daftar terpilih.
    expect(screen.getAllByLabelText("Hapus kolom")).toHaveLength(1);
    expect(screen.getByText("Nama")).toBeInTheDocument();
  });

  it("value undefined/null diperlakukan sebagai array kosong (tidak crash)", () => {
    renderPicker({ value: undefined });

    expect(
      screen.getByText(
        "Belum ada kolom dipilih — pilih minimal satu kolom untuk ditampilkan.",
      ),
    ).toBeInTheDocument();
  });

  it("klik tombol Hapus pada satu baris memanggil onChange tanpa kolom itu, sisanya tetap terurut", async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    renderPicker({ value: ["name", "status", "code"], onChange });

    await user.click(screen.getAllByLabelText("Hapus kolom")[1]);

    expect(onChange).toHaveBeenCalledWith(["name", "code"]);
  });
});

describe("ColumnOrderPicker — dialog tambah/buang kolom", () => {
  it("dialog tertutup secara default, terbuka setelah klik tombol tambah", async () => {
    const user = userEvent.setup({ delay: null });
    renderPicker({ value: ["name"] });

    expect(
      screen.queryByText("TR:core.formtable.select_columns"),
    ).not.toBeInTheDocument();

    await user.click(addButton());

    expect(
      screen.getByText("TR:core.formtable.select_columns"),
    ).toBeInTheDocument();
  });

  it("hanya menampilkan kolom yg selectable sebagai checkbox (relations/meta/hidden disaring)", async () => {
    const user = userEvent.setup({ delay: null });
    renderPicker({ value: [] });

    await user.click(addButton());

    expect(screen.getByLabelText("Nama")).toBeInTheDocument();
    expect(screen.getByLabelText("TR:core.status")).toBeInTheDocument();
    expect(screen.getByLabelText("Kode")).toBeInTheDocument();
    expect(screen.queryByLabelText("Anak")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Route")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Rahasia")).not.toBeInTheDocument();
  });

  it("checkbox mencerminkan kolom yg sudah terpilih saat dialog dibuka", async () => {
    const user = userEvent.setup({ delay: null });
    renderPicker({ value: ["name"] });

    await user.click(addButton());

    expect(screen.getByLabelText("Nama")).toHaveAttribute(
      "data-state",
      "checked",
    );
    expect(screen.getByLabelText("Kode")).toHaveAttribute(
      "data-state",
      "unchecked",
    );
  });

  it("centang kolom baru lalu klik Terapkan memanggil onChange dgn kolom lama + kolom baru", async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    renderPicker({ value: ["name"], onChange });

    await user.click(addButton());
    await user.click(screen.getByLabelText("Kode"));
    await user.click(applyButton());

    expect(onChange).toHaveBeenCalledWith(["name", "code"]);
  });

  it("hapus centang kolom yg sudah terpilih lalu Terapkan memanggil onChange tanpa kolom itu", async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    renderPicker({ value: ["name", "code"], onChange });

    await user.click(addButton());
    await user.click(screen.getByLabelText("Nama"));
    await user.click(applyButton());

    expect(onChange).toHaveBeenCalledWith(["code"]);
  });

  it("tombol Pilih Semua menandai seluruh kolom selectable, diterapkan lewat Terapkan", async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    renderPicker({ value: [], onChange });

    await user.click(addButton());
    await user.click(selectAllButton());
    await user.click(applyButton());

    expect(onChange).toHaveBeenCalledWith(["name", "status", "code"]);
  });

  it("menutup dialog lewat Terapkan (DialogClose) -- dialog tidak lagi tampil", async () => {
    const user = userEvent.setup({ delay: null });
    renderPicker({ value: ["name"] });

    await user.click(addButton());
    await user.click(applyButton());

    expect(
      screen.queryByText("TR:core.formtable.select_columns"),
    ).not.toBeInTheDocument();
  });

  it("perubahan checkbox yg TIDAK diterapkan (batal via Escape) TIDAK bocor ke pembukaan dialog berikutnya -- draft di-reset via useEffect(open)", async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    renderPicker({ value: ["name"], onChange });

    await user.click(addButton());
    await user.click(screen.getByLabelText("Kode")); // centang tanpa Terapkan
    await user.keyboard("{Escape}"); // batal, dialog tertutup tanpa apply

    expect(onChange).not.toHaveBeenCalled();

    await user.click(addButton()); // buka lagi -- draft sinkron ulang ke selected ["name"]

    expect(screen.getByLabelText("Nama")).toHaveAttribute(
      "data-state",
      "checked",
    );
    expect(screen.getByLabelText("Kode")).toHaveAttribute(
      "data-state",
      "unchecked",
    );
  });
});

describe("ColumnOrderPicker — reorder drag-and-drop (handler asli, tanpa simulasi pointer fisik)", () => {
  it("drag over kolom lain memanggil onChange dgn urutan baru (arrayMove oldIndex -> newIndex)", () => {
    const onChange = vi.fn();
    renderPicker({ value: ["name", "status", "code"], onChange });

    expect(capturedOnDragEnd).toBeInstanceOf(Function);
    capturedOnDragEnd({ active: { id: "name" }, over: { id: "code" } });

    expect(onChange).toHaveBeenCalledWith(["status", "code", "name"]);
  });

  it("drop di luar target valid (over null) tidak memanggil onChange", () => {
    const onChange = vi.fn();
    renderPicker({ value: ["name", "status"], onChange });

    capturedOnDragEnd({ active: { id: "name" }, over: null });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("drop di posisi yg sama (active.id === over.id) tidak memanggil onChange", () => {
    const onChange = vi.fn();
    renderPicker({ value: ["name", "status"], onChange });

    capturedOnDragEnd({ active: { id: "name" }, over: { id: "name" } });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("id yg tidak ada di daftar selected (oldIndex/newIndex -1) tidak memanggil onChange", () => {
    const onChange = vi.fn();
    renderPicker({ value: ["name", "status"], onChange });

    capturedOnDragEnd({
      active: { id: "kolom_hantu" },
      over: { id: "status" },
    });

    expect(onChange).not.toHaveBeenCalled();
  });
});
