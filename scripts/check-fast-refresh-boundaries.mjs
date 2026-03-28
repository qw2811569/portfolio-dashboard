import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const boundaries = [
  {
    file: "src/App.jsx",
    label: "root app boundary",
    requireDefaultExport: true,
    allowNamedExports: false,
  },
];

const namedExportPattern = /^\s*export\s+(?!default\b)/gm;
const defaultExportPattern = /^\s*export\s+default\b/m;

function lineNumberForIndex(source, index) {
  return source.slice(0, index).split("\n").length;
}

const failures = [];

for (const boundary of boundaries) {
  const absPath = path.resolve(process.cwd(), boundary.file);
  const source = readFileSync(absPath, "utf8");

  if (boundary.requireDefaultExport && !defaultExportPattern.test(source)) {
    failures.push(`${boundary.file}: missing default export for ${boundary.label}`);
  }

  if (!boundary.allowNamedExports) {
    const namedExports = Array.from(source.matchAll(namedExportPattern)).map((match) => lineNumberForIndex(source, match.index ?? 0));
    if (namedExports.length > 0) {
      failures.push(
        `${boundary.file}: named exports are not allowed for ${boundary.label} (lines: ${namedExports.join(", ")})`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error("Fast Refresh boundary check failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("✅ Fast Refresh boundary check passed: App.jsx keeps a default-only export shape.");
