import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { useState } from "react";

// t harus stabil -- Form.jsx tidak punya useEffect ber-dependency `t` secara
// langsung, tapi tetap dipakai konstan mengikuti pola acuan sesi ini.
const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

// getDataModel & getFonts dipanggil dari resources/js/lib/utils -- keduanya
// async dan menyentuh axios/window.queryLocalFonts. Di-mock supaya
// deterministik; generateRandom & DEFAULT_PRINT_FONTS dipakai REAL (pure,
// tidak butuh mock) karena itu logic asli Form.jsx (nama otomatis & daftar
// font fallback).
const getDataModelMock = vi.fn();
const getFontsMock = vi.fn();
vi.mock("@/lib/utils", async () => {
  const actual = await vi.importActual("@/lib/utils");
  return {
    ...actual,
    getDataModel: (...a) => getDataModelMock(...a),
    getFonts: (...a) => getFontsMock(...a),
  };
});

// FormPageContent & useFormPage: FormPageContent sudah ditest sendiri
// (FormPageContent.rtl.test.jsx) -- di sini distub sebagai passthrough biar
// title+children terlihat tanpa menyeret logic tab Radix.
//
// useFormPage TIDAK bisa distub dengan vi.fn() statis: Form.jsx membaca
// {data, setData} lalu memanggil setData berulang kali dengan updater
// function untuk kalkulasi (paper/unit/orientation/width/height), dan
// FormCheckbox (dipakai REAL, bukan distub) juga memanggil useFormPage()
// sendiri untuk `disabled`. Supaya reaktif lintas re-render, useFormPage
// diimplementasikan lewat React Context asli + useState nyata (bukan mock
// statis) -- persis pola yang diwajibkan task ini.
const FormPageTestContext = React.createContext(null);

function useFormPage() {
  return React.useContext(FormPageTestContext);
}

function FormPageContent({ title, children }) {
  return (
    <div role="content">
      {title != null && <div role="title">{title}</div>}
      {children}
    </div>
  );
}

vi.mock("@/Pages/Core/FormPage", () => ({
  useFormPage: (...a) => useFormPage(...a),
  FormPageContent: (props) => FormPageContent(props),
}));

// FormInput, Select, NumberInput, LinkModel, PermissionLinkModel: semua
// adalah komponen input generik dengan dependency berat sendiri (axios,
// usePermission, FormPageDialog, useCurrency, dst) yang tidak menjadi
// tanggung jawab Form.jsx. Distub sebagai kontrol sederhana.
//
// Form.jsx TIDAK memberi `name`/`data-testid` eksplisit ke Select/NumberInput
// manapun -- satu-satunya identitas stabil yang tersedia dari tiap field
// adalah `label` yang dilempar ke FormInput. Mock FormInput di bawah
// membungkus tiap field dengan `data-field="<label>"` supaya test bisa
// menemukan Select/NumberInput yang tepat lewat `within(getByTestField(...))`
// tanpa bergantung urutan DOM yang rapuh.
vi.mock("@/Components/FormInput", () => ({
  default: ({ label, children }) => (
    <div data-field={label ?? ""}>
      {label && <label>{label}</label>}
      {children}
    </div>
  ),
}));

vi.mock("@/Components/Select", () => ({
  default: ({ value, onValueChange, options }) => (
    <select value={value ?? ""} onChange={(e) => onValueChange(e.target.value)}>
      <option value="" />
      {(options ?? []).map((opt) => {
        const optValue = typeof opt === "object" ? opt.value : opt;
        const optLabel = typeof opt === "object" ? opt.label : opt;
        return (
          <option key={optValue} value={optValue}>
            {optLabel}
          </option>
        );
      })}
    </select>
  ),
}));

vi.mock("@/Components/NumberInput", () => ({
  default: ({ value, onValueChange }) => (
    <input
      type="number"
      value={value ?? ""}
      onChange={(e) => {
        const raw = e.target.value;
        onValueChange(raw === "" ? null : parseFloat(raw));
      }}
    />
  ),
}));

vi.mock("@/Components/LinkModel", () => ({
  default: ({ value, onValueChange }) => (
    <input
      data-testid="letter-head-link"
      value={value ?? ""}
      onChange={(e) => onValueChange(e.target.value)}
    />
  ),
}));

vi.mock("../PermissionLinkModel", () => ({
  default: ({ value, onValueChange }) => (
    <input
      data-testid="permission-link-model"
      value={value?.name ?? ""}
      onChange={(e) =>
        onValueChange(
          e.target.value
            ? { model: "App\\Models\\Sales\\SalesOrder", name: e.target.value }
            : null,
        )
      }
    />
  ),
}));

import Form from "./Form";

/**
 * Wrapper yang menyediakan context useFormPage nyata (data + setData
 * ber-state) supaya interaksi user (klik/ketik) benar-benar memicu re-render
 * Form.jsx dengan data terbaru -- meniru FormPageProvider asli secara
 * minimal, cukup untuk kebutuhan Form.jsx & FormCheckbox.
 * @param root0
 * @param root0.initialData
 * @param root0.disabled
 */
function Harness({ initialData = {}, disabled = false }) {
  const [data, setData] = useState(initialData);

  const handleSetData = (keyOrUpdater, value) => {
    setData((prev) => {
      if (typeof keyOrUpdater === "function") {
        return keyOrUpdater(prev);
      }
      return { ...prev, [keyOrUpdater]: value };
    });
  };

  return (
    <FormPageTestContext.Provider
      value={{ data, setData: handleSetData, disabled }}
    >
      <Form />
    </FormPageTestContext.Provider>
  );
}

async function renderForm(props) {
  let utils;
  await act(async () => {
    utils = render(<Harness {...props} />);
  });
  return utils;
}

/**
 * Field pada Form.jsx tidak diberi `name`/`data-testid` eksplisit ke
 * Select/NumberInput manapun -- satu-satunya identitas stabil yang tersedia
 * adalah `label` yang dilempar ke FormInput (dibungkus mock FormInput
 * sebagai `data-field="<label>"`). Helper ini scope query ke container field
 * tsb via `within()`, lalu ambil kontrolnya lewat role native
 * (`combobox` utk <select>, `spinbutton` utk <input type="number">) --
 * menghindari ambiguous-query karena banyak <select>/<option> dengan teks
 * yang sama (mis. "portrait" dipakai baik sbg option orientation maupun
 * kata dalam field lain).
 * @param label
 */
function getField(label) {
  return document.querySelector(`[data-field="${label}"]`);
}

function getSelectInField(label) {
  return within(getField(label)).getByRole("combobox");
}

function getNumberInputInField(label) {
  return within(getField(label)).getByRole("spinbutton");
}

describe("PrintTemplate Form", () => {
  beforeEach(() => {
    getDataModelMock.mockReset();
    getFontsMock.mockReset();
    getDataModelMock.mockResolvedValue(null);
    getFontsMock.mockResolvedValue([
      "Times New Roman",
      "Arial",
      "Helvetica",
      "Segoe UI",
      "Verdana",
      "Tahoma",
      "Trebuchet MS",
      "Georgia",
      "Garamond",
      "Cambria",
      "Courier New",
      "Roboto",
      "Noto Sans",
      "Noto Serif",
    ]);
  });

  describe("rendering dasar & toggle is_letter_head", () => {
    it("menampilkan field model (PermissionLinkModel) & style settings ketika is_letter_head=false", async () => {
      await renderForm({ initialData: { is_letter_head: false } });

      expect(screen.getByTestId("permission-link-model")).toBeInTheDocument();
      expect(
        screen.getByText("core.printTemplate.style_settings"),
      ).toBeInTheDocument();
    });

    it("menyembunyikan field model & style settings, tapi tetap tampilkan name & letter_head selector ketika is_letter_head=true", async () => {
      await renderForm({ initialData: { is_letter_head: true } });

      expect(
        screen.queryByTestId("permission-link-model"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("core.printTemplate.style_settings"),
      ).not.toBeInTheDocument();
      // name tetap ada (di luar blok is_letter_head)
      expect(
        screen.getByText("core.printTemplate.columns.name"),
      ).toBeInTheDocument();
      // default_language & letter_head hanya muncul saat !is_letter_head
      expect(
        screen.queryByText("core.printTemplate.columns.default_language"),
      ).not.toBeInTheDocument();
    });

    it("mencentang checkbox is_letter_head memicu setData dan menyembunyikan section style settings", async () => {
      const user = userEvent.setup({ delay: null });
      await renderForm({ initialData: { is_letter_head: false } });

      expect(
        screen.getByText("core.printTemplate.style_settings"),
      ).toBeInTheDocument();

      // FormCheckbox (Components/ui/checkbox.jsx) merender role="forminput"
      // -- BUKAN role="checkbox" native -- jadi query harus lewat role
      // tsb + name (accessible name dari label).
      const checkbox = screen.getByRole("forminput", {
        name: "core.printTemplate.columns.is_letter_head",
      });
      await user.click(checkbox);

      expect(
        screen.queryByText("core.printTemplate.style_settings"),
      ).not.toBeInTheDocument();
    });

    it("menampilkan field page_number_format hanya ketika page_number diisi dan bukan 'hide'", async () => {
      // NB: `rerender` RTL TIDAK bisa dipakai utk mengganti `initialData`
      // Harness -- state `data` sudah di-inisialisasi via useState() pada
      // mount pertama, jadi prop `initialData` baru diabaikan React pada
      // re-render (bukan bug Form.jsx). Interaksi lewat UI (ganti Select
      // page_number sungguhan) supaya reaktif thd context nyata.
      const user = userEvent.setup({ delay: null });
      await renderForm({
        initialData: { is_letter_head: false, page_number: "hide" },
      });
      expect(
        screen.queryByText("core.printTemplate.columns.page_number_format"),
      ).not.toBeInTheDocument();

      const pageNumberSelect = getSelectInField(
        "core.printTemplate.columns.page_number",
      );
      await user.selectOptions(pageNumberSelect, "bottom_right");

      expect(
        screen.getByText("core.printTemplate.columns.page_number_format"),
      ).toBeInTheDocument();
    });
  });

  describe("kalkulasi paper size", () => {
    it("memilih paper baru menghitung ulang width/height sesuai paperSize & conversion_factor unit aktif", async () => {
      const user = userEvent.setup({ delay: null });
      await renderForm({
        initialData: {
          is_letter_head: false,
          paper: "A4",
          unit: "cm",
          orientation: "portrait",
          width: 21,
          height: 29.7,
        },
      });

      const paperSelect = getSelectInField("core.printTemplate.columns.paper");
      await user.selectOptions(paperSelect, "Letter");

      // Letter: width 215.9mm / conversion_factor(cm=10) = 21.59
      const widthInput = getNumberInputInField(
        "core.printTemplate.columns.width",
      );
      const heightInput = getNumberInputInField(
        "core.printTemplate.columns.height",
      );
      expect(Number(widthInput.value)).toBeCloseTo(21.59, 2);
      expect(Number(heightInput.value)).toBeCloseTo(27.94, 2);
    });

    it("memilih paper='custom' TIDAK mengubah width/height (dipertahankan dari state sebelumnya)", async () => {
      const user = userEvent.setup({ delay: null });
      await renderForm({
        initialData: {
          is_letter_head: false,
          paper: "A4",
          unit: "cm",
          orientation: "portrait",
          width: 21,
          height: 29.7,
        },
      });

      const paperSelect = getSelectInField("core.printTemplate.columns.paper");
      await user.selectOptions(paperSelect, "custom");

      const widthInput = getNumberInputInField(
        "core.printTemplate.columns.width",
      );
      const heightInput = getNumberInputInField(
        "core.printTemplate.columns.height",
      );
      expect(Number(widthInput.value)).toBeCloseTo(21, 2);
      expect(Number(heightInput.value)).toBeCloseTo(29.7, 2);
    });

    it("orientation=landscape menukar posisi width/height saat memilih paper baru", async () => {
      const user = userEvent.setup({ delay: null });
      await renderForm({
        initialData: {
          is_letter_head: false,
          paper: "A4",
          unit: "cm",
          orientation: "landscape",
          width: 29.7,
          height: 21,
        },
      });

      const paperSelect = getSelectInField("core.printTemplate.columns.paper");
      await user.selectOptions(paperSelect, "A5");

      // A5: width 148mm/10=14.8, height 210mm/10=21 -- landscape menukar
      // width<->height dari hasil kalkulasi widthOri/heightOri.
      const widthInput = getNumberInputInField(
        "core.printTemplate.columns.width",
      );
      const heightInput = getNumberInputInField(
        "core.printTemplate.columns.height",
      );
      expect(Number(widthInput.value)).toBeCloseTo(21, 2);
      expect(Number(heightInput.value)).toBeCloseTo(14.8, 2);
    });
  });

  describe("kalkulasi orientation", () => {
    it("mengganti orientation menukar nilai width & height", async () => {
      const user = userEvent.setup({ delay: null });
      await renderForm({
        initialData: {
          is_letter_head: false,
          orientation: "portrait",
          width: 21,
          height: 29.7,
        },
      });

      const orientationSelect = getSelectInField(
        "core.printTemplate.columns.orientation",
      );
      await user.selectOptions(orientationSelect, "landscape");

      const widthInput = getNumberInputInField(
        "core.printTemplate.columns.width",
      );
      const heightInput = getNumberInputInField(
        "core.printTemplate.columns.height",
      );
      expect(Number(widthInput.value)).toBeCloseTo(29.7, 2);
      expect(Number(heightInput.value)).toBeCloseTo(21, 2);
    });
  });

  describe("kalkulasi unit (konversi width/height/margin)", () => {
    it("mengganti unit dari cm ke mm mengalikan width/height/margin dengan rasio conversion_factor", async () => {
      const user = userEvent.setup({ delay: null });
      await renderForm({
        initialData: {
          is_letter_head: false,
          paper: "custom",
          unit: "cm",
          width: 10,
          height: 20,
          margin_top: 1,
          margin_bottom: 1,
          margin_left: 1,
          margin_right: 1,
          last_conversion_factor: 10,
        },
      });

      const unitSelect = getSelectInField("core.printTemplate.columns.unit");
      await user.selectOptions(unitSelect, "mm");

      // cm(10) -> mm(1): rasio 10/1 = 10x untuk width/height/margin (paper
      // custom memakai jalur width * (last/curr)).
      expect(
        Number(getNumberInputInField("core.printTemplate.columns.width").value),
      ).toBeCloseTo(100, 2);
      expect(
        Number(
          getNumberInputInField("core.printTemplate.columns.height").value,
        ),
      ).toBeCloseTo(200, 2);
      expect(
        Number(
          getNumberInputInField("core.printTemplate.columns.margin_top").value,
        ),
      ).toBeCloseTo(10, 2);
    });

    it("mengganti unit dengan paper preset (bukan custom) menghitung width/height dari paperSize baru", async () => {
      const user = userEvent.setup({ delay: null });
      await renderForm({
        initialData: {
          is_letter_head: false,
          paper: "A4",
          unit: "cm",
          width: 21,
          height: 29.7,
          margin_top: 0,
          margin_bottom: 0,
          margin_left: 0,
          margin_right: 0,
          last_conversion_factor: 10,
        },
      });

      const unitSelect = getSelectInField("core.printTemplate.columns.unit");
      await user.selectOptions(unitSelect, "in");

      // A4 width 210mm / conversion_factor(in=25.4) = 8.267...
      expect(
        Number(getNumberInputInField("core.printTemplate.columns.width").value),
      ).toBeCloseTo(8.27, 1);
    });
  });

  describe("kalkulasi width/height manual & auto-switch ke paper=custom", () => {
    it("mengubah width secara manual (beda dari paperSize aktif) mengubah paper jadi custom", async () => {
      const user = userEvent.setup({ delay: null });
      await renderForm({
        initialData: {
          is_letter_head: false,
          paper: "A4",
          unit: "cm",
          orientation: "portrait",
          width: 21,
          height: 29.7,
        },
      });

      const widthInput = getNumberInputInField(
        "core.printTemplate.columns.width",
      );
      await user.clear(widthInput);
      await user.type(widthInput, "15");

      const paperSelect = getSelectInField("core.printTemplate.columns.paper");
      expect(paperSelect.value).toBe("custom");
    });

    it("width lebih besar dari height mengubah orientation jadi landscape", async () => {
      const user = userEvent.setup({ delay: null });
      await renderForm({
        initialData: {
          is_letter_head: false,
          paper: "custom",
          unit: "cm",
          orientation: "portrait",
          width: 10,
          height: 20,
        },
      });

      const widthInput = getNumberInputInField(
        "core.printTemplate.columns.width",
      );
      await user.clear(widthInput);
      await user.type(widthInput, "25");

      const orientationSelect = getSelectInField(
        "core.printTemplate.columns.orientation",
      );
      expect(orientationSelect.value).toBe("landscape");
    });

    it("height >= width membuat orientation portrait", async () => {
      const user = userEvent.setup({ delay: null });
      await renderForm({
        initialData: {
          is_letter_head: false,
          paper: "custom",
          unit: "cm",
          orientation: "landscape",
          width: 20,
          height: 10,
        },
      });

      const heightInput = getNumberInputInField(
        "core.printTemplate.columns.height",
      );
      await user.clear(heightInput);
      await user.type(heightInput, "25");

      const orientationSelect = getSelectInField(
        "core.printTemplate.columns.orientation",
      );
      expect(orientationSelect.value).toBe("portrait");
    });
  });

  describe("fontOptions (dedup case-insensitive)", () => {
    it("menggabungkan font_family aktif dengan daftar font dari getFonts tanpa duplikat (case-insensitive)", async () => {
      getFontsMock.mockResolvedValue(["times new roman", "Calibri"]);
      await renderForm({
        initialData: { is_letter_head: false, font_family: "Times New Roman" },
      });

      // Tunggu useEffect getFonts selesai dan opsi Calibri muncul (scope ke
      // field font_family supaya tidak collision dgn <option> field lain).
      await screen.findByText("Calibri");
      const fontSelect = getSelectInField(
        "core.printTemplate.columns.font_family",
      );

      const optionTexts = Array.from(fontSelect.querySelectorAll("option"))
        .map((o) => o.textContent)
        .filter(Boolean);

      // "Times New Roman" (dari data.font_family) tidak boleh duplikat
      // dengan "times new roman" (dari getFonts) -- hanya versi pertama
      // (data.font_family) yang dipertahankan.
      const timesVariants = optionTexts.filter(
        (t) => t.toLowerCase() === "times new roman",
      );
      expect(timesVariants).toEqual(["Times New Roman"]);
      expect(optionTexts).toContain("Calibri");
    });

    it("font_family kosong/whitespace tidak masuk ke opsi (filter Boolean+trim)", async () => {
      getFontsMock.mockResolvedValue(["Arial"]);
      await renderForm({
        initialData: { is_letter_head: false, font_family: "   " },
      });

      await screen.findByText("Arial");
      const fontSelect = getSelectInField(
        "core.printTemplate.columns.font_family",
      );

      const optionTexts = Array.from(fontSelect.querySelectorAll("option"))
        .map((o) => o.textContent)
        .filter(Boolean);
      expect(optionTexts).not.toContain("   ");
    });
  });

  describe("show_absolute_values", () => {
    it("checkbox show_absolute_values memanggil setData saat diklik", async () => {
      const user = userEvent.setup({ delay: null });
      await renderForm({
        initialData: { is_letter_head: false, show_absolute_values: false },
      });

      // role="forminput" (bukan "checkbox" native), lihat catatan di
      // FormCheckbox (Components/ui/checkbox.jsx).
      const checkbox = screen.getByRole("forminput", {
        name: /show_absolute_values/i,
      });
      await user.click(checkbox);

      // Setelah diklik, checkbox re-render dengan checked=true (state
      // benar-benar berubah lewat setData context nyata).
      expect(checkbox).toHaveAttribute("data-state", "checked");
    });
  });
});
