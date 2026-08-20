import { describe, expect, it } from "vitest";
import {
  dotPathToMergeTagToken,
  sanitizeProseMirrorJSON,
} from "./TiptapEditor";

describe("dotPathToMergeTagToken", () => {
  it("mengonversi dot-path jadi Blade-style arrow accessor", () => {
    expect(dotPathToMergeTagToken("doc.customer.name")).toBe(
      "{{ $doc->customer->name }}",
    );
  });

  it("path 1 segmen tanpa dot tetap valid", () => {
    expect(dotPathToMergeTagToken("doc")).toBe("{{ $doc }}");
  });
});

describe("sanitizeProseMirrorJSON", () => {
  it("membuang text node dengan text:null dari content", () => {
    const node = {
      type: "doc",
      content: [
        { type: "text", text: "Halo" },
        { type: "text", text: null },
      ],
    };
    const result = sanitizeProseMirrorJSON(node);
    expect(result.content).toEqual([{ type: "text", text: "Halo" }]);
  });

  it("membersihkan secara rekursif di semua level nested content", () => {
    const node = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "A" },
            { type: "text", text: null },
            { type: "mention", attrs: { id: "x" } },
          ],
        },
      ],
    };
    const result = sanitizeProseMirrorJSON(node);
    expect(result.content[0].content).toEqual([
      { type: "text", text: "A" },
      { type: "mention", attrs: { id: "x" } },
    ]);
  });

  it("node tanpa content dikembalikan apa adanya", () => {
    const node = { type: "text", text: "Halo" };
    expect(sanitizeProseMirrorJSON(node)).toBe(node);
  });

  it("null/undefined/non-object dikembalikan apa adanya", () => {
    expect(sanitizeProseMirrorJSON(null)).toBeNull();
    expect(sanitizeProseMirrorJSON(undefined)).toBeUndefined();
  });

  it("mempertahankan node non-text dengan text:null (bukan text node)", () => {
    const node = {
      type: "doc",
      content: [{ type: "mention", text: null, attrs: { id: "x" } }],
    };
    const result = sanitizeProseMirrorJSON(node);
    expect(result.content).toHaveLength(1);
  });
});
