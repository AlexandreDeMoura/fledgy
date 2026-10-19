import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// What git says has happened to each Flow. A Flow changed when one of its
// files did: its own, its Parts' and the code files their Anchors point into.
export type Commit = { sha: string; subject: string; date: string };
export type FlowChanges = {
  // `last` is the last commit to change the Flow, absent when none did.
  flows: Record<string, { uncommitted: boolean; last?: Commit }>;
  // The branch's last commits, newest first, each with the Flows it changed.
  recent: (Commit & { flows: string[] })[];
};

// A path is taken as written, so the brackets of `app/[id]/page.tsx` are not a pattern.
function git(repoRoot: string, ...args: string[]): string {
  return execFileSync("git", ["--literal-pathspecs", ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    maxBuffer: 64 * 1024 * 1024,
  });
}

// `filesByFlow` holds each Flow's files, as paths from the root of the repo;
// `dirty` is what `uncommittedFiles` found.
export function flowChanges(repoRoot: string, filesByFlow: Record<string, string[]>, dirty: Set<string>): FlowChanges {
  return {
    flows: Object.fromEntries(
      Object.entries(filesByFlow).map(([flow, files]) => [
        flow,
        { uncommitted: files.some((file) => dirty.has(file)), last: commits(repoRoot, files, "-n", "1")[0] },
      ]),
    ),
    recent: recentCommits(repoRoot, filesByFlow),
  };
}

// What has happened to a Flow since a QA Result was recorded on it. `byDate`
// says the result's commit is not in the branch's history, so the commits
// are the ones made after the result's date.
export type ChangedSince = { commits: Commit[]; uncommitted: boolean; byDate: boolean };

// Reads what has happened since for the results of one request. `dirty` is
// what `uncommittedFiles` found. Results recorded on the same commit of the
// same Flow share one answer from git.
export function sinceReader(repoRoot: string, dirty: Set<string>) {
  const asked = new Map<string, unknown>();
  const once = <T>(key: string, ask: () => T): T => {
    if (!asked.has(key)) asked.set(key, ask());
    return asked.get(key) as T;
  };

  // `files` are the Flow's files; `commit` and `date` are where and when the
  // result was recorded.
  return (files: string[], { commit: from, date }: { commit: string; date: string }): ChangedSince => {
    // git does not say when an uncommitted change was made, the file does. A
    // deleted file says nothing, so it counts.
    const changedAfter = (file: string) => {
      const stat = fs.statSync(path.join(repoRoot, file), { throwIfNoEntry: false });
      return !stat || stat.mtimeMs > Date.parse(date);
    };
    const inHistory = once(from, () => isAncestor(repoRoot, from));
    const range = inHistory ? `${from}..HEAD` : `--since=@${Math.floor(Date.parse(date) / 1000)}`;
    return {
      commits: once([range, ...files].join("\0"), () => commits(repoRoot, files, range)),
      uncommitted: files.some((file) => dirty.has(file) && changedAfter(file)),
      byDate: !inHistory,
    };
  };
}

function isAncestor(repoRoot: string, sha: string): boolean {
  try {
    git(repoRoot, "merge-base", "--is-ancestor", sha, "HEAD");
    return true;
  } catch {
    return false; // on another branch, or a commit this clone does not have
  }
}

function recentCommits(repoRoot: string, filesByFlow: Record<string, string[]>): FlowChanges["recent"] {
  let log: string;
  try {
    log = git(repoRoot, "-c", "core.quotePath=false", "log", "-n", "10", "--name-only", `--format=%x1e${commitFormat}`);
  } catch {
    return []; // not a git repo, or one with no commit
  }
  return log
    .split("\x1e")
    .filter(Boolean)
    .map((record) => {
      const [head = "", ...touched] = record.split("\n");
      const flows = Object.keys(filesByFlow).filter((flow) => filesByFlow[flow]!.some((file) => touched.includes(file)));
      return { ...commit(head), flows };
    });
}

const commitFormat = "%H%x1f%cI%x1f%s";
function commit(line: string): Commit {
  const [sha = "", date = "", subject = ""] = line.split("\x1f");
  return { sha, date, subject };
}

// The commits that touched one of `files`, newest first, narrowed by `range`.
function commits(repoRoot: string, files: string[], ...range: string[]): Commit[] {
  try {
    return git(repoRoot, "log", `--format=${commitFormat}`, ...range, "--", ...files)
      .split("\n")
      .filter(Boolean)
      .map(commit);
  } catch {
    return []; // not a git repo, or one with no commit
  }
}

// The files that are new, changed or deleted and not committed, staged or not.
export function uncommittedFiles(repoRoot: string): Set<string> {
  try {
    const entries = git(repoRoot, "status", "--porcelain", "--untracked-files=all", "--no-renames", "-z").split("\0");
    return new Set(entries.filter(Boolean).map((entry) => entry.slice(3)));
  } catch {
    return new Set(); // not a git repo
  }
}
