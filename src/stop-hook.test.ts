import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { hostRepo, knowledgeBase } from "./testing/host-repo.js";

const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));

const resolving = {
  ...knowledgeBase("web/src/tool-step.tsx#ToolStep", "screen"),
  "web/src/tool-step.tsx": "export function ToolStep() {\n  return <div />;\n}\n",
};
// The symbol the Anchor names was renamed and the knowledge base was not updated.
const broken = { ...resolving, "web/src/tool-step.tsx": "export function ToolCard() {\n  return <div />;\n}\n" };

// Runs the built binary as Claude Code runs a Stop hook: what it knows about
// the stop on stdin, the answer read from stdout. `stop_hook_active` is true
// when the agent is stopping again after a hook already sent it back.
function stopHook(root: string, { sentBackAlready }: { sentBackAlready: boolean }) {
  spawnSync("git", ["init", "--quiet"], { cwd: root });
  const run = spawnSync("node", [cli, "stop-hook"], {
    cwd: path.join(root, "web"),
    input: JSON.stringify({ hook_event_name: "Stop", stop_hook_active: sentBackAlready }),
    encoding: "utf8",
  });
  return { status: run.status, stderr: run.stderr, answer: run.stdout === "" ? undefined : JSON.parse(run.stdout) };
}

test("the Stop hook lets the agent stop, saying nothing, when the check passes", () => {
  const run = stopHook(hostRepo(resolving), { sentBackAlready: false });

  expect(run).toEqual({ status: 0, stderr: "", answer: undefined });
});

test("the Stop hook sends the agent back with the list of problems when the check fails", () => {
  const run = stopHook(hostRepo(broken), { sentBackAlready: false });

  expect(run.status).toBe(0);
  expect(run.answer.decision).toBe("block");
  expect(run.answer.reason).toContain(
    '✗ Part tool-approval, Anchor "The tool step and its buttons": symbol gone (web/src/tool-step.tsx#ToolStep)',
  );
  expect(run.answer.reason).toContain("tell the Builder");
});

test("the Stop hook tells the agent it is sent back this one time, and that the Builder will see what still fails", () => {
  const run = stopHook(hostRepo(broken), { sentBackAlready: false });

  expect(run.answer.reason).toContain("Repair the knowledge base now");
  expect(run.answer.reason).toContain("This is the one time you are sent back");
  expect(run.answer.reason).toContain("the Builder will be shown whatever still fails");
});

test("the Stop hook lets the agent stop the second time, and shows the Builder what still fails", () => {
  const run = stopHook(hostRepo(broken), { sentBackAlready: true });

  expect(run.status).toBe(0);
  expect(run.answer.decision).toBeUndefined();
  expect(run.answer.systemMessage).toMatch(
    /^Fledgy: the knowledge base still fails its check and the agent stopped without fixing it\. Ask it to fix the knowledge base\.\n\n/,
  );
  expect(run.answer.systemMessage).toContain(
    '✗ Part tool-approval, Anchor "The tool step and its buttons": symbol gone (web/src/tool-step.tsx#ToolStep)',
  );
});

test("the Stop hook sends the agent back when a knowledge base file is not valid YAML", () => {
  const root = hostRepo({ ...resolving, "knowledge-base/parts/tool-approval.yaml": "anchors: [unclosed" });

  const run = stopHook(root, { sentBackAlready: false });

  expect(run.status).toBe(0);
  expect(run.answer.decision).toBe("block");
  expect(run.answer.reason).toContain("✗ knowledge-base/parts/tool-approval.yaml: not valid YAML");
});

test("the Stop hook lets the agent stop in a repo that has no knowledge base yet", () => {
  const run = stopHook(hostRepo({ "web/package.json": "{}" }), { sentBackAlready: false });

  expect(run).toEqual({ status: 0, stderr: "", answer: undefined });
});
