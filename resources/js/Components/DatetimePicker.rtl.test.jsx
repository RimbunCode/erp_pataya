import { describe, expect, it, vi } from "vitest";
import { render as rtlRender, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

vi.mock("@inertiajs/react", () => ({
  usePage: () => ({ props: { lang: "en" } }),
}));

import DatetimePicker from "./DatetimePicker";
import { TooltipProvider } from "./ui/tooltip";

const render = (ui) => rtlRender(<TooltipProvider>{ui}</TooltipProvider>);

describe("DatetimePicker", () => {
  it("render input kosong tanpa value", () => {
    render(<DatetimePicker type="date" />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("render display value untuk type='date'", () => {
    render(<DatetimePicker type="date" value="2026-03-15" />);
    // format PPP locale en -> "March 15th, 2026"
    expect(screen.getByRole("textbox")).toHaveValue("March 15th, 2026");
  });

  it("render display value untuk type='datetime'", () => {
    render(<DatetimePicker type="datetime" value="2026-03-15T10:30:00" />);
    const input = screen.getByRole("textbox");
    expect(input.value).toContain("March 15th, 2026");
    expect(input.value).toContain("10:30");
  });

  it("mengetik tanggal valid lalu Enter memanggil onValueChange", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    render(<DatetimePicker type="date" onValueChange={onValueChange} />);

    const input = screen.getByRole("textbox");
    await user.type(input, "2026-06-01{Enter}");

    expect(onValueChange).toHaveBeenCalled();
    const [calledWith] = onValueChange.mock.calls.at(-1);
    expect(new Date(calledWith).getFullYear()).toBe(2026);
    expect(new Date(calledWith).getMonth()).toBe(5); // Juni = index 5
  });

  it("mengosongkan input lalu blur memanggil onValueChange dengan null", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    render(
      <DatetimePicker
        type="date"
        value="2026-03-15"
        onValueChange={onValueChange}
      />,
    );

    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.tab(); // trigger blur

    expect(onValueChange).toHaveBeenCalledWith(null);
  });

  it("input tidak valid (tidak match format apapun) tidak memanggil onValueChange", async () => {
    // delay: null -- setiap keystroke memicu re-parsing lewat puluhan format
    // date-fns x 3 locale; teks pendek + tanpa delay antar-karakter tetap
    // perlu timeout lebih longgar dari default 5s.
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    render(<DatetimePicker type="date" onValueChange={onValueChange} />);

    const input = screen.getByRole("textbox");
    await user.type(input, "zzz{Enter}");

    expect(onValueChange).not.toHaveBeenCalled();
  }, 15000);

  it("disabled mencegah input diedit", () => {
    render(<DatetimePicker type="date" disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("tombol clear (X) muncul saat ada value dan mengosongkan onValueChange(null)", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    render(
      <DatetimePicker
        type="date"
        value="2026-03-15"
        onValueChange={onValueChange}
      />,
    );

    const clearButton = screen.getByRole("button", { name: "" });
    await user.click(clearButton);

    expect(onValueChange).toHaveBeenCalledWith(null);
  });
});
