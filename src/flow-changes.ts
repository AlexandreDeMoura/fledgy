import fs from "node:fs";
import path from "node:path";
import { readGit, gitObjects } from "./change-git.js";
import { flowAnchors, knowledgeBaseFiles, type FlowAnchors } from "./flow-anchors.js";
import { commitDiffs, committedChanges, workingChanges, type Changes, type Commit } from "./code-changes.js";
import { knowledgeBaseVersions, anchorsByVersion } from "./history.js";
import { appDataDirectory } from "./qa-results.js";
export type { Commit } from "./code-changes.js";

// Only code changes count: a changed anchored definition changes its Flows;
// another change in its file comes near them. Calls outside Anchors are not
// followed: Anchors point where code starts, not to every dependency it calls.
export type AnchorsFrom = "exact" | "after" | "disk" | "before-first";
export type RecentCommit = Commit & Changes & { anchorsFrom: AnchorsFrom };
export type FlowChanges = {
  flows: Record<string, { uncommitted: boolean; last?: Commit }>;
  recent: RecentCommit[];
  uncommitted: Changes;
};
export type ChangedSince = {
  commits: Commit[];
  nearCommits: Commit[];
  uncommitted: boolean;
  nearUncommitted: boolean;
  byDate: boolean;
};

const appHistories = new Map<string, { head: string; directory: string; commits: Set<string>; firstParents: Set<string> }>();
const ancestors = new Map<string, Set<string>>();

function appHistory(root: string, home: string) {
  const key = `${root}\0${home}`;
  try {
    const head = readGit(root, "rev-parse", "HEAD").trim();
    const previous = appHistories.get(key);
    if (previous?.head === head) return previous;
    const commits = new Set(readGit(root, "rev-list", "HEAD").trim().split("\n"));
    const firstParents = new Set(readGit(root, "rev-list", "--first-parent", "HEAD").trim().split("\n"));
    const directory = appDataDirectory(root, home)!;
    const history = { head, directory, commits, firstParents };
    appHistories.set(key, history);
    return history;
  } catch {
    return undefined; // not a git repo, or no app commit yet
  }
}

const empty = (): Changes => ({ flows: [], near: [], files: [] });

// Shared by the recent columns and every QA Result in one /api/data request.
export async function changeReader(repoRoot: string, home: string) {
  const anchors = flowAnchors(knowledgeBaseFiles(repoRoot));
  const app = appHistory(repoRoot, home);
  const store = app && path.join(app.directory, "history.git");
  const objects = app
    ? gitObjects(repoRoot, store && fs.existsSync(store) ? path.join(store, "objects") : undefined)
    : undefined;
  try {
    const versions = app ? knowledgeBaseVersions(repoRoot, store, app.head) : [];
    const history = app?.commits ?? new Set<string>();
    const oldest = versions[0];
    const ancestorKey = oldest && `${repoRoot}\0${oldest.appCommit}`;
    if (ancestorKey && history.has(oldest!.appCommit) && !ancestors.has(ancestorKey)) {
      ancestors.set(ancestorKey, new Set(readGit(repoRoot, "rev-list", oldest!.appCommit).trim().split("\n").slice(1)));
    }
    const beforeFirst = ancestorKey && history.has(oldest!.appCommit) ? ancestors.get(ancestorKey) : undefined;

    // Selection is by exact app commit, then save time, never ancestry. Only
    // the before-first flag uses ancestry. In Private installs a branch switch
    // can select a version saved on another branch (a known limit).
    const pick = (commit: Commit) => {
      const exact = versions.filter(version => version.appCommit === commit.sha).at(-1);
      if (exact) return { version: exact, anchorsFrom: "exact" as const };
      const before = oldest && (beforeFirst
        ? beforeFirst.has(commit.sha)
        : Date.parse(commit.date) < Date.parse(oldest.saved));
      const version = versions.find(version => Date.parse(version.saved) > Date.parse(commit.date));
      return {
        version: version ?? (before ? oldest : undefined),
        anchorsFrom: before ? "before-first" as const : version ? "after" as const : "disk" as const,
      };
    };
    const byVersion = objects ? await anchorsByVersion(repoRoot, versions, objects) : new Map<string, FlowAnchors>();
    const candidates = [...new Set([anchors, ...byVersion.values()].flatMap(byFlow =>
      Object.values(byFlow).flat().map(anchor => anchor.file),
    ))];
    const ranges = new Map<string, Promise<RecentCommit[]>>();
    const range = (args: string[]) => {
      const key = args.join("\0");
      let answer = ranges.get(key);
      if (!answer) {
        answer = objects && app ? Promise.all(commitDiffs(repoRoot, args, candidates, app.head).map(async commit => {
          const selected = pick(commit);
          const atCommit = selected.version ? byVersion.get(selected.version.source)! : anchors;
          return {
            sha: commit.sha, date: commit.date, subject: commit.subject, body: commit.body,
            ...await committedChanges(repoRoot, commit, atCommit, objects, app.directory),
            anchorsFrom: selected.anchorsFrom,
          };
        })) : Promise.resolve([]);
        ranges.set(key, answer);
      }
      return answer;
    };

    // The commits since `from`, an ancestor of `tip`, along first parents. A
    // merge that brought `from` in through another parent would carry the
    // tested work in its diff, so it is replaced by its branch's own commits
    // after `from`. A conflict resolved in that merge is not seen (a known limit).
    const sinceCommits = async (from: string, tip: string): Promise<RecentCommit[]> => {
      const chain = await range([`${from}..${tip}`]);
      if (tip === "HEAD" && app?.firstParents.has(from)) return chain;
      const after = new Set(readGit(repoRoot, "rev-list", "--ancestry-path", `${from}..${tip}`).trim().split("\n"));
      const merge = chain.filter(commit => after.has(commit.sha)).at(-1);
      if (!merge) return chain;
      const [first, ...others] = readGit(repoRoot, "rev-parse", `${merge.sha}^@`).trim().split("\n");
      const branch = others.find(parent => parent === from || after.has(parent));
      if (first === from || !branch) return chain;
      return [...chain.filter(commit => commit !== merge), ...await sinceCommits(from, branch)]
        .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
    };
    const sinceRanges = new Map<string, Promise<RecentCommit[]>>();

    const uncommitted = objects ? await workingChanges(repoRoot, anchors, objects) : empty();
    const recent = await range(["-n", "30"]);
    return {
      changes: {
        flows: Object.fromEntries(Object.keys(anchors).map(flow => [flow, {
          uncommitted: uncommitted.flows.includes(flow), last: recent.find(commit => commit.flows.includes(flow)),
        }])),
        recent,
        uncommitted,
      } satisfies FlowChanges,
      async sinceReader(flow: string, { commit: from, date }: { commit: string; date: string }): Promise<ChangedSince> {
        const inHistory = history.has(from);
        if (inHistory && !sinceRanges.has(from)) sinceRanges.set(from, sinceCommits(from, "HEAD"));
        const selected = inHistory
          ? await sinceRanges.get(from)!
          : await range([`--since-as-filter=@${Math.floor(Date.parse(date) / 1000)}`]);
        const commits = inHistory ? selected : selected.filter(commit => Date.parse(commit.date) > Date.parse(date));
        const changedAfter = (file: string) => {
          const stat = fs.statSync(path.join(repoRoot, file), { throwIfNoEntry: false });
          return !stat || stat.mtimeMs > Date.parse(date);
        };
        // The mtime gate only applies to files that changed or came near this
        // Flow; edits to the Knowledge base itself never count.
        const dirty = uncommitted.files.filter(file =>
          anchors[flow]?.some(anchor => anchor.file === file.path) && changedAfter(file.path),
        );
        const changes = dirty.some(file => file.flows.includes(flow));
        return {
          commits: commits.filter(commit => commit.flows.includes(flow)),
          nearCommits: commits.filter(commit => commit.near.includes(flow)),
          uncommitted: changes,
          nearUncommitted: !changes && dirty.some(file => file.near.includes(flow)),
          byDate: !inHistory,
        };
      },
      close() { objects?.close(); },
    };
  } catch (error) {
    objects?.close();
    throw error;
  }
}
