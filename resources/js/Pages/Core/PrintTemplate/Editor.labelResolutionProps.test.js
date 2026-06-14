import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const editorSourcePath = resolve(
  process.cwd(),
  "resources/js/Pages/Core/PrintTemplate/Editor.jsx",
);
const editorSource = readFileSync(editorSourcePath, "utf8");

describe("Editor label resolution props wiring", () => {
  it("menerima prop columns di komponen PrintTemplate", () => {
    expect(editorSource).toMatch(
      /function PrintTemplate\(\{[\s\S]*docInfo,\s*[\s\S]*columns,\s*[\s\S]*\}\)/,
    );
  });

  it("meneruskan columns ke variableDropListener", () => {
    expect(editorSource).toMatch(
      /variableDropListener\(editor,\s*\{[\s\S]*columns,\s*[\s\S]*\}\)/,
    );
  });

  it("meneruskan printTemplate.model sebagai modelDoc", () => {
    expect(editorSource).toMatch(
      /modelDoc:\s*printTemplate\?\.model\s*\|\|\s*null/,
    );
  });

  it("tetap meneruskan dataTableColumns dan docInfo tanpa perubahan nama", () => {
    expect(editorSource).toMatch(
      /variableDropListener\(editor,\s*\{[\s\S]*dataTableColumns,\s*[\s\S]*docInfo,\s*[\s\S]*\}\)/,
    );
  });
});
