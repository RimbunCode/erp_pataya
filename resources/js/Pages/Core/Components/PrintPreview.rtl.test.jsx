import { describe, expect, it, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import React from "react";

// t harus stabil -- source PrintPreview.jsx pakai `t` di dependency array
// useMemo `doc` & `{ html, css }`. Mock naif yang membuat fungsi baru tiap
// panggil useLaravelReactI18n() akan membuat useMemo itu re-run terus
// (walau bukan infinite loop krn tidak ada setState di useMemo, tapi bikin
// referensi `doc`/`html` berubah tiap render -- berpotensi flaky pada efek
// lain yang depend on `html`/`css`). setLocale juga harus stabil karena
// dipanggil dari dalam useEffect.
const stableT = (key) => `TR:${key}`;
const setLocaleMock = vi.fn();
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT, setLocale: setLocaleMock }),
}));

const usePageMock = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
}));

// getCurrencyConfig melakukan axios call (getDataModel) + localStorage cache
// -- di luar scope wrapper PrintPreview, stub agar test fokus ke logic
// PrintPreview sendiri (kapan dipanggil, bagaimana hasilnya dipakai).
const getCurrencyConfigMock = vi.fn();
vi.mock("@/Components/NumberInput/getCurrencyConfig", () => ({
  getCurrencyConfig: (...a) => getCurrencyConfigMock(...a),
}));

// initHandlebar meregister helper Handlebars global -- tidak perlu diuji
// ulang di sini (bukan tanggung jawab PrintPreview), stub agar no-op.
vi.mock("@/lib/initHandlebar", () => ({
  initHandlebar: vi.fn(),
}));

import PrintPreview from "./PrintPreview";

const baseTemplate = {
  model: "App\\Models\\Sales\\SalesOrder",
  default_language: "en",
  html: "<div class='content'>{{doc.number}}</div>",
  css: ".content{color:red;}",
  is_letter_head: false,
  letter_head: null,
  unit: "cm",
  width: 21,
  height: 29.7,
  margin_top: 1,
  margin_right: 1,
  margin_bottom: 1,
  margin_left: 1,
  font_family: "Arial",
  page_number: "hide",
  show_absolute_values: false,
};

function setPageProps({
  doc = { number: "SO-001" },
  columns = {},
  docInfo = {},
  preferences = { default_currency_id: "IDR" },
  document = { id: 1 },
} = {}) {
  usePageMock.mockReturnValue({
    props: { doc, columns, docInfo, preferences, document },
  });
}

beforeEach(() => {
  getCurrencyConfigMock.mockReset();
  getCurrencyConfigMock.mockResolvedValue({ symbol: "Rp" });
  setLocaleMock.mockReset();
  setPageProps();
});

function renderPrintPreview(template = baseTemplate) {
  const ref = React.createRef();
  const utils = render(<PrintPreview ref={ref} template={template} />);
  return { ...utils, ref };
}

describe("PrintPreview", () => {
  it("merender sebuah iframe dengan data-role print-preview", () => {
    const { container } = renderPrintPreview();
    const iframe = container.querySelector('iframe[data-role="print-preview"]');
    expect(iframe).toBeInTheDocument();
  });

  it("memanggil setLocale sesuai template.default_language", () => {
    renderPrintPreview({ ...baseTemplate, default_language: "id" });
    expect(setLocaleMock).toHaveBeenCalledWith("id");
  });

  it("default_language kosong fallback ke 'en' untuk setLocale", () => {
    renderPrintPreview({ ...baseTemplate, default_language: undefined });
    expect(setLocaleMock).toHaveBeenCalledWith("en");
  });

  it("menulis hasil compile Handlebars (data doc) ke dalam iframe body", async () => {
    const { ref } = renderPrintPreview();

    await vi.waitFor(() => {
      const body = ref.current.contentDocument.body;
      expect(body.innerHTML).toContain("SO-001");
    });
  });

  it("menyuntikkan <style> print-preview ke iframe head dengan ukuran halaman template", async () => {
    const { ref } = renderPrintPreview();

    await vi.waitFor(() => {
      const style = ref.current.contentDocument.head.querySelector(
        "style#print-preview-style",
      );
      expect(style).toBeTruthy();
      expect(style.innerHTML).toContain("21cm 29.7cm");
    });
  });

  it("menambahkan <link> Bootstrap CSS ke iframe head", async () => {
    const { ref } = renderPrintPreview();

    await vi.waitFor(() => {
      const link = ref.current.contentDocument.getElementById(
        "bootstrap-css-link",
      );
      expect(link).toBeTruthy();
      expect(link.getAttribute("href")).toContain("bootstrap");
    });
  });

  it("mengatur iframe.style.width/minHeight sesuai template width/height + unit", async () => {
    const { ref } = renderPrintPreview();

    await vi.waitFor(() => {
      expect(ref.current.style.width).toBe("21cm");
      expect(ref.current.style.minHeight).toBe("29.7cm");
    });
  });

  it("memanggil getCurrencyConfig untuk default_currency_id preferences", async () => {
    renderPrintPreview();

    await vi.waitFor(() => {
      expect(getCurrencyConfigMock).toHaveBeenCalledWith("IDR", "IDR");
    });
  });

  it("tidak memanggil getCurrencyConfig saat tidak ada kolom currency & default_currency_id kosong", () => {
    setPageProps({ preferences: {} });
    renderPrintPreview();

    expect(getCurrencyConfigMock).not.toHaveBeenCalled();
  });

  it("format tanggal pada doc menggunakan kolom bertipe date dari columns", async () => {
    setPageProps({
      doc: { delivery_date: "2026-01-15T00:00:00.000Z" },
      columns: {
        "App\\Models\\Sales\\SalesOrder": {
          delivery_date: { type: "date" },
        },
      },
    });
    const { ref } = renderPrintPreview({
      ...baseTemplate,
      html: "<div>{{doc.delivery_date}}</div>",
    });

    await vi.waitFor(() => {
      const body = ref.current.contentDocument.body;
      // format "PPP" -> contoh "January 15th, 2026" (locale default en, tanpa getLocaleDate khusus)
      expect(body.innerHTML).toMatch(/2026/);
    });
  });

  it("halaman huruf kepala (letter head) ikut di-compile ke html saat is_letter_head=false dan letter_head tersedia", async () => {
    const { ref } = renderPrintPreview({
      ...baseTemplate,
      letter_head: {
        html: "<body class='lh'>LETTERHEAD-MARK</body>",
        css: "body{background:blue;}",
      },
    });

    await vi.waitFor(() => {
      const body = ref.current.contentDocument.body;
      expect(body.innerHTML).toContain("LETTERHEAD-MARK");
    });
  });

  it("page_number != 'hide' menghasilkan aturan @page counter pada style", async () => {
    const { ref } = renderPrintPreview({
      ...baseTemplate,
      page_number: "bottom_center",
      page_number_format: ":page / :total",
    });

    await vi.waitFor(() => {
      const style = ref.current.contentDocument.head.querySelector(
        "style#print-preview-style",
      );
      expect(style.innerHTML).toContain("@bottom-center");
      expect(style.innerHTML).toContain("counter(page)");
    });
  });
});
