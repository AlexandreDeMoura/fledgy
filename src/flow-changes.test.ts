import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, test } from "vitest";
import { commitAll, git, hostRepo, knowledgeBase } from "./testing/host-repo.js";
import { startView, type View } from "./view.js";

const flowId = "approve-a-tool-call";
const approve = { flow: flowId, path: "main", step: "approve" };
const flowFile = "knowledge-base/flows/approve-a-tool-call.yaml";
const partFile = "knowledge-base/parts/tool-approval.yaml";
const codeFile = "web/src/tool-step.tsx";
const theFlowsFiles = [
  ["a code file one of its Anchors points into", codeFile],
] as const;

const views: View[] = [];
afterEach(async () => {
  for (const view of views.splice(0)) await view.close();
});

// A committed host repo holding one Flow, with the code its Part points into.
function committedHost() {
  const root = hostRepo({
    ...knowledgeBase(`${codeFile}#ToolStep`, "screen"),
    [codeFile]: "export function ToolStep() {}\n",
  });
  return { root, first: commitAll(root, "first") };
}

const change = (root: string, file: string) => {
  const full = path.join(root, file);
  const text = fs.readFileSync(full, "utf8");
  fs.writeFileSync(full, file.endsWith(".tsx") ? text.replace("}", " return 1;\n}") : text + "\n");
};

// Starts the web view on a host repo, with an empty folder standing in for the Builder's home folder.
async function view(root: string) {
  const started = await startView(root, { port: 0, home: fs.mkdtempSync(path.join(os.tmpdir(), "kb-home-")) });
  views.push(started);
  return {
    data: async () => (await fetch(new URL("/api/data", started.url))).json(),
    record: async (body: unknown) =>
      (
        await fetch(new URL("/api/result", started.url), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        })
      ).json(),
  };
}

test.each(theFlowsFiles)("a Flow is sent as having uncommitted changes when %s has some", async (_, changed) => {
  const { root } = committedHost();
  const { data } = await view(root);

  expect((await data()).changes.flows[flowId].uncommitted).toBe(false);

  change(root, changed);

  expect((await data()).changes.flows[flowId].uncommitted).toBe(true);
});

test("a change outside the Flow's files is not a change to the Flow, uncommitted or committed", async () => {
  const { root, first } = committedHost();
  const { data } = await view(root);
  fs.writeFileSync(path.join(root, "web/src/other.tsx"), "export const other = 1;\n");
  change(root, "knowledge-base/areas.yaml");

  expect((await data()).changes.flows[flowId]).toMatchObject({ uncommitted: false, last: { sha: first } });

  commitAll(root, "second");

  expect((await data()).changes.flows[flowId]).toMatchObject({ uncommitted: false, last: { sha: first } });
});

test.each(theFlowsFiles)("the last commit to change a Flow is the last to touch %s", async (_, changed) => {
  const { root } = committedHost();
  const { data } = await view(root);
  change(root, changed);
  const before = Date.now();
  const second = commitAll(root, "Reword the approval");
  fs.writeFileSync(path.join(root, "web/src/other.tsx"), "export const other = 1;\n");
  commitAll(root, "third");

  const { last } = (await data()).changes.flows[flowId];

  expect(last).toMatchObject({ sha: second, subject: "Reword the approval" });
  expect(Date.parse(last.date)).toBeGreaterThanOrEqual(before - 1000);
  expect(Date.parse(last.date)).toBeLessThanOrEqual(Date.now());
});

test("recent commits include code-unrelated columns without marking their Flows", async () => {
  const { root } = committedHost();
  const { data } = await view(root);
  change(root, codeFile);
  const second = commitAll(root, "Restyle the tool step");
  for (let n = 3; n <= 12; n++) {
    fs.writeFileSync(path.join(root, "web/src/other.tsx"), `export const other = ${n};\n`);
    commitAll(root, `commit ${n}`);
  }
  change(root, partFile);
  const last = commitAll(root, "Reword the Part");

  const { recent } = (await data()).changes;

  expect(recent).toHaveLength(13);
  expect(recent[0]).toMatchObject({ sha: last, subject: "Reword the Part", flows: [] });
  expect(recent[1]).toMatchObject({ subject: "commit 12", flows: [] });
  expect(recent.map((commit: { sha: string }) => commit.sha)).toContain(second);
});

test("a Flow whose Anchor points into a path with brackets changes with that file", async () => {
  const page = "web/app/[id]/page.tsx";
  const root = hostRepo({ ...knowledgeBase(`${page}#Page`, "screen"), [page]: "export function Page() {}\n" });
  commitAll(root, "first");
  const { data } = await view(root);
  change(root, page);
  const second = commitAll(root, "second");
  change(root, page);

  const { flows, recent } = (await data()).changes;

  expect(flows[flowId]).toMatchObject({ uncommitted: true, last: { sha: second } });
  expect(recent[0].flows).toEqual([flowId]);
});

test("outside a git repo no Flow has changes and there are no commits", async () => {
  const { data } = await view(hostRepo(knowledgeBase(`${codeFile}#ToolStep`, "screen")));

  expect((await data()).changes).toEqual({ flows: { [flowId]: { uncommitted: false } }, recent: [], uncommitted: { flows: [], near: [], files: [] } });
});

test.each(theFlowsFiles)("a result is sent with the commits that touched %s since it was recorded", async (_, changed) => {
  const { root } = committedHost();
  const { data, record } = await view(root);
  const sent = await record({ ...approve, state: "passed" });

  expect(sent.results[flowId].main.approve.since).toEqual({ commits: [], nearCommits: [], uncommitted: false, nearUncommitted: false, byDate: false });

  change(root, changed);
  const second = commitAll(root, "Reword the approval");
  fs.writeFileSync(path.join(root, "web/src/other.tsx"), "export const other = 1;\n");
  commitAll(root, "third");
  change(root, changed);
  const fourth = commitAll(root, "Reword it again");

  const { since } = (await data()).results[flowId].main.approve;

  expect(since.commits.map((commit: { sha: string }) => commit.sha)).toEqual([fourth, second]);
  expect(since.commits[1].subject).toBe("Reword the approval");
  expect(since).toMatchObject({ uncommitted: false, byDate: false });
});

test.each(theFlowsFiles)("a result says the Flow has uncommitted changes since when %s was changed after it", async (_, changed) => {
  const { root } = committedHost();
  const { data, record } = await view(root);
  await record({ ...approve, state: "passed" });

  change(root, changed);

  expect((await data()).results[flowId].main.approve.since).toEqual({ commits: [], nearCommits: [], uncommitted: true, nearUncommitted: false, byDate: false });
});

test("uncommitted changes a result was recorded with are not changes since", async () => {
  const { root } = committedHost();
  change(root, codeFile);
  // The file is as it was a minute before the result.
  const earlier = new Date(Date.now() - 60_000);
  fs.utimesSync(path.join(root, codeFile), earlier, earlier);
  const { record } = await view(root);

  const sent = await record({ ...approve, state: "passed" });

  expect(sent.changes.flows[flowId].uncommitted).toBe(true);
  expect(sent.results[flowId].main.approve).toMatchObject({ uncommitted: true, since: { commits: [], uncommitted: false } });
});

test("a file of the Flow deleted and not committed is an uncommitted change since", async () => {
  const { root } = committedHost();
  const { data, record } = await view(root);
  await record({ ...approve, state: "passed" });

  fs.rmSync(path.join(root, codeFile));

  expect((await data()).results[flowId].main.approve.since.uncommitted).toBe(true);
});

// Commits everything with the commit dated some minutes from now.
function commitAllAt(root: string, message: string, minutesFromNow: number) {
  process.env.GIT_COMMITTER_DATE = new Date(Date.now() + minutesFromNow * 60_000).toISOString();
  try {
    return commitAll(root, message);
  } finally {
    delete process.env.GIT_COMMITTER_DATE;
  }
}

test("a result whose commit is not in the branch's history is sent with the commits made after its date, and says so", async () => {
  const { root } = committedHost();
  const trunk = git(root, "branch", "--show-current");
  const { data, record } = await view(root);
  git(root, "checkout", "--quiet", "-b", "side");
  change(root, codeFile);
  commitAll(root, "on the side");
  await record({ ...approve, state: "passed" });

  git(root, "checkout", "--quiet", trunk);
  change(root, codeFile);
  commitAllAt(root, "an hour before the result", -60);
  change(root, codeFile);
  const after = commitAllAt(root, "an hour after the result", 60);
  fs.writeFileSync(path.join(root, "web/src/other.tsx"), "export const other = 1;\n");
  commitAllAt(root, "outside the Flow", 120);

  const { since } = (await data()).results[flowId].main.approve;

  expect(since.commits.map((commit: { sha: string }) => commit.sha)).toEqual([after]);
  expect(since.byDate).toBe(true);
});
