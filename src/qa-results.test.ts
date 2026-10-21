import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, test } from "vitest";
import { commitAll, git, hostRepo, knowledgeBase } from "./testing/host-repo.js";
import { startView, type View } from "./view.js";

const flowId = "approve-a-tool-call";
const approve = { flow: flowId, path: "main", step: "approve" };
const deny = { flow: flowId, path: "deny", step: "deny" };

const views: View[] = [];
afterEach(async () => {
  for (const view of views.splice(0)) await view.close();
});

const emptyFolder = () => fs.mkdtempSync(path.join(os.tmpdir(), "kb-home-"));

// A committed host repo holding one Flow, with the code its Part points into.
function committedHost() {
  const root = hostRepo({
    ...knowledgeBase("web/src/tool-step.tsx#ToolStep", "screen"),
    "web/src/tool-step.tsx": "export function ToolStep() {}\n",
  });
  return { root, first: commitAll(root, "first") };
}

// Starts the web view on a host repo, with a folder standing in for the Builder's home folder.
async function view(root: string, home = emptyFolder()) {
  const started = await startView(root, { port: 0, home });
  views.push(started);
  const post = (to: string, body: unknown) =>
    fetch(new URL(to, started.url), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return {
    home,
    post,
    data: async () => (await fetch(new URL("/api/data", started.url))).json(),
    record: async (body: unknown) => (await post("/api/result", body)).json(),
    close: async () => {
      views.splice(views.indexOf(started), 1);
      await started.close();
    },
  };
}

test("a result recorded on a QA Step is sent back with its state, its note, the commit and the moment", async () => {
  const { root, first } = committedHost();
  const { record, data } = await view(root);
  const before = Date.now();

  const sent = await record({ ...approve, state: "failed", note: "The button did nothing." });

  const result = sent.results[flowId].main.approve;
  expect(result).toMatchObject({ state: "failed", note: "The button did nothing.", commit: first, uncommitted: false });
  expect(Date.parse(result.date)).toBeGreaterThanOrEqual(before);
  expect(Date.parse(result.date)).toBeLessThanOrEqual(Date.now());
  expect((await data()).results).toEqual(sent.results);
});

test("results survive a restart of the web view and a change of branch, in one file per repo in the home folder", async () => {
  const { root, first } = committedHost();
  const before = await view(root);
  await before.record({ ...approve, state: "passed" });
  await before.close();
  git(root, "checkout", "--quiet", "-b", "other");
  commitAll(root, "second");

  const sent = await (await view(root, before.home)).data();

  expect(sent.results[flowId].main.approve).toMatchObject({ state: "passed", note: "", commit: first });
  expect(sent.resultsFile).toBe(path.join(before.home, ".fledgy", first, "qa-results.json"));
  expect(fs.existsSync(sent.resultsFile)).toBe(true);
});

test.each([
  ["the Flow's file", "knowledge-base/flows/approve-a-tool-call.yaml", false],
  ["the file of a Part it uses", "knowledge-base/parts/tool-approval.yaml", false],
  ["an anchored function", "web/src/tool-step.tsx", true],
] as const)("a result records code changes only when editing %s", async (_, changed, expected) => {
  const { root } = committedHost();
  if (expected) fs.writeFileSync(path.join(root, changed), "export function ToolStep() { return <div />; }\n");
  else fs.appendFileSync(path.join(root, changed), "\n");
  const { record } = await view(root);

  const sent = await record({ ...approve, state: "passed" });

  expect(sent.results[flowId].main.approve.uncommitted).toBe(expected);
});

test("uncommitted changes outside the Flow do not mark its results", async () => {
  const { root } = committedHost();
  fs.writeFileSync(path.join(root, "web/src/other.tsx"), "export const other = 1;\n");
  fs.appendFileSync(path.join(root, "knowledge-base/areas.yaml"), "\n");
  const { record } = await view(root);

  const sent = await record({ ...approve, state: "passed" });

  expect(sent.results[flowId].main.approve.uncommitted).toBe(false);
});

test("recording a QA Step again stamps it with the current commit, while editing its note changes only the note", async () => {
  const { root, first } = committedHost();
  const { record, post, data } = await view(root);
  await record({ ...approve, state: "passed" });
  await record({ ...deny, state: "passed" });
  const second = commitAll(root, "second");

  await post("/api/note", { ...approve, note: "Slow, but it ran." });
  await record({ ...deny, state: "passed" });

  const { results } = await data();
  expect(results[flowId].main.approve).toMatchObject({ state: "passed", note: "Slow, but it ran.", commit: first });
  expect(results[flowId].deny.deny).toMatchObject({ state: "passed", commit: second });
});

test("setting a QA Step back to not checked removes its result and leaves the others", async () => {
  const { root } = committedHost();
  const { record } = await view(root);
  await record({ ...approve, state: "passed" });
  await record({ ...deny, state: "failed" });

  const sent = await record({ ...approve, state: "not-checked" });

  expect(sent.results).toEqual({ [flowId]: { deny: { deny: expect.objectContaining({ state: "failed" }) } } });
});

test("resetting a path removes its results and leaves the other paths'", async () => {
  const { root } = committedHost();
  const { record, post, data } = await view(root);
  await record({ ...approve, state: "passed" });
  await record({ ...deny, state: "failed" });

  const reset = await post("/api/result-reset", { flow: flowId, path: "main" });

  expect(reset.status).toBe(200);
  expect((await data()).results).toEqual({ [flowId]: { deny: { deny: expect.objectContaining({ state: "failed" }) } } });
});

test("a result whose QA Step is gone is kept in the file and not sent, and is sent again when the step returns", async () => {
  const { root } = committedHost();
  const file = path.join(root, "knowledge-base/flows/approve-a-tool-call.yaml");
  const whole = fs.readFileSync(file, "utf8");
  const { record, data } = await view(root);
  await record({ ...approve, state: "passed" });
  await record({ ...deny, state: "failed" });

  fs.writeFileSync(file, whole.replace("- id: deny\n          do:", "- id: refuse\n          do:"));
  const without = await data();

  expect(without.results).toEqual({ [flowId]: { main: { approve: expect.objectContaining({ state: "passed" }) } } });
  expect(JSON.parse(fs.readFileSync(without.resultsFile, "utf8")).results[flowId].deny.deny.state).toBe("failed");

  fs.writeFileSync(file, whole);

  expect((await data()).results[flowId].deny.deny.state).toBe("failed");
});

test("a result is refused for a QA Step the knowledge base does not have, and for a state that is not one of the four", async () => {
  const { root } = committedHost();
  const { post, data } = await view(root);

  const noStep = await post("/api/result", { ...approve, step: "__proto__", state: "passed" });
  const noFlow = await post("/api/result", { ...approve, flow: "nothing", state: "passed" });
  const noState = await post("/api/result", { ...approve, state: "ticked" });

  expect([noStep.status, noFlow.status, noState.status]).toEqual([400, 400, 400]);
  expect((await noStep.json()).error).toBe("No QA Step __proto__ on the path main of the Flow approve-a-tool-call.");
  expect((await data()).results).toEqual({});
});

test("in a repo with no commit there is no results file, and recording says why", async () => {
  const root = hostRepo(knowledgeBase("web/src/tool-step.tsx#ToolStep", "screen"));
  const { post, data } = await view(root);

  const refused = await post("/api/result", { ...approve, state: "passed" });

  expect(refused.status).toBe(409);
  expect((await refused.json()).error).toBe("QA Results need a git repo with at least one commit.");
  expect(await data()).toMatchObject({ results: {}, resultsFile: null });
});

test("a request another web page could send without asking is refused", async () => {
  const { root } = committedHost();
  const { post, data } = await view(root);
  const { url } = views.at(-1)!;

  const sneaked = await fetch(new URL("/api/result", url), {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: JSON.stringify({ ...approve, state: "passed" }),
  });

  expect(sneaked.status).toBe(415);
  expect((await data()).results).toEqual({});
  expect((await post("/api/result", { ...approve, state: "passed" })).status).toBe(200);
});
