import { describe, it, expect } from "vitest";
import { sanitizeHTML } from "./htmlSanitizer";

describe("sanitizeHTML", () => {
  it("return kosong untuk input kosong/whitespace", () => {
    expect(sanitizeHTML("")).toEqual({
      sanitizedHTML: "",
      warnings: [],
      removedTags: [],
      removedAttributes: [],
    });
    expect(sanitizeHTML("   ")).toEqual({
      sanitizedHTML: "",
      warnings: [],
      removedTags: [],
      removedAttributes: [],
    });
  });

  it("meloloskan tag & atribut yang di-whitelist tanpa perubahan", () => {
    const result = sanitizeHTML('<p class="text">Hello</p>');
    expect(result.sanitizedHTML).toBe('<p class="text">Hello</p>');
    expect(result.removedTags).toEqual([]);
    expect(result.removedAttributes).toEqual([]);
  });

  it("menghapus tag berbahaya (script)", () => {
    const result = sanitizeHTML("<p>Hi</p><script>alert(1)</script>");
    expect(result.sanitizedHTML).not.toContain("<script>");
    expect(result.removedTags).toContain("script");
    expect(result.warnings.some((w) => w.includes("script"))).toBe(true);
  });

  it("menghapus tag yang tidak ada di whitelist (mis. iframe)", () => {
    const result = sanitizeHTML('<iframe src="evil.com"></iframe>');
    expect(result.sanitizedHTML).not.toContain("<iframe");
    expect(result.removedTags).toContain("iframe");
  });

  it("menghapus atribut event handler (onclick dkk)", () => {
    const result = sanitizeHTML('<p onclick="alert(1)">Hi</p>');
    expect(result.sanitizedHTML).not.toContain("onclick");
    expect(result.removedAttributes).toContain("onclick");
  });

  it("menghapus atribut yang tidak di-whitelist", () => {
    const result = sanitizeHTML('<p data-evil="x">Hi</p>');
    expect(result.sanitizedHTML).not.toContain("data-evil");
    expect(result.removedAttributes).toContain("data-evil");
  });

  it("menolak href dengan javascript: protocol", () => {
    const result = sanitizeHTML('<a href="javascript:alert(1)">click</a>');
    expect(result.sanitizedHTML).not.toContain("javascript:");
    expect(result.removedAttributes).toContain("href");
  });

  it("menolak src dengan data:...script", () => {
    const result = sanitizeHTML('<img src="data:text/html;base64,script">');
    expect(result.removedAttributes).toContain("src");
  });

  it("meloloskan href relatif dan http(s)/mailto/tel yang aman", () => {
    const relative = sanitizeHTML('<a href="/path">link</a>');
    expect(relative.sanitizedHTML).toContain('href="/path"');

    const https = sanitizeHTML('<a href="https://example.com">link</a>');
    expect(https.sanitizedHTML).toContain('href="https://example.com"');

    const mailto = sanitizeHTML('<a href="mailto:a@b.com">mail</a>');
    expect(mailto.sanitizedHTML).toContain('href="mailto:a@b.com"');
  });

  it("memproses nested children secara rekursif", () => {
    const result = sanitizeHTML(
      '<div><p>ok</p><script>bad()</script><span onclick="x()">text</span></div>',
    );
    expect(result.sanitizedHTML).not.toContain("<script>");
    expect(result.sanitizedHTML).not.toContain("onclick");
    expect(result.sanitizedHTML).toContain("<p>ok</p>");
    expect(result.sanitizedHTML).toContain("text");
  });

  it("mengumpulkan removedTags/removedAttributes tanpa duplikat", () => {
    const result = sanitizeHTML("<script>a</script><script>b</script>");
    expect(result.removedTags).toEqual(["script"]);
  });
});
