import { existsSync, renameSync, rmSync } from "node:fs";

import path from "node:path";

const outputDirectory = path.resolve("resources/js");
const tsSchemaPath = path.join(outputDirectory, "schema.ts");
const jsSchemaPath = path.join(outputDirectory, "schema.js");

if (!existsSync(tsSchemaPath)) {
  throw new Error(`Expected generated schema file not found: ${tsSchemaPath}`);
}

if (existsSync(jsSchemaPath)) {
  rmSync(jsSchemaPath);
}

renameSync(tsSchemaPath, jsSchemaPath);
