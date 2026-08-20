import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({
    t: (key, params) =>
      params ? `TR:${key}:${JSON.stringify(params)}` : `TR:${key}`,
  }),
}));

// ValueField adalah router 15+ varian yang masing-masing merender child
// component kompleks (LinkModel, MultiSelect, dst, sudah punya test sendiri).
// Di sini semua child di-stub sederhana agar test fokus ke LOGIC ROUTING
// ValueField sendiri (valueInput yang benar -> komponen yang benar) dan
// helper internal (MultiGrow, RangePair), bukan detail rendering child.
vi.mock("@/Components/ui/input", () => ({
  Input: (props) => (
    <input
      data-testid="stub-input"
      value={props.value ?? ""}
      onChange={props.onChange}
      type={props.type}
    />
  ),
}));
vi.mock("@/Components/NumberInput", () => ({
  default: ({ value, onValueChange }) => (
    <input
      data-testid="stub-number-input"
      value={value ?? ""}
      onChange={(e) => onValueChange(e.target.value)}
    />
  ),
}));
vi.mock("@/Components/Select", () => ({
  default: ({ value, onValueChange, options }) => (
    <select
      data-testid="stub-select"
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
vi.mock("@/Components/MultiSelect", () => ({
  default: () => <div data-testid="stub-multiselect" />,
}));
vi.mock("@/Components/NestedSelect", () => ({
  default: () => <div data-testid="stub-nestedselect" />,
}));
vi.mock("@/Components/LinkModel", () => ({
  default: () => <div data-testid="stub-linkmodel" />,
}));
vi.mock("@/Pages/Core/PermissionLinkModel", () => ({
  default: () => <div data-testid="stub-permissionlinkmodel" />,
}));
vi.mock("./DateSelector", () => ({
  default: () => <div data-testid="stub-dateselector" />,
}));
vi.mock("@/Components/Checkbox", () => ({
  default: (props) => (
    <input data-testid="stub-checkbox" type="checkbox" {...props} />
  ),
}));

import ValueField from "./ValueField";

describe("ValueField - routing valueInput ke komponen yang benar", () => {
  it("valueInput null (column tanpa type) -> tidak render apapun", () => {
    const { container } = render(
      <ValueField column={null} operator="=" value={null} onChange={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("column number, operator '=' -> NumberInput (currency)", () => {
    render(
      <ValueField
        column={{ type: "number" }}
        operator="="
        value={100}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("stub-number-input")).toBeInTheDocument();
  });

  it("column number, operator 'between' -> 2x NumberInput (currency2/RangePair)", () => {
    render(
      <ValueField
        column={{ type: "number" }}
        operator="between"
        value={[10, 20]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getAllByTestId("stub-number-input")).toHaveLength(2);
  });

  it("column boolean -> Checkbox", () => {
    render(
      <ValueField
        column={{ type: "boolean" }}
        operator="="
        value={false}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("stub-checkbox")).toBeInTheDocument();
  });

  it("column string dgn options, operator '=' -> Select", () => {
    render(
      <ValueField
        column={{ type: "string", options: ["a", "b"] }}
        operator="="
        value="a"
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("stub-select")).toBeInTheDocument();
  });

  it("column relation, operator '=' -> LinkModel", () => {
    render(
      <ValueField
        column={{ type: "relation", related: "App\\Models\\Item" }}
        operator="="
        value={null}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("stub-linkmodel")).toBeInTheDocument();
  });

  it("column relation morph, operator '=' -> MorphField (PermissionLinkModel + LinkModel)", () => {
    render(
      <ValueField
        column={{ type: "relation", typeRelation: "morph" }}
        operator="="
        value={null}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("stub-permissionlinkmodel")).toBeInTheDocument();
    expect(screen.getByTestId("stub-linkmodel")).toBeInTheDocument();
  });

  it("column date, operator 'in_period' -> DateSelector", () => {
    render(
      <ValueField
        column={{ type: "date" }}
        operator="in_period"
        value={null}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("stub-dateselector")).toBeInTheDocument();
  });

  it("operator 'set' (valueInput=none) -> tidak render apapun", () => {
    const { container } = render(
      <ValueField
        column={{ type: "string" }}
        operator="set"
        value={null}
        onChange={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("mode='column' -> ColumnRefPicker (NestedSelect) untuk operator '='", () => {
    render(
      <ValueField
        column={{ type: "number" }}
        operator="="
        value={{ kind: "column", ref: "" }}
        onChange={vi.fn()}
        mode="column"
      />,
    );
    expect(screen.getByTestId("stub-nestedselect")).toBeInTheDocument();
  });
});

describe("ValueField - text input (MultiGrow behavior via multiselect tanpa options)", () => {
  it("string tanpa options, operator 'in' -> MultiGrow render 1 field kosong default", () => {
    render(
      <ValueField
        column={{ type: "string" }}
        operator="in"
        value={null}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getAllByTestId("stub-input")).toHaveLength(1);
  });

  it("MultiGrow auto-append field baru saat field terakhir diisi", async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    const { rerender } = render(
      <ValueField
        column={{ type: "string" }}
        operator="in"
        value={null}
        onChange={onChange}
      />,
    );

    const input = screen.getByTestId("stub-input");
    await user.type(input, "x");

    expect(onChange).toHaveBeenLastCalledWith(["x", null]);

    // Simulasikan parent mengoper value baru hasil onChange (controlled).
    rerender(
      <ValueField
        column={{ type: "string" }}
        operator="in"
        value={["x", null]}
        onChange={onChange}
      />,
    );
    expect(screen.getAllByTestId("stub-input")).toHaveLength(2);
  });

  it("MultiGrow menampilkan tombol hapus hanya saat item > 1", () => {
    render(
      <ValueField
        column={{ type: "string" }}
        operator="in"
        value={["a", "b"]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getAllByTestId("stub-input")).toHaveLength(2);
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("klik tombol hapus MultiGrow memanggil onChange tanpa item tsb", async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    render(
      <ValueField
        column={{ type: "string" }}
        operator="in"
        value={["a", "b"]}
        onChange={onChange}
      />,
    );

    const buttons = screen.getAllByRole("button");
    await user.click(buttons[0]);

    expect(onChange).toHaveBeenCalledWith(["b"]);
  });
});
