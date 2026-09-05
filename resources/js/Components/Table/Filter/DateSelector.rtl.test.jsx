import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({
    t: (key) => {
      const map = {
        "core.datatable.filter.dateselector.subop.is": "is",
        "core.datatable.filter.dateselector.subop.between": "between",
      };
      return map[key] ?? key;
    },
  }),
}));

vi.mock("@inertiajs/react", () => ({
  usePage: () => ({ props: { lang: "en" } }),
}));

// Panel kalender reui kompleks & punya konsern testing sendiri -- stub agar
// test DateSelector fokus ke wrapper: parsing input teks, display summary,
// dan tombol clear (bukan detail interaksi kalender).
vi.mock("@/Components/ui/date-selector", () => ({
  DateSelector: () => <div data-testid="stub-reui-panel" />,
}));

import DateSelector from "./DateSelector";

describe("DateSelector", () => {
  it("render input kosong tanpa value", () => {
    render(<DateSelector type="date" value={null} onValueChange={vi.fn()} />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("render ringkasan 'is <tanggal>' untuk value period=day operator=is", () => {
    render(
      <DateSelector
        type="date"
        value={{ period: "day", operator: "is", startDate: "2026-03-15" }}
        onValueChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("textbox")).toHaveValue("is 15 March 2026");
  });

  it("render ringkasan tahun untuk period=year", () => {
    render(
      <DateSelector
        type="date"
        value={{ period: "year", operator: "is", year: 2026 }}
        onValueChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("textbox")).toHaveValue("is 2026");
  });

  it("mengetik tahun (4 digit) lalu Enter memanggil onValueChange dgn period=year", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    render(
      <DateSelector type="date" value={null} onValueChange={onValueChange} />,
    );

    const input = screen.getByRole("textbox");
    await user.type(input, "2026{Enter}");

    expect(onValueChange).toHaveBeenCalledWith(
      expect.objectContaining({ period: "year", year: 2026 }),
    );
  });

  it("blur setelah mengetik (tanpa Enter) tetap commit draft", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    render(
      <DateSelector type="date" value={null} onValueChange={onValueChange} />,
    );

    const input = screen.getByRole("textbox");
    await user.type(input, "2026");
    await user.tab();

    expect(onValueChange).toHaveBeenCalledWith(
      expect.objectContaining({ period: "year", year: 2026 }),
    );
  });

  it("Escape membatalkan draft tanpa memanggil onValueChange", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    render(
      <DateSelector type="date" value={null} onValueChange={onValueChange} />,
    );

    const input = screen.getByRole("textbox");
    await user.type(input, "2026{Escape}");

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("input teks yang tidak bisa di-parse tidak memanggil onValueChange", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    render(
      <DateSelector type="date" value={null} onValueChange={onValueChange} />,
    );

    const input = screen.getByRole("textbox");
    await user.type(input, "bukan tanggal{Enter}");

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("tombol clear (X) muncul saat ada value", () => {
    render(
      <DateSelector
        type="date"
        value={{ period: "year", operator: "is", year: 2026 }}
        onValueChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  // BUG DIKONFIRMASI (lihat task terpisah "Fix bug DateSelector: clear button
  // gagal emit saat value awal controlled"): ref internal `lastEmitted`
  // (DateSelector.jsx ~L338) selalu mulai dari null, TIDAK diinisialisasi dari
  // prop `value` awal (beda dgn `lastValueRef` yg diinisialisasi dgn benar).
  // Akibatnya emit(null) di klik clear PERTAMA pada value controlled dari
  // mount awal SILENT NO-OP -- onValueChange tidak pernah terpanggil, walau
  // UI lokal terlihat ter-clear. Baru bekerja mulai klik clear KEDUA (setelah
  // minimal 1x emit apapun dari dalam komponen). Test ini mendokumentasikan
  // actual behavior saat ini, BUKAN behavior yang diinginkan.
  it("[BUG] klik clear PERTAMA pada value controlled awal TIDAK memanggil onValueChange (seharusnya memanggil)", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    render(
      <DateSelector
        type="date"
        value={{ period: "year", operator: "is", year: 2026 }}
        onValueChange={onValueChange}
      />,
    );

    await user.click(screen.getByRole("button"));

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("klik clear KEDUA (setelah emit internal apapun) berhasil memanggil onValueChange(null)", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    render(
      <DateSelector
        type="date"
        value={{ period: "year", operator: "is", year: 2026 }}
        onValueChange={onValueChange}
      />,
    );

    // Trigger 1 emit internal dulu (mengetik tahun baru lalu Enter) agar
    // lastEmitted terisi -- baru setelah ini clear button bekerja normal.
    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "2027{Enter}");
    onValueChange.mockClear();

    await user.click(screen.getByRole("button"));

    expect(onValueChange).toHaveBeenCalledWith(null);
  });

  it("tombol clear TIDAK muncul saat tidak ada value", () => {
    render(<DateSelector type="date" value={null} onValueChange={vi.fn()} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("klik input membuka popover panel kalender (stub)", async () => {
    const user = userEvent.setup({ delay: null });
    render(<DateSelector type="date" value={null} onValueChange={vi.fn()} />);

    await user.click(screen.getByRole("textbox"));
    expect(await screen.findByTestId("stub-reui-panel")).toBeInTheDocument();
  });
});
