import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { hostRepo, knowledgeBase } from "./testing/host-repo.js";

const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));

// Runs the built binary from `web/`, as it will be on a host whose only
// package.json is in a subfolder.
function check(root: string) {
  spawnSync("git", ["init", "--quiet"], { cwd: root });
  return spawnSync("node", [cli, "check"], { cwd: path.join(root, "web"), encoding: "utf8" });
}

test("check exits 0 when every Anchor resolves", () => {
  const root = hostRepo({
    ...knowledgeBase("web/src/tool-step.tsx#ToolStep", "screen"),
    "web/src/tool-step.tsx": "export function ToolStep() {\n  return <div />;\n}\n",
  });

  const run = check(root);

  expect(run.stderr).toBe("");
  expect(run.status).toBe(0);
  expect(run.stdout).toBe("Knowledge base check passed.\n");
});

test("check exits 1 and names the Part, the Anchor and what is wrong", () => {
  const root = hostRepo({
    ...knowledgeBase("web/src/tool-step.tsx#ToolStep", "screen"),
    "web/src/tool-step.tsx": "export function ToolCard() {\n  return <div />;\n}\n",
  });

  const run = check(root);

  expect(run.status).toBe(1);
  expect(run.stdout).toMatch(/^Knowledge base check failed: 1 problem\.\n/);
  expect(run.stdout).toContain("tool-approval");
  expect(run.stdout).toContain("The tool step and its buttons");
  expect(run.stdout).toContain("symbol gone");
  expect(run.stdout).toContain("web/src/tool-step.tsx#ToolStep");
});

test("check exits 1 and names the file when a knowledge base file is not valid YAML", () => {
  const root = hostRepo({
    ...knowledgeBase("web/src/tool-step.tsx#ToolStep", "screen"),
    "knowledge-base/areas.yaml": "chat: [unclosed",
    "web/src/tool-step.tsx": "export function ToolStep() {\n  return <div />;\n}\n",
  });

  const run = check(root);

  expect(run.stderr).toBe("");
  expect(run.status).toBe(1);
  expect(run.stdout).toContain("✗ knowledge-base/areas.yaml: not valid YAML");
});

test("view serves the knowledge base of the repo it is started in, and says where", async () => {
  const root = hostRepo({
    "knowledge-base/areas.yaml": "chat:\n  name: Chat\n  is: Talking to an agent in a thread.\n",
    "web/package.json": "{}",
  });
  spawnSync("git", ["init", "--quiet"], { cwd: root });
  const running = spawn("node", [cli, "view", "--port", "0"], { cwd: path.join(root, "web") });

  try {
    const said = await new Promise<string>((resolve) => running.stdout.once("data", (chunk) => resolve(String(chunk))));
    const [url] = said.match(/http:\/\/localhost:\d+\//) ?? [];

    expect(url).toBeDefined();
    const data = await (await fetch(new URL("/api/data", url))).json();
    expect(data.areas).toEqual({ chat: { name: "Chat", is: "Talking to an agent in a thread." } });
    expect((await fetch(url!)).status).toBe(200);
  } finally {
    running.kill();
  }
});
