import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";

export type FlowAnchor = { file: string; symbol?: string; part: string };
export type FlowAnchors = Record<string, FlowAnchor[]>;

export function knowledgeBaseFiles(repoRoot: string): Map<string, string> {
  const root = path.join(repoRoot, "knowledge-base");
  const files = new Map<string, string>();
  if (!fs.existsSync(root)) return files;
  for (const file of fs.readdirSync(root, { recursive: true, encoding: "utf8" })) {
    if (!/^(flows|parts)[/\\].*\.yaml$/.test(file)) continue;
    try { files.set(file.split(path.sep).join("/"), fs.readFileSync(path.join(root, file), "utf8")); } catch { /* half-written file */ }
  }
  return files;
}

const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" ? value as Record<string, unknown> : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];

// Both disk and git trees use this extraction. Every path's Steps count,
// including Variants. A broken file must not discard the other Flows/Parts.
export function flowAnchors(files: Map<string, string>): FlowAnchors {
  const flows: Record<string, Record<string, unknown>> = {};
  const parts: Record<string, Record<string, unknown>> = {};
  for (const [file, text] of files) {
    const match = /^(flows|parts)\/(.*)\.yaml$/.exec(file);
    if (!match) continue;
    try { (match[1] === "flows" ? flows : parts)[match[2]!] = object(parse(text)); } catch { /* keep what can be read */ }
  }
  return Object.fromEntries(Object.entries(flows).map(([id, flow]) => {
    const steps = [...array(flow.steps), ...array(flow.variants).flatMap(variant => array(object(variant).steps))];
    const used = new Set(steps.flatMap(step => array(object(step).parts)).filter((id): id is string => typeof id === "string"));
    return [id, [...used].flatMap(part => array(parts[part]?.anchors).flatMap(anchor => {
      const at = object(anchor).at;
      if (typeof at !== "string") return [];
      const [file = "", symbol] = at.split("#");
      // Knowledge base edits never count, even if an invalid Anchor names one.
      if (!file || file.startsWith("knowledge-base/") || path.isAbsolute(file) || file.split("/").includes("..")) return [];
      return [{ file, ...(symbol ? { symbol } : {}), part }];
    }))];
  }));
}
