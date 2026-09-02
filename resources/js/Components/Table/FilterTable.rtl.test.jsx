import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

// FilterItem sudah kompleks sendiri (NestedSelect, Select, DatetimePicker,
// axios utk kolom relasi) dan pantas ditest terpisah. Di sini di-stub supaya
// test FilterTable fokus ke perilaku wrapper-nya: buka/tutup dialog, mapping
// initialFilters -> baris, tambah/hapus baris, dan payload applyFilters.
vi.mock("./FilterItem", () => ({
  default: ({ id, column, operator, value, onChanged, removeFilter }) => (
    <div data-testid={`filter-item-${id}`}>
      <span data-testid="column">{column}</span>
      <span data-testid="operator">{operator}</span>
      <span data-testid="value">{value}</span>
      <button
        onClick={() =>
          onChanged(id, { column: "name", operator: "eq", value: "budi" })
        }
      >
        set-{id}
      </button>
      <button onClick={() => removeFilter(id)}>remove-{id}</button>
    </div>
  ),
}));

import FilterTable from "./FilterTable";

const columns = [{ name: "name", title: "Name", type: "text" }];

const openDialog = async (user) => {
  await user.click(
    screen.getByRole("button", { name: /TR:core.datatable.filter.filter/ }),
  );
};

describe("FilterTable", () => {
  it("render tombol trigger tanpa badge saat initialFilters kosong", () => {
    render(
      <FilterTable columns={columns} initialFilters={[]} onApply={vi.fn()} />,
    );
    const trigger = screen.getByRole("button", {
      name: /TR:core.datatable.filter.filter/,
    });
    expect(trigger).toBeInTheDocument();
    expect(within(trigger).queryByText(/^\d+$/)).not.toBeInTheDocument();
  });

  it("menampilkan badge jumlah sesuai initialFilters.length", () => {
    render(
      <FilterTable
        columns={columns}
        initialFilters={[
          ["name", "eq", "budi"],
          ["status", "!eq", "open"],
        ]}
        onApply={vi.fn()}
      />,
    );
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("mode mobile merender trigger sebagai elemen non-button dengan label yang sama", () => {
    render(
      <FilterTable
        columns={columns}
        initialFilters={[]}
        onApply={vi.fn()}
        isMobile
      />,
    );
    expect(
      screen.queryByRole("button", {
        name: /TR:core.datatable.filter.filter/,
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("TR:core.datatable.filter.filter"),
    ).toBeInTheDocument();
  });

  it("klik trigger membuka dialog dan memetakan initialFilters valid ke baris FilterItem", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <FilterTable
        columns={columns}
        initialFilters={[
          ["name", "eq", "budi"],
          ["status", "!eq", "open"],
        ]}
        onApply={vi.fn()}
      />,
    );
    await openDialog(user);

    expect(screen.getAllByTestId("column").map((c) => c.textContent)).toEqual([
      "name",
      "status",
    ]);
    expect(screen.getAllByTestId("operator").map((c) => c.textContent)).toEqual(
      ["eq", "!eq"],
    );
    expect(screen.getAllByTestId("value").map((c) => c.textContent)).toEqual([
      "budi",
      "open",
    ]);
  });

  it("entri initialFilters dengan kurang dari 3 elemen diabaikan, fallback ke 1 baris kosong", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <FilterTable
        columns={columns}
        initialFilters={[["name", "eq"]]}
        onApply={vi.fn()}
      />,
    );
    await openDialog(user);

    const columnCells = screen.getAllByTestId("column");
    expect(columnCells).toHaveLength(1);
    expect(columnCells[0].textContent).toBe("");
  });

  it("klik Tambah Filter menambah baris filter kosong baru", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <FilterTable columns={columns} initialFilters={[]} onApply={vi.fn()} />,
    );
    await openDialog(user);
    expect(screen.getAllByTestId("column")).toHaveLength(1);

    await user.click(
      screen.getByRole("button", {
        name: /TR:core.datatable.filter.add_filter/,
      }),
    );

    expect(screen.getAllByTestId("column")).toHaveLength(2);
  });

  it("klik hapus baris menghapus filter tsb; menghapus baris terakhir fallback ke 1 baris kosong", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <FilterTable
        columns={columns}
        initialFilters={[
          ["name", "eq", "budi"],
          ["status", "!eq", "open"],
        ]}
        onApply={vi.fn()}
      />,
    );
    await openDialog(user);
    expect(screen.getAllByTestId("column")).toHaveLength(2);

    await user.click(screen.getAllByRole("button", { name: /^remove-/ })[0]);
    expect(screen.getAllByTestId("column")).toHaveLength(1);
    expect(screen.getByTestId("column").textContent).toBe("status");

    await user.click(screen.getByRole("button", { name: /^remove-/ }));
    const remaining = screen.getAllByTestId("column");
    expect(remaining).toHaveLength(1);
    expect(remaining[0].textContent).toBe("");
  });

  it("Terapkan Filter mengabaikan baris tanpa column/operator/value lengkap", async () => {
    const user = userEvent.setup({ delay: null });
    const onApply = vi.fn();
    render(
      <FilterTable columns={columns} initialFilters={[]} onApply={onApply} />,
    );
    await openDialog(user);

    await user.click(
      screen.getByRole("button", {
        name: /TR:core.datatable.filter.apply_filters/,
      }),
    );

    expect(onApply).toHaveBeenCalledWith([]);
  });

  it("Terapkan Filter dengan baris lengkap memanggil onApply format [column, operator, value] dan menutup dialog", async () => {
    const user = userEvent.setup({ delay: null });
    const onApply = vi.fn();
    render(
      <FilterTable columns={columns} initialFilters={[]} onApply={onApply} />,
    );
    await openDialog(user);

    await user.click(screen.getByRole("button", { name: /^set-/ }));
    await user.click(
      screen.getByRole("button", {
        name: /TR:core.datatable.filter.apply_filters/,
      }),
    );

    expect(onApply).toHaveBeenCalledWith([["name", "eq", "budi"]]);
    expect(screen.queryByTestId(/filter-item-/)).not.toBeInTheDocument();
  });

  it("klik Reset Filter mereset semua baris menjadi 1 baris kosong", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <FilterTable
        columns={columns}
        initialFilters={[
          ["name", "eq", "budi"],
          ["status", "!eq", "open"],
        ]}
        onApply={vi.fn()}
      />,
    );
    await openDialog(user);
    expect(screen.getAllByTestId("column")).toHaveLength(2);

    await user.click(
      screen.getByRole("button", {
        name: /TR:core.datatable.filter.clear_filters/,
      }),
    );

    const remaining = screen.getAllByTestId("column");
    expect(remaining).toHaveLength(1);
    expect(remaining[0].textContent).toBe("");
  });
});
