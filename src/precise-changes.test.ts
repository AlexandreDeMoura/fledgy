import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { commitAll, flow as flowYaml, git, hostRepo, knowledgeBase, partWithAnchor } from "./testing/host-repo.js";
import { qaResultsFile, recordQaResult } from "./qa-results.js";
import { startView, type View } from "./view.js";
import { stopHook } from "./stop-hook.js";

const flow = "approve-a-tool-call";
const part = "knowledge-base/parts/tool-approval.yaml";
let home: string;
const views: View[] = [];
beforeEach(() => {
  home = hostRepo({ ".gitconfig": "" });
  vi.stubEnv("HOME", home);
  vi.stubEnv("GIT_CONFIG_GLOBAL", path.join(home, ".gitconfig"));
  vi.stubEnv("GIT_CONFIG_NOSYSTEM", "1");
});
afterEach(async () => {
  for (const view of views.splice(0)) await view.close();
  vi.unstubAllEnvs();
});
function write(root: string, file: string, text: string) {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), text);
}
async function api(root: string) {
  const view = await startView(root, { port: 0, home });
  views.push(view);
  return {
    data: async () => {
      const response = await fetch(new URL("api/data", view.url));
      const data = await response.json();
      expect(response.status, JSON.stringify(data)).toBe(200);
      return data;
    },
    record: async () => (await fetch(new URL("api/result", view.url), {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ flow, path: "main", step: "approve", state: "passed" }),
    })).json(),
  };
}
const code = (a: number, b: number) => `export function anchored() {\n  return ${a};\n}\nexport function other() {\n  return ${b};\n}\n`;
function app(anchor = "code.ts#anchored", source = code(1, 1)) {
  const root = hostRepo({ ...knowledgeBase(anchor, "backend"), [anchor.split("#")[0]!]: source });
  commitAll(root, "first");
  return root;
}

test("a shared file changes only its anchored function and reports other definitions as near", async () => {
  const root = app();
  const { data } = await api(root);
  write(root, "code.ts", code(2, 1));
  const changed = commitAll(root, "Change anchored\n\nFull explanation.\n\nAnother paragraph.");
  write(root, "code.ts", code(2, 2));
  const near = commitAll(root, "Change other");
  const result = (await data()).changes;
  expect(result.flows[flow]).toMatchObject({ uncommitted: false, last: { sha: changed } });
  expect(result.recent[0]).toMatchObject({ sha: near, flows: [], near: [flow], files: [{
    path: "code.ts", fileLevel: false, symbols: [], unanchored: ["other"], outsideDefinitions: false,
  }] });
  expect(result.recent[1]).toMatchObject({ sha: changed, body: "Full explanation.\n\nAnother paragraph.\n", flows: [flow], near: [], files: [{
    symbols: [{ name: "anchored", parts: ["tool-approval"], flows: [flow] }],
  }] });
});

test.each(["Private", "Shared"])("each commit uses its own Knowledge base version in a %s install", async install => {
  const root = hostRepo({ "code.ts": code(1, 1) });
  const before = commitAll(root, "before Fledgy");
  if (install === "Private") fs.appendFileSync(path.join(root, ".git/info/exclude"), "\nknowledge-base/\n");
  for (const [file, text] of Object.entries(knowledgeBase("code.ts#anchored", "backend"))) write(root, file, text);
  write(root, "code.ts", code(2, 1));
  const original = commitAll(root, "first session");
  await stopHook(root, false, home);
  write(root, part, partWithAnchor("code.ts#other", "backend"));
  write(root, "code.ts", code(2, 2));
  const current = commitAll(root, "new Anchor");
  await stopHook(root, false, home);
  const { data } = await api(root);
  const recent = (await data()).changes.recent;
  expect(recent.find((c: { sha: string }) => c.sha === original)).toMatchObject({ anchorsFrom: "exact", flows: [flow], files: [{ symbols: [{ name: "anchored" }] }] });
  expect(recent.find((c: { sha: string }) => c.sha === current)).toMatchObject({ anchorsFrom: "exact", flows: [flow], files: [{ symbols: [{ name: "other" }] }] });
  expect(recent.find((c: { sha: string }) => c.sha === before)).toMatchObject({ anchorsFrom: "before-first", flows: [flow] });
});

test.each([
  ["function", "code.ts#anchored", code(1, 1), code(2, 1), true, false, ["anchored"]],
  ["other function", "code.ts#anchored", code(1, 1), code(1, 2), false, false, []],
  ["imports", "code.ts#anchored", code(1, 1), 'import fs from "node:fs";\n' + code(1, 1), false, false, []],
  ["class member", "code.ts#Agent", "class Agent {\n create() { return 1; }\n}\n", "class Agent {\n create() { return 2; }\n}\n", true, false, ["Agent"]],
  ["added symbol", "code.ts#anchored", "export const other = 1;\n", code(1, 1), true, false, ["anchored"]],
  ["removed symbol", "code.ts#anchored", code(1, 1), "export const other = 1;\n", true, false, ["anchored"]],
  ["CSS", "style.css", "body { color: red; }\n", "body { color: blue; }\n", true, true, []],
  ["no symbol", "code.ts", code(1, 1), code(1, 2), true, true, []],
  ["Python", "code.py#Agent.create", "class Agent:\n    def create(self):\n        return 1\n", "class Agent:\n    def create(self):\n        return 2\n", true, false, ["Agent.create"]],
  ["TSX", "app/[id]/page.tsx#Page", "export function Page() {\n return <div>one</div>;\n}\n", "export function Page() {\n return <div>two</div>;\n}\n", true, false, ["Page"]],
  ["parse failure", "code.ts#anchored", code(1, 1), "export function anchored( {\n", true, true, []],
  ["binary", "code.ts#anchored", code(1, 1), "binary\0data", true, true, []],
] as const)("%s uses the same symbol rules for committed and uncommitted changes", async (_, anchor, before, after, changes, fileLevel, symbols) => {
  const root = app(anchor, before);
  const { data } = await api(root);
  write(root, anchor.split("#")[0]!, after);
  const dirty = (await data()).changes;
  expect(dirty.flows[flow].uncommitted).toBe(changes);
  expect(dirty.uncommitted).toMatchObject({ flows: changes ? [flow] : [], near: changes ? [] : [flow], files: [{ fileLevel }] });
  const sha = commitAll(root, "edit");
  const commit = (await data()).changes.recent[0];
  expect(commit).toMatchObject({ sha, flows: changes ? [flow] : [], near: changes ? [] : [flow], files: [{ fileLevel }] });
  expect(commit.files[0].symbols.map((s: { name: string }) => s.name)).toEqual(symbols);
});

test("a renamed file compares its old content and a deleted file changes the Flow", async () => {
  const root = app();
  const { data } = await api(root);
  git(root, "mv", "code.ts", "renamed.ts");
  write(root, part, partWithAnchor("renamed.ts#anchored", "backend"));
  write(root, "renamed.ts", code(2, 1));
  commitAll(root, "rename and edit");
  const renamed = (await data()).changes.recent[0];
  expect(renamed).toMatchObject({ flows: [flow], files: [{ path: "renamed.ts", symbols: [{ name: "anchored" }], unanchored: [] }] });
  fs.rmSync(path.join(root, "renamed.ts"));
  expect((await data()).changes.uncommitted.flows).toEqual([flow]);
  commitAll(root, "delete");
  expect((await data()).changes.recent[0].flows).toEqual([flow]);
});

test("a symlink that becomes a file does not move its changes onto the next file", async () => {
  const root = app();
  fs.symlinkSync("code.ts", path.join(root, "a-link.ts"));
  commitAll(root, "add a link");
  const { data } = await api(root);
  fs.rmSync(path.join(root, "a-link.ts"));
  write(root, "a-link.ts", "export const linked = 1;\n");
  write(root, "code.ts", code(1, 2));
  expect((await data()).changes.uncommitted).toMatchObject({ flows: [], near: [flow] });
  commitAll(root, "link becomes a file, other changes");
  expect((await data()).changes.recent[0]).toMatchObject({ flows: [], near: [flow], files: [{ path: "code.ts", unanchored: ["other"] }] });
});

test("an anchored file that becomes a symlink changes the Flow at file level", async () => {
  const root = app("link.ts#anchored");
  write(root, "target.ts", code(1, 1));
  commitAll(root, "add a target");
  const { data } = await api(root);
  fs.rmSync(path.join(root, "link.ts"));
  fs.symlinkSync("target.ts", path.join(root, "link.ts"));
  expect((await data()).changes.uncommitted).toMatchObject({ flows: [flow], files: [{ path: "link.ts", fileLevel: true }] });
  commitAll(root, "file becomes a link");
  expect((await data()).changes.recent[0]).toMatchObject({ flows: [flow], files: [{ path: "link.ts", fileLevel: true }] });
});

test("untracked anchored files count but Knowledge base edits never do", async () => {
  const root = app();
  const { data } = await api(root);
  fs.appendFileSync(path.join(root, part), "\n");
  expect((await data()).changes.uncommitted).toEqual({ flows: [], near: [], files: [] });
  commitAll(root, "only Knowledge base");
  expect((await data()).changes.recent[0]).toMatchObject({ flows: [], near: [], files: [] });
  write(root, part, partWithAnchor("new.ts#anchored", "backend"));
  write(root, "new.ts", code(1, 1));
  expect((await data()).changes.uncommitted.flows).toEqual([flow]);
});

test("merges are one first-parent column with the whole branch's changes", async () => {
  const root = app();
  const trunk = git(root, "branch", "--show-current");
  git(root, "checkout", "--quiet", "-b", "feature");
  write(root, "code.ts", code(2, 1));
  const side = commitAll(root, "on feature");
  git(root, "checkout", "--quiet", trunk);
  write(root, "readme.txt", "trunk\n");
  commitAll(root, "on trunk");
  git(root, "merge", "--no-ff", "--quiet", "feature", "-m", "merge feature");
  const { data } = await api(root);
  const recent = (await data()).changes.recent;
  expect(recent[0]).toMatchObject({ subject: "merge feature", flows: [flow], files: [{ symbols: [{ name: "anchored" }] }] });
  expect(recent.map((c: { sha: string }) => c.sha)).not.toContain(side);
});

test("a result recorded on a merged branch counts that branch's later commits and the trunk's, not the merge", async () => {
  const root = app();
  const trunk = git(root, "branch", "--show-current");
  git(root, "checkout", "--quiet", "-b", "feature");
  write(root, "code.ts", code(2, 1));
  commitAll(root, "tested on feature");
  const { data, record } = await api(root);
  await record();
  write(root, "code.ts", code(3, 1));
  const later = commitAll(root, "after the test on feature");
  git(root, "checkout", "--quiet", trunk);
  write(root, "code.ts", code(1, 2));
  const onTrunk = commitAll(root, "near on trunk");
  git(root, "merge", "--no-ff", "--quiet", "feature", "-m", "merge feature");
  const since = (await data()).results[flow].main.approve.since;
  expect(since.commits.map((c: { sha: string }) => c.sha)).toEqual([later]);
  expect(since.nearCommits.map((c: { sha: string }) => c.sha)).toEqual([onTrunk]);
  expect(since.byDate).toBe(false);
});

test("a result recorded on a merged branch with no later work has no commits since", async () => {
  const root = app();
  const trunk = git(root, "branch", "--show-current");
  git(root, "checkout", "--quiet", "-b", "feature");
  write(root, "code.ts", code(2, 1));
  commitAll(root, "tested on feature");
  const { data, record } = await api(root);
  await record();
  git(root, "checkout", "--quiet", trunk);
  git(root, "merge", "--no-ff", "--quiet", "feature", "-m", "merge feature");
  const since = (await data()).results[flow].main.approve.since;
  expect(since).toMatchObject({ commits: [], nearCommits: [], byDate: false });
});

test("QA Results separate near commits and near uncommitted work, with the mtime gate", async () => {
  const root = app();
  const { data, record } = await api(root);
  await record();
  write(root, "code.ts", code(1, 2));
  const near = commitAll(root, "near");
  write(root, "code.ts", code(2, 2));
  const changed = commitAll(root, "changed");
  write(root, "code.ts", code(2, 3));
  // Explicit times avoid file system clock resolution races.
  const future = new Date(Date.now() + 60_000);
  fs.utimesSync(path.join(root, "code.ts"), future, future);
  const since = (await data()).results[flow].main.approve.since;
  expect(since.commits.map((c: { sha: string }) => c.sha)).toEqual([changed]);
  expect(since.nearCommits.map((c: { sha: string }) => c.sha)).toEqual([near]);
  expect(since).toMatchObject({ uncommitted: false, nearUncommitted: true, byDate: false });
  const earlier = new Date(Date.now() - 60_000);
  fs.utimesSync(path.join(root, "code.ts"), earlier, earlier);
  expect((await data()).results[flow].main.approve.since.nearUncommitted).toBe(false);
  const recorded = await record();
  expect(recorded.results[flow].main.approve.uncommitted).toBe(false);
});

function dated(root: string, message: string, date: string) {
  vi.stubEnv("GIT_COMMITTER_DATE", date);
  try { return commitAll(root, message); } finally { delete process.env.GIT_COMMITTER_DATE; }
}

test("the latest exact version wins, even when the disk now names a different symbol", async () => {
  const root = app();
  write(root, "code.ts", code(1, 2));
  const sha = commitAll(root, "other changed");
  await stopHook(root, false, home);
  write(root, part, partWithAnchor("code.ts#other", "backend"));
  await stopHook(root, false, home);
  write(root, part, partWithAnchor("code.ts#anchored", "backend"));
  const { data } = await api(root);
  expect((await data()).changes.recent[0]).toMatchObject({ sha, anchorsFrom: "exact", flows: [flow], files: [{ symbols: [{ name: "other" }] }] });
});

test("code in X uses the Knowledge base committed in X+1, including a teammate's pulled map", async () => {
  const root = app();
  write(root, "code.ts", code(1, 2));
  const codeCommit = dated(root, "code", "2030-01-01T10:00:00Z");
  const teammate = path.join(hostRepo({}), "teammate");
  git(root, "clone", "--quiet", root, teammate);
  write(teammate, part, partWithAnchor("code.ts#other", "backend"));
  dated(teammate, "teammate map", "2030-01-01T11:00:00Z");
  git(root, "pull", "--quiet", "--ff-only", teammate);
  // A disk edit must not replace the historical version.
  write(root, part, partWithAnchor("code.ts#anchored", "backend"));
  const { data } = await api(root);
  expect((await data()).changes.recent.find((c: { sha: string }) => c.sha === codeCommit)).toMatchObject({ anchorsFrom: "after", flows: [flow], files: [{ symbols: [{ name: "other" }] }] });
});

test("a squash commit uses the first later version, and newest commits use disk", async () => {
  const root = app();
  const trunk = git(root, "branch", "--show-current");
  git(root, "checkout", "--quiet", "-b", "feature");
  write(root, "code.ts", code(1, 2));
  write(root, part, partWithAnchor("code.ts#other", "backend"));
  dated(root, "feature", "2030-01-01T09:00:00Z");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2030-01-01T12:00:00Z"));
  try { await stopHook(root, false, home); } finally { vi.useRealTimers(); }
  git(root, "checkout", "--quiet", trunk);
  git(root, "merge", "--squash", "--quiet", "feature");
  // Squash only the code, leaving the new map in the personal history store.
  git(root, "restore", "--source=HEAD", "--staged", "--worktree", part);
  const squash = dated(root, "squashed", "2030-01-01T11:00:00Z");
  const { data } = await api(root);
  expect((await data()).changes.recent[0]).toMatchObject({ sha: squash, anchorsFrom: "after", flows: [flow] });
  write(root, "code.ts", code(2, 2));
  dated(root, "newest", "2030-01-01T13:00:00Z");
  expect((await data()).changes.recent[0]).toMatchObject({ anchorsFrom: "disk", flows: [flow], files: [{ symbols: [{ name: "anchored" }] }] });
});

test("before-first includes commits made during the first agent session", async () => {
  const root = hostRepo({ "code.ts": code(1, 1) });
  commitAll(root, "before install");
  fs.appendFileSync(path.join(root, ".git/info/exclude"), "\nknowledge-base/\n");
  for (const [file, text] of Object.entries(knowledgeBase("code.ts#anchored", "backend"))) write(root, file, text);
  write(root, "code.ts", code(2, 1));
  const during = commitAll(root, "during first session");
  write(root, "code.ts", code(3, 1));
  commitAll(root, "end first session");
  await stopHook(root, false, home);
  const { data } = await api(root);
  expect((await data()).changes.recent.find((c: { sha: string }) => c.sha === during)).toMatchObject({ anchorsFrom: "before-first", flows: [flow] });
});

test("a broken file in a historical version leaves the readable Flows and Variant Parts available", async () => {
  const root = app();
  write(root, "knowledge-base/flows/broken.yaml", "steps: [oops");
  write(root, "knowledge-base/parts/broken.yaml", "anchors: [oops");
  write(root, "knowledge-base/parts/variant.yaml", partWithAnchor("code.ts#other", "backend"));
  const flowFile = `knowledge-base/flows/${flow}.yaml`;
  write(root, flowFile, fs.readFileSync(path.join(root, flowFile), "utf8").replace("      parts: [tool-approval]", "      parts: [variant]"));
  write(root, "code.ts", code(1, 2));
  const sha = commitAll(root, "variant code and broken map");
  await stopHook(root, false, home);
  fs.rmSync(path.join(root, "knowledge-base/flows/broken.yaml"));
  fs.rmSync(path.join(root, "knowledge-base/parts/broken.yaml"));
  // Keep the on-disk map readable, and prove the old map is being used.
  write(root, flowFile, knowledgeBase("code.ts#anchored", "backend")[flowFile]!);
  const { data } = await api(root);
  expect((await data()).changes.recent[0]).toMatchObject({ sha, flows: [flow], files: [{ symbols: [{ name: "other", parts: ["variant"] }] }] });
});

test("recent keeps 30 columns, while QA Results and a Flow's last change reach farther back", async () => {
  const root = app();
  const { data, record } = await api(root);
  await record();
  write(root, "code.ts", code(2, 1));
  const oldChange = commitAll(root, "old change");
  for (let n = 0; n < 31; n++) commitAll(root, `empty ${n}`);
  const sent = await data();
  expect(sent.changes.recent).toHaveLength(30);
  expect(sent.changes.recent[0].subject).toBe("empty 30");
  expect(sent.changes.recent.every((c: { body: unknown }) => typeof c.body === "string")).toBe(true);
  expect(sent.changes.flows[flow].last).toMatchObject({ sha: oldChange, subject: "old change" });
  expect(sent.results[flow].main.approve.since.commits.map((c: { sha: string }) => c.sha)).toEqual([oldChange]);
});

test("a Flow's last change is found again after a new commit without reading older commits again", async () => {
  const root = app();
  write(root, "code.ts", code(2, 1));
  const oldChange = commitAll(root, "old change");
  for (let n = 0; n < 40; n++) commitAll(root, `empty ${n}`);
  const trace = path.join(home, "git-trace");
  vi.stubEnv("GIT_TRACE", trace);
  const { data } = await api(root);
  expect((await data()).changes.flows[flow].last).toMatchObject({ sha: oldChange });
  commitAll(root, "one more");
  fs.writeFileSync(trace, "");
  expect((await data()).changes.flows[flow].last).toMatchObject({ sha: oldChange });
  // Only the recent commits are read again: the older ones are already known.
  expect(fs.readFileSync(trace, "utf8").match(/built-in: git log .*--patch/g)).toHaveLength(1);
});

test("a warm request reuses cached commit facts without starting cat-file", async () => {
  const root = app();
  write(root, "code.ts", code(2, 1));
  commitAll(root, "changed");
  const trace = path.join(home, "git-trace");
  vi.stubEnv("GIT_TRACE", trace);
  const { data } = await api(root);
  const cold = await data();
  expect(fs.readFileSync(trace, "utf8")).toContain("cat-file --batch");
  const cache = path.join(home, ".fledgy", git(root, "rev-list", "--max-parents=0", "HEAD"), "changes-v2");
  expect(fs.readdirSync(cache).length).toBeGreaterThan(0);
  fs.writeFileSync(trace, "");
  const warm = await data();
  expect(warm.changes).toEqual(cold.changes);
  expect(fs.readFileSync(trace, "utf8")).not.toContain("cat-file --batch");
});

// What a warm request asked git for, after a cold one.
async function warmGitTrace(root: string) {
  const trace = path.join(home, "git-trace");
  vi.stubEnv("GIT_TRACE", trace);
  const { data } = await api(root);
  const cold = await data();
  fs.writeFileSync(trace, "");
  const warm = await data();
  expect(warm.changes).toEqual(cold.changes);
  expect(warm.results).toEqual(cold.results);
  return { warm, trace: fs.readFileSync(trace, "utf8") };
}

test("a warm request reads no commits again when QA Results were recorded at many commits", async () => {
  const steps = Array.from({ length: 40 }, (_, n) => `step-${n}`);
  const root = app();
  const qa = steps.map(step => `    - id: ${step}\n      do: Click Approve.\n      expect: The tool runs.\n`).join("");
  write(root, `knowledge-base/flows/${flow}.yaml`, flowYaml.replace("    - id: approve\n      do: Click Approve.\n      expect: The tool runs.\n", qa));
  commitAll(root, "many QA Steps");
  const file = qaResultsFile(root, home)!;
  for (const step of steps) {
    commitAll(root, `before ${step}`);
    recordQaResult(root, file, { flow, path: "main", step }, false, { state: "passed", note: "" });
  }
  const { warm, trace } = await warmGitTrace(root);
  expect(Object.keys(warm.results[flow].main)).toHaveLength(steps.length);
  expect(trace).not.toContain("built-in: git log");
  expect(trace).not.toContain("cat-file --batch");
});

test("a warm request reads no Knowledge base version again when there are hundreds", async () => {
  const root = app();
  // In a Shared install, each commit that changes the Knowledge base is a
  // version. One fast-import writes them all, far quicker than a commit each.
  const data = (text: string) => `data ${Buffer.byteLength(text)}\n${text}\n`;
  let stream = "";
  for (let n = 0; n < 300; n++) {
    stream += `commit refs/heads/${git(root, "branch", "--show-current")}\n`;
    stream += `committer Builder <builder@example.com> ${1_900_000_000 + n} +0000\n${data(`version ${n}`)}`;
    if (n === 0) stream += `from ${git(root, "rev-parse", "HEAD")}\n`;
    stream += `M 100644 inline ${part}\n${data(`${partWithAnchor("code.ts#anchored", "backend")}# ${n}\n`)}`;
  }
  execFileSync("git", ["fast-import", "--quiet"], { cwd: root, input: stream });
  git(root, "reset", "--quiet", "--hard");
  const { trace } = await warmGitTrace(root);
  expect(trace).not.toContain("built-in: git log");
  expect(trace).not.toContain("cat-file --batch");
});

test("going back to a branch reads none of its Knowledge base versions again", async () => {
  const root = app();
  const trunk = git(root, "branch", "--show-current");
  git(root, "checkout", "--quiet", "-b", "feature");
  write(root, part, partWithAnchor("code.ts#other", "backend"));
  commitAll(root, "feature Knowledge base");
  const trace = path.join(home, "git-trace");
  vi.stubEnv("GIT_TRACE", trace);
  const { data } = await api(root);
  const before = await data();
  git(root, "checkout", "--quiet", trunk);
  await data();
  git(root, "checkout", "--quiet", "feature");
  fs.writeFileSync(trace, "");
  const back = await data();
  expect(back.changes).toEqual(before.changes);
  expect(fs.readFileSync(trace, "utf8")).not.toContain("cat-file --batch");
});

test("file-level Anchors on one Flow do not turn another Flow's near work into a QA change", async () => {
  const root = app();
  const otherFlow = knowledgeBase("code.ts", "backend")[`knowledge-base/flows/${flow}.yaml`]!.replaceAll("tool-approval", "whole-file");
  write(root, "knowledge-base/flows/whole.yaml", otherFlow);
  write(root, "knowledge-base/parts/whole-file.yaml", partWithAnchor("code.ts", "backend"));
  commitAll(root, "other Flow");
  const { data, record } = await api(root);
  await record();
  write(root, "code.ts", code(1, 2));
  const future = new Date(Date.now() + 60_000);
  fs.utimesSync(path.join(root, "code.ts"), future, future);
  const result = await data();
  expect(result.changes.uncommitted).toMatchObject({ flows: ["whole"], near: [flow] });
  expect(result.results[flow].main.approve.since).toMatchObject({ uncommitted: false, nearUncommitted: true });
});

test("decorators belong to their definitions' changed ranges", async () => {
  const root = app("code.py#anchored", "@first\ndef anchored():\n    return 1\n");
  write(root, "code.py", "@second\ndef anchored():\n    return 1\n");
  commitAll(root, "change decorator");
  const { data } = await api(root);
  expect((await data()).changes.recent[0]).toMatchObject({ flows: [flow], near: [], files: [{ symbols: [{ name: "anchored" }] }] });
});

test("before-first uses dates when the oldest version's app commit is off this history", async () => {
  const root = hostRepo({ "code.ts": code(1, 1) });
  dated(root, "root", "2030-01-01T08:00:00Z");
  const trunk = git(root, "branch", "--show-current");
  fs.appendFileSync(path.join(root, ".git/info/exclude"), "\nknowledge-base/\n");
  git(root, "checkout", "--quiet", "-b", "feature");
  for (const [file, text] of Object.entries(knowledgeBase("code.ts#other", "backend"))) write(root, file, text);
  write(root, "code.ts", code(1, 2));
  dated(root, "feature session", "2030-01-01T09:00:00Z");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2030-01-01T12:00:00Z"));
  try { await stopHook(root, false, home); } finally { vi.useRealTimers(); }
  git(root, "checkout", "--quiet", trunk);
  write(root, "code.ts", code(1, 3));
  dated(root, "trunk before first version", "2030-01-01T11:00:00Z");
  const { data } = await api(root);
  expect((await data()).changes.recent[0]).toMatchObject({ anchorsFrom: "before-first", flows: [flow] });
});

test("a sibling declarator in one statement only comes near an anchored function", async () => {
  const source = (value: number) => `export const anchored = () => {\n  return 1;\n}, other = () => {\n  return ${value};\n};\n`;
  const root = app("code.ts#anchored", source(1));
  const { data, record } = await api(root);
  await record();
  write(root, "code.ts", source(2));
  const future = new Date(Date.now() + 60_000);
  fs.utimesSync(path.join(root, "code.ts"), future, future);
  const dirty = await data();
  expect(dirty.changes.uncommitted).toMatchObject({ flows: [], near: [flow] });
  expect(dirty.results[flow].main.approve.since).toMatchObject({ uncommitted: false, nearUncommitted: true });
  const sha = commitAll(root, "other declarator");
  const result = await data();
  expect(result.changes.recent[0]).toMatchObject({ sha, flows: [], near: [flow], files: [{ symbols: [], unanchored: ["other"] }] });
  expect(result.results[flow].main.approve.since).toMatchObject({ commits: [], nearCommits: [{ sha }] });
});
