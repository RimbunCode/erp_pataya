/**
 * Mode chip MultiSelect (default; spec finance-multi-tax-per-item, Requirement 13).
 * Perilaku lama (ringkasan teks) diuji di MultiSelect.rtl.test.jsx lewat `chips={false}`.
 */
import { describe, expect, it, vi } from "vitest";
import {
  render as rtlRender,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({
    t: (key, params) =>
      params?.name ? `TR:${key}:${params.name}` : `TR:${key}`,
  }),
}));

import MultiSelect from "./MultiSelect";
import { TooltipProvider } from "./ui/tooltip";

const render = (ui) =>
  rtlRender(<TooltipProvider delayDuration={0}>{ui}</TooltipProvider>);

const options = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta" },
  { value: "c", label: "Gamma" },
];

const chipTexts = () =>
  screen.queryAllByTestId("chip").map((chip) => chip.textContent);

function Controlled(props) {
  const [value, setValue] = useState(props.initial ?? []);
  return (
    <MultiSelect
      options={options}
      {...props}
      value={value}
      onValueChange={(next) => {
        props.onValueChange?.(next);
        setValue(next);
      }}
    />
  );
}

describe("MultiSelect -- chip", () => {
  it("nilai terpilih tampil sbg chip per nilai (urut value), input tertutup kosong", () => {
    render(<MultiSelect options={options} value={["c", "a"]} />);
    expect(chipTexts()).toEqual(["Gamma", "Alpha"]);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("tanpa value: tanpa chip, placeholder tampil; ada value: placeholder disembunyikan", () => {
    const { rerender } = render(
      <MultiSelect options={options} value={[]} placeholder="Pilih" />,
    );
    expect(screen.getByRole("textbox")).toHaveAttribute("placeholder", "Pilih");
    rerender(
      <TooltipProvider delayDuration={0}>
        <MultiSelect options={options} value={["a"]} placeholder="Pilih" />
      </TooltipProvider>,
    );
    expect(screen.getByRole("textbox")).toHaveAttribute("placeholder", "");
  });

  it("klik X chip mencabut hanya chip itu", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    render(<Controlled initial={["a", "b"]} onValueChange={onValueChange} />);
    await user.click(screen.getByRole("button", { name: /TR:.*:Alpha/ }));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith(["b"]);
    expect(chipTexts()).toEqual(["Beta"]);
  });

  it("showAllOption + semua terpilih -> SATU chip 'Semua'; X-nya mengosongkan", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    render(
      <Controlled
        initial={["a", "b", "c"]}
        showAllOption
        allOptionLabel="Semua"
        onValueChange={onValueChange}
      />,
    );
    expect(chipTexts()).toEqual(["Semua"]);
    await user.click(screen.getByRole("button", { name: /Semua/ }));
    expect(onValueChange).toHaveBeenCalledWith([]);
    expect(chipTexts()).toEqual([]);
  });

  it("showAllOption tapi sebagian terpilih -> chip per nilai", () => {
    render(<MultiSelect options={options} value={["a", "b"]} showAllOption />);
    expect(chipTexts()).toEqual(["Alpha", "Beta"]);
  });

  it("defaultValue (nilai tunggal) tampil sbg chip saat value null", () => {
    render(<MultiSelect options={options} value={null} defaultValue="b" />);
    expect(chipTexts()).toEqual(["Beta"]);
  });

  it("tombol clear tetap ada dan mengosongkan semua chip", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    render(<Controlled initial={["a", "b"]} onValueChange={onValueChange} />);
    const clear = screen
      .getAllByRole("button")
      .find((button) => !button.getAttribute("aria-label"));
    await user.click(clear);
    expect(onValueChange).toHaveBeenCalledWith([]);
    expect(chipTexts()).toEqual([]);
  });

  it("label chip teks biasa tanpa prop navigation (bukan tombol/tautan)", () => {
    render(<MultiSelect options={options} value={["a"]} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId("chip")).queryByRole("button", {
        name: "Alpha",
      }),
    ).not.toBeInTheDocument();
  });

  it("navigation opt-in: href -> tautan tab baru; null -> teks biasa; menerima option asli", () => {
    const navigation = vi.fn((opt) =>
      opt.value === "a" ? `/alphas/${opt.value}` : null,
    );
    render(
      <MultiSelect
        options={options}
        value={["a", "b"]}
        navigation={navigation}
      />,
    );
    const link = screen.getByRole("link", { name: "Alpha" });
    expect(link).toHaveAttribute("href", "/alphas/a");
    expect(link).toHaveAttribute("target", "_blank");
    expect(
      screen.queryByRole("link", { name: "Beta" }),
    ).not.toBeInTheDocument();
    expect(navigation).toHaveBeenCalledWith(options[0]);
  });

  it("chip 'Semua' tidak pernah menjadi tautan", () => {
    render(
      <MultiSelect
        options={options}
        value={["a", "b", "c"]}
        showAllOption
        navigation={() => "/x"}
      />,
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("readOnly/disabled: X disembunyikan, label tautan tetap berfungsi", () => {
    const { rerender } = render(
      <MultiSelect
        options={options}
        value={["a"]}
        readOnly
        navigation={() => "/a"}
      />,
    );
    expect(screen.getByRole("link", { name: "Alpha" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    rerender(
      <TooltipProvider delayDuration={0}>
        <MultiSelect
          options={options}
          value={["a"]}
          disabled
          navigation={() => "/a"}
        />
      </TooltipProvider>,
    );
    expect(screen.getByRole("link", { name: "Alpha" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("required: input tidak required lagi bila sudah ada chip", () => {
    const { rerender } = render(
      <MultiSelect options={options} value={[]} required />,
    );
    expect(screen.getByRole("textbox")).toBeRequired();
    rerender(
      <TooltipProvider delayDuration={0}>
        <MultiSelect options={options} value={["a"]} required />
      </TooltipProvider>,
    );
    expect(screen.getByRole("textbox")).not.toBeRequired();
  });

  it("valueBefore: chip ditambah ditandai added, dicabut tampil removed tanpa X", () => {
    render(
      <MultiSelect
        options={options}
        value={["a", "c"]}
        valueBefore={["a", "b"]}
      />,
    );
    const chips = screen.getAllByTestId("chip");
    expect(chips.map((c) => c.getAttribute("data-status"))).toEqual([
      null,
      "added",
      "removed",
    ]);
    expect(chips.map((c) => c.textContent)).toEqual(["Alpha", "Gamma", "Beta"]);
    expect(within(chips[2]).queryByRole("button")).not.toBeInTheDocument();
  });

  it("valueBefore sama -> tanpa penanda", () => {
    render(<MultiSelect options={options} value={["a"]} valueBefore={["a"]} />);
    expect(screen.getByTestId("chip")).not.toHaveAttribute("data-status");
  });

  it("changeOnBlur, popover tertutup: X chip commit langsung sekali", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    render(
      <Controlled
        initial={["a", "b"]}
        changeOnBlur
        onValueChange={onValueChange}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Alpha/ }));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith(["b"]);
  });

  it("changeOnBlur, popover terbuka: X chip commit langsung dan TIDAK dobel saat popover ditutup", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    render(
      <div>
        <Controlled
          initial={["a", "b"]}
          changeOnBlur
          onValueChange={onValueChange}
        />
        <button type="button">luar</button>
      </div>,
    );
    await user.click(screen.getByRole("textbox"));
    await user.click(screen.getByRole("button", { name: /Alpha/ }));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "luar" }));
    await waitFor(() => expect(onValueChange).toHaveBeenCalledTimes(1));
    expect(chipTexts()).toEqual(["Beta"]);
  });

  it("memilih opsi di dropdown menambah chip; ketik+delimiter menambah chip", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Controlled />);
    await user.click(screen.getByRole("textbox"));
    await user.click(await screen.findByText("Beta"));
    expect(chipTexts()).toEqual(["Beta"]);
    await user.type(screen.getByRole("textbox"), "alpha,");
    expect(chipTexts()).toEqual(["Beta", "Alpha"]);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("paste banyak entri menambah chip sekaligus; onSearchChange tetap dipanggil", async () => {
    const user = userEvent.setup({ delay: null });
    const onSearchChange = vi.fn();
    render(<Controlled onSearchChange={onSearchChange} />);
    await user.click(screen.getByRole("textbox"));
    await user.paste("Alpha, Gamma");
    expect(chipTexts()).toEqual(["Alpha", "Gamma"]);
    await user.type(screen.getByRole("textbox"), "b");
    expect(onSearchChange).toHaveBeenCalledWith("b");
  });

  it("chips={false} mempertahankan ringkasan teks lama (tanpa chip)", () => {
    render(<MultiSelect options={options} value={["a", "b"]} chips={false} />);
    expect(screen.queryAllByTestId("chip")).toHaveLength(0);
    expect(screen.getByRole("textbox")).toHaveValue("Alpha, Beta");
  });
});
