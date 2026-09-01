import { describe, expect, it, vi } from "vitest";
import { render as rtlRender, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

import Select from "./Select";
import { TooltipProvider } from "./ui/tooltip";

// Select membungkus dirinya dengan <Tooltip> internal (untuk menampilkan
// diff before/after) tanpa menyediakan <TooltipProvider> sendiri -- provider
// itu disediakan sekali di app-level (lihat pemakaian nyata di SelectModel.jsx).
const render = (ui) => rtlRender(<TooltipProvider>{ui}</TooltipProvider>);

const options = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta" },
  { value: "c", label: "Gamma" },
];

describe("Select", () => {
  it("render input kosong tanpa value", () => {
    render(<Select options={options} />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("render label opsi yang cocok dengan value (controlled)", () => {
    render(<Select options={options} value="b" />);
    expect(screen.getByRole("textbox")).toHaveValue("Beta");
  });

  it("mengetik di input membuka daftar opsi yang cocok", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Select options={options} />);

    await user.type(screen.getByRole("textbox"), "Alp");

    expect(await screen.findByText("Alp")).toBeInTheDocument();
  });

  it("memilih opsi memanggil onValueChange dengan value opsi tersebut", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    render(<Select options={options} onValueChange={onValueChange} />);

    await user.click(screen.getByRole("textbox"));
    const option = await screen.findByText("Alpha");
    await user.click(option);

    expect(onValueChange).toHaveBeenCalledWith("a");
  });

  it("tombol clear (X) mengosongkan pilihan", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    render(
      <Select options={options} value="a" onValueChange={onValueChange} />,
    );

    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("Alpha");

    const clearButton = screen.getByRole("button");
    await user.click(clearButton);

    expect(onValueChange).toHaveBeenCalledWith(undefined);
  });

  it("disabled mencegah interaksi dan tidak menampilkan tombol clear", () => {
    render(<Select options={options} value="a" disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("optionTrans membangun key terjemahan dari prefix + value mentah", () => {
    render(
      <Select
        options={["draft", "approved"]}
        optionTrans="status"
        value="draft"
      />,
    );
    expect(screen.getByRole("textbox")).toHaveValue("TR:status.draft");
  });
});
