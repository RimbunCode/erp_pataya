import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

import SearchLegend, { legendTipsFor } from "./SearchLegend";

// Tips mengikuti KONDISI SAAT INI (revisi 12): tombol yg sama berfungsi beda
// tergantung fokus, jadi tiap kondisi punya daftar sendiri.
describe("legendTipsFor — mode value, fokus di kotak (kosong / mengetik)", () => {
  it("kotak kosong tanpa chip: Enter = selesai (batal), ↓ ke daftar, simbol sesuai tipe", () => {
    const text = legendTipsFor({ vmode: "text" });
    expect(text).toEqual(
      expect.arrayContaining([
        "enter_finish_empty",
        "option_down",
        "separator",
        "exclude",
        "escape",
      ]),
    );
    expect(text).not.toContain("compare");

    const number = legendTipsFor({ vmode: "number" });
    expect(number).toContain("separator_number");
    expect(number).not.toContain("separator");
    expect(number).toEqual(expect.arrayContaining(["compare", "range"]));
  });

  it("kotak kosong dgn chip: Enter = selesai + simpan; chip bisa disorot", () => {
    const tips = legendTipsFor({ vmode: "text", hasChips: true });
    expect(tips).toContain("enter_finish");
    expect(tips).not.toContain("enter_finish_empty");
    expect(tips).toContain("chip_focus");
  });

  it("mengetik text/number/date: Enter = jadikan chip (bukan selesai)", () => {
    for (const vmode of ["text", "number", "date"]) {
      const tips = legendTipsFor({ vmode, typing: true });
      expect(tips).toContain("enter_chip");
      expect(tips).not.toContain("enter_finish");
    }
    expect(legendTipsFor({ vmode: "date", typing: true })).toContain(
      "complete",
    );
  });

  it("date: pemisah tanpa koma, contoh format, simbol; list/relation tak punya compare/range", () => {
    const date = legendTipsFor({ vmode: "date" });
    expect(date).toEqual(
      expect.arrayContaining([
        "separator_number",
        "compare",
        "range",
        "examples",
        "option_down",
      ]),
    );
    expect(date).not.toContain("separator");
    for (const vmode of ["list", "relation"]) {
      const tips = legendTipsFor({ vmode });
      expect(tips).not.toContain("compare");
      expect(tips).not.toContain("range");
    }
  });

  it("sedang mengedit chip nilai: Enter = simpan hasil edit (kosong = hapus nilai itu)", () => {
    const tips = legendTipsFor({
      vmode: "text",
      hasChips: true,
      editing: true,
    });
    expect(tips).toContain("enter_edit_save");
    expect(tips).not.toContain("enter_finish");
    expect(
      legendTipsFor({ vmode: "text", editing: true, typing: true }),
    ).toContain("editing_note");
  });

  it("mode kecualikan (`!`): tips 'aktif' menggantikan tips awalan", () => {
    expect(legendTipsFor({ vmode: "text", excluded: true })).toContain(
      "exclude_on",
    );
    expect(legendTipsFor({ vmode: "text", excluded: true })).not.toContain(
      "exclude",
    );
    expect(legendTipsFor({ vmode: "text" })).toContain("exclude");
  });

  it("tipe tak dikenal / null -> kosong", () => {
    expect(legendTipsFor({ vmode: null })).toEqual([]);
    expect(legendTipsFor({ vmode: null, isBoolean: false })).toEqual([]);
  });
});

describe("legendTipsFor — aturan daftar number/date (chipLock)", () => {
  it("sudah ada nilai polos: simbol ditolak (compare/range diganti catatan)", () => {
    for (const vmode of ["number", "date"]) {
      const tips = legendTipsFor({ vmode, hasChips: true, chipLock: "plain" });
      expect(tips).toContain("lock_plain");
      expect(tips).not.toContain("compare");
      expect(tips).not.toContain("range");
    }
  });

  it("ketikan bersimbol (number/date): Enter = langsung selesai, bukan jadikan chip", () => {
    for (const vmode of ["number", "date"]) {
      const tips = legendTipsFor({ vmode, typing: true, typingSymbol: true });
      expect(tips).toContain("enter_symbol_finish");
      expect(tips).not.toContain("enter_chip");
    }
    // ketikan polos tetap jadi chip
    expect(
      legendTipsFor({ vmode: "number", typing: true, typingSymbol: false }),
    ).toContain("enter_chip");
  });

  it("text/list tak punya catatan lock", () => {
    expect(legendTipsFor({ vmode: "text", hasChips: true })).not.toContain(
      "lock_plain",
    );
  });
});

describe("legendTipsFor — opsi tersorot (daftar nilai)", () => {
  it("opsi list/relation/date: ↑↓ pindah, ↑ di opsi pertama kembali ke kotak, Enter pilih, Tab lengkapi", () => {
    for (const vmode of ["list", "relation", "date"]) {
      const tips = legendTipsFor({ vmode, optionActive: true });
      expect(tips).toEqual(
        expect.arrayContaining([
          "option_move",
          "option_back",
          "option_pick",
          "complete",
        ]),
      );
      // Enter memilih opsi, BUKAN selesai/jadikan chip.
      expect(tips).not.toContain("enter_finish");
      expect(tips).not.toContain("enter_chip");
    }
  });

  it("opsi tersorot dgn ketikan bersimbol: Enter langsung selesai (bukan 'jadi chip')", () => {
    const tips = legendTipsFor({
      vmode: "date",
      optionActive: true,
      typingSymbol: true,
    });
    expect(tips).toContain("option_pick_symbol");
    expect(tips).not.toContain("option_pick");
  });

  it("boolean: Enter pada opsi = pilih & terapkan; tak ada pemisah", () => {
    const idle = legendTipsFor({ vmode: "list", isBoolean: true });
    expect(idle).toContain("option_down");
    expect(idle).not.toContain("separator");
    const active = legendTipsFor({
      vmode: "list",
      isBoolean: true,
      optionActive: true,
    });
    expect(active).toContain("option_pick_apply");
    expect(active).not.toContain("option_pick");
  });
});

describe("legendTipsFor — fokus di chip / widget", () => {
  it("chip nilai tersorot: ←→ pindah, Enter/Space edit, ⌫/Del hapus (Enter BUKAN selesai)", () => {
    const tips = legendTipsFor({ vmode: "text", chipFocused: true });
    expect(tips).toEqual(["chip_nav", "chip_edit", "chip_remove", "escape"]);
  });

  it("widget kalender berfokus (date): tips navigasi kalender saja", () => {
    expect(legendTipsFor({ vmode: "date", widgetFocused: true })).toEqual([
      "widget_nav",
      "widget_pick",
      "escape",
    ]);
  });
});

describe("legendTipsFor — Panel & saran (mode key)", () => {
  it("Panel, fokus di kotak: ketik / masuk panel / pilih kolom; tips chip hanya bila ada chip", () => {
    const tips = legendTipsFor({ scope: "panel" });
    expect(tips).toEqual([
      "type_hint",
      "panel_enter",
      "column_pick",
      "enter_apply",
      "escape_close",
    ]);
    // Chip FILTER (bukan chip nilai): teks berbeda.
    expect(legendTipsFor({ scope: "panel", hasChips: true })).toContain(
      "chip_focus_filter",
    );
  });

  it("Panel, fokus di item: pindah / pilih / ↑ di item pertama kembali ke kotak", () => {
    expect(legendTipsFor({ scope: "panelItem" })).toEqual([
      "panel_move",
      "panel_pick",
      "panel_back",
      "escape_close",
    ]);
  });

  it("saran ketikan: pindah / pakai saran / Tab-`:` pilih kolom", () => {
    expect(legendTipsFor({ scope: "suggest" })).toEqual([
      "suggest_move",
      "suggest_pick",
      "column_pick",
      "escape_close",
    ]);
  });

  it("chip filter tersorot (mode key, Panel/saran): tips chip", () => {
    for (const scope of ["panel", "suggest"]) {
      expect(legendTipsFor({ scope, chipFocused: true })).toEqual([
        "chip_nav",
        "chip_edit",
        "chip_remove",
        "escape",
      ]);
    }
  });
});

describe("SearchLegend — render", () => {
  it("tiap item = tombol <kbd> + penjelasan; item tanpa tombol hanya teks", () => {
    render(<SearchLegend ctx={{ vmode: "text", hasChips: true }} />);
    const legend = screen.getByTestId("search-legend");
    expect(
      within(legend).getByText("TR:core.datatable.search.legend.title"),
    ).toBeInTheDocument();
    const kbds = [...legend.querySelectorAll("kbd")].map((k) => k.textContent);
    expect(kbds).toEqual(
      expect.arrayContaining(["!", "|", ";", ",", "Enter", "←", "⌫", "Esc"]),
    );
    // "Selesai" ber-tombol Enter; catatan tanpa tombol hanya teks.
    const finish = within(legend)
      .getByText("TR:core.datatable.search.legend.enter_finish")
      .closest("li");
    expect(finish.querySelector("kbd").textContent).toBe("Enter");
  });

  it("penjelasan berubah mengikuti kondisi (Enter di kotak vs Enter di chip tersorot)", () => {
    const { rerender } = render(
      <SearchLegend ctx={{ vmode: "text", typing: true }} />,
    );
    expect(
      screen.getByText("TR:core.datatable.search.legend.enter_chip"),
    ).toBeInTheDocument();

    rerender(<SearchLegend ctx={{ vmode: "text", chipFocused: true }} />);
    expect(
      screen.queryByText("TR:core.datatable.search.legend.enter_chip"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("TR:core.datatable.search.legend.chip_edit"),
    ).toBeInTheDocument();
  });

  it("Panel: tombol Tab & `:` utk memilih kolom, kontras teks tinggi (foreground)", () => {
    render(<SearchLegend ctx={{ scope: "panel", hasChips: true }} />);
    const legend = screen.getByTestId("search-legend");
    const kbds = [...legend.querySelectorAll("kbd")].map((k) => k.textContent);
    expect(kbds).toEqual(expect.arrayContaining(["Tab", ":", "Enter", "Esc"]));
    expect(legend.querySelector("ul").className).toContain(
      "text-foreground/90",
    );
    expect(legend.className).not.toContain("muted-foreground");
  });

  it("tipe tanpa petunjuk -> tidak render apa pun", () => {
    const { container } = render(<SearchLegend ctx={{ vmode: null }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
