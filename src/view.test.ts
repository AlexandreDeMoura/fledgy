import fs from "node:fs";
import path from "node:path";
import { afterEach, expect, test } from "vitest";
import { hostRepo, partWithAnchor } from "./testing/host-repo.js";
import { startView, type View } from "./view.js";

const flow = `name: Approve a tool call
area: chat
actor: member
goal: Let the agent run a tool that needs approval.
trigger: The agent decides to call a tool marked "needs approval".
outcome: The tool has run.
steps:
  - id: ask
    sees: The tool step opens with Approve and Deny buttons.
    system: The run ends with status "interrupted".
    parts: [tool-approval]
  - id: decide
    does: Clicks Approve.
    parts: [tool-approval]
  - id: finish
    sees: The reply continues to its end.
qa:
  setup:
    - Sign in as a Member.
  steps:
    - do: Click Approve.
      expect: The agent finishes its reply.
`;

const views: View[] = [];
afterEach(async () => {
  for (const view of views.splice(0)) await view.close();
});

// Starts the web view on a throwaway host repo and reads what it sends the page.
async function view(files: Record<string, string>) {
  const root = hostRepo(files);
  const started = await startView(root, { port: 0 });
  views.push(started);
  const get = (path: string) => fetch(new URL(path, started.url));
  return { root, get, data: async () => (await get("/api/data")).json() };
}

test("a Flow is sent under its file name, with its Area and its main path", async () => {
  const { data } = await view({ "knowledge-base/flows/approve-a-tool-call.yaml": flow });

  const sent = (await data()).flows["approve-a-tool-call"];

  expect(sent.name).toBe("Approve a tool call");
  expect(sent.area).toBe("chat");
  expect(sent.paths).toHaveLength(1);
  expect(sent.paths[0]).toMatchObject({ id: "main", name: "Main path", outcome: "The tool has run." });
  expect(sent.paths[0].steps.map((step: { id: string }) => step.id)).toEqual(["ask", "decide", "finish"]);
  expect(sent.paths[0].qa.steps).toEqual([{ do: "Click Approve.", expect: "The agent finishes its reply." }]);
});

const denyVariant = `variants:
  - id: deny
    name: The Member denies the call
    diverges_at: decide
    when: The Member clicks Deny instead of Approve.
    outcome: The tool was never run.
    steps:
      - id: decide
        does: Clicks Deny.
        parts: [tool-approval]
      - id: refuse
        sees: The tool step shows DENIED.
    qa:
      setup:
        - Same as the main path.
      steps:
        - do: Click Deny.
          expect: The tool step shows DENIED.
`;

test("a Variant is sent as a path that starts with the main path's Steps before it diverges", async () => {
  const { data } = await view({ "knowledge-base/flows/approve-a-tool-call.yaml": flow + denyVariant });

  const [main, deny] = (await data()).flows["approve-a-tool-call"].paths;

  expect(main.steps.map((step: { id: string }) => step.id)).toEqual(["ask", "decide", "finish"]);
  expect(deny).toMatchObject({
    id: "deny",
    name: "The Member denies the call",
    when: "The Member clicks Deny instead of Approve.",
    outcome: "The tool was never run.",
    divergesAt: 1,
    qa: { setup: ["Same as the main path."], steps: [{ do: "Click Deny.", expect: "The tool step shows DENIED." }] },
  });
  expect(deny.steps).toEqual([
    {
      id: "ask",
      sees: "The tool step opens with Approve and Deny buttons.",
      system: 'The run ends with status "interrupted".',
      parts: ["tool-approval"],
      shared: true,
    },
    { id: "decide", does: "Clicks Deny.", parts: ["tool-approval"] },
    { id: "refuse", sees: "The tool step shows DENIED." },
  ]);
});

test("a Variant that diverges at a Step the main path does not have is sent with its own Steps only", async () => {
  const { data } = await view({
    "knowledge-base/flows/approve-a-tool-call.yaml": flow + denyVariant.replace("diverges_at: decide", "diverges_at: choose"),
  });

  const [, deny] = (await data()).flows["approve-a-tool-call"].paths;

  expect(deny.steps.map((step: { id: string }) => step.id)).toEqual(["decide", "refuse"]);
  expect(deny).not.toHaveProperty("divergesAt");
});

test("Actors, Areas and Parts are sent by id, with the host repo's folder and name", async () => {
  const { root, data } = await view({
    "knowledge-base/actors.yaml": "member:\n  name: Member\n  is: A signed-in person.\n",
    "knowledge-base/areas.yaml": "chat:\n  name: Chat\n  is: Talking to an agent in a thread.\n",
    "knowledge-base/flows/approve-a-tool-call.yaml": flow,
    "knowledge-base/parts/tool-approval.yaml": partWithAnchor("web/src/tool-step.tsx#ToolStep", "screen"),
  });

  const sent = await data();

  expect(sent.actors).toEqual({ member: { name: "Member", is: "A signed-in person." } });
  expect(sent.areas).toEqual({ chat: { name: "Chat", is: "Talking to an agent in a thread." } });
  expect(sent.parts["tool-approval"]).toEqual({
    name: "Tool approval",
    is: "Stops the agent before it runs a tool that needs approval.",
    anchors: [{ label: "The tool step and its buttons", at: "web/src/tool-step.tsx#ToolStep", side: "screen" }],
  });
  expect(sent.repo).toEqual({ name: path.basename(root), root });
});

test("an Area is sent with its Flows to write, by id", async () => {
  const { data } = await view({
    "knowledge-base/areas.yaml":
      "chat:\n  name: Chat\n  is: Talking to an agent in a thread.\n  flows_to_write:\n    start-a-thread:\n      name: Start a thread\n      is: A Member opens a thread.\n",
  });

  expect((await data()).areas.chat.flows_to_write).toEqual({
    "start-a-thread": { name: "Start a thread", is: "A Member opens a thread." },
  });
});

test("a Mapping record beside the knowledge base files is left out of what is sent", async () => {
  const { get, data } = await view({
    "knowledge-base/areas.yaml": "chat:\n  name: Chat\n  is: Talking to an agent in a thread.\n",
    "knowledge-base/flows/approve-a-tool-call.yaml": flow,
    "knowledge-base/mapping-record.md": "# Mapping record\n\n| Area | Is |\n|---|---|\n| Chat: | - [ a\n",
  });

  expect((await get("/api/data")).status).toBe(200);
  const sent = await data();
  expect(Object.keys(sent.flows)).toEqual(["approve-a-tool-call"]);
  expect(Object.keys(sent.areas)).toEqual(["chat"]);
  expect(JSON.stringify(sent)).not.toContain("Mapping record");
});

test("a file that is not valid YAML is reported by name, and read again once it is mended", async () => {
  const file = "knowledge-base/flows/approve-a-tool-call.yaml";
  const { root, get, data } = await view({ [file]: "name: [Approve a tool call\n" });

  const broken = await get("/api/data");

  expect(broken.status).toBe(500);
  expect((await broken.json()).error).toContain(file);

  fs.writeFileSync(path.join(root, file), flow);

  expect((await data()).flows["approve-a-tool-call"].name).toBe("Approve a tool call");
});

test("the page is served with its script and its stylesheet, and nothing else", async () => {
  const { get } = await view({ "knowledge-base/flows/approve-a-tool-call.yaml": flow });

  const page = await get("/");
  const script = await get("/view.js");
  const styles = await get("/view.css");

  expect(page.headers.get("content-type")).toBe("text/html; charset=utf-8");
  expect(await page.text()).toContain('<script src="/view.js">');
  expect(script.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
  expect(script.status).toBe(200);
  expect(styles.headers.get("content-type")).toBe("text/css; charset=utf-8");
  expect(styles.status).toBe(200);
  expect((await get("/../package.json")).status).toBe(404);
  expect((await get("/view.ts")).status).toBe(404);
});
