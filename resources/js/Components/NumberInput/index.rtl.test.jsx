import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

const usePageMock = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
}));

vi.mock("@/lib/gooeyToast", () => ({
  gooeyToast: { promise: vi.fn() },
}));

const fetchExchangeRate = vi.fn();
vi.mock("./fetchExchangeRate", () => ({
  fetchExchangeRate: (...a) => fetchExchangeRate(...a),
}));

const getCurrencyConfig = vi.fn();
vi.mock("./getCurrencyConfig", () => ({
  getCurrencyConfig: (...a) => getCurrencyConfig(...a),
}));

import NumberInput from "./index";
import { TooltipProvider } from "@/Components/ui/tooltip";

const renderInput = (ui) => render(<TooltipProvider>{ui}</TooltipProvider>);

describe("NumberInput", () => {
  beforeEach(() => {
    usePageMock.mockReturnValue({
      props: { preferences: { default_number_format: "#,###.##" } },
    });
    getCurrencyConfig.mockResolvedValue(null);
  });

  it("menampilkan value awal terformat (group separator + default decimalScale)", () => {
    renderInput(<NumberInput value={1234567} />);
    expect(screen.getByRole("textbox")).toHaveValue("1,234,567.00");
  });

  it("value null/undefined menghasilkan input kosong", () => {
    renderInput(<NumberInput value={null} />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("mengetik memicu onValueChange dengan float mentah (tanpa pembulatan)", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    renderInput(<NumberInput onValueChange={onValueChange} />);

    await user.type(screen.getByRole("textbox"), "1500");

    expect(onValueChange).toHaveBeenLastCalledWith(
      1500,
      expect.objectContaining({ float: 1500 }),
    );
  });

  it("onBlur membulatkan sesuai decimalScale (round half-up)", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    renderInput(
      <NumberInput decimalScale={2} onValueChange={onValueChange} />,
    );

    const input = screen.getByRole("textbox");
    await user.type(input, "1.005");
    await user.tab();

    expect(input).toHaveValue("1.01");
  });

  it("onBlur meng-clamp ke min/max", async () => {
    const user = userEvent.setup({ delay: null });
    renderInput(<NumberInput min={0} max={100} decimalScale={0} />);

    const input = screen.getByRole("textbox");
    await user.type(input, "500");
    await user.tab();

    expect(input).toHaveValue("100");
  });

  it("allowNegativeValue=false membuang tanda minus saat mengetik", async () => {
    const user = userEvent.setup({ delay: null });
    renderInput(<NumberInput allowNegativeValue={false} decimalScale={0} />);

    const input = screen.getByRole("textbox");
    await user.type(input, "-500");

    expect(input).toHaveValue("500");
  });

  it("maxLength membatasi jumlah digit, menolak input melebihi batas", async () => {
    const user = userEvent.setup({ delay: null });
    renderInput(<NumberInput maxLength={3} decimalScale={0} />);

    const input = screen.getByRole("textbox");
    await user.type(input, "12345");

    expect(input).toHaveValue("123");
  });

  it("allowDecimals=false memaksa decimalScale ke 0 saat blur", async () => {
    const user = userEvent.setup({ delay: null });
    renderInput(<NumberInput allowDecimals={false} />);

    const input = screen.getByRole("textbox");
    await user.type(input, "10.99");
    await user.tab();

    expect(input).toHaveValue("11");
  });

  it("mengosongkan input lalu blur mengirim onValueChange(null)", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    renderInput(<NumberInput value={100} onValueChange={onValueChange} />);

    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.tab();

    expect(input).toHaveValue("");
    expect(onValueChange).toHaveBeenLastCalledWith(
      null,
      expect.objectContaining({ float: null }),
    );
  });

  it("prefix eksplisit dipakai sebagai placeholder default", () => {
    renderInput(<NumberInput prefix="$" decimalScale={2} />);
    expect(screen.getByRole("textbox")).toHaveAttribute(
      "placeholder",
      "$0.00",
    );
  });

  it("Escape membuat input blur", async () => {
    const user = userEvent.setup({ delay: null });
    renderInput(<NumberInput value={100} />);

    const input = screen.getByRole("textbox");
    input.focus();
    await user.keyboard("{Escape}");

    expect(input).not.toHaveFocus();
  });
});
