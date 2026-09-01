import { describe, expect, it, vi } from "vitest";
import { render as rtlRender, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({
    t: (key, params) =>
      params ? `TR:${key}:${JSON.stringify(params)}` : `TR:${key}`,
  }),
}));

// FilterItem2 kompleks (ValueField dgn banyak varian input) -- stub agar test
// FilterGroup2 fokus ke logic grouping, bukan detail rendering item.
vi.mock("./FilterItem2", () => ({
  default: ({ id }) => <div data-testid={`filter-item-${id}`} />,
}));

import FilterGroup2 from "./FilterGroup2";
import { NestedFiltersProvider } from "@/Hooks/useNestedFilters";
import { TooltipProvider } from "@/Components/ui/tooltip";

const renderGroup = (initialFilters) =>
  rtlRender(
    <TooltipProvider>
      <NestedFiltersProvider initialFilters={initialFilters} columns={{}}>
        <FilterGroup2 id="root" depth={0} />
      </NestedFiltersProvider>
    </TooltipProvider>,
  );

describe("FilterGroup2", () => {
  it("render 1 item filter default untuk root kosong", () => {
    renderGroup();
    expect(screen.getAllByTestId(/filter-item-/)).toHaveLength(1);
  });

  it("render FilterItem2 untuk tiap item anak", () => {
    renderGroup({
      root: {
        k: "and",
        c: {
          a: { k: "field_a", o: "=", v: "1" },
          b: { k: "field_b", o: "=", v: "2" },
        },
      },
    });
    expect(screen.getAllByTestId(/filter-item-/)).toHaveLength(2);
  });

  it("render FilterGroup2 rekursif untuk nested group", () => {
    // collapseEntry (useNestedFilters.js) meng-collapse REKURSIF tiap group
    // yang punya persis 1 child -- berlaku di root MAUPUN nested group.
    // Nested group "g" wajib >=2 child juga, bukan cuma root, agar "g" tidak
    // ikut collapse jadi item biasa.
    renderGroup({
      root: {
        k: "and",
        c: {
          g: {
            k: "or",
            c: {
              a: { k: "field_a", o: "=", v: "1" },
              c: { k: "field_c", o: "=", v: "3" },
            },
          },
          b: { k: "field_b", o: "=", v: "2" },
        },
      },
    });
    // Grup nested juga render Select untuk pilih and/or -- ada 2 total (root+nested).
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
  });

  it("tombol tambah item memanggil addItemToGroup (menambah item baru)", async () => {
    const user = userEvent.setup({ delay: null });
    renderGroup();

    expect(screen.getAllByTestId(/filter-item-/)).toHaveLength(1);

    // Select root punya value default ("and"), jadi tombol clear (X) miliknya
    // ikut muncul SEBELUM tombol Plus -- cari tombol via svg icon "lucide-plus"
    // alih-alih asumsi index, biar tidak rapuh terhadap perubahan urutan render.
    const buttons = screen.getAllByRole("button");
    const addButton = buttons.find((b) =>
      b.querySelector("svg")?.getAttribute("class")?.includes("lucide-plus"),
    );
    await user.click(addButton);

    expect(await screen.findAllByTestId(/filter-item-/)).toHaveLength(2);
  });

  it("root group tidak bisa dihapus (tombol delete disabled)", () => {
    renderGroup();
    const buttons = screen.getAllByRole("button");
    const deleteButton = buttons.find((b) =>
      b.querySelector("svg")?.getAttribute("class")?.includes("lucide-trash"),
    );
    expect(deleteButton).toHaveAttribute("aria-disabled", "true");
  });

  it("return null jika id tidak ditemukan di tree (bukan group)", () => {
    const { container } = rtlRender(
      <NestedFiltersProvider columns={{}}>
        <FilterGroup2 id="tidak-ada" depth={0} />
      </NestedFiltersProvider>,
    );
    expect(container.firstChild).toBeNull();
  });
});
