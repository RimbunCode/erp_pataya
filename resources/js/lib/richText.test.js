/**
 * Unit test untuk richText.js (richTextValue) — pure function, tanpa render komponen.
 *
 * richTextValue() menyediakan fallback nilai awal utk TiptapEditor dari field
 * rich-text block dashboard yang disimpan sebagai { json, html }, string HTML
 * lama, atau kosong (null/undefined).
 */

import { describe, it, expect } from "vitest";
import { richTextValue } from "./richText";

describe("richTextValue", () => {
  it("value null -> null", () => {
    expect(richTextValue(null)).toBeNull();
  });

  it("value undefined -> null", () => {
    expect(richTextValue(undefined)).toBeNull();
  });

  it("value string kosong -> null (falsy, bukan dikembalikan apa adanya)", () => {
    // "" falsy di JS, jadi masuk cabang `!value` sebelum sempat dicek typeof string.
    expect(richTextValue("")).toBeNull();
  });

  it("value string HTML biasa (data lama) dikembalikan apa adanya", () => {
    expect(richTextValue("<p>Halo dunia</p>")).toBe("<p>Halo dunia</p>");
  });

  it("value object dengan json -> mengembalikan json", () => {
    const json = { type: "doc", content: [] };
    expect(richTextValue({ json, html: "<p>fallback</p>" })).toBe(json);
  });

  it("value object hanya punya html (json tidak ada) -> fallback ke html", () => {
    expect(richTextValue({ html: "<p>dari seeding</p>" })).toBe(
      "<p>dari seeding</p>",
    );
  });

  it("value object json bernilai null eksplisit -> fallback ke html", () => {
    expect(richTextValue({ json: null, html: "<p>dari html</p>" })).toBe(
      "<p>dari html</p>",
    );
  });

  it("value object tanpa json maupun html -> null", () => {
    expect(richTextValue({})).toBeNull();
  });

  it("json berupa string kosong dianggap 'ada' oleh nullish coalescing, bukan fallback ke html", () => {
    // value.json ?? value.html hanya fallback saat json null/undefined,
    // BUKAN saat json falsy (mis. ""). Jadi html tidak terpakai di sini.
    expect(richTextValue({ json: "", html: "<p>tak terpakai</p>" })).toBe("");
  });

  it("value object dengan json object kosong ({}) tetap dikembalikan (truthy, bukan null/undefined)", () => {
    const json = {};
    expect(richTextValue({ json, html: "<p>tak terpakai</p>" })).toBe(json);
  });
});
