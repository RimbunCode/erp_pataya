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

  describe("Tab -- autocomplete label yg di-highlight keyboard, TIDAK langsung pilih", () => {
    it("sedang dirty (lagi ngetik) -> Tab CUMA nulis label lengkap ke input, TIDAK langsung pilih; fokus tetap di input; blur baru commit", async () => {
      const user = userEvent.setup({ delay: null });
      const onValueChange = vi.fn();
      render(
        <div>
          <Select options={options} onValueChange={onValueChange} />
          <button type="button">Outside</button>
        </div>,
      );

      const input = screen.getByRole("textbox");
      await user.click(input);
      await user.type(input, "Bet"); // isDirty true, "Beta" satu²nya match

      await user.tab();

      expect(onValueChange).not.toHaveBeenCalled();
      expect(input).toHaveFocus();
      expect(input).toHaveValue("Beta");

      // Blur beneran -> BARU ke-commit (mekanisme exact-match on-close yg
      // sudah ada, sama kayak kalau user ngetik "Beta" manual lalu blur).
      await user.click(screen.getByText("Outside"));
      expect(onValueChange).toHaveBeenCalledWith("b");
    });

    it("popover baru dibuka (opsi pertama ter-highlight default, belum ngetik apa²/tidak dirty), lalu Tab -> label ditulis, fokus PINDAH keluar -> blur otomatis pilih", async () => {
      const user = userEvent.setup({ delay: null });
      const onValueChange = vi.fn();
      render(
        <div>
          <Select options={options} onValueChange={onValueChange} />
          <button type="button">Outside</button>
        </div>,
      );

      const input = screen.getByRole("textbox");
      await user.click(input);
      await user.tab();

      expect(input).not.toHaveFocus();
      expect(onValueChange).toHaveBeenCalledWith("a");
      expect(input).toHaveValue("Alpha");
    });

    it("daftar option kosong (hasil search gak ketemu) -> Tab TIDAK menulis/memilih opsi apapun", async () => {
      const user = userEvent.setup({ delay: null });
      const onValueChange = vi.fn();
      render(<Select options={options} onValueChange={onValueChange} />);

      const input = screen.getByRole("textbox");
      await user.click(input);
      await user.type(input, "Zzz");
      await user.tab();

      // Gak ada opsi ke-highlight (list kosong) -> Tab gak nulis apa-apa.
      // Blur abis itu tetap jalanin perilaku existing "teks gak match
      // apapun -> value dikosongkan, input dibersihkan" -- itu bukan hal
      // baru dari fitur Tab ini, cuma sebelumnya gak ke-trigger via Tab
      // krn Select.jsx belum py onBlur sama sekali.
      expect(onValueChange).not.toHaveBeenCalledWith("a");
      expect(onValueChange).not.toHaveBeenCalledWith("b");
      expect(onValueChange).not.toHaveBeenCalledWith("c");
      expect(input).toHaveValue("");
    });
  });
});
