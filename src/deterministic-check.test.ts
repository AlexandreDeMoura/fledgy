import { describe, expect, test } from "vitest";
import { runDeterministicCheck } from "./deterministic-check.js";
import { flow, hostRepo, knowledgeBase } from "./testing/host-repo.js";

describe("an Anchor into a TSX file", () => {
  const at = "web/src/tool-step.tsx#ToolStep";
  const part = knowledgeBase(at, "screen");

  test("resolves when the symbol is defined once", async () => {
    const root = hostRepo({
      ...part,
      "web/src/tool-step.tsx": "export function ToolStep() {\n  return <div>Approve</div>;\n}\n",
    });

    expect(await runDeterministicCheck(root)).toEqual([]);
  });

  test("fails with file gone when the file does not exist", async () => {
    const root = hostRepo(part);

    expect(await runDeterministicCheck(root)).toEqual([
      { part: "tool-approval", anchor: "The tool step and its buttons", at, wrong: "file gone" },
    ]);
  });

  test("fails with symbol gone when the file no longer defines it", async () => {
    const root = hostRepo({
      ...part,
      "web/src/tool-step.tsx": "export function ToolCard() {\n  return <div>ToolStep</div>;\n}\n",
    });

    expect(await runDeterministicCheck(root)).toEqual([
      { part: "tool-approval", anchor: "The tool step and its buttons", at, wrong: "symbol gone" },
    ]);
  });

  test("fails with symbol defined more than once when the file defines it twice", async () => {
    const root = hostRepo({
      ...part,
      "web/src/tool-step.tsx": "export type ToolStep = { id: string };\nexport const ToolStep = () => <div />;\n",
    });

    expect(await runDeterministicCheck(root)).toEqual([
      { part: "tool-approval", anchor: "The tool step and its buttons", at, wrong: "symbol defined more than once" },
    ]);
  });
});

describe("an Anchor into a Python file", () => {
  const at = "backend/app/runtime/hitl.py#build_resume_command";
  const part = knowledgeBase(at, "backend");

  test("resolves when the symbol is defined once", async () => {
    const root = hostRepo({
      ...part,
      "backend/app/runtime/hitl.py": "def build_resume_command(decisions):\n    return decisions\n",
    });

    expect(await runDeterministicCheck(root)).toEqual([]);
  });

  test("fails with file gone when the file does not exist", async () => {
    const root = hostRepo(part);

    expect(await runDeterministicCheck(root)).toEqual([
      { part: "tool-approval", anchor: "The tool step and its buttons", at, wrong: "file gone" },
    ]);
  });

  test("fails with symbol gone when the file only uses the name", async () => {
    const root = hostRepo({
      ...part,
      "backend/app/runtime/hitl.py":
        "from app.runtime.resume import build_resume_command\n\ndef resume(decisions):\n    return build_resume_command(decisions)\n",
    });

    expect(await runDeterministicCheck(root)).toEqual([
      { part: "tool-approval", anchor: "The tool step and its buttons", at, wrong: "symbol gone" },
    ]);
  });

  test("fails with symbol defined more than once when the file defines it twice", async () => {
    const root = hostRepo({
      ...part,
      "backend/app/runtime/hitl.py":
        "def build_resume_command(decisions):\n    return decisions\n\nbuild_resume_command = None\n",
    });

    expect(await runDeterministicCheck(root)).toEqual([
      { part: "tool-approval", anchor: "The tool step and its buttons", at, wrong: "symbol defined more than once" },
    ]);
  });
});

describe("an Anchor written as Class.member", () => {
  const anchor = "The tool step and its buttons";

  test("resolves to a method of that class in Python", async () => {
    const at = "backend/app/runtime/toolset.py#Toolset.prepare";
    const root = hostRepo({
      ...knowledgeBase(at, "backend"),
      "backend/app/runtime/toolset.py":
        "class Other:\n    def prepare(self):\n        pass\n\n@dataclass\nclass Toolset:\n    @classmethod\n    async def prepare(cls):\n        pass\n",
    });

    expect(await runDeterministicCheck(root)).toEqual([]);
  });

  test("is not satisfied by a function of the same name outside the class", async () => {
    const at = "backend/app/runtime/toolset.py#Toolset.prepare";
    const root = hostRepo({
      ...knowledgeBase(at, "backend"),
      "backend/app/runtime/toolset.py": "class Toolset:\n    pass\n\ndef prepare():\n    pass\n",
    });

    expect(await runDeterministicCheck(root)).toEqual([
      { part: "tool-approval", anchor, at, wrong: "symbol gone" },
    ]);
  });

  test("resolves to a method of that class in TypeScript", async () => {
    const at = "web/src/lib/toolset.ts#Toolset.prepare";
    const root = hostRepo({
      ...knowledgeBase(at, "screen"),
      "web/src/lib/toolset.ts":
        "export class Toolset {\n  prepare(name: string): void;\n  prepare(name: unknown): void {}\n}\nfunction prepare() {}\n",
    });

    expect(await runDeterministicCheck(root)).toEqual([]);
  });
});

// A knowledge base that breaks no rule, with the code its one Anchor points into.
const sound: Record<string, string> = {
  ...knowledgeBase("web/src/tool-step.tsx#ToolStep", "screen"),
  "web/src/tool-step.tsx": "export function ToolStep() {\n  return <div />;\n}\n",
};
const flowFile = "knowledge-base/flows/approve-a-tool-call.yaml";
const partFile = "knowledge-base/parts/tool-approval.yaml";

// The problems found in `sound` once `changes` are laid over it. A file set
// to `undefined` is left out.
async function problemsWith(changes: Record<string, string | undefined>) {
  const files = Object.entries({ ...sound, ...changes }).filter((entry): entry is [string, string] => entry[1] !== undefined);
  return runDeterministicCheck(hostRepo(Object.fromEntries(files)));
}

describe("a model rule", () => {
  test("is not broken by a knowledge base where every Part is named and every path has its Manual QA Check", async () => {
    expect(await problemsWith({})).toEqual([]);
  });

  // The Mapping record is kept in the knowledge base folder while an app is
  // mapped from zero. It is Markdown, and not part of the knowledge base.
  test("is not broken by a Mapping record beside the knowledge base files", async () => {
    const problems = await problemsWith({
      "knowledge-base/mapping-record.md": "# Mapping record\n\n| Area | Is |\n|---|---|\n| Chat: | - [ a\n",
    });

    expect(problems).toEqual([]);
  });

  test("fails when a Step says what the system does and names no Part", async () => {
    const problems = await problemsWith({
      [flowFile]: flow.replace("    system: The tool is called.\n    parts: [tool-approval]\n", "    system: The tool is called.\n"),
    });

    expect(problems).toEqual([
      { file: flowFile, wrong: 'Step "decide" of the main path says what the system does and names no Part' },
    ]);
  });

  test("fails when no Step names a Part", async () => {
    const problems = await problemsWith({
      "knowledge-base/parts/run-queue.yaml": sound[partFile]!,
    });

    expect(problems).toEqual([{ file: "knowledge-base/parts/run-queue.yaml", wrong: "no Step names this Part" }]);
  });

  test("fails when a path has no Manual QA Check", async () => {
    const problems = await problemsWith({ [flowFile]: flow.slice(0, flow.indexOf("    qa:\n      setup:\n        - Same")) });

    expect(problems).toEqual([{ file: flowFile, wrong: 'Variant "deny" has no Manual QA Check (`qa`)' }]);
  });

  test("fails when a Part has no Anchor", async () => {
    const problems = await problemsWith({
      [partFile]: "name: Tool approval\nis: Stops the agent before it runs a tool.\nanchors: []\n",
    });

    expect(problems).toEqual([{ file: partFile, wrong: "the Part has no Anchor" }]);
  });
});

describe("a malformed file", () => {
  test("fails when a file is not valid YAML, and the other files are still checked", async () => {
    const problems = await problemsWith({ "knowledge-base/actors.yaml": "member: [unclosed" });

    expect(problems).toEqual([
      { file: "knowledge-base/actors.yaml", wrong: expect.stringContaining("not valid YAML") },
      { file: flowFile, wrong: 'names the Actor "member", which is not in actors.yaml' },
    ]);
  });

  test("fails when the parts folder is missing", async () => {
    const problems = await problemsWith({ [partFile]: undefined });

    expect(problems).toContainEqual({
      file: flowFile,
      wrong: 'Step "ask" of the main path names the Part "tool-approval", which has no file',
    });
  });

  test("fails when a Flow is missing a required field", async () => {
    const problems = await problemsWith({ [flowFile]: flow.replace(/^goal: .*\n/m, "") });

    expect(problems).toEqual([{ file: flowFile, wrong: "the Flow is missing `goal`" }]);
  });

  test("fails when a Flow does not name its Area", async () => {
    const problems = await problemsWith({ [flowFile]: flow.replace("area: chat\n", "") });

    expect(problems).toEqual([{ file: flowFile, wrong: "the Flow is missing `area`" }]);
  });

  test("fails when a Flow file sits in a folder under flows/", async () => {
    const nested = "knowledge-base/flows/chat/approve-a-tool-call.yaml";
    const problems = await problemsWith({ [flowFile]: undefined, [nested]: flow });

    expect(problems).toEqual([{ file: nested, wrong: "a Flow file sits directly under flows/, and names its Area in `area`" }]);
  });

  test("fails when an Anchor has no side", async () => {
    const problems = await problemsWith({ [partFile]: sound[partFile]!.replace("    side: screen\n", "") });

    expect(problems).toEqual([
      { file: partFile, wrong: 'Anchor "The tool step and its buttons": `side` is neither screen nor backend' },
    ]);
  });

  test("fails when a Step has nothing in it", async () => {
    const problems = await problemsWith({
      [flowFile]: flow.replace(
        "        does: Clicks Deny.\n        system: The agent is told the call was refused.\n        parts: [tool-approval]\n",
        "",
      ),
    });

    expect(problems).toEqual([
      { file: flowFile, wrong: 'Step "decide" of Variant "deny" has none of `does`, `sees`, `system`' },
    ]);
  });

  test("fails when a QA Step has no id", async () => {
    const problems = await problemsWith({ [flowFile]: flow.replace("        - id: deny\n          do:", "        - do:") });

    expect(problems).toEqual([
      { file: flowFile, wrong: 'QA Step 1 of the Manual QA Check of Variant "deny" is missing `id`' },
    ]);
  });

  test("fails when a Manual QA Check has two QA Steps with the same id", async () => {
    const problems = await problemsWith({
      [flowFile]: flow.replace(
        "          expect: The tool does not run.\n",
        "          expect: The tool does not run.\n        - id: deny\n          do: Read the reply.\n          expect: It carries on without the tool.\n",
      ),
    });

    expect(problems).toEqual([
      { file: flowFile, wrong: 'the Manual QA Check of Variant "deny" has two QA Steps with the id "deny"' },
    ]);
  });

  test("passes when two Manual QA Checks of a Flow use the same QA Step id", async () => {
    expect(await problemsWith({ [flowFile]: flow.replace("        - id: deny\n", "        - id: approve\n") })).toEqual([]);
  });

  test("fails when an Actor has no sentence", async () => {
    const problems = await problemsWith({ "knowledge-base/actors.yaml": "member:\n  name: Member\n" });

    expect(problems).toEqual([{ file: "knowledge-base/actors.yaml", wrong: 'Actor "member" is missing `is`' }]);
  });
});

describe("an Entity", () => {
  const entity = sound[partFile]!.replace("anchors:", "entity: true\nrelations:\n  - belongs to one thread\nanchors:");

  test("passes with `entity: true` and its relations as sentences", async () => {
    expect(await problemsWith({ [partFile]: entity })).toEqual([]);
  });

  test("fails when `entity` is not true or false", async () => {
    const problems = await problemsWith({ [partFile]: entity.replace("entity: true", "entity: thread") });

    expect(problems).toEqual([{ file: partFile, wrong: "the Part: `entity` is neither true nor false" }]);
  });

  test("fails when `relations` is not a list of sentences", async () => {
    const problems = await problemsWith({
      [partFile]: entity.replace("relations:\n  - belongs to one thread\n", "relations: belongs to one thread\n"),
    });

    expect(problems).toEqual([{ file: partFile, wrong: "the Part: `relations` is not a list of sentences" }]);
  });

  test("fails when a Part that is not an Entity has relations", async () => {
    const problems = await problemsWith({ [partFile]: entity.replace("entity: true\n", "") });

    expect(problems).toEqual([{ file: partFile, wrong: "the Part has `relations` and is not an Entity (`entity: true`)" }]);
  });

  test("fails when a relation is not a sentence", async () => {
    const problems = await problemsWith({ [partFile]: entity.replace("  - belongs to one thread", "  - thread: one") });

    expect(problems).toEqual([{ file: partFile, wrong: "the Part: `relations` is not a list of sentences" }]);
  });
});

describe("a reference inside the knowledge base", () => {
  test("fails when a Flow names an Actor that is not in actors.yaml", async () => {
    const problems = await problemsWith({ [flowFile]: flow.replace("actor: member", "actor: admin") });

    expect(problems).toEqual([{ file: flowFile, wrong: 'names the Actor "admin", which is not in actors.yaml' }]);
  });

  test("fails when a Step names a Part that has no file", async () => {
    const problems = await problemsWith({
      [flowFile]: flow.replace("system: The tool is called.\n    parts: [tool-approval]", "system: The tool is called.\n    parts: [run-queue]"),
    });

    expect(problems).toEqual([
      { file: flowFile, wrong: 'Step "decide" of the main path names the Part "run-queue", which has no file' },
    ]);
  });

  test("fails when a Flow names an Area that is not in areas.yaml", async () => {
    const problems = await problemsWith({ [flowFile]: flow.replace("area: chat", "area: agents") });

    expect(problems).toEqual([{ file: flowFile, wrong: 'names the Area "agents", which is not in areas.yaml' }]);
  });

  test("passes when a Flow moves to another Area by a change of its `area` alone", async () => {
    const problems = await problemsWith({
      "knowledge-base/areas.yaml": `${sound["knowledge-base/areas.yaml"]}agents:\n  name: Agents\n  is: Setting up an agent.\n`,
      [flowFile]: flow.replace("area: chat", "area: agents"),
    });

    expect(problems).toEqual([]);
  });

  test("fails when a Variant diverges at a Step the main path does not have", async () => {
    const problems = await problemsWith({ [flowFile]: flow.replace("diverges_at: decide", "diverges_at: answer") });

    expect(problems).toEqual([
      { file: flowFile, wrong: 'Variant "deny" diverges at "answer", which is not a Step of the main path' },
    ]);
  });

  test("fails when a precondition names a Flow that has no file", async () => {
    const problems = await problemsWith({
      [flowFile]: flow.replace(
        "  - The Member is signed in.\n",
        "  - The Member is signed in.\n  - flow: start-a-thread\n    so_that: A thread is open.\n",
      ),
    });

    expect(problems).toEqual([
      { file: flowFile, wrong: 'precondition 2 names the Flow "start-a-thread", which has no file' },
    ]);
  });
});

describe("a precondition that waits for a Flow to write", () => {
  const waiting = flow.replace(
    "  - The Member is signed in.\n",
    "  - The Member is signed in.\n  - flow_to_write: start-a-thread\n    so_that: A thread is open.\n",
  );

  const areasFile = "knowledge-base/areas.yaml";
  const listed = `${sound[areasFile]}  flows_to_write:
    start-a-thread:
      name: Start a thread
      is: A Member opens a thread with an agent and sends a first message.
`;

  test("passes while that Flow has no file and is listed under an Area", async () => {
    expect(await problemsWith({ [flowFile]: waiting, [areasFile]: listed })).toEqual([]);
  });

  test("fails when the Flow to write is not listed under any Area", async () => {
    const problems = await problemsWith({ [flowFile]: waiting });

    expect(problems).toEqual([
      {
        file: flowFile,
        wrong:
          'precondition 2 waits for the Flow to write "start-a-thread", which is not under `flows_to_write` of any Area in areas.yaml',
      },
    ]);
  });

  test("fails once that Flow has a file, asking for a flow reference", async () => {
    const problems = await problemsWith({
      [flowFile]: waiting,
      "knowledge-base/flows/start-a-thread.yaml": flow,
    });

    expect(problems).toEqual([
      {
        file: flowFile,
        wrong:
          'precondition 2 waits for the Flow "start-a-thread" with `flow_to_write`, and that Flow now has a file: write `flow: start-a-thread`',
      },
    ]);
  });
});

describe("the list of Flows to write", () => {
  const areasFile = "knowledge-base/areas.yaml";
  const entry = (id: string) => `    ${id}:\n      name: Start a thread\n      is: A Member opens a thread and sends a first message.\n`;
  const listed = `${sound[areasFile]}  flows_to_write:\n${entry("start-a-thread")}`;

  test("passes with an entry whose Flow has no file", async () => {
    expect(await problemsWith({ [areasFile]: listed })).toEqual([]);
  });

  test("fails when the Flow of an entry has a file", async () => {
    const problems = await problemsWith({
      [areasFile]: listed,
      "knowledge-base/flows/start-a-thread.yaml": flow,
    });

    expect(problems).toEqual([
      {
        file: areasFile,
        wrong: 'the Flow to write "start-a-thread" now has a Flow file: remove it from `flows_to_write`',
      },
    ]);
  });

  test("fails when two Areas list the same id", async () => {
    const problems = await problemsWith({
      [areasFile]: `${listed}agents:\n  name: Agents\n  is: Setting up an agent.\n  flows_to_write:\n${entry("start-a-thread")}`,
    });

    expect(problems).toEqual([
      { file: areasFile, wrong: 'the Flow to write "start-a-thread" is listed under two Areas, "chat" and "agents"' },
    ]);
  });

  test("fails when an entry has no sentence", async () => {
    const problems = await problemsWith({
      [areasFile]: `${sound[areasFile]}  flows_to_write:\n    start-a-thread:\n      name: Start a thread\n`,
    });

    expect(problems).toEqual([{ file: areasFile, wrong: 'Flow to write "start-a-thread" is missing `is`' }]);
  });

  test("fails when the entries of an Area are not listed by id", async () => {
    const problems = await problemsWith({
      [areasFile]: `${sound[areasFile]}  flows_to_write:\n    - Start a thread\n`,
    });

    expect(problems).toEqual([
      { file: areasFile, wrong: '`flows_to_write` of the Area "chat" is not a list of Flows to write by id' },
    ]);
  });
});
