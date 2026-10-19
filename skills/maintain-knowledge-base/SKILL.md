---
name: maintain-knowledge-base
description: Update the knowledge base in `knowledge-base/` after a code change. Use whenever you have changed the app's code, before you stop.
---

# Maintain the knowledge base

`knowledge-base/` at the repo root describes this app so that the Builder, who does not read the code, can understand it. After a code change it must be true again: every sentence describes what the app now does, and every Anchor points to code that exists.

## Steps

1. **List the code you changed**: every file you added, edited, renamed or deleted in this session (`git status`, `git diff`).
2. **Find the Parts it touches.** Search `knowledge-base/parts/` for the path of each changed file. Add any Part whose capability you changed through a file it has no Anchor in yet.
3. **Sort every change no Part covers.** A change from step 1 that no Part from step 2 carries belongs to a Flow that has no file. Name that Flow, then take its case:
   - **A whole new Flow**: the Actor can now pursue a goal the app did not offer before. Write the Flow now with the `write-a-flow` skill.
   - **A change inside a Flow the app already had**: a fix, an adjustment, or behaviour that would be a Step or a Variant of it. Record it as a Flow to write, following "A Flow to write" below.
   - **Nothing an Actor can observe**: a refactor, tests, tooling, CI. It needs no Flow.
4. **Make each Part from step 2 true.** Point every Anchor at the code as it now is, add an Anchor for a new place that carries the capability, remove one whose code is gone, and reword `is` and the labels if the capability changed.
5. **Find the Flows that name those Parts.** Search `knowledge-base/flows/` for each Part's id.
6. **Make each of those Flows true.** Re-read every Step that names the Part, on the main path and in every Variant, against the new code, and rewrite what the Actor does, what they see and what the system does. A Variant repeats the Steps it shares with the main path, so the same edit is often needed in both. Then rewrite the Manual QA Check (`qa`) of every path whose Steps changed, so that following it by hand verifies the new behaviour.
7. **Run the Deterministic Check** with the check command in your instructions, and fix what it reports until it passes.
8. **Tell the Builder** which knowledge base files you changed and, in plain words, what is different for the people using the app. End the message with one line per Flow to write your change falls inside, whether you added it or found it on the list: name the Flow and ask whether to write it now. On a yes, write it as in the first case of step 3.

Done when every change from step 1 is carried by a Part or sorted into a case of step 3, every Part from step 2 and every Flow from step 5 has been re-read against the new code, and the Deterministic Check passes.

## The files

An id is a file name without `.yaml`, in lower case with dashes.

| File | Holds |
|---|---|
| `actors.yaml` | Each Actor by id: `name`, `is`. |
| `areas.yaml` | Each Area by id: `name`, `is`, and its Flows to write under `flows_to_write`. |
| `flows/<flow>.yaml` | One Flow: its Area, its main path, its Variants and their Manual QA Checks. |
| `parts/<part>.yaml` | One Part and its Anchors. An Entity is a Part. |

### A Flow to write

A Flow the app has and nobody has written yet. It is an entry under its Area in `areas.yaml`, and that entry is the only place it lives: it has no file under `flows/`.

```yaml
chat:
  name: Chat
  is: Talking to an agent in a thread.
  flows_to_write:
    start-a-thread:
      name: Start a thread
      is: A Member opens a thread with an agent and sends a first message.
```

- Read every `flows_to_write` list first. When the Flow is already there under any Area, keep that entry, and extend its `is` when your change added behaviour to the Flow.
- Otherwise add the entry under the Area the Flow belongs to, adding the Area with its `name` and `is` when `areas.yaml` lacks it.
- `is` is one sentence: who does what, to what end, including any behaviour your change added.
- An id is used once across the whole app: by one entry under one Area, and never by a Flow that has a file.

### A Part

```yaml
name: Tool approval
is: Stops the agent before it runs a tool marked "needs approval" and checks the answer.
anchors:
  - label: The tool step and its buttons
    at: web/src/chat/tool-step.tsx#ToolStep
    side: screen
```

- A Part is one capability the Builder would name in conversation, whatever layers of code it spans, so one Part carries Anchors on both sides.
- `at` is `path#Symbol`: the path from the repo root, then a function, class, constant or type defined at the top level of that file, or `Class.member` for a member. The symbol must be defined exactly once in the file. Without `#Symbol` the Anchor points at the whole file.
- `side` is `screen` or `backend`.
- `label` says in the Builder's words what that place in the code is for.

### An Entity

A Part that is a thing the app stores and keeps between visits, such as a thread or a run, where any other Part is something the app does. It is a Part file with two more fields:

```yaml
name: Run
entity: true
is: One piece of agent work on a thread, with how it ended.
relations:
  - belongs to one thread
  - belongs to one user
anchors:
  - label: The stored record
    at: backend/app/runtime/runs/models.py#RunDB
    side: backend
```

- Its Anchors point to where the stored record is defined.
- `relations` says in plain words, one sentence each, how it relates to other Entities. Only an Entity has `relations`; an Entity related to none leaves the field out.
- The Step that creates or changes the stored thing names the Entity in `parts`, like any Part.

### A Flow

```yaml
name: Approve a tool call
area: chat
actor: member
goal: Let the agent run a tool after seeing what it is about to do.
trigger: The agent decides to call a tool marked "needs approval".
outcome: The tool has run and the agent has finished its reply.
preconditions:
  - The Member is signed in.
  - flow_to_write: start-a-thread
    so_that: A thread with that agent is open.
steps:
  - id: decide
    does: Clicks Approve.
    sees: Both buttons lock.
    system: The browser sends the decision.
    parts: [tool-approval]
qa:
  setup:
    - Sign in as a Member.
  steps:
    - id: approve
      do: Click Approve.
      expect: Both buttons lock.
variants:
  - id: deny
    name: The Member denies the call
    diverges_at: decide
    when: The Member clicks Deny instead of Approve.
    outcome: The tool was never run.
    steps: []
    qa: { setup: [], steps: [] }
```

- `area` is the id of the Flow's Area in `areas.yaml`. Every Flow file sits directly under `flows/`, whatever its Area, so a Flow's id is its file name and is used once across the whole app. To move a Flow to another Area, change `area` and nothing else.
- A Step is one moment: `does` (the Actor acts), `sees` (what is on screen), `system` (what the system does). Any may be absent, never all three. A new Step starts whenever the Actor acts or the system does a distinct thing.
- A Step with `system` names at least one Part in `parts`. Steps never point to code; only Anchors do.
- When a Step's `system` describes something no Part covers, add a Part file for it.
- A Variant starts at the Step named by `diverges_at` and lists its own Steps through to its own `outcome`. It never rejoins the main path.
- The main path and every Variant each have exactly one `qa`: `setup` starts from the preconditions, then each QA Step pairs what the Builder does (`do`) with what they should observe (`expect`).
- A QA Step has an `id`, used once within its `qa`. The Builder's recorded result for the step is kept under that id, so an id stays as it is when the step is reworded or moved, and a new step takes an id no step of that `qa` has had.
- A precondition is a plain sentence, or names the Flow that brings it about, with `so_that`: `flow: <flow>` for a Flow that has a file, `flow_to_write: <id>` for an entry of `flows_to_write`. Both are the id alone, without the Area.

## The words

Write for the Builder: plain sentences about what happens, naming things as they appear on screen. File names, function names and other code identifiers belong in an Anchor's `at`, nowhere else.
