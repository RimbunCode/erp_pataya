import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({
    t: (key, params) =>
      params ? `TR:${key}:${JSON.stringify(params)}` : `TR:${key}`,
  }),
}));

import ChipEditor from "./ChipEditor";

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

describe("ChipEditor kind=group (GroupLevelsEditor)", () => {
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
    { value: "customer", label: "Customer" },
    { value: "created_at", label: "Dibuat" },
    { value: "total", label: "Total" },
  ];

  const renderGroup = (value, onApply = vi.fn()) => {
    render(
      <ChipEditor
        kind="group"
        groupOptions={groupOptions}
        columns={columns}
        value={value}
        onApply={onApply}
      />,
    );
    return onApply;
  };

  it("mencentang kolom baru memanggil onApply(Groups) dgn default granularity/range kolom itu", async () => {
    const user = userEvent.setup({ delay: null });
    const onApply = renderGroup([]);

    await user.click(screen.getByRole("checkbox", { name: "Dibuat" }));
    expect(onApply).toHaveBeenLastCalledWith([
      { column: "created_at", granularity: "month", range: null },
    ]);

    await user.click(screen.getByRole("checkbox", { name: "Total" }));
    expect(onApply).toHaveBeenLastCalledWith([
      { column: "total", granularity: null, range: 50 },
    ]);
  });

  it("value = Groups bertingkat: level aktif di atas berurutan, menghapus centang membuang level itu saja", async () => {
    const user = userEvent.setup({ delay: null });
    const onApply = renderGroup([
      { column: "total", granularity: null, range: 500 },
      { column: "customer", granularity: null, range: null },
    ]);

    expect(
      screen
        .getAllByRole("checkbox")
        .map((row) => [
          row.getAttribute("aria-label"),
          row.getAttribute("aria-checked"),
        ]),
    ).toEqual([
      ["Total", "true"],
      ["Customer", "true"],
      ["Dibuat", "false"],
    ]);

    await user.click(screen.getByRole("checkbox", { name: "Total" }));
    expect(onApply).toHaveBeenCalledWith([
      { column: "customer", granularity: null, range: null },
    ]);
  });

  it("menghapus centang level terakhir mengirim list kosong (tak mengelompokkan)", async () => {
    const user = userEvent.setup({ delay: null });
    const onApply = renderGroup([
      { column: "customer", granularity: null, range: null },
    ]);

    await user.click(screen.getByRole("checkbox", { name: "Customer" }));
    expect(onApply).toHaveBeenCalledWith([]);
  });

  it("value kosong/undefined dibaca sbg tanpa level (tak crash)", () => {
    renderGroup(undefined);

    expect(
      screen
        .getAllByRole("checkbox")
        .every((row) => row.getAttribute("aria-checked") === "false"),
    ).toBe(true);
  });

  it("kolom date aktif menampilkan Select granularity; memilih opsi lain mengganti granularity saja", async () => {
    const user = userEvent.setup({ delay: null });
    const onApply = renderGroup([
      { column: "created_at", granularity: "month", range: null },
    ]);

    await user.click(
      screen.getByRole("combobox", {
        name: "TR:core.datatable.group_levels.granularity",
      }),
    );
    await user.click(
      await screen.findByRole("option", {
        name: "TR:core.datatable.granularity.year",
      }),
    );

    expect(onApply).toHaveBeenCalledWith([
      { column: "created_at", granularity: "year", range: null },
    ]);
  });

  it("kolom number aktif menampilkan range dari groupRangeOptions kolom (bukan default global)", async () => {
    const user = userEvent.setup({ delay: null });
    const onApply = renderGroup([
      { column: "total", granularity: null, range: 50 },
    ]);

    await user.click(
      screen.getByRole("combobox", { name: "TR:core.datatable.group_range" }),
    );
    const options = await screen.findAllByRole("option");
    // range default global (10/100/1000) TIDAK dipakai -- kolom punya sendiri.
    expect(options.map((option) => option.textContent)).toEqual(["50", "500"]);

    await user.click(screen.getByRole("option", { name: "500" }));
    expect(onApply).toHaveBeenCalledWith([
      { column: "total", granularity: null, range: 500 },
    ]);
  });

  it("kolom string aktif tidak menampilkan granularity maupun range", () => {
    renderGroup([{ column: "customer", granularity: null, range: null }]);

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("TIDAK ada kotak cari kedua di dalam daftar kolom grup (feedback verifikasi visual: duplikat dgn Search Bar utama)", () => {
    renderGroup([]);

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    // Daftar tetap tampil sbg baris centang polos.
    expect(
      screen.getByRole("checkbox", { name: "Dibuat" }),
    ).toBeInTheDocument();
  });

  it("default lebar w-64 (popover mengambang ChipEditor) -- SearchPanel yang override ke w-full", () => {
    renderGroup([]);

    expect(
      screen.getByRole("checkbox", { name: "Dibuat" }).closest(".w-64"),
    ).not.toBeNull();
  });
});
