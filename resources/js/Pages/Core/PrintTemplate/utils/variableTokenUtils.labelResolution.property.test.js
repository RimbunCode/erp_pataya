import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { resolveLabel } from "./variableTokenUtils";

const modelKeyArb = fc
  .stringMatching(/^[A-Za-z][A-Za-z0-9_\\]{2,30}$/)
  .map((value) => value.replace(/\\\\/g, "\\"));
const segmentArb = fc.stringMatching(/^[a-z][a-z0-9_]{0,10}$/);
const dotPathArb = fc
  .array(segmentArb, { minLength: 1, maxLength: 4 })
  .map((segments) => segments.join("."));
const docPathArb = dotPathArb.map((path) => `doc.${path}`);
const prefixedPathArb = fc.oneof(
  docPathArb,
  dotPathArb.map((path) => `company.${path}`),
  dotPathArb.map((path) => `docInfo.${path}`),
);

const columnDefinitionArb = fc.record(
  {
    name: fc.option(segmentArb, { nil: undefined }),
    title: fc.option(fc.string({ minLength: 1, maxLength: 24 }), {
      nil: undefined,
    }),
    titleTrans: fc.option(fc.string({ minLength: 1, maxLength: 24 }), {
      nil: undefined,
    }),
    type: fc.option(fc.constantFrom("text", "currency", "number", "relation"), {
      nil: undefined,
    }),
    related: fc.option(modelKeyArb, { nil: undefined }),
  },
  { withDeletedKeys: true },
);

const columnsArb = fc.dictionary(
  modelKeyArb,
  fc.dictionary(segmentArb, columnDefinitionArb),
  { maxKeys: 5 },
);

const t = (key) => `TR:${key}`;

describe("Feature: editor-label-resolution, Property 1", () => {
  it("resolveLabel mengembalikan path asli saat context wajib tidak tersedia", () => {
    fc.assert(
      fc.property(prefixedPathArb, fc.option(modelKeyArb), (path, modelDoc) => {
        expect(() => resolveLabel(path, null, modelDoc, t)).not.toThrow();
        expect(resolveLabel(path, null, modelDoc, t)).toBe(path);

        expect(() => resolveLabel(path, undefined, modelDoc, t)).not.toThrow();
        expect(resolveLabel(path, undefined, modelDoc, t)).toBe(path);
      }),
      { numRuns: 100 },
    );

    fc.assert(
      fc.property(docPathArb, columnsArb, (path, columns) => {
        expect(() => resolveLabel(path, columns, null, t)).not.toThrow();
        expect(resolveLabel(path, columns, null, t)).toBe(path);
      }),
      { numRuns: 100 },
    );
  });
});

describe("Feature: editor-label-resolution, Property 2", () => {
  it("resolveLabel mengembalikan path asli untuk model/kolom yang tidak ditemukan", () => {
    fc.assert(
      fc.property(
        modelKeyArb,
        segmentArb,
        columnsArb,
        (modelDoc, segment, columns) => {
          fc.pre(!Object.prototype.hasOwnProperty.call(columns, modelDoc));
          const path = `doc.${segment}`;

          expect(() => resolveLabel(path, columns, modelDoc, t)).not.toThrow();
          expect(resolveLabel(path, columns, modelDoc, t)).toBe(path);
        },
      ),
      { numRuns: 100 },
    );

    fc.assert(
      fc.property(
        modelKeyArb,
        segmentArb,
        fc.dictionary(segmentArb, columnDefinitionArb),
        (modelDoc, missingSegment, modelColumns) => {
          fc.pre(
            !Object.prototype.hasOwnProperty.call(modelColumns, missingSegment),
          );
          const columns = { [modelDoc]: modelColumns };
          const path = `doc.${missingSegment}`;

          expect(() => resolveLabel(path, columns, modelDoc, t)).not.toThrow();
          expect(resolveLabel(path, columns, modelDoc, t)).toBe(path);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("Feature: editor-label-resolution, Property 3", () => {
  it("resolveLabel mengikuti prioritas title -> t(titleTrans) -> name", () => {
    // Source (resolveColumnDisplayLabel) menganggap string whitespace-only
    // sebagai kosong (pakai .trim()), jadi generator harus konsisten dgn itu.
    const nonEmptyArb = fc
      .string({ minLength: 1, maxLength: 24 })
      .filter((value) => value.trim().length > 0);

    fc.assert(
      fc.property(
        modelKeyArb,
        segmentArb,
        nonEmptyArb,
        fc.option(nonEmptyArb, { nil: undefined }),
        fc.option(nonEmptyArb, { nil: undefined }),
        (modelDoc, fieldName, name, title, titleTrans) => {
          fc.pre(Boolean(title) || Boolean(titleTrans) || Boolean(name));

          const column = {
            name,
            ...(title ? { title } : {}),
            ...(titleTrans ? { titleTrans } : {}),
            type: undefined,
          };

          const columns = {
            [modelDoc]: {
              [fieldName]: column,
            },
          };

          const path = `doc.${fieldName}`;
          const expected = title || (titleTrans ? t(titleTrans) : null) || name;

          expect(resolveLabel(path, columns, modelDoc, t)).toBe(expected);
        },
      ),
      { numRuns: 100 },
    );
  });
});
