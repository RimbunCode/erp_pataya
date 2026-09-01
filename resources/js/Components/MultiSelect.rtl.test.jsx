import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

import MultiSelect from "./MultiSelect";

const options = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta" },
  { value: "c", label: "Gamma" },
];

describe("MultiSelect", () => {
  it("render input kosong tanpa value", () => {
    render(<MultiSelect options={options} />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("placeholder menampilkan ringkasan label value terpilih", () => {
    render(<MultiSelect options={options} value={["a", "b"]} />);
    expect(screen.getByPlaceholderText("Alpha, Beta")).toBeInTheDocument();
  });

  it("membuka popover menampilkan seluruh opsi sebagai checkbox", async () => {
    const user = userEvent.setup({ delay: null });
    render(<MultiSelect options={options} />);

    await user.click(screen.getByRole("textbox"));

    expect(await screen.findByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText("Gamma")).toBeInTheDocument();
  });

  it("klik opsi menambahkan value via onValueChange", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    render(
      <MultiSelect
        options={options}
        value={[]}
        onValueChange={onValueChange}
      />,
    );

    await user.click(screen.getByRole("textbox"));
    await user.click(await screen.findByText("Alpha"));

    expect(onValueChange).toHaveBeenCalledWith(["a"]);
  });

  it("klik opsi yang sudah terpilih menghapusnya (toggle)", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    render(
      <MultiSelect
        options={options}
        value={["a"]}
        onValueChange={onValueChange}
      />,
    );

    await user.click(screen.getByRole("textbox"));
    await user.click(await screen.findByText("Alpha"));

    expect(onValueChange).toHaveBeenCalledWith([]);
  });

  it("tombol clear (X) mengosongkan seluruh value", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    render(
      <MultiSelect
        options={options}
        value={["a", "b"]}
        onValueChange={onValueChange}
      />,
    );

    const clearButton = screen.getByRole("button");
    await user.click(clearButton);

    expect(onValueChange).toHaveBeenCalledWith([]);
  });

  it("disabled mencegah interaksi dan tidak menampilkan tombol clear", () => {
    render(<MultiSelect options={options} value={["a"]} disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
