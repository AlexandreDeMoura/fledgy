import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readGit, type GitObjects } from "./change-git.js";
import { flowAnchors, type FlowAnchors } from "./flow-anchors.js";
import { appDataDirectory } from "./qa-results.js";

export type KnowledgeBaseVersion = { source: string; appCommit: string; saved: string; checkout?: string };

export function historyStore(repoRoot: string, home: string): string | undefined {
  const directory = appDataDirectory(repoRoot, home);
  return directory && path.join(directory, "history.git");
}

// A Knowledge base version describes HEAD plus any uncommitted work at the
// end of an agent session. Hand edits without a session are only seen on disk.
export function saveKnowledgeBaseVersion(repoRoot: string, home: string): void {
  const store = historyStore(repoRoot, home);
  if (!store) return; // no app commit yet
  const knowledgeBase = path.join(repoRoot, "knowledge-base");
  if (!fs.existsSync(knowledgeBase) && !fs.existsSync(store)) return;
  const checkout = fs.realpathSync(repoRoot);
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: checkout, encoding: "utf8" }).trim();
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "fledgy-history-"));
  const env = { ...process.env, GIT_INDEX_FILE: path.join(temp, "index"), GIT_OPTIONAL_LOCKS: "0" };
  const git = (...args: string[]) => execFileSync("git", [`--git-dir=${store}`, ...args], {
    cwd: checkout, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  try {
    if (!fs.existsSync(store)) {
      fs.mkdirSync(path.dirname(store), { recursive: true });
      git("init", "--bare", "--quiet", store);
    }
    const ref = `refs/checkouts/${createHash("sha256").update(checkout).digest("hex")}`;
    let previous: string | undefined;
    try { previous = git("rev-parse", "--verify", ref); } catch { /* first session in this checkout */ }
    // A fresh temporary index captures deletions too, and force includes the
    // Private install's excluded files. Only the store's config/index is used.
    git("read-tree", "--empty");
    if (fs.existsSync(knowledgeBase) && fs.readdirSync(knowledgeBase, { recursive: true, withFileTypes: true }).some(entry => !entry.isDirectory())) {
      git(`--work-tree=${checkout}`, "-c", "core.bare=false", "add", "--force", "--all", "--", "knowledge-base");
    }
    const tree = git("write-tree");
    if (previous) {
      const [oldTree, message] = git("show", "-s", "--format=%T%n%B", previous).split("\n");
      if (oldTree === tree && JSON.parse(message!).appCommit === head) return;
    }
    const metadata = { appCommit: head, saved: new Date().toISOString(), checkout };
    const version = git("-c", "user.name=Fledgy", "-c", "user.email=fledgy@localhost", "-c", "commit.gpgSign=false",
      "commit-tree", tree, ...(previous ? ["-p", previous] : []), "-m", JSON.stringify(metadata));
    git("update-ref", ref, version, previous ?? "");
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

// All checkouts contribute versions. Shared installs also contribute every
// Knowledge base commit reachable from HEAD, including teammates' changes.
const versionLists = new Map<string, { key: string; versions: KnowledgeBaseVersion[] }>();
function refsKey(store: string): string {
  const refs = path.join(store, "refs");
  const files = fs.existsSync(refs) ? fs.readdirSync(refs, { recursive: true, encoding: "utf8" }).map(file => path.join(refs, file)) : [];
  files.push(path.join(store, "packed-refs"));
  return files.sort().flatMap(file => {
    try { return [`${file}\0${fs.readFileSync(file, "utf8")}`]; } catch { return []; }
  }).join("\0");
}
export function knowledgeBaseVersions(repoRoot: string, store?: string, head?: string): KnowledgeBaseVersion[] {
  const key = `${head ?? ""}\0${store ? refsKey(store) : ""}`;
  const location = `${repoRoot}\0${store ?? ""}`;
  const previous = versionLists.get(location);
  if (head && previous?.key === key) return previous.versions;
  const versions: KnowledgeBaseVersion[] = [];
  if (store && fs.existsSync(store)) try {
    const log = readGit(repoRoot, `--git-dir=${store}`, "log", "--all", "--format=%H%x00%B%x00");
    const fields = log.split("\0");
    for (let n = 0; n + 1 < fields.length; n += 2) {
      try {
        const metadata = JSON.parse(fields[n + 1]!);
        if (typeof metadata.appCommit === "string" && typeof metadata.saved === "string" && Number.isFinite(Date.parse(metadata.saved))) {
          versions.push({ source: fields[n]!.trim(), appCommit: metadata.appCommit, saved: metadata.saved, checkout: metadata.checkout });
        }
      } catch { /* a damaged version must not discard the others */ }
    }
  } catch { /* unavailable personal history */ }
  const seen = new Set<string>();
  for (const row of readGit(repoRoot, "log", "HEAD", "--full-history", "-m", "--format=%H %cI", "--", "knowledge-base/").trim().split("\n")) {
    const [sha, saved] = row.split(" ");
    if (sha && saved && !seen.has(sha)) { seen.add(sha); versions.push({ source: sha, appCommit: sha, saved }); }
  }
  versions.sort((a, b) => Date.parse(a.saved) - Date.parse(b.saved) || a.source.localeCompare(b.source));
  if (head) versionLists.set(location, { key, versions });
  return versions;
}

const savedAnchors = new Map<string, FlowAnchors>();
export async function versionAnchors(version: KnowledgeBaseVersion, objects: GitObjects): Promise<FlowAnchors> {
  const cached = savedAnchors.get(version.source);
  if (cached) return cached;
  const files = new Map<string, string>();
  const commit = await objects.get(version.source);
  const tree = /^tree ([a-f0-9]+)/.exec(commit?.toString("utf8") ?? "")?.[1];
  async function entries(tree: string) {
    const bytes = await objects.get(tree);
    const out: { name: string; sha: string; directory: boolean }[] = [];
    if (!bytes) return out;
    for (let start = 0; start < bytes.length;) {
      const nul = bytes.indexOf(0, start);
      if (nul < 0) break;
      const header = bytes.subarray(start, nul).toString("utf8");
      const space = header.indexOf(" ");
      const size = tree.length / 2;
      out.push({ name: header.slice(space + 1), directory: header.slice(0, space) === "40000", sha: bytes.subarray(nul + 1, nul + 1 + size).toString("hex") });
      start = nul + 1 + size;
    }
    return out;
  }
  async function walk(tree: string, prefix: string) {
    await Promise.all((await entries(tree)).map(async entry => {
      const file = `${prefix}${entry.name}`;
      if (entry.directory) await walk(entry.sha, `${file}/`);
      else if (file.endsWith(".yaml")) {
        const content = await objects.get(entry.sha);
        if (content) files.set(file, content.toString("utf8"));
      }
    }));
  }
  if (tree) {
    const kb = (await entries(tree)).find(entry => entry.name === "knowledge-base" && entry.directory);
    if (kb) for (const entry of await entries(kb.sha)) {
      if (entry.directory && ["flows", "parts"].includes(entry.name)) await walk(entry.sha, `${entry.name}/`);
    }
  }
  const anchors = flowAnchors(new Map([...files].sort(([a], [b]) => a.localeCompare(b))));
  savedAnchors.set(version.source, anchors);
  if (savedAnchors.size > 256) savedAnchors.delete(savedAnchors.keys().next().value!);
  return anchors;
}
