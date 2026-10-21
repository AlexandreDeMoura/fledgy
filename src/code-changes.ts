import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { readGit, type GitObjects } from "./change-git.js";
import { definitionRanges, type Definition } from "./symbols.js";
import type { FlowAnchors } from "./flow-anchors.js";

export type Commit = { sha: string; subject: string; body: string; date: string };
export type FileChange = {
  path: string;
  fileLevel: boolean;
  flows: string[];
  near: string[];
  symbols: { name: string; parts: string[]; flows: string[] }[];
  unanchored: string[];
  outsideDefinitions: boolean;
};
export type Changes = { flows: string[]; near: string[]; files: FileChange[] };
type Lines = { start: number; count: number }[];
type DiffFile = { path: string; oldPath: string; before: string; after: string; oldLines: Lines; newLines: Lines; binary: boolean };
export type CommitDiff = Commit & { files: DiffFile[] };
type FileFacts = { before: string[]; after: string[]; outsideDefinitions: boolean; comparable: boolean; deleted: boolean };

const marker = "\0FLEDGY-COMMIT\0";
const format = `%x00FLEDGY-COMMIT%x00%H%x00%cI%x00%s%x00%b%x00`;
const diffArgs = ["--raw", "-z", "--no-abbrev", "--patch", "-U0", "-M", "--no-ext-diff", "--no-textconv", "--no-color"];

// Raw paths are NUL-delimited; patch headers are not used to recover filenames.
// That handles brackets, spaces, Unicode, quotes and newlines without guessing.
function diffFiles(text: string): DiffFile[] {
  const end = text.indexOf("\0\0diff --git ");
  const raw = (end < 0 ? text : text.slice(0, end)).replace(/^\s*\0?\s*/, "").split("\0");
  const files: DiffFile[] = [];
  for (let n = 0; n < raw.length; n++) {
    const match = /^:\d+ \d+ ([a-f0-9]+) ([a-f0-9]+) ([A-Z])\d*$/.exec(raw[n]!);
    if (!match) continue;
    const oldPath = raw[++n]!;
    const file = match[3] === "R" || match[3] === "C" ? raw[++n]! : oldPath;
    files.push({ path: file, oldPath, before: match[1]!, after: match[2]!, oldLines: [], newLines: [], binary: false });
  }
  const patches = end < 0 ? [] : text.slice(end + 2).split(/^diff --git /m).slice(1);
  for (const [index, patch] of patches.entries()) {
    const file = files[index];
    if (!file) continue;
    file.binary = /^Binary files /m.test(patch) || /^GIT binary patch/m.test(patch);
    for (const match of patch.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm)) {
      file.oldLines.push({ start: Number(match[1]), count: Number(match[2] ?? 1) });
      file.newLines.push({ start: Number(match[3]), count: Number(match[4] ?? 1) });
    }
  }
  return files;
}

// Sparse retains columns with no candidate-path changes. Full diff preserves
// rename sources outside the candidate paths; only anchored files are parsed.
const windows = new Map<string, CommitDiff[]>();
export function commitDiffs(root: string, range: string[], candidates: string[], head?: string): CommitDiff[] {
  const key = JSON.stringify([root, head, range, candidates]);
  if (head && windows.has(key)) return windows.get(key)!;
  if (!candidates.length) candidates = ["knowledge-base"];
  const log = readGit(root, "log", "--first-parent", "-m", "--diff-merges=first-parent", "--root", "--full-history", "--sparse", "--full-diff",
    ...diffArgs, `--format=${format}`, ...range, "--", ...candidates);
  const commits = log.split(marker).slice(1).map(record => {
    const [sha = "", date = "", subject = "", body = ""] = record.split("\0", 4);
    const offset = [sha, date, subject, body].reduce((size, field) => size + field.length + 1, 0);
    return { sha, date, subject, body, files: diffFiles(record.slice(offset)) };
  });
  if (head) {
    windows.set(key, commits);
    if (windows.size > 32) windows.delete(windows.keys().next().value!);
  }
  return commits;
}

function hits(definition: Definition, lines: Lines): boolean {
  return lines.some(({ start, count }) => count > 0 && start <= definition.end && start + count - 1 >= definition.start);
}
function outside(definitions: Definition[], lines: Lines): boolean {
  for (const { start, count } of lines) {
    // Union ranges instead of walking every line of a large added file.
    let next = start;
    for (const definition of [...definitions].sort((a, b) => a.start - b.start)) {
      if (definition.end < next) continue;
      if (definition.start > next) break;
      next = Math.max(next, definition.end + 1);
    }
    if (next < start + count) return true;
  }
  return false;
}

async function compare(file: DiffFile, before: Buffer | undefined, after: Buffer | undefined): Promise<FileFacts> {
  const deleted = after === undefined;
  const oldDefinitions = before === undefined ? [] : await definitionRanges(file.oldPath, before.toString("utf8"));
  const newDefinitions = after === undefined ? [] : await definitionRanges(file.path, after.toString("utf8"));
  if (file.binary || !oldDefinitions || !newDefinitions) return { before: [], after: [], outsideDefinitions: false, comparable: false, deleted };
  return {
    before: oldDefinitions.filter(def => hits(def, file.oldLines) || !newDefinitions.some(other => other.name === def.name)).map(def => def.name),
    after: newDefinitions.filter(def => hits(def, file.newLines) || !oldDefinitions.some(other => other.name === def.name)).map(def => def.name),
    outsideDefinitions: outside(oldDefinitions, file.oldLines) || outside(newDefinitions, file.newLines),
    comparable: true, deleted,
  };
}

// Immutable commit/file facts, independent of Anchors. The on-disk format is
// versioned; a damaged or unwritable cache costs work, never correctness.
const memory = new Map<string, FileFacts>();
async function facts(root: string, commit: string, file: DiffFile, objects: GitObjects, cache?: string): Promise<FileFacts> {
  const key = createHash("sha256").update(`v1\0${commit}\0${file.path}`).digest("hex");
  const location = cache && path.join(cache, "changes-v1", `${key}.json`);
  if (location && memory.has(location)) return memory.get(location)!;
  if (location) try {
    const value = JSON.parse(fs.readFileSync(location, "utf8")) as FileFacts;
    if (Array.isArray(value.before) && Array.isArray(value.after) && typeof value.comparable === "boolean" && typeof value.deleted === "boolean" && typeof value.outsideDefinitions === "boolean") {
      memory.set(location, value);
      return value;
    }
  } catch { /* cache miss */ }
  const [before, after] = await Promise.all([objects.get(file.before), objects.get(file.after)]);
  const value = await compare(file, before, after);
  if (location) {
    memory.set(location, value);
    if (memory.size > 10_000) memory.delete(memory.keys().next().value!);
    const temp = `${location}.${randomUUID()}.tmp`;
    try {
      fs.mkdirSync(path.dirname(location), { recursive: true });
      fs.writeFileSync(temp, JSON.stringify(value));
      fs.renameSync(temp, location);
    } catch { /* a cache is optional */ }
    finally { try { fs.rmSync(temp, { force: true }); } catch { /* read-only home */ } }
  }
  return value;
}

function match(files: { file: DiffFile; facts: FileFacts }[], anchors: FlowAnchors): Changes {
  const changes: Changes = { flows: [], near: [], files: [] };
  const changed = new Set<string>();
  const near = new Set<string>();
  for (const { file, facts } of files) {
    const named = Object.entries(anchors).flatMap(([flow, anchors]) => anchors.filter(anchor => anchor.file === file.path).map(anchor => ({ ...anchor, flow })));
    if (!named.length) continue;
    const fileChanged = new Set<string>();
    const fileNear = new Set<string>();
    const definitions = new Set([...facts.before, ...facts.after]);
    const symbols = new Map<string, { name: string; parts: Set<string>; flows: Set<string> }>();
    for (const anchor of named) {
      if (!facts.comparable || !anchor.symbol || facts.deleted || definitions.has(anchor.symbol)) {
        changed.add(anchor.flow);
        fileChanged.add(anchor.flow);
        if (anchor.symbol && (definitions.has(anchor.symbol) || facts.deleted)) {
          const symbol = symbols.get(anchor.symbol) ?? { name: anchor.symbol, parts: new Set(), flows: new Set() };
          symbol.parts.add(anchor.part);
          symbol.flows.add(anchor.flow);
          symbols.set(anchor.symbol, symbol);
        }
      } else { near.add(anchor.flow); fileNear.add(anchor.flow); }
    }
    changes.files.push({
      flows: [...fileChanged], near: [...fileNear].filter(flow => !fileChanged.has(flow)),
      path: file.path, fileLevel: !facts.comparable || named.some(anchor => !anchor.symbol),
      symbols: [...symbols.values()].map(symbol => ({ name: symbol.name, parts: [...symbol.parts], flows: [...symbol.flows] })),
      unanchored: [...definitions].filter(name => !named.some(anchor => anchor.symbol === name)),
      outsideDefinitions: facts.outsideDefinitions,
    });
  }
  changes.flows = [...changed];
  changes.near = [...near].filter(flow => !changed.has(flow));
  return changes;
}

export async function committedChanges(root: string, commit: CommitDiff, anchors: FlowAnchors, objects: GitObjects, cache?: string): Promise<Changes> {
  const candidates = new Set(Object.values(anchors).flat().map(anchor => anchor.file));
  const files = await Promise.all(commit.files.filter(file => candidates.has(file.path)).map(async file => ({
    file, facts: await facts(root, commit.sha, file, objects, cache),
  })));
  return match(files, anchors);
}

export async function workingChanges(root: string, anchors: FlowAnchors, objects: GitObjects): Promise<Changes> {
  const candidates = new Set(Object.values(anchors).flat().map(anchor => anchor.file));
  const dirty = readGit(root, "status", "--porcelain", "--untracked-files=all", "--no-renames", "-z")
    .split("\0").filter(entry => entry && candidates.has(entry.slice(3)));
  if (!dirty.length) return { flows: [], near: [], files: [] };
  const tracked = dirty.some(entry => !entry.startsWith("?? ")) ? diffFiles(readGit(root, "diff", ...diffArgs, "HEAD", "--")) : [];
  const untracked = dirty.filter(entry => entry.startsWith("?? ")).map(entry => entry.slice(3));
  for (const file of untracked) tracked.push({ path: file, oldPath: file, before: "0", after: "0", oldLines: [], newLines: [], binary: false });
  const files = await Promise.all(tracked.filter(file => candidates.has(file.path)).map(async file => {
    let after: Buffer | undefined;
    try { after = fs.readFileSync(path.join(root, file.path)); } catch { /* deleted */ }
    if (untracked.includes(file.path)) file.newLines = [{ start: 1, count: after?.toString("utf8").split("\n").length ?? 0 }];
    return { file, facts: await compare(file, await objects.get(file.before), after) };
  }));
  return match(files, anchors);
}
