import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Setelah refactoring, logika grid/subgrid dipindahkan ke variableDropUtils.js
// dan konstanta grid didefinisikan di gridConstants.js
const variableDropUtilsPath = resolve(
  process.cwd(),
  "resources/js/Pages/Core/PrintTemplate/utils/variableDropUtils.js",
);
const gridConstantsPath = resolve(
  process.cwd(),
  "resources/js/Pages/Core/PrintTemplate/utils/gridConstants.js",
);
const editorSourcePath = resolve(
  process.cwd(),
  "resources/js/Pages/Core/PrintTemplate/Editor.jsx",
);

const variableDropSource = readFileSync(variableDropUtilsPath, "utf8");
const gridConstantsSource = readFileSync(gridConstantsPath, "utf8");
const editorSource = readFileSync(editorSourcePath, "utf8");

describe("PrintTemplate Editor grid/subgrid CSS wiring", () => {
  it("defines grid and subGrid constants in gridConstants module", () => {
    expect(gridConstantsSource).toMatch(/export const GRID_CLASS = "gjs-grid"/);
    expect(gridConstantsSource).toMatch(
      /export const SUBGRID_CLASS = "gjs-subgrid"/,
    );
  });

  it("registers grid and subGrid component classes in variableDropUtils", () => {
    expect(variableDropSource).toMatch(/classes:\s*\[GRID_CLASS\]/);
    expect(variableDropSource).toMatch(/classes:\s*\[SUBGRID_CLASS\]/);
  });

  it("enforces grid/subgrid rules in Css Composer for canvas rendering", () => {
    expect(variableDropSource).toMatch(
      /cssComposer\.setRule\(`\.\$\{GRID_CLASS\}`,\s*GRID_RULE_STYLE,\s*\{\s*addStyles:\s*true/,
    );
    expect(variableDropSource).toMatch(
      /cssComposer\.setRule\(`\.\$\{SUBGRID_CLASS\}`,\s*SUBGRID_RULE_STYLE,\s*\{\s*addStyles:\s*true/,
    );
  });

  it("keeps subgrid class on exported HTML from custom toHTML", () => {
    expect(variableDropSource).toMatch(
      /<div class="\$\{SUBGRID_CLASS\}" data-variable="\$\{variablePath\}"/,
    );
  });

  it("adds classes to dropped variable component and auto-created grid wrapper", () => {
    expect(variableDropSource).toMatch(
      /result\.content = \{[\s\S]*classes:\s*\[SUBGRID_CLASS\]/,
    );
    expect(variableDropSource).toMatch(
      /type:\s*"gjsGrid",[\s\S]*classes:\s*\[GRID_CLASS\]/,
    );
  });

  it("Editor.jsx imports variableDropListener from utility module", () => {
    expect(editorSource).toMatch(
      /import \{ variableDropListener \} from "\.\/utils\/variableDropUtils"/,
    );
  });
});
