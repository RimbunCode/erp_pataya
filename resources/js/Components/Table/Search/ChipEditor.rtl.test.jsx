import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({
    t: (key, params) =>
      params ? `TR:${key}:${JSON.stringify(params)}` : `TR:${key}`,
  }),
}));

// Table2.jsx menarik graf modul berat (dnd-kit, inertia, css) yang tidak
// relevan di sini -- ChipEditor hanya butuh 2 konstanta ekspor darinya.
vi.mock("@/Components/Table/Table2", () => ({
  DATE_GROUP_GRANULARITIES: ["day", "month", "quarter", "half", "year"],
  DEFAULT_NUMBER_GROUP_RANGE_OPTIONS: [10, 100, 1000],
}));

import ChipEditor, { GroupPicker, computeGroupDefaults } from "./ChipEditor";

describe("ChipEditor kind=search", () => {
  it("menampilkan teks awal + info 'Mencari di' dan Terapkan mengirim {v} ter-trim", async () => {
    const user = userEvent.setup({ delay: null });
    const onApply = vi.fn();
    render(
      <ChipEditor
        kind="search"
        value="PT A"
        searchColumnTitles={["Kode", "Nama"]}
        onApply={onApply}
      />,
    );

    expect(screen.getByRole("textbox")).toHaveValue("PT A");
    expect(
      screen.getByText(
        'TR:core.datatable.search.searching_in:{"columns":"Kode, Nama"}',
      ),
    ).toBeInTheDocument();

    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "  PT Baru  ");
    await user.click(
      screen.getByRole("button", { name: "TR:core.datatable.search.apply" }),
    );

    expect(onApply).toHaveBeenCalledWith({ v: "PT Baru" });
  });

  it("teks kosong tidak menerapkan apapun", async () => {
    const user = userEvent.setup({ delay: null });
    const onApply = vi.fn();
    render(
      <ChipEditor
        kind="search"
        value="abc"
        searchColumnTitles={["Kode"]}
        onApply={onApply}
      />,
    );

    await user.clear(screen.getByRole("textbox"));
    await user.click(
      screen.getByRole("button", { name: "TR:core.datatable.search.apply" }),
    );

    expect(onApply).not.toHaveBeenCalled();
  });
});

describe("ChipEditor kind=group / GroupPicker", () => {
  const columns = {
    customer: { name: "customer", title: "Customer", type: "string" },
    created_at: { name: "created_at", title: "Dibuat", type: "date" },
    total: {
      name: "total",
      title: "Total",
      type: "currency",
      groupRangeOptions: [50, 500],
    },
  };
  const groupOptions = [
    { value: "__no_group__", label: "Tidak ada" },
    { value: "customer", label: "Customer" },
    { value: "created_at", label: "Dibuat" },
    { value: "total", label: "Total" },
  ];

  it("computeGroupDefaults: date -> month, number -> range pertama, lainnya -> null", () => {
    expect(computeGroupDefaults(columns.created_at)).toEqual({
      column: "created_at",
      granularity: "month",
      range: null,
    });
    expect(computeGroupDefaults(columns.total)).toEqual({
      column: "total",
      granularity: null,
      range: 50,
    });
    expect(computeGroupDefaults(columns.customer)).toEqual({
      column: "customer",
      granularity: null,
      range: null,
    });
    expect(computeGroupDefaults(null)).toEqual({
      column: null,
      granularity: null,
      range: null,
    });
  });

  it("memilih kolom baru memanggil onApply dengan default granularity/range kolom itu", async () => {
    const user = userEvent.setup({ delay: null });
    const onApply = vi.fn();
    render(
      <ChipEditor
        kind="group"
        groupOptions={groupOptions}
        columns={columns}
        value={{ column: null, granularity: null, range: null }}
        onApply={onApply}
      />,
    );

    await user.click(screen.getByText("Dibuat"));
    expect(onApply).toHaveBeenLastCalledWith({
      column: "created_at",
      granularity: "month",
      range: null,
    });

    await user.click(screen.getByText("Total"));
    expect(onApply).toHaveBeenLastCalledWith({
      column: "total",
      granularity: null,
      range: 50,
    });
  });

  it("memilih 'Tidak ada' mengosongkan group", async () => {
    const user = userEvent.setup({ delay: null });
    const onApply = vi.fn();
    render(
      <GroupPicker
        groupOptions={groupOptions}
        columns={columns}
        value={{ column: "customer", granularity: null, range: null }}
        onChange={onApply}
      />,
    );

    await user.click(screen.getByText("Tidak ada"));
    expect(onApply).toHaveBeenCalledWith({
      column: null,
      granularity: null,
      range: null,
    });
  });

  it("kolom date aktif menampilkan pilihan granularity; klik mengganti granularity saja", async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    render(
      <GroupPicker
        groupOptions={groupOptions}
        columns={columns}
        value={{ column: "created_at", granularity: "month", range: null }}
        onChange={onChange}
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: "TR:core.datatable.granularity.year",
      }),
    );
    expect(onChange).toHaveBeenCalledWith({
      column: "created_at",
      granularity: "year",
      range: null,
    });
  });

  it("kolom number aktif menampilkan range dari groupRangeOptions kolom", async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    render(
      <GroupPicker
        groupOptions={groupOptions}
        columns={columns}
        value={{ column: "total", granularity: null, range: 50 }}
        onChange={onChange}
      />,
    );

    expect(screen.getByRole("button", { name: "500" })).toBeInTheDocument();
    // range default global (10/100/1000) TIDAK dipakai -- kolom punya sendiri.
    expect(
      screen.queryByRole("button", { name: "1000" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "500" }));
    expect(onChange).toHaveBeenCalledWith({
      column: "total",
      granularity: null,
      range: 500,
    });
  });

  it("kolom string aktif tidak menampilkan granularity maupun range", () => {
    render(
      <GroupPicker
        groupOptions={groupOptions}
        columns={columns}
        value={{ column: "customer", granularity: null, range: null }}
        onChange={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /granularity/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "500" }),
    ).not.toBeInTheDocument();
  });
});
