import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DateSelector } from "./date-selector";

// Tanggal "sekarang" dibekukan (hanya `Date`, bukan timer -- fake timers penuh
// membuat Radix menggantung) supaya bulan kalender tak bergantung jam mesin.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 15, 13, 45));
});
afterEach(() => {
  vi.useRealTimers();
});

const i18n = {
  todayLabels: {
    day: "PINTASAN",
    month: "PINTASAN",
    quarter: "PINTASAN",
    "half-year": "PINTASAN",
    year: "PINTASAN",
  },
};

const base = { i18n, showTwoMonths: false, minYear: 2026, maxYear: 2027 };
const lastValue = (fn) => fn.mock.calls.at(-1)[0];
const dayCell = (n) =>
  screen.getByRole("button", {
    name: new RegExp(`September ${n}(st|nd|rd|th), 2026`),
  });
const isCellSelected = (n) =>
  dayCell(n).closest("td").getAttribute("aria-selected") === "true";
const days = (v) => v.selections.map((s) => s.startDate.getDate());
// minYear 2026..maxYear 2027 -> tiap grid punya 2 blok tahun; [0] = 2026.
const firstOf = (name) => screen.getAllByRole("button", { name })[0];
const kondisi = () => screen.getAllByRole("combobox")[0];
const periode = () => screen.getAllByRole("combobox")[1];
const pickOption = async (user, combo, name) => {
  await user.click(combo);
  await user.click(await screen.findByRole("option", { name }));
};

describe("ui/DateSelector — multi-select `allowMultiple` (revisi 11, Requirement 59)", () => {
  it("DEFAULT (tanpa allowMultiple) = perilaku lama: klik hari kedua MENGGANTI, tak ada `selections`", async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    render(<DateSelector {...base} onChange={onChange} />);

    await user.click(dayCell(10));
    await user.click(dayCell(20));

    const v = lastValue(onChange);
    expect(v).not.toHaveProperty("selections");
    expect(v.startDate.getDate()).toBe(20);
  });

  it("allowMultiple + Kondisi Pada: klik hari men-toggle anggota `selections`; sel ditandai", async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    render(<DateSelector {...base} allowMultiple onChange={onChange} />);

    await user.click(dayCell(10));
    await user.click(dayCell(20));
    expect(days(lastValue(onChange))).toEqual([10, 20]);
    expect(isCellSelected(10)).toBe(true);
    expect(isCellSelected(20)).toBe(true);
    expect(isCellSelected(11)).toBe(false);

    await user.click(dayCell(10));
    expect(days(lastValue(onChange))).toEqual([20]);
    expect(isCellSelected(10)).toBe(false);
  });

  it("pilihan berupa objek periode `is` lengkap (hari = awal hari); single fields tak terisi", async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    render(<DateSelector {...base} allowMultiple onChange={onChange} />);

    await user.click(dayCell(10));

    const v = lastValue(onChange);
    expect(v.operator).toBe("is");
    expect(v.selections).toHaveLength(1);
    expect(v.selections[0]).toMatchObject({ period: "day", operator: "is" });
    const start = v.selections[0].startDate;
    expect([start.getFullYear(), start.getMonth(), start.getDate()]).toEqual([
      2026, 8, 10,
    ]);
    expect([start.getHours(), start.getMinutes()]).toEqual([0, 0]);
    expect(v.startDate).toBeUndefined();
  });

  it("pintasan 'hari ini' bersifat MENAMBAH (dua kali klik tak melepas)", async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    render(<DateSelector {...base} allowMultiple onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "PINTASAN" }));
    await user.click(screen.getByRole("button", { name: "PINTASAN" }));

    expect(days(lastValue(onChange))).toEqual([15]);
  });

  it("ganti Periode TIDAK membersihkan pilihan; daftar boleh campuran hari + bulan", async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    render(<DateSelector {...base} allowMultiple onChange={onChange} />);

    await user.click(dayCell(10));
    await pickOption(user, periode(), "Month");
    await user.click(firstOf("Mar"));

    const { selections } = lastValue(onChange);
    expect(selections).toHaveLength(2);
    expect(selections[0]).toMatchObject({ period: "day" });
    expect(selections[1]).toEqual({
      period: "month",
      operator: "is",
      year: 2026,
      month: 2,
    });
  });

  it("grid bulan/kuartal/semester & daftar tahun menandai pilihan multi dan men-toggle", async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    render(
      <DateSelector
        {...base}
        allowMultiple
        onChange={onChange}
        value={{
          period: "month",
          operator: "is",
          selections: [
            { period: "month", operator: "is", year: 2026, month: 2 },
            { period: "month", operator: "is", year: 2026, month: 5 },
          ],
        }}
      />,
    );

    const marked = (name) => firstOf(name).className.includes("bg-foreground");
    expect(marked("Mar")).toBe(true);
    expect(marked("Jun")).toBe(true);
    expect(marked("Apr")).toBe(false);

    await user.click(firstOf("Mar"));
    expect(lastValue(onChange).selections).toHaveLength(1);
    expect(marked("Mar")).toBe(false);

    // kuartal
    await pickOption(user, periode(), "Quarter");
    await user.click(firstOf("Q2"));
    expect(lastValue(onChange).selections.at(-1)).toEqual({
      period: "quarter",
      operator: "is",
      year: 2026,
      quarter: 1,
    });
    // semester
    await pickOption(user, periode(), "Half-year");
    await user.click(firstOf("H2"));
    expect(lastValue(onChange).selections.at(-1)).toEqual({
      period: "half-year",
      operator: "is",
      year: 2026,
      halfYear: 1,
    });
    // tahun
    await pickOption(user, periode(), "Year");
    await user.click(screen.getByRole("button", { name: "2027" }));
    expect(lastValue(onChange).selections.at(-1)).toEqual({
      period: "year",
      operator: "is",
      year: 2027,
    });
    expect(screen.getByRole("button", { name: "2027" }).className).toContain(
      "bg-foreground",
    );
  });

  it("hidrasi dari value.selections (hari ditandai di kalender)", () => {
    render(
      <DateSelector
        {...base}
        allowMultiple
        onChange={vi.fn()}
        value={{
          period: "day",
          operator: "is",
          selections: [
            {
              period: "day",
              operator: "is",
              startDate: new Date(2026, 8, 4),
            },
            {
              period: "day",
              operator: "is",
              startDate: new Date(2026, 8, 18, 9, 30),
            },
          ],
        }}
      />,
    );

    expect(isCellSelected(4)).toBe(true);
    expect(isCellSelected(18)).toBe(true);
    expect(isCellSelected(5)).toBe(false);
  });

  it("klik sel hari yg dipilih via ketikan berjam me-toggle (hari sama, jam diabaikan)", async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    render(
      <DateSelector
        {...base}
        allowMultiple
        onChange={onChange}
        value={{
          period: "day",
          operator: "is",
          selections: [
            {
              period: "day",
              operator: "is",
              startDate: new Date(2026, 8, 18, 9, 30),
            },
          ],
        }}
      />,
    );

    await user.click(dayCell(18));
    expect(lastValue(onChange).selections).toEqual([]);
  });

  it("Kondisi selain Pada DINONAKTIFKAN selama >= 2 pilihan (tak ada pilihan hilang diam-diam)", async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    render(<DateSelector {...base} allowMultiple onChange={onChange} />);

    await user.click(dayCell(10));
    await user.click(dayCell(20));
    await user.click(kondisi());
    for (const name of ["after", "before", "between"]) {
      expect(await screen.findByRole("option", { name })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
    }
    expect(screen.getByRole("option", { name: "is" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("dengan <= 1 pilihan Kondisi lain boleh dipilih: pilihan dibersihkan & kembali ke mode tunggal/range", async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    render(<DateSelector {...base} allowMultiple onChange={onChange} />);

    await user.click(dayCell(10));
    await pickOption(user, kondisi(), "between");
    expect(lastValue(onChange).selections).toEqual([]);
    expect(lastValue(onChange).operator).toBe("between");

    // Di Antara = range (bukan multi): dua klik -> startDate & endDate.
    await user.click(dayCell(5));
    await user.click(dayCell(12));
    const v = lastValue(onChange);
    expect(v.selections).toEqual([]);
    expect([v.startDate.getDate(), v.endDate.getDate()]).toEqual([5, 12]);
  });

  it("batas maxSelections: klik baru diabaikan & onSelectionLimit dipanggil", async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    const onSelectionLimit = vi.fn();
    render(
      <DateSelector
        {...base}
        allowMultiple
        maxSelections={2}
        onSelectionLimit={onSelectionLimit}
        onChange={onChange}
      />,
    );

    await user.click(dayCell(1));
    await user.click(dayCell(2));
    await user.click(dayCell(3));

    expect(days(lastValue(onChange))).toEqual([1, 2]);
    expect(onSelectionLimit).toHaveBeenCalledTimes(1);
    expect(isCellSelected(3)).toBe(false);
    // melepas pilihan tetap boleh saat penuh
    await user.click(dayCell(1));
    expect(days(lastValue(onChange))).toEqual([2]);
  });

  it("datetime (withTime) mode multi: pemilih jam tak tampil; klik sel = seluruh hari", async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    const { unmount } = render(
      <DateSelector {...base} withTime onChange={onChange} />,
    );
    // mode tunggal: pemilih jam ada (tombol HH:mm)
    expect(screen.getByRole("button", { name: /^\d{2}:\d{2}$/ })).toBeTruthy();
    unmount();

    render(
      <DateSelector {...base} withTime allowMultiple onChange={onChange} />,
    );
    expect(screen.queryByRole("button", { name: /^\d{2}:\d{2}$/ })).toBeNull();
    await user.click(dayCell(10));
    const start = lastValue(onChange).selections[0].startDate;
    expect([start.getHours(), start.getMinutes()]).toEqual([0, 0]);
  });

  it("emisi `selections` juga saat kosong (allowMultiple) agar konsumen selalu punya kunci", () => {
    const onChange = vi.fn();
    render(<DateSelector {...base} allowMultiple onChange={onChange} />);
    expect(lastValue(onChange).selections).toEqual([]);
  });

  it("grid periode: kalender hari tetap satu bulan (within grid) -- tak merusak navigasi", () => {
    render(<DateSelector {...base} allowMultiple onChange={vi.fn()} />);
    expect(
      within(screen.getByRole("grid")).getAllByRole("button").length,
    ).toBeGreaterThan(28);
  });
});
