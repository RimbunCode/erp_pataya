import { describe, expect, it, vi, beforeEach } from "vitest";
import { render as rtlRender, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

// t harus stabil -- Print.jsx pakai `t` di dependency array useCallback
// handleDownloadPdf (baris 148 source). Mock naif yang membuat fungsi baru
// tiap panggil useLaravelReactI18n() akan membuat handleDownloadPdf
// re-create terus (bukan infinite loop, tapi berpotensi flaky pada efek
// lain yang depend on referensi callback itu).
const stableT = (key) => `TR:${key}`;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
  LaravelReactI18nProvider: ({ children }) => children,
}));

// useForm di-mock dengan implementasi minimal yang meniru kontrak Inertia:
// { data, setData } -- setData mendukung dua bentuk pemanggilan yang dipakai
// Print.jsx: setData(key, value) DAN setData(updaterFn) (functional update,
// dipakai di handler paper/orientation/unit/width/height).
const usePageMock = vi.fn();
vi.mock("@inertiajs/react", () => ({
  Head: ({ title }) => <title>{title}</title>,
  usePage: () => usePageMock(),
  useForm: () => {
    throw new Error(
      "useForm harus di-override per-test via mockUseForm agar state bisa diobservasi",
    );
  },
}));

const toastError = vi.fn();
vi.mock("@/lib/gooeyToast", () => ({
  gooeyToast: { error: (...a) => toastError(...a) },
}));

// FormInput/FormCheckbox (dipakai apa adanya di test ini, bukan di-stub)
// bergantung pada useFormPage/useFormPageMeta dari FormPage.jsx (file besar,
// 2200+ baris) -- di-mock minimal supaya FormInput/FormCheckbox/useCanUpdate
// berjalan di mode "tanpa form context" (default: bisa update, tanpa error,
// tanpa dataBefore/diff).
vi.mock("@/Pages/Core/FormPage", () => ({
  useFormPage: () => undefined,
  useFormPageMeta: () => undefined,
  FormPageContext: React.createContext(undefined),
}));

// AppLayout membungkus Navbar/Sidebar/GlobalCommandPalette penuh (di luar
// scope test halaman Print) -- stub jadi passthrough agar test fokus ke
// konten Print.jsx sendiri.
vi.mock("@/Layouts/AppLayout", () => ({
  default: ({ children, className }) => (
    <div data-testid="app-layout" className={className}>
      {children}
    </div>
  ),
}));

// PrintPreview (komponen anak) SUDAH ditest sendiri di
// Components/PrintPreview.rtl.test.jsx -- di sini cukup di-stub sebagai anak
// yang menerima props `template`, expose ref kosong (Print.jsx memanggil
// frame.current?.contentDocument / frame.current?.contentWindow.print()).
vi.mock("./Components/PrintPreview", () => ({
  default: React.forwardRef(function PrintPreviewStub({ template }, ref) {
    return (
      <div
        data-testid="print-preview-stub"
        data-template={JSON.stringify(template)}
        ref={ref}
      />
    );
  }),
}));

// LinkModel (picker letter_head) -- komponen berat (axios, FormPageDialog,
// dll), bukan bagian yang diuji Print.jsx sendiri. Stub jadi tombol
// sederhana yang memanggil onValueChange.
vi.mock("@/Components/LinkModel", () => ({
  default: ({ value, onValueChange }) => (
    <button
      type="button"
      data-testid="link-model-stub"
      onClick={() => onValueChange?.(99)}
    >
      LinkModel:{String(value ?? "")}
    </button>
  ),
}));

// NumberInput (width/height/margin) -- bergantung ke usePage/useCurrency
// yang di luar scope test ini. Stub jadi <input type="number"> biasa yang
// tetap meneruskan onValueChange dengan angka (kontrak yang dipakai
// Print.jsx: onValueChange(val) dengan val berupa number).
vi.mock("@/Components/NumberInput", () => ({
  default: React.forwardRef(function NumberInputStub(
    { value, onValueChange, disabled, ...props },
    ref,
  ) {
    return (
      <input
        ref={ref}
        type="number"
        disabled={disabled}
        value={value ?? ""}
        onChange={(e) => {
          const val = e.target.value === "" ? null : Number(e.target.value);
          onValueChange?.(val);
        }}
        {...props}
      />
    );
  }),
}));

// Link (tombol "edit template") -- pakai router dari @inertiajs/core
// (BUKAN @inertiajs/react), lihat catatan pada Tags.rtl.test.jsx. Stub jadi
// <a> biasa supaya klik tidak memicu router.visit asli Inertia.
vi.mock("@/Components/Link", () => ({
  default: ({ href, children, ...props }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import Print from "./Print";
import { TooltipProvider } from "@/Components/ui/tooltip";
import * as InertiaReact from "@inertiajs/react";

function render(ui) {
  return rtlRender(<TooltipProvider>{ui}</TooltipProvider>);
}

/**
 * Setup useForm mock agar `data`/`setData` benar-benar reaktif (pakai
 * useState React sungguhan di dalam komponen Print), meniru kontrak
 * @inertiajs/react useForm({ data, setData }). Harus dipanggil sebelum
 * render karena vi.mock di atas untuk "@inertiajs/react" melempar error
 * bila useForm dipakai tanpa override ini.
 */
function mockUseForm() {
  InertiaReact.useForm = (initial) => {
    const [data, setDataState] = React.useState(initial);
    const setData = (keyOrFn, maybeValue) => {
      if (typeof keyOrFn === "function") {
        setDataState((prev) => keyOrFn(prev));
        return;
      }
      setDataState((prev) => ({ ...prev, [keyOrFn]: maybeValue }));
    };
    return { data, setData };
  };
}

function setPageProps({ doc = { id: 1, code: "PO-001" }, lang = "en" } = {}) {
  usePageMock.mockReturnValue({ props: { doc, lang } });
}

function getTemplateFromPreview() {
  const stub = screen.getByTestId("print-preview-stub");
  return JSON.parse(stub.getAttribute("data-template"));
}

// Banyak field FormInput di Print.jsx berstatus `required` -- Label
// merender teks tambahan "*" di <span> terpisah setelah label text (lihat
// FormInput.jsx: `{label} {_required && <span>*</span>}`), sehingga
// textContent Label lengkap adalah "TR:...columns.paper *", bukan persis
// sama dengan key terjemahannya. getByLabelText perlu exact:false (substring
// match) supaya tetap ketemu tanpa test harus tahu detail asterisk itu.
function getSelectInputByLabel(labelText) {
  return screen.getByLabelText(labelText, {
    selector: "input",
    exact: false,
  });
}

beforeEach(() => {
  toastError.mockReset();
  mockUseForm();
  setPageProps();
  window.axios = { post: vi.fn() };
  window.route = Object.assign(
    (name, params) =>
      params !== undefined ? `${name}/${JSON.stringify(params)}` : name,
    {
      current: () => "printTemplates.print",
    },
  );
});

describe("Print - initialTemplate (useMemo)", () => {
  it("fallback lengkap saat printTemplate kosong: paper A4, unit cm, orientation portrait, width/height dari A4/cm", () => {
    render(<Print printTemplate={{}} lang="en" />);

    const template = getTemplateFromPreview();
    expect(template.paper).toBe("A4");
    expect(template.unit).toBe("cm");
    expect(template.orientation).toBe("portrait");
    expect(template.default_language).toBe("en");
    expect(template.page_number).toBe("bottom_right");
    expect(template.font_family).toBe("Times New Roman");
    // A4 portrait: width 210mm/10 = 21cm, height 297mm/10 = 29.7cm
    expect(template.width).toBeCloseTo(21);
    expect(template.height).toBeCloseTo(29.7);
    expect(template.last_conversion_factor).toBe(10);
  });

  it("orientation landscape menukar width/height dari basis portrait paper", () => {
    render(
      <Print
        printTemplate={{ paper: "A4", unit: "cm", orientation: "landscape" }}
        lang="en"
      />,
    );

    const template = getTemplateFromPreview();
    expect(template.orientation).toBe("landscape");
    // landscape: width jadi portraitHeight, height jadi portraitWidth
    expect(template.width).toBeCloseTo(29.7);
    expect(template.height).toBeCloseTo(21);
  });

  it("orientation selain 'landscape' dinormalisasi ke 'portrait'", () => {
    render(
      <Print
        printTemplate={{
          paper: "A4",
          unit: "cm",
          orientation: "invalid-value",
        }}
        lang="en"
      />,
    );

    expect(getTemplateFromPreview().orientation).toBe("portrait");
  });

  it("paper tidak dikenal fallback ke metrik A4", () => {
    render(
      <Print
        printTemplate={{
          paper: "UnknownPaper",
          unit: "mm",
          orientation: "portrait",
        }}
        lang="en"
      />,
    );

    const template = getTemplateFromPreview();
    // A4 mm: width 210, height 297 (conversion_factor mm = 1)
    expect(template.width).toBeCloseTo(210);
    expect(template.height).toBeCloseTo(297);
  });

  it("unit tidak dikenal fallback conversion_factor 1 (setara mm)", () => {
    render(
      <Print
        printTemplate={{
          paper: "A4",
          unit: "unknown-unit",
          orientation: "portrait",
        }}
        lang="en"
      />,
    );

    const template = getTemplateFromPreview();
    expect(template.last_conversion_factor).toBe(1);
    expect(template.width).toBeCloseTo(210);
    expect(template.height).toBeCloseTo(297);
  });

  it("width/height/default_language/page_number/font_family eksplisit di printTemplate TIDAK ditimpa fallback", () => {
    render(
      <Print
        printTemplate={{
          paper: "A4",
          unit: "cm",
          orientation: "portrait",
          width: 99,
          height: 88,
          default_language: "id",
          page_number: "top_left",
          font_family: "Courier New",
          last_conversion_factor: 5,
        }}
        lang="en"
      />,
    );

    const template = getTemplateFromPreview();
    expect(template.width).toBe(99);
    expect(template.height).toBe(88);
    expect(template.default_language).toBe("id");
    expect(template.page_number).toBe("top_left");
    expect(template.font_family).toBe("Courier New");
    expect(template.last_conversion_factor).toBe(5);
  });

  it("default_language fallback ke prop `lang` saat printTemplate.default_language kosong", () => {
    render(<Print printTemplate={{}} lang="id" />);
    expect(getTemplateFromPreview().default_language).toBe("id");
  });

  it("default_language fallback ke 'en' saat printTemplate DAN lang kosong", () => {
    render(<Print printTemplate={{}} lang={undefined} />);
    expect(getTemplateFromPreview().default_language).toBe("en");
  });

  it("F4 portrait cm menghasilkan width 21 height 33 (210x330mm / 10)", () => {
    render(
      <Print
        printTemplate={{ paper: "F4", unit: "cm", orientation: "portrait" }}
        lang="en"
      />,
    );

    const template = getTemplateFromPreview();
    expect(template.width).toBeCloseTo(21);
    expect(template.height).toBeCloseTo(33);
  });
});

describe("Print - render dasar", () => {
  it("merender judul halaman print preview", () => {
    setPageProps({ doc: { id: 1, code: "PO-001" } });
    render(<Print printTemplate={{}} lang="en" />);

    expect(screen.getByText("TR:core.form.print_preview")).toBeInTheDocument();
  });

  it("merender PrintPreview stub dengan template yang sudah dihitung", () => {
    render(<Print printTemplate={{}} lang="en" />);
    expect(screen.getByTestId("print-preview-stub")).toBeInTheDocument();
  });

  it("tombol edit template mengarah ke route printTemplates.editor dengan id template", () => {
    render(<Print printTemplate={{ id: 42 }} lang="en" />);

    const link = screen.getByText("TR:core.form.edit_template").closest("a");
    expect(link).toHaveAttribute("href", "printTemplates.editor/42");
  });
});

describe("Print - handleDownloadPdf", () => {
  it("tombol download tidak disabled sebelum diklik (state awal isDownloadingPdf=false)", () => {
    render(<Print printTemplate={{ id: 1 }} lang="en" />);

    const button = screen
      .getByText("TR:core.form.download_pdf")
      .closest("button");
    expect(button).not.toBeDisabled();
  });

  it("klik tombol download TIDAK memanggil axios saat iframe belum ready (frame.current bukan iframe asli, contentDocument undefined)", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Print printTemplate={{ id: 1 }} lang="en" />);

    const button = screen
      .getByText("TR:core.form.download_pdf")
      .closest("button");
    await user.click(button);

    // handleDownloadPdf early-return karena frame.current?.contentDocument
    // falsy pada stub div -- axios.post tidak boleh terpanggil, dan tombol
    // tidak masuk mode "generating_pdf".
    expect(window.axios.post).not.toHaveBeenCalled();
    expect(
      screen.queryByText("TR:core.form.generating_pdf"),
    ).not.toBeInTheDocument();
  });
});

describe("Print - font_family options (fontOptions useMemo)", () => {
  it("Select font_family menampilkan opsi tanpa duplikat saat font_family template sama dengan salah satu DEFAULT_PRINT_FONTS", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <Print printTemplate={{ font_family: "Times New Roman" }} lang="en" />,
    );

    const fontInput = getSelectInputByLabel(
      "TR:core.printTemplate.columns.font_family",
    );
    await user.click(fontInput);

    // "Times New Roman" adalah font_family template SEKALIGUS anggota
    // DEFAULT_PRINT_FONTS -- fontOptions harus dedupe case-insensitive
    // sehingga command-item untuk "Times New Roman" hanya muncul SATU kali.
    const items = await screen.findAllByText("Times New Roman");
    // satu kemunculan sebagai command item dropdown (input pakai value
    // attribute, bukan text node, jadi tidak ikut dihitung getAllByText).
    expect(items.length).toBe(1);
  });

  it("font_family custom (di luar DEFAULT_PRINT_FONTS) ikut muncul sebagai opsi tambahan", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <Print printTemplate={{ font_family: "My Custom Font" }} lang="en" />,
    );

    const fontInput = getSelectInputByLabel(
      "TR:core.printTemplate.columns.font_family",
    );
    await user.click(fontInput);

    expect(await screen.findByText("My Custom Font")).toBeInTheDocument();
  });
});

describe("Print - kontrol paper/orientation/unit", () => {
  it("mengganti paper size memperbarui width/height sesuai metrik paper baru", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <Print
        printTemplate={{ paper: "A4", unit: "cm", orientation: "portrait" }}
        lang="en"
      />,
    );

    const paperInput = getSelectInputByLabel(
      "TR:core.printTemplate.columns.paper",
    );
    await user.click(paperInput);
    const option = await screen.findByText("A5");
    await user.click(option);

    const template = getTemplateFromPreview();
    expect(template.paper).toBe("A5");
    // A5 portrait cm: width 148/10 = 14.8, height 210/10 = 21
    expect(template.width).toBeCloseTo(14.8);
    expect(template.height).toBeCloseTo(21);
  });

  it("mengganti orientation menukar width dan height", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <Print
        printTemplate={{ paper: "A4", unit: "cm", orientation: "portrait" }}
        lang="en"
      />,
    );

    const beforeTemplate = getTemplateFromPreview();

    const orientationInput = getSelectInputByLabel(
      "TR:core.printTemplate.columns.orientation",
    );
    await user.click(orientationInput);
    const option = await screen.findByText(
      "TR:core.printTemplate.columns.orientation.options.landscape",
    );
    await user.click(option);

    const afterTemplate = getTemplateFromPreview();
    expect(afterTemplate.orientation).toBe("landscape");
    expect(afterTemplate.width).toBeCloseTo(beforeTemplate.height);
    expect(afterTemplate.height).toBeCloseTo(beforeTemplate.width);
  });

  it("mengganti unit mengonversi width/height/margin sesuai conversion_factor baru", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <Print
        printTemplate={{
          paper: "custom",
          unit: "cm",
          orientation: "portrait",
          width: 21,
          height: 29.7,
          margin_top: 1,
          margin_bottom: 1,
          margin_left: 1,
          margin_right: 1,
        }}
        lang="en"
      />,
    );

    const unitInput = getSelectInputByLabel(
      "TR:core.printTemplate.columns.unit",
    );
    await user.click(unitInput);
    const option = await screen.findByText("Millimeter");
    await user.click(option);

    const template = getTemplateFromPreview();
    expect(template.unit).toBe("mm");
    // cm (factor 10) -> mm (factor 1): width 21 * (10/1) = 210
    expect(template.width).toBeCloseTo(210);
    expect(template.height).toBeCloseTo(297);
    expect(template.margin_top).toBeCloseTo(10);
  });

  it("mengganti page_number ke selain 'hide' menampilkan field format nomor halaman", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <Print
        printTemplate={{
          paper: "A4",
          unit: "cm",
          orientation: "portrait",
          page_number: "hide",
        }}
        lang="en"
      />,
    );

    expect(
      screen.queryByLabelText(
        "TR:core.printTemplate.columns.page_number_format",
        { exact: false },
      ),
    ).not.toBeInTheDocument();

    const pageNumberInput = getSelectInputByLabel(
      "TR:core.printTemplate.columns.page_number",
    );
    await user.click(pageNumberInput);
    const option = await screen.findByText(
      "TR:core.printTemplate.columns.page_number.options.top_left",
    );
    await user.click(option);

    expect(
      screen.getByLabelText(
        "TR:core.printTemplate.columns.page_number_format",
        { exact: false },
      ),
    ).toBeInTheDocument();
  });

  it("mengganti width secara manual menandai paper jadi 'custom' dan menentukan orientation dari perbandingan width/height", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <Print
        printTemplate={{ paper: "A4", unit: "cm", orientation: "portrait" }}
        lang="en"
      />,
    );

    const widthInput = getSelectInputByLabel(
      "TR:core.printTemplate.columns.width",
    );
    await user.clear(widthInput);
    await user.type(widthInput, "50");

    const template = getTemplateFromPreview();
    expect(template.paper).toBe("custom");
    // width (50) > height (29.7) -> landscape
    expect(template.orientation).toBe("landscape");
  });

  it("checkbox show_absolute_values toggle memperbarui template", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Print printTemplate={{}} lang="en" />);

    // Checkbox.jsx menyetel role="forminput" secara eksplisit pada elemen
    // Radix CheckboxPrimitive.Root (menimpa role default "checkbox" dari
    // Radix) -- role "checkbox" TIDAK ada di accessibility tree, jadi query
    // harus lewat label FormCheckbox sendiri, bukan getByRole("checkbox").
    const checkbox = screen.getByLabelText(
      "TR:core.printTemplate.columns.show_absolute_values",
    );
    expect(checkbox).toHaveAttribute("aria-checked", "false");

    await user.click(checkbox);

    expect(getTemplateFromPreview().show_absolute_values).toBe(true);
  });

  it("mengganti letter_head lewat LinkModel stub memperbarui template.letter_head", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Print printTemplate={{}} lang="en" />);

    await user.click(screen.getByTestId("link-model-stub"));

    expect(getTemplateFromPreview().letter_head).toBe(99);
  });
});
