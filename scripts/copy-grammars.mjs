// Copies the three .wasm grammars out of their npm packages into grammars/, so
// the published package carries 3.5 MB of grammars instead of depending on
// 44 MB of packages whose install scripts a host would have to approve.
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const out = new URL("../grammars/", import.meta.url).pathname;
fs.mkdirSync(out, { recursive: true });

const grammars = {
  "tree-sitter-typescript": ["tree-sitter-typescript.wasm", "tree-sitter-tsx.wasm"],
  "tree-sitter-python": ["tree-sitter-python.wasm"],
};
for (const [pkg, files] of Object.entries(grammars)) {
  const dir = path.dirname(require.resolve(`${pkg}/package.json`));
  for (const file of files) fs.copyFileSync(path.join(dir, file), path.join(out, file));
  fs.copyFileSync(path.join(dir, "LICENSE"), path.join(out, `${pkg}.LICENSE`));
}
