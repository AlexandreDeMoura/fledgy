import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Writes a throwaway host repo to a temp folder: keys are paths from its root.
export function hostRepo(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "kb-host-"));
  for (const [file, content] of Object.entries(files)) {
    const full = path.join(root, file);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return root;
}

// A Part file with one Anchor, in the knowledge base format.
export function partWithAnchor(at: string, side: "screen" | "backend"): string {
  return [
    "name: Tool approval",
    "is: Stops the agent before it runs a tool that needs approval.",
    "anchors:",
    "  - label: The tool step and its buttons",
    `    at: ${at}`,
    `    side: ${side}`,
    "",
  ].join("\n");
}

// A Flow file whose every Step names the Part `tool-approval`.
export const flow = [
  "name: Approve a tool call",
  "area: chat",
  "actor: member",
  "goal: Let the agent run a tool that needs approval.",
  "trigger: The agent decides to call a tool marked as needing approval.",
  "outcome: The tool has run.",
  "preconditions:",
  "  - The Member is signed in.",
  "steps:",
  "  - id: ask",
  "    sees: The tool step opens with Approve and Deny buttons.",
  "    system: The run stops and waits for a decision.",
  "    parts: [tool-approval]",
  "  - id: decide",
  "    does: Clicks Approve.",
  "    system: The tool is called.",
  "    parts: [tool-approval]",
  "qa:",
  "  setup:",
  "    - Sign in as a Member.",
  "  steps:",
  "    - id: approve",
  "      do: Click Approve.",
  "      expect: The tool runs.",
  "variants:",
  "  - id: deny",
  "    name: The Member denies the call",
  "    diverges_at: decide",
  "    when: The Member clicks Deny.",
  "    outcome: The tool was never run.",
  "    steps:",
  "      - id: decide",
  "        does: Clicks Deny.",
  "        system: The agent is told the call was refused.",
  "        parts: [tool-approval]",
  "    qa:",
  "      setup:",
  "        - Same as the main path.",
  "      steps:",
  "        - id: deny",
  "          do: Click Deny.",
  "          expect: The tool does not run.",
  "",
].join("\n");

// A whole knowledge base that breaks no rule: one Actor, one Area, one Flow
// and the Part its Steps name, with one Anchor. The code the Anchor points
// into is not written.
export function knowledgeBase(at: string, side: "screen" | "backend"): Record<string, string> {
  return {
    "knowledge-base/actors.yaml": "member:\n  name: Member\n  is: A signed-in person who chats with agents.\n",
    "knowledge-base/areas.yaml": "chat:\n  name: Chat\n  is: Talking to an agent in a thread.\n",
    "knowledge-base/flows/approve-a-tool-call.yaml": flow,
    "knowledge-base/parts/tool-approval.yaml": partWithAnchor(at, side),
  };
}

// Runs git in a host repo and returns what it prints.
export function git(root: string, ...args: string[]): string {
  const identity = ["-c", "user.name=Builder", "-c", "user.email=builder@example.com"];
  return execFileSync("git", [...identity, ...args], { cwd: root, encoding: "utf8" }).trim();
}

// Commits everything in a host repo, making it a git repo first if it is not one, and returns the commit's id.
export function commitAll(root: string, message: string): string {
  if (!fs.existsSync(path.join(root, ".git"))) git(root, "init", "--quiet");
  git(root, "add", "--all");
  git(root, "commit", "--quiet", "--allow-empty", "--message", message);
  return git(root, "rev-parse", "HEAD");
}
