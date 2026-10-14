import { describe, expect, it } from "vitest";

import {
  buildPrintLayoutCss,
  PRINT_TEMPLATE_SCOPES,
  scopeTemplateCss,
  scopeTemplateHtml,
} from "./printTemplateRender";

describe("printTemplateRender", () => {
  it("hanya mengganti root body tanpa merusak tbody atau teks", () => {
    const html =
      '<body id="root"><table><tbody><tr><td>body</td></tr></tbody></table></body>';

    expect(scopeTemplateHtml(html, PRINT_TEMPLATE_SCOPES.template)).toBe(
      '<section id="root" class="pt-scope pt-scope--template"><table><tbody><tr><td>body</td></tr></tbody></table></section>',
    );
  });

  it("mengganti body pada template HTML lengkap", () => {
    expect(
      scopeTemplateHtml(
        '<html><body class="legacy"><tbody><tr><td>body</td></tr></tbody></body></html>',
        PRINT_TEMPLATE_SCOPES.template,
      ),
    ).toBe(
      '<html><section class="legacy pt-scope pt-scope--template"><tbody><tr><td>body</td></tr></tbody></section></html>',
    );
  });

  it("mengisolasi selector tanpa mengubah string atau nama class", () => {
    const css =
      'body .items-table, .note-body { color: red; content: "body"; }';

    expect(scopeTemplateCss(css, PRINT_TEMPLATE_SCOPES.template)).toBe(
      '.pt-scope--template .items-table,.pt-scope--template .note-body{ color: red; content: "body"; }',
    );
  });

  it("mempertahankan token body di dalam komentar CSS", () => {
    expect(
      scopeTemplateCss(
        "/* body */ body .items { color: red; }",
        PRINT_TEMPLATE_SCOPES.template,
      ),
    ).toBe("/* body */ .pt-scope--template .items{ color: red; }");
  });

  describe("buildPrintLayoutCss", () => {
    const template = {
      unit: "cm",
      font_family: "Arial",
      width: 21,
      height: 29.7,
      margin_top: 1,
      margin_right: 2,
      margin_bottom: 3,
      margin_left: 4,
    };

    it("menghasilkan aturan font ter-scope di .pt-scope", () => {
      expect(buildPrintLayoutCss(template)).toContain(
        ".pt-scope { font-family: 'Arial', sans-serif; }",
      );
    });

    it("mempertahankan margin di body dan tidak memindahkannya ke .pt-scope", () => {
      const css = buildPrintLayoutCss(template);
      const scopeRule = css.match(/\.pt-scope \{[^}]*\}/)[0];

      expect(css).toContain(
        "body { font-family: 'Arial', sans-serif; margin: 1cm 2cm 3cm 4cm; }",
      );
      expect(scopeRule).not.toContain("margin");
    });

    it("aturan font kalah-menang: spesifisitas sama dengan scope template dan dipasang belakangan", () => {
      const templateCss = scopeTemplateCss(
        "body { font-family: Arial, Helvetica, sans-serif; }",
        PRINT_TEMPLATE_SCOPES.template,
      );
      const combined =
        templateCss +
        buildPrintLayoutCss({ ...template, font_family: "Courier New" });

      expect(templateCss).toContain(".pt-scope--template");
      expect(
        combined.lastIndexOf(".pt-scope { font-family: 'Courier New'"),
      ).toBeGreaterThan(combined.indexOf(".pt-scope--template"));
    });

    it("font_family null jatuh ke sans-serif tanpa memalsukan Times New Roman", () => {
      const css = buildPrintLayoutCss({ ...template, font_family: null });

      expect(css).toContain(".pt-scope { font-family: sans-serif; }");
      expect(css).not.toContain("Times New Roman");
    });
  });
});
