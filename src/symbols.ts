import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Language, type Node, Parser } from "web-tree-sitter";

const GRAMMAR_BY_EXTENSION: Record<string, string> = {
  ".ts": "tree-sitter-typescript.wasm",
  ".mts": "tree-sitter-typescript.wasm",
  ".cts": "tree-sitter-typescript.wasm",
  ".tsx": "tree-sitter-tsx.wasm",
  ".js": "tree-sitter-tsx.wasm",
  ".jsx": "tree-sitter-tsx.wasm",
  ".mjs": "tree-sitter-tsx.wasm",
  ".cjs": "tree-sitter-tsx.wasm",
  ".py": "tree-sitter-python.wasm",
};

// Nodes that define a name, read from their `name` field. Overload signatures
// (`function_signature`, `method_signature`) are left out so that an
// overloaded function counts once, at its implementation.
const DEFINITIONS = new Set([
  "function_declaration",
  "generator_function_declaration",
  "class_declaration",
  "abstract_class_declaration",
  "interface_declaration",
  "type_alias_declaration",
  "enum_declaration",
  "variable_declarator",
  "method_definition",
  "public_field_definition",
  "abstract_method_signature",
  "function_definition",
  "class_definition",
]);

// Nodes that only wrap a definition.
const WRAPPERS = new Set([
  "export_statement",
  "lexical_declaration",
  "variable_declaration",
  "decorated_definition",
  "expression_statement",
]);

const parsers = new Map<string, Promise<Parser>>();

function parserFor(file: string): Promise<Parser> {
  const grammar = GRAMMAR_BY_EXTENSION[path.extname(file)];
  if (!grammar) throw new Error(`Cannot look for a symbol in ${file}: no grammar for this kind of file`);
  let parser = parsers.get(grammar);
  if (!parser) {
    parser = (async () => {
      await Parser.init();
      const loaded = new Parser();
      loaded.setLanguage(await Language.load(fileURLToPath(new URL(`../grammars/${grammar}`, import.meta.url))));
      return loaded;
    })();
    parsers.set(grammar, parser);
  }
  return parser;
}

function nameDefinedBy(node: Node): string | undefined {
  if (DEFINITIONS.has(node.type)) return node.childForFieldName("name")?.text;
  // Python: `NAME = value` and `NAME: type = value`.
  if (node.type === "assignment") {
    const left = node.childForFieldName("left");
    return left?.type === "identifier" ? left.text : undefined;
  }
  return undefined;
}

// The definitions made directly in a scope: a file's top level or a class body.
function definitionsIn(scope: Node): { name: string; node: Node }[] {
  return scope.namedChildren.flatMap((child) => {
    if (!child) return [];
    if (WRAPPERS.has(child.type)) return definitionsIn(child);
    const name = nameDefinedBy(child);
    return name ? [{ name, node: child }] : [];
  });
}

// How many times `symbol` is defined in `file`. `Name` is looked for at the
// file's top level; `Class.member` inside the body of the top-level `Class`.
export async function countDefinitions(file: string, symbol: string): Promise<number> {
  const tree = (await parserFor(file)).parse(fs.readFileSync(file, "utf8"));
  if (!tree) throw new Error(`Could not parse ${file}`);
  let scopes: Node[] = [tree.rootNode];
  let found: Node[] = [];
  for (const name of symbol.split(".")) {
    found = scopes.flatMap(definitionsIn).filter((definition) => definition.name === name).map(({ node }) => node);
    scopes = found.flatMap((node) => node.childForFieldName("body") ?? []);
  }
  return found.length;
}

// Include wrappers such as Python decorators and multiline exports in the
// definition's extent, while retaining the check's definition discovery rules.
function definitionRange(name: string, node: Node): Definition {
  let outer = node;
  while (outer.parent && WRAPPERS.has(outer.parent.type) && definitionsIn(outer.parent).length === 1) outer = outer.parent;
  return { name, start: outer.startPosition.row + 1, end: outer.endPosition.row + 1 };
}

export type Definition = { name: string; start: number; end: number };

// The same definitions as the Deterministic Check, with one-based line ranges.
// A parse error means history must fall back to file level; the check's existing
// acceptance rules remain unchanged.
export async function definitionRanges(file: string, content: string): Promise<Definition[] | undefined> {
  if (!GRAMMAR_BY_EXTENSION[path.extname(file)] || content.includes("\0")) return undefined;
  const tree = (await parserFor(file)).parse(content);
  if (!tree) return undefined;
  try {
    if (tree.rootNode.hasError) return undefined;
    const definitions: Definition[] = [];
    for (const { name, node } of definitionsIn(tree.rootNode)) {
      definitions.push(definitionRange(name, node));
      if (["class_declaration", "abstract_class_declaration", "class_definition"].includes(node.type)) {
        const body = node.childForFieldName("body");
        if (body) for (const member of definitionsIn(body)) definitions.push(definitionRange(`${name}.${member.name}`, member.node));
      }
    }
    return definitions;
  } finally { tree.delete(); }
}
