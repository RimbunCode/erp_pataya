import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sourcePath = resolve(
  process.cwd(),
  "resources/js/Pages/Core/PrintTemplate/Components/VariableItem.jsx",
);
const source = readFileSync(sourcePath, "utf8");

describe("VariableItem handleInsert trans title wiring", () => {
  it("menormalisasi titleTrans dari payload sebelum dipakai", () => {
    expect(source).toMatch(
      /const normalizedTitleTrans =[\s\S]*payload\.titleTrans[\s\S]*payload\.titleTrans\.trim\(\)/,
    );
  });

  it("menyertakan atribut data-trans-title pada komponen label hasil handleInsert", () => {
    expect(source).toMatch(
      /"data-label-key":\s*labelKey[\s\S]*"data-trans-title":\s*normalizedTitleTrans/,
    );
  });
});
