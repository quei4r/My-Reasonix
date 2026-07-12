// Mass replace silent .catch(() => {}) with logCatch() calls.
// Run: node scripts/fix-silent-catch.js
const fs = require("fs");
const path = require("path");

const SRC = "/home/quei/code/tools/My-Reasonix/vscode-extension/frontend/src";
const LOG_CATCH_IMPORT = 'import { logCatch } from "./lib/logCatch";';

function getMethod(content, offset) {
  const before = content.slice(Math.max(0, offset - 100), offset);
  let m = before.match(/(?:app\.|\.)(\w+)\s*\([^)]*\)\s*\.\s*catch/);
  if (m) return m[1];
  m = before.match(/(\w+)\s*\([^)]*\)\s*\.\s*catch/);
  if (m) return m[1];
  return "async";
}

const files = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "node_modules" && e.name !== "__tests__" && e.name !== "__mocks__") walk(p); }
    else if (e.isFile() && /\.(ts|tsx)$/.test(e.name) && !e.name.endsWith(".d.ts")) files.push(p);
  }
}
walk(SRC);

let total = 0;
const changed = [];

for (const file of files) {
  let content = fs.readFileSync(file, "utf8");
  const orig = content;
  let needImport = false;

  content = content.replace(/\.catch\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/g, (m, off) => {
    needImport = true; total++; return `.catch(logCatch("${getMethod(content, off)}"))`;
  });
  content = content.replace(/\.catch\(\s*\(\s*\)\s*=>\s*undefined\s*\)/g, (m, off) => {
    needImport = true; total++; return `.catch(logCatch("${getMethod(content, off)}", undefined))`;
  });
  content = content.replace(/\.catch\(\s*\(\s*\)\s*=>\s*\[\s*\]\s*\)/g, (m, off) => {
    needImport = true; total++; return `.catch(logCatch("${getMethod(content, off)}", []))`;
  });
  content = content.replace(/\.catch\(\s*\(\s*\)\s*=>\s*false\s*\)/g, (m, off) => {
    needImport = true; total++; return `.catch(logCatch("${getMethod(content, off)}", false))`;
  });
  content = content.replace(/\.catch\(\s*\(\s*\)\s*=>\s*null\s*\)/g, (m, off) => {
    needImport = true; total++; return `.catch(logCatch("${getMethod(content, off)}", null))`;
  });

  if (needImport && !content.includes('from "./lib/logCatch"')) {
    const lines = content.split("\n");
    let last = -1;
    for (let i = 0; i < lines.length; i++) { if (lines[i].trim().startsWith("import ")) last = i; }
    if (last >= 0) lines.splice(last + 1, 0, LOG_CATCH_IMPORT);
    content = lines.join("\n");
  }

  if (content !== orig) { fs.writeFileSync(file, content, "utf8"); changed.push(path.relative(SRC, file)); }
}

console.log(`Replaced ${total} silent catches in ${changed.length} files`);
changed.forEach((f) => console.log(" ", f));
