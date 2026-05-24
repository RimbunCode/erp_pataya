import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const editorSourcePath = resolve(
  process.cwd(),
  "resources/js/Pages/Core/PrintTemplate/Editor.jsx",
);
const editorSource = readFileSync(editorSourcePath, "utf8");

describe("PrintTemplate Editor grid/subgrid CSS wiring", () => {
  it("registers grid and subGrid component classes in GrapesJS selector collections", () => {
    expect(editorSource).toMatch(/const GRID_CLASS = "gjs-grid";/);
    expect(editorSource).toMatch(/const SUBGRID_CLASS = "gjs-subgrid";/);
    expect(editorSource).toMatch(/classes:\s*\[GRID_CLASS\]/);
    expect(editorSource).toMatch(/classes:\s*\[SUBGRID_CLASS\]/);
  });

  it("enforces grid/subgrid rules in Css Composer for canvas rendering", () => {
    expect(editorSource).toMatch(
      /cssComposer\.setRule\(`\.\$\{GRID_CLASS\}`,\s*GRID_RULE_STYLE,\s*\{\s*addStyles:\s*true/,
    );
    expect(editorSource).toMatch(
      /cssComposer\.setRule\(`\.\$\{SUBGRID_CLASS\}`,\s*SUBGRID_RULE_STYLE,\s*\{\s*addStyles:\s*true/,
    );
  });

  it("keeps subgrid class on exported HTML from custom toHTML", () => {
    expect(editorSource).toMatch(
      /<div class="\$\{SUBGRID_CLASS\}" data-variable="\$\{variablePath\}"/,
    );
  });

  it("adds classes to dropped variable component and auto-created grid wrapper", () => {
    expect(editorSource).toMatch(
      /result\.content = \{[\s\S]*classes:\s*\[SUBGRID_CLASS\]/,
    );
    expect(editorSource).toMatch(
      /type:\s*"grid",[\s\S]*classes:\s*\[GRID_CLASS\]/,
    );
  });
});
