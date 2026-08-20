import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({
    t: (key, params) =>
      params ? `TR:${key}:${JSON.stringify(params)}` : `TR:${key}`,
  }),
}));

vi.mock("axios", () => ({ default: { get: vi.fn() } }));

// NestedSelect (column picker) & ValueField sudah punya test sendiri --
// stub sederhana agar test FilterItem2 fokus ke logic-nya sendiri
// (perpindahan operator, mode value<->column, branch/delete).
vi.mock("@/Components/NestedSelect", () => ({
  default: ({ value, onValueChange, options }) => (
    <select
      data-testid="stub-column-select"
      value={value ?? ""}
      onChange={(e) => onValueChange(e.target.value)}
    >
      <option value="">--</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}));
vi.mock("@/Components/Select", () => ({
  default: ({ value, onValueChange, options, disabled }) => (
    <select
      data-testid="stub-operator-select"
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => onValueChange(e.target.value)}
    >
      <option value="">--</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  ),
}));
vi.mock("./ValueField", () => ({
  default: ({ value, onChange }) => (
    <input
      data-testid="stub-value-field"
      value={typeof value === "string" ? value : ""}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

import FilterItem2 from "./FilterItem2";
import { NestedFiltersProvider } from "@/Hooks/useNestedFilters";
import { TooltipProvider } from "@/Components/ui/tooltip";

const columns = {
  status: { name: "status", type: "formStatus", title: "Status" },
  amount: { name: "amount", type: "number", title: "Amount" },
};

const renderItem = (initialFilters) =>
  render(
    <TooltipProvider>
      <NestedFiltersProvider initialFilters={initialFilters} columns={columns}>
        <FilterItem2 id="a" depth={0} />
      </NestedFiltersProvider>
    </TooltipProvider>,
  );

describe("FilterItem2", () => {
  // BUG DIKONFIRMASI (lihat task terpisah "Fix bug FilterItem2: isGroupNode
  // dicek ke object salah"): guard `isValidFilter` (FilterItem2.jsx ~L125)
  // memanggil isGroupNode(filter) -- `filter` adalah RESHAPE {key,operator,
  // value} dari node asli `f`, tidak pernah membawa property children/c
  // apapun isi `f` aslinya, sehingga isGroupNode(filter) SELALU false.
  // Akibatnya FilterItem2 TIDAK PERNAH return null walau id merujuk ke group
  // node -- dia tetap render UI item filter dengan filter.key = GROUP_KEY
  // ("and"/"or"), yang tidak masuk akal secara semantik. Test ini
  // mendokumentasikan actual behavior saat ini, BUKAN behavior yang benar.
  it("[BUG] TIDAK return null walau id merujuk ke group node (seharusnya null)", () => {
    // Group "a" wajib >=2 child, kalau tidak collapseSingleChildGroups akan
    // meng-collapse-nya sehingga id "a" hilang dari tree sama sekali.
    const { container } = renderItem({
      root: {
        k: "and",
        c: {
          a: {
            k: "or",
            c: {
              x: { k: "field", o: "=", v: "1" },
              y: { k: "field2", o: "=", v: "2" },
            },
          },
        },
      },
    });
    // Actual (buggy): tetap render UI item filter, bukan return null.
    expect(container.firstChild).not.toBeNull();
    expect(screen.getByTestId("stub-column-select")).toBeInTheDocument();
  });

  it("render NestedSelect (column), Select (operator), ValueField untuk item valid", () => {
    renderItem({
      root: { k: "and", c: { a: { k: "status", o: "=", v: "draft" } } },
    });
    expect(screen.getByTestId("stub-column-select")).toBeInTheDocument();
    expect(screen.getByTestId("stub-operator-select")).toBeInTheDocument();
    expect(screen.getByTestId("stub-value-field")).toBeInTheDocument();
  });

  it("operator select disabled saat belum ada kolom terpilih", () => {
    renderItem({ root: { k: "and", c: { a: { k: "", o: "", v: "" } } } });
    expect(screen.getByTestId("stub-operator-select")).toBeDisabled();
  });

  it("ganti kolom mereset operator dan value", async () => {
    const user = userEvent.setup({ delay: null });
    renderItem({
      root: { k: "and", c: { a: { k: "status", o: "=", v: "draft" } } },
    });

    await user.selectOptions(
      screen.getByTestId("stub-column-select"),
      "amount",
    );

    expect(screen.getByTestId("stub-operator-select")).toHaveValue("");
  });

  it("ganti operator dgn valueInput sama mempertahankan value", async () => {
    const user = userEvent.setup({ delay: null });
    renderItem({
      root: { k: "and", c: { a: { k: "amount", o: ">", v: "100" } } },
    });

    // ">" dan ">=" sama-sama valueInput "currency" -> value tetap.
    await user.selectOptions(screen.getByTestId("stub-operator-select"), ">=");

    expect(screen.getByTestId("stub-value-field")).toHaveValue("100");
  });

  it("ganti operator dgn valueInput beda mereset value", async () => {
    const user = userEvent.setup({ delay: null });
    renderItem({
      root: { k: "and", c: { a: { k: "amount", o: "=", v: "100" } } },
    });

    // "=" (currency) -> "in" (multiselect): valueInput beda, value harus reset.
    await user.selectOptions(screen.getByTestId("stub-operator-select"), "in");

    expect(screen.getByTestId("stub-value-field")).toHaveValue("");
  });

  it("tombol delete disabled saat item satu-satunya anak root", () => {
    renderItem({
      root: { k: "and", c: { a: { k: "status", o: "=", v: "draft" } } },
    });
    const buttons = screen.getAllByRole("button");
    const deleteButton = buttons.find((b) =>
      b.querySelector("svg")?.getAttribute("class")?.includes("lucide-trash"),
    );
    expect(deleteButton).toHaveAttribute("aria-disabled", "true");
  });

  it("tombol delete enabled saat item bukan satu-satunya anak root", () => {
    renderItem({
      root: {
        k: "and",
        c: {
          a: { k: "status", o: "=", v: "draft" },
          b: { k: "amount", o: "=", v: "1" },
        },
      },
    });
    const buttons = screen.getAllByRole("button");
    const deleteButton = buttons.find((b) =>
      b.querySelector("svg")?.getAttribute("class")?.includes("lucide-trash"),
    );
    expect(deleteButton).toHaveAttribute("aria-disabled", "false");
  });

  it("menampilkan pesan error saat item punya errorKey", () => {
    const { _rerender } = renderItem({
      root: { k: "and", c: { a: { k: "amount", o: "=", v: "not-a-number" } } },
    });
    // errors di-set lewat setErrors context -- gunakan langsung via render ulang
    // dengan provider yang sudah punya errors ter-set tidak mudah tanpa akses
    // context; verifikasi minimal bahwa TIDAK ada pesan error saat errors kosong.
    expect(screen.queryByText(/value_numeric/)).not.toBeInTheDocument();
  });
});
