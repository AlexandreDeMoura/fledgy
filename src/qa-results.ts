import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export type QaResult = {
  state: "passed" | "failed" | "could-not-perform";
  note: string;
  // `HEAD` and the moment the state was chosen.
  commit: string;
  date: string;
  // Whether the Flow had uncommitted changes at that moment.
  uncommitted: boolean;
};
// Flow id, then path id, then QA Step id. A QA Step with no entry is not checked.
export type QaResults = Record<string, Record<string, Record<string, QaResult>>>;
export type QaStepRef = { flow: string; path: string; step: string };

function git(repoRoot: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

// The QA Results of one Builder for one repo. They are personal and never
// committed, so they live in the Builder's home folder, under the id of the
// repo's first commit: the same in every branch, worktree and clone.
export function appDataDirectory(repoRoot: string, home: string): string | undefined {
  try {
    // A repo can have several first commits; the oldest is listed last.
    const first = git(repoRoot, "rev-list", "--max-parents=0", "HEAD").split("\n").at(-1);
    return first ? path.join(home, ".fledgy", first) : undefined;
  } catch {
    return undefined;
  }
}

export function qaResultsFile(repoRoot: string, home: string): string | undefined {
  const directory = appDataDirectory(repoRoot, home);
  return directory && path.join(directory, "qa-results.json");
}

export function readQaResults(file: string | undefined): QaResults {
  if (!file || !fs.existsSync(file)) return {};
  return (JSON.parse(fs.readFileSync(file, "utf8")) as { results: QaResults }).results;
}

// The result recorded on one QA Step, if any.
export function qaResultAt(results: QaResults, { flow, path: pathId, step }: QaStepRef): QaResult | undefined {
  const own = <T>(of: Record<string, T> | undefined, key: string) => (of && Object.hasOwn(of, key) ? of[key] : undefined);
  return own(own(own(results, flow), pathId), step);
}

function write(file: string, results: QaResults) {
  // A Flow or a path left with no result is dropped.
  for (const [flow, paths] of Object.entries(results)) {
    for (const [pathId, steps] of Object.entries(paths)) if (Object.keys(steps).length === 0) delete paths[pathId];
    if (Object.keys(paths).length === 0) delete results[flow];
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // Written beside and moved into place, so a stop half-way leaves the old file whole.
  fs.writeFileSync(`${file}.tmp`, JSON.stringify({ results }, null, 2) + "\n");
  fs.renameSync(`${file}.tmp`, file);
}

// Choosing a state, even the same one again, stamps the result. The caller
// supplies uncommitted changes using the same symbol rules as the columns.
export function recordQaResult(
  repoRoot: string,
  file: string,
  { flow, path: pathId, step }: QaStepRef,
  uncommitted: boolean,
  { state, note }: Pick<QaResult, "state" | "note">,
) {
  const results = readQaResults(file);
  ((results[flow] ??= {})[pathId] ??= {})[step] = {
    state,
    note,
    commit: git(repoRoot, "rev-parse", "HEAD"),
    date: new Date().toISOString(),
    uncommitted,
  };
  write(file, results);
}

// Changes the note of a recorded result and nothing else. A QA Step that is
// not checked has no result to carry a note.
export function noteQaResult(file: string, { flow, path: pathId, step }: QaStepRef, note: string) {
  const results = readQaResults(file);
  const result = qaResultAt(results, { flow, path: pathId, step });
  if (!result) return;
  result.note = note;
  write(file, results);
}

// Sets one QA Step back to not checked, or with no `step` the whole path.
export function removeQaResults(file: string, { flow, path: pathId, step }: Omit<QaStepRef, "step"> & { step?: string }) {
  const results = readQaResults(file);
  if (step === undefined) delete results[flow]?.[pathId];
  else delete results[flow]?.[pathId]?.[step];
  write(file, results);
}
