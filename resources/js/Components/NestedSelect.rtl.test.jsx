import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({
    t: (key, params) =>
      params ? `TR:${key}:${JSON.stringify(params)}` : `TR:${key}`,
  }),
}));

import NestedSelect from "./NestedSelect";

const options = [
  { label: "Customer", value: "customer", type: "relation" },
  {
    label: "Items",
    value: "items",
    type: "relation",
    children: [{ label: "Product Name", value: "items.product_name" }],
  },
  { label: "Status", value: "status" },
];

describe("NestedSelect", () => {
  it("render trigger dengan placeholder saat belum ada value", () => {
    render(<NestedSelect options={options} placeholder="Pilih kolom" />);
    expect(screen.getByText("Pilih kolom")).toBeInTheDocument();
  });

  it("render pathLabel node terpilih pada trigger", () => {
    render(<NestedSelect options={options} value="status" />);
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("render pathLabel gabungan untuk nested value terpilih", () => {
    render(<NestedSelect options={options} value="items.product_name" />);
    expect(screen.getByText("Items / Product Name")).toBeInTheDocument();
  });

  it("membuka popover menampilkan opsi level teratas", async () => {
    const user = userEvent.setup({ delay: null });
    render(<NestedSelect options={options} placeholder="Pilih kolom" />);

    await user.click(screen.getByRole("button"));

    expect(await screen.findByText("Customer")).toBeInTheDocument();
    expect(screen.getByText("Items")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("memilih leaf node (tanpa children) memanggil onValueChange", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    render(
      <NestedSelect
        options={options}
        placeholder="Pilih kolom"
        onValueChange={onValueChange}
      />,
    );

    await user.click(screen.getByRole("button"));
    await user.click(await screen.findByText("Status"));

    expect(onValueChange).toHaveBeenCalledWith("status");
  });

  it("mengetik di search menampilkan hasil filter berdasar label", async () => {
    const user = userEvent.setup({ delay: null });
    render(<NestedSelect options={options} placeholder="Pilih kolom" />);

    await user.click(screen.getByRole("button"));
    const searchInput = await screen.findByPlaceholderText(
      "TR:core.datatable.filter.column.search.placeholder",
    );
    await user.type(searchInput, "Product");

    expect(await screen.findByText("Items / Product Name")).toBeInTheDocument();
    expect(screen.queryByText("Customer")).not.toBeInTheDocument();
  });

  it("memilih hasil filter search langsung memanggil onValueChange", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    render(
      <NestedSelect
        options={options}
        placeholder="Pilih kolom"
        onValueChange={onValueChange}
      />,
    );

    await user.click(screen.getByRole("button"));
    const searchInput = await screen.findByPlaceholderText(
      "TR:core.datatable.filter.column.search.placeholder",
    );
    await user.type(searchInput, "Product");
    await user.click(await screen.findByText("Items / Product Name"));

    expect(onValueChange).toHaveBeenCalledWith("items.product_name");
  });

  it("fetchChildren dipanggil saat drill-down node loadable via tombol chevron", async () => {
    const user = userEvent.setup({ delay: null });
    const fetchChildren = vi
      .fn()
      .mockResolvedValue([{ label: "Lazy Child", value: "lazy.child" }]);
    const lazyOptions = [
      { label: "Lazy Node", value: "lazy", loadable: true, type: "relation" },
    ];

    render(
      <NestedSelect
        options={lazyOptions}
        placeholder="Pilih kolom"
        fetchChildren={fetchChildren}
      />,
    );

    await user.click(screen.getByRole("button"));
    const chevronButton = await screen.findByLabelText(
      "Lihat kolom di dalam Lazy Node",
    );
    await user.click(chevronButton);

    expect(fetchChildren).toHaveBeenCalled();
    expect(await screen.findByText("Lazy Child")).toBeInTheDocument();
  });

  it("disabled mencegah trigger diklik", () => {
    render(<NestedSelect options={options} disabled />);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
