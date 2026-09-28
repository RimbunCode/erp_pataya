import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({
    t: (key, params) =>
      params ? `TR:${key}:${JSON.stringify(params)}` : `TR:${key}`,
  }),
}));

// Drag/keyboard sensor dnd-kit butuh layout nyata (getBoundingClientRect) yang
// tak ada di jsdom -- yang diuji di sini WIRING-nya: DndContext dibungkus supaya
// `onDragEnd` bisa dipanggil langsung dgn {active, over} seperti yang dikirim
// dnd-kit. Drag sungguhan (pointer & keyboard) diverifikasi di browser.
const dnd = vi.hoisted(() => ({ onDragEnd: null }));
vi.mock("@dnd-kit/core", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    DndContext: ({ children, onDragEnd }) => {
      dnd.onDragEnd = onDragEnd;
      return children;
    },
  };
});

import GroupLevelsEditor from "./GroupLevelsEditor";

const options = [
  { value: "category", label: "Kategori" },
  { value: "status", label: "Status" },
  { value: "order_date", label: "Tgl Order" },
  { value: "amount", label: "Jumlah" },
  { value: "customer", label: "Customer" },
  { value: "warehouse", label: "Gudang" },
];

const columns = {
  category: { name: "category", type: "string" },
  status: { name: "status", type: "formStatus" },
  order_date: { name: "order_date", type: "date" },
  amount: { name: "amount", type: "number", groupRangeOptions: [50, 500] },
  customer: { name: "customer", type: "relation" },
  warehouse: { name: "warehouse", type: "relation" },
};

const level = (column, granularity = null, range = null) => ({
  column,
  granularity,
  range,
});

const setup = (value = [], props = {}) => {
  const onChange = vi.fn();
  const view = render(
    <GroupLevelsEditor
      columns={columns}
      options={options}
      value={value}
      onChange={onChange}
      {...props}
    />,
  );
  return { onChange, ...view };
};

// Nama aksesibel baris = label kolom (aria-label pada role="checkbox").
const rows = () =>
  screen.getAllByRole("checkbox").map((row) => ({
    label: row.getAttribute("aria-label"),
    checked: row.getAttribute("aria-checked"),
  }));

describe("GroupLevelsEditor — susunan panel", () => {
  it("aktif di atas berurutan (urutan = nesting), divider, lalu non-aktif", () => {
    setup([level("status"), level("category")]);

    expect(rows()).toEqual([
      { label: "Status", checked: "true" },
      { label: "Kategori", checked: "true" },
      { label: "Tgl Order", checked: "false" },
      { label: "Jumlah", checked: "false" },
      { label: "Customer", checked: "false" },
      { label: "Gudang", checked: "false" },
    ]);
    expect(screen.getAllByRole("separator")).toHaveLength(1);
  });

  it("divider HANYA muncul bila ada aktif DAN non-aktif", () => {
    const { rerender, onChange } = setup([]);
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();

    rerender(
      <GroupLevelsEditor
        columns={columns}
        options={options}
        value={options.map((o) => level(o.value)).slice(0, 4)}
        onChange={onChange}
      />,
    );
    expect(screen.getByRole("separator")).toBeInTheDocument();

    rerender(
      <GroupLevelsEditor
        columns={columns}
        options={options.slice(0, 2)}
        value={[level("category"), level("status")]}
        onChange={onChange}
      />,
    );
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
  });

  it("level aktif yang kolomnya tak ada di options tetap tampil (label = nama kolom) supaya bisa dihapus", () => {
    setup([level("kolom_lama")]);

    expect(rows()[0]).toEqual({ label: "kolom_lama", checked: "true" });
  });

  it("className override diterapkan pada wadah (SearchPanel memakai w-full)", () => {
    const { container } = setup([], { className: "w-full" });

    expect(container.firstChild).toHaveClass("w-full");
    expect(container.firstChild).not.toHaveClass("w-64");
  });
});

describe("GroupLevelsEditor — toggle", () => {
  it("klik non-aktif menambah sbg level TERDALAM dgn default per tipe", async () => {
    const user = userEvent.setup({ delay: null });
    const { onChange } = setup([level("category")]);

    await user.click(screen.getByRole("checkbox", { name: "Tgl Order" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith([
      level("category"),
      level("order_date", "month"),
    ]);
  });

  it("default range kolom number = opsi pertama groupRangeOptions kolom itu", async () => {
    const user = userEvent.setup({ delay: null });
    const { onChange } = setup([]);

    await user.click(screen.getByRole("checkbox", { name: "Jumlah" }));

    expect(onChange).toHaveBeenCalledWith([level("amount", null, 50)]);
  });

  it("klik aktif menghapus; level lain & urutannya utuh", async () => {
    const user = userEvent.setup({ delay: null });
    const { onChange } = setup([
      level("category"),
      level("status"),
      level("customer"),
    ]);

    await user.click(screen.getByRole("checkbox", { name: "Status" }));

    expect(onChange).toHaveBeenCalledWith([
      level("category"),
      level("customer"),
    ]);
  });

  it("satu klik = SATU onChange (tanpa double-fire label+kontrol)", async () => {
    const user = userEvent.setup({ delay: null });
    const { onChange } = setup([]);

    await user.click(screen.getByRole("checkbox", { name: "Kategori" }));

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("keyboard: Spasi dan Enter pada baris menoggle", async () => {
    const user = userEvent.setup({ delay: null });
    const { onChange } = setup([]);

    const row = screen.getByRole("checkbox", { name: "Kategori" });
    row.focus();
    await user.keyboard(" ");
    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenNthCalledWith(1, [level("category")]);
  });
});

describe("GroupLevelsEditor — batas level", () => {
  const full = ["category", "status", "order_date", "amount"].map((c) =>
    level(c),
  );

  it("di batas (4) baris non-aktif disabled + keterangan batas; klik diabaikan", async () => {
    const user = userEvent.setup({ delay: null });
    const { onChange } = setup(full);

    const inactive = screen.getByRole("checkbox", { name: "Customer" });
    expect(inactive).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByText('TR:core.datatable.group_levels.max:{"max":4}'),
    ).toBeInTheDocument();

    await user.click(inactive);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("di batas menghapus tetap boleh & keterangan hilang saat < batas", async () => {
    const user = userEvent.setup({ delay: null });
    const { onChange, rerender } = setup(full);

    await user.click(screen.getByRole("checkbox", { name: "Status" }));
    expect(onChange).toHaveBeenCalledTimes(1);

    rerender(
      <GroupLevelsEditor
        columns={columns}
        options={options}
        value={full.slice(0, 3)}
        onChange={onChange}
      />,
    );
    expect(
      screen.queryByText('TR:core.datatable.group_levels.max:{"max":4}'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Customer" }),
    ).not.toHaveAttribute("aria-disabled");
  });

  it("prop max kustom dihormati", () => {
    setup([level("category"), level("status")], { max: 2 });

    expect(screen.getByRole("checkbox", { name: "Customer" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});

describe("GroupLevelsEditor — urutan (drag)", () => {
  it("tiap baris aktif punya handle drag beraksesibilitas; non-aktif tidak", () => {
    setup([level("category"), level("status")]);

    expect(
      screen.getAllByRole("button", {
        name: "TR:core.datatable.group_levels.drag_handle",
      }),
    ).toHaveLength(2);
  });

  it("onDragEnd memindahkan level: A>B>C, geser A ke posisi C -> B>C>A", () => {
    const { onChange } = setup([
      level("category"),
      level("status"),
      level("order_date", "month"),
    ]);

    dnd.onDragEnd({ active: { id: "category" }, over: { id: "order_date" } });

    expect(onChange).toHaveBeenCalledWith([
      level("status"),
      level("order_date", "month"),
      level("category"),
    ]);
  });

  it("onDragEnd tanpa target / target sama = tidak melapor", () => {
    const { onChange } = setup([level("category"), level("status")]);

    dnd.onDragEnd({ active: { id: "category" }, over: null });
    dnd.onDragEnd({ active: { id: "category" }, over: { id: "category" } });

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("GroupLevelsEditor — opsi per level", () => {
  it("kolom date aktif menampilkan Select granularity (default Bulan); ganti hanya milik level itu", async () => {
    const user = userEvent.setup({ delay: null });
    const { onChange } = setup([
      level("category"),
      level("order_date", "month"),
    ]);

    const trigger = screen.getByRole("combobox", {
      name: "TR:core.datatable.group_levels.granularity",
    });
    expect(trigger).toHaveTextContent("TR:core.datatable.granularity.month");

    await user.click(trigger);
    await user.click(
      await screen.findByRole("option", {
        name: "TR:core.datatable.granularity.year",
      }),
    );

    expect(onChange).toHaveBeenCalledWith([
      level("category"),
      level("order_date", "year"),
    ]);
  });

  it("kolom number aktif menampilkan Select range dari groupRangeOptions kolom itu", async () => {
    const user = userEvent.setup({ delay: null });
    const { onChange } = setup([level("amount", null, 50)]);

    const trigger = screen.getByRole("combobox", {
      name: "TR:core.datatable.group_range",
    });
    expect(trigger).toHaveTextContent("50");

    await user.click(trigger);
    expect(await screen.findAllByRole("option")).toHaveLength(2);
    await user.click(screen.getByRole("option", { name: "500" }));

    expect(onChange).toHaveBeenCalledWith([level("amount", null, 500)]);
  });

  it("kolom string/relasi tidak punya Select opsi; baris non-aktif juga tidak", () => {
    setup([level("category"), level("customer")]);

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("dua level date/number sekaligus: tiap level punya Select sendiri", () => {
    setup([level("order_date", "quarter"), level("amount", null, 500)]);

    const combos = screen.getAllByRole("combobox");
    expect(combos).toHaveLength(2);
    expect(
      within(combos[0]).getByText("TR:core.datatable.granularity.quarter"),
    ).toBeInTheDocument();
    expect(combos[1]).toHaveTextContent("500");
  });
});
