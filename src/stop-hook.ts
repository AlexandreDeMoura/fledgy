import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { saveKnowledgeBaseVersion } from "./history.js";
import { type Problem, runDeterministicCheck } from "./deterministic-check.js";

// What Claude Code reads from a Stop hook's stdout: `decision: "block"` sends
// the agent back with `reason`; `systemMessage` is shown to the Builder.
export type Answer = { decision: "block"; reason: string } | { systemMessage: string };

export function problemLines(problems: Problem[]): string {
  return problems
    .map((problem) =>
      "file" in problem
        ? `  ✗ ${problem.file}: ${problem.wrong}`
        : `  ✗ Part ${problem.part}, Anchor "${problem.anchor}": ${problem.wrong} (${problem.at})`,
    )
    .join("\n");
}

// Runs the Deterministic Check when the agent tries to stop. A failing check
// sends the agent back once; if it still fails when the agent stops again,
// the agent is let go and the Builder is shown what is left. `sentBackAlready`
// is Claude Code's `stop_hook_active`.
export async function stopHook(repoRoot: string, sentBackAlready: boolean, home = os.homedir()): Promise<Answer | undefined> {
  // A host that ran `init` before writing its first Flow has nothing to check.
  const exists = fs.existsSync(path.join(repoRoot, "knowledge-base"));
  const failing = exists ? await whatFails(repoRoot) : undefined;
  try { saveKnowledgeBaseVersion(repoRoot, home); } catch {
    // Personal history must never change the Stop hook's answer.
  }
  if (!failing) return undefined;
  // No command is suggested to the Builder: in a private install `npx fledgy
  // check` would fetch a copy from npm, and the agent knows the right one.
  if (sentBackAlready) {
    return {
      systemMessage:
        "Fledgy: the knowledge base still fails its check and the agent stopped without fixing it. " +
        `Ask it to fix the knowledge base.\n\n${failing}`,
    };
  }
  return {
    decision: "block",
    reason:
      `The knowledge base fails its Deterministic Check.\n\n${failing}\n\n` +
      "Repair the knowledge base now: follow the maintain-knowledge-base skill to make it true again.\n\n" +
      "This is the one time you are sent back. When you stop again you will be let go whatever the check says, " +
      "and the Builder will be shown whatever still fails. That is not leave to stop with the check failing: " +
      "it only means nothing will ask you again, so the repair has to happen in this turn. " +
      "If something here cannot be fixed, tell the Builder exactly what is still failing and why before you stop, " +
      "and do not tell them the hook will keep blocking.",
  };
}

// A file the check cannot read is a failure like any other: the agent is the
// one who can repair it.
async function whatFails(repoRoot: string): Promise<string | undefined> {
  try {
    const problems = await runDeterministicCheck(repoRoot);
    return problems.length === 0 ? undefined : problemLines(problems);
  } catch (error) {
    return `  ✗ The check could not run: ${(error as Error).message}`;
  }
}
