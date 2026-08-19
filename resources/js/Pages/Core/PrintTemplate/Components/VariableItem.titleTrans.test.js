import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sourcePath = resolve(
  process.cwd(),
  "resources/js/Pages/Core/PrintTemplate/Components/VariableItem.jsx",
);
const source = readFileSync(sourcePath, "utf8");

describe("VariableItem handleInsert trans title wiring", () => {
  it("menurunkan labelKey dari formatted token sebelum dipakai", () => {
    expect(source).toMatch(
      /labelKey:\s*extractLabelKeyFromToken\(tokenValue\)/,
    );
  });

  it("menyertakan atribut data-label-key pada komponen token hasil handleInsert", () => {
    expect(source).toMatch(/"data-label-key":\s*payloadWithToken\.labelKey/);
  });
});
