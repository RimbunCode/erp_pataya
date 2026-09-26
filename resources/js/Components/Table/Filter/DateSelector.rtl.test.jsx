import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
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
// `reuiProps.current` = props terakhir yg diterima panel -- test memanggil
// `onChange` langsung utk mensimulasikan emisi widget (revisi 16, multi "Pada").
const reuiProps = vi.hoisted(() => ({ current: null }));
vi.mock("@/Components/ui/date-selector", () => ({
  DateSelector: (props) => {
    reuiProps.current = props;
    return <div data-testid="stub-reui-panel" />;
  },
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

describe("DateSelector — banyak nilai 'Pada' (revisi 16)", () => {
  const sep = { period: "month", operator: "is", year: 2026, month: 8 };
  const nov = { period: "month", operator: "is", year: 2026, month: 10 };
  const openPanel = async (user) => {
    await user.click(screen.getByRole("textbox"));
    await screen.findByTestId("stub-reui-panel");
  };
  const emitFromWidget = (next) =>
    act(() => {
      reuiProps.current.onChange(next);
    });

  it("widget diberi allowMultiple + maxSelections 20", async () => {
    const user = userEvent.setup({ delay: null });
    render(<DateSelector type="date" value={null} onValueChange={vi.fn()} />);
    await openPanel(user);

    expect(reuiProps.current.allowMultiple).toBe(true);
    expect(reuiProps.current.maxSelections).toBe(20);
  });

  it("ketik `Sep 2026 | Nov 2026` + Enter -> DAFTAR dua periode 'Pada' (bukan objek)", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    render(
      <DateSelector type="date" value={null} onValueChange={onValueChange} />,
    );

    await user.type(screen.getByRole("textbox"), "Sep 2026 | Nov 2026{Enter}");

    expect(onValueChange).toHaveBeenLastCalledWith([sep, nov]);
  });

  it("pemisah `;` juga berlaku; duplikat dibuang", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    render(
      <DateSelector type="date" value={null} onValueChange={onValueChange} />,
    );

    await user.type(screen.getByRole("textbox"), "2026; 2027; 2026{Enter}");

    expect(onValueChange).toHaveBeenLastCalledWith([
      { period: "year", operator: "is", year: 2026 },
      { period: "year", operator: "is", year: 2027 },
    ]);
  });

  it("satu segmen berpemisah (`Sep 2026;`) -> objek tunggal, bukan daftar 1 elemen", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    render(
      <DateSelector type="date" value={null} onValueChange={onValueChange} />,
    );

    await user.type(screen.getByRole("textbox"), "Sep 2026;{Enter}");

    expect(onValueChange).toHaveBeenLastCalledWith(sep);
  });

  it("segmen tak terparse / campur nilai bersimbol / negasi `!` -> tak ada emisi", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    render(
      <DateSelector type="date" value={null} onValueChange={onValueChange} />,
    );
    const input = screen.getByRole("textbox");

    await user.type(input, "Sep 2026 | bukan tanggal{Enter}");
    await user.clear(input);
    await user.type(input, "Sep 2026 | >2027{Enter}");
    await user.clear(input);
    await user.type(input, "!Sep 2026 | Nov 2026{Enter}");

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("ketikan tanpa pemisah tetap lewat jalur lama (satu objek, operator dari label)", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    render(
      <DateSelector type="date" value={null} onValueChange={onValueChange} />,
    );

    await user.type(screen.getByRole("textbox"), "2026{Enter}");

    const arg = onValueChange.mock.calls.at(-1)[0];
    expect(Array.isArray(arg)).toBe(false);
    expect(arg).toMatchObject({ period: "year", year: 2026, operator: "is" });
  });

  it("nilai DAFTAR: ringkasan `a | b`, widget dihidrasi dgn `selections` Kondisi Pada; tombol hapus berlabel", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <DateSelector type="date" value={[sep, nov]} onValueChange={vi.fn()} />,
    );
    expect(screen.getByRole("textbox")).toHaveValue("Sep 2026 | Nov 2026");
    expect(
      screen.getByRole("button", {
        name: "core.datatable.filter.dateselector.clear",
      }),
    ).toBeInTheDocument();

    await openPanel(user);
    expect(reuiProps.current.value.operator).toBe("is");
    expect(reuiProps.current.value.selections).toHaveLength(2);
    expect(reuiProps.current.value.selections[0].month).toBe(8);
  });

  it("nilai objek 'is' lengkap = SATU pilihan widget; Kondisi lain (after) tanpa `selections`", async () => {
    const user = userEvent.setup({ delay: null });
    const { rerender } = render(
      <DateSelector type="date" value={sep} onValueChange={vi.fn()} />,
    );
    await openPanel(user);
    expect(reuiProps.current.value.selections).toHaveLength(1);

    rerender(
      <DateSelector
        type="date"
        value={{ period: "year", operator: "after", year: 2026 }}
        onValueChange={vi.fn()}
      />,
    );
    expect(reuiProps.current.value.operator).toBe("after");
    expect(reuiProps.current.value.selections).toBeUndefined();
  });

  it("widget mengirim >= 2 `selections` -> onValueChange(daftar, tanggal LOKAL); 1 -> objek; 0 -> nilai tunggal", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    render(
      <DateSelector type="date" value={null} onValueChange={onValueChange} />,
    );
    await openPanel(user);

    const d1 = {
      period: "day",
      operator: "is",
      startDate: new Date(2026, 3, 15, 13, 45),
    };
    const d2 = {
      period: "day",
      operator: "is",
      startDate: new Date(2026, 3, 16),
    };
    emitFromWidget({ operator: "is", period: "day", selections: [d1, d2] });
    expect(onValueChange).toHaveBeenLastCalledWith([
      { period: "day", operator: "is", startDate: "2026-04-15" },
      { period: "day", operator: "is", startDate: "2026-04-16" },
    ]);

    emitFromWidget({ operator: "is", period: "day", selections: [d2] });
    expect(onValueChange).toHaveBeenLastCalledWith({
      period: "day",
      operator: "is",
      startDate: "2026-04-16",
    });

    emitFromWidget({ operator: "is", period: "year", selections: [] });
    expect(onValueChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ period: "year", operator: "is" }),
    );
    expect(Array.isArray(onValueChange.mock.calls.at(-1)[0])).toBe(false);
  });
});
