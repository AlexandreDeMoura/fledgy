---
name: write-a-flow
description: Write one Flow of the knowledge base in `knowledge-base/` from zero, with its Variants, Manual QA Checks and Parts. Use when the Builder asks to write or map a Flow, accepts an offer to write a Flow to write, or when a code change is a whole new Flow.
---

# Write a Flow

A Flow is one goal an Actor pursues, from a trigger to an outcome they can observe. You write it by reading the code outward from the trigger, so that the Builder, who does not read the code, can follow it on screen and verify it by hand.

The format of every file, and how to word them, is in "The files" and "The words" of `../maintain-knowledge-base/SKILL.md`. Read both sections before step 1; every step below writes to that format.

## Steps

1. **Read what is written.** `knowledge-base/actors.yaml`, `areas.yaml` with every `flows_to_write` list, the names of the files under `flows/`, and the `name` and `is` of every Part under `parts/`.
2. **Name the Flow.** Settle its Actor, goal, trigger, outcome, Area and id. A Flow to write keeps the id of its entry, and its Area is the one the entry is listed under. Any other Flow takes an id that no file under `flows/` and no entry of `flows_to_write` has, in any Area. A Flow that already has a file under `flows/` is not written here: follow the `maintain-knowledge-base` skill for it. Add the Actor to `actors.yaml` or the Area to `areas.yaml` when missing.
3. **Trace the code outward from the trigger.** Find the place in the code where the trigger happens: the button, the page, the endpoint, the schedule, the incoming event. Follow each call from there, across from the screen to the backend and into whatever runs later, until the outcome is something the Actor observes. Open every file on the way; a sentence you write describes a line you read, and words on screen are quoted as the code has them. Done when the trace reaches the outcome and you have listed every place on it where the code takes another path.
4. **Sort every other path.** Each place from step 3 where the code takes another path is one of:
   - a **Variant**: the Actor ends at a different outcome that the app answers on purpose, with a message, a screen or a state the code has for that case. It comes from a choice of theirs, a refusal or a failure;
   - a sentence inside a Step: the Actor still reaches the same outcome;
   - a **possible bug**: the code has no answer for the case, so the Actor is shown nothing and left where they were, or the case may never happen in the running app. It stays out of the knowledge base and goes to the Builder in step 10;
   - nothing: the Actor cannot observe it.
5. **Settle the Parts.** For each thing the system does on any path, reuse the Part whose `is` already covers that capability, adding Anchors for the places it lacks, and write a new Part only for a capability no Part covers. A thing the app stores, created or changed by a Step, is an Entity.
6. **Settle the preconditions**: everything that must be true before the trigger. One that another Flow brings about names that Flow, following "A precondition Flow" below.
7. **Write the files**: the Flow at `flows/<id>.yaml` with its Area in `area`, the main path, every Variant and one Manual QA Check per path, and its Parts under `parts/`. A Manual QA Check is followed by someone who knows the app only from its screen: `setup` brings them from the preconditions to the moment before the trigger, each `do` is one thing to do on screen, each `expect` is what they then see, matching the `sees` of the Step it checks.
8. **Clear the Flow to write**, when the Flow was one: remove its entry from `flows_to_write`, then search `knowledge-base/flows/` for `flow_to_write: <id>` and turn each into `flow: <id>`.
9. **Run the Deterministic Check** with the check command in your instructions, and fix what it reports until it passes.
10. **Tell the Builder**, one line each: every Flow written, with its Variants; every Flow to write added, with why it was left unwritten; every possible bug from step 4, with what the Actor would do to meet it. Say "Variant", never "path", and name the Actor ("a Member") rather than saying "the Actor". When no Flow file existed before this session, these are the Builder's first Flows: say once what a Variant is, another way the Flow can end, like a refusal or a payment that fails. When the budget below ran out, ask the Builder to start a new session for the rest.

Done when every path the trace found is the main path, a Variant, a sentence in a Step, a possible bug told to the Builder, or unobservable; every Step with `system` names a Part whose Anchors point at the code you read for it; every precondition Flow is written or listed; no entry or `flow_to_write` names a Flow you wrote; and the Deterministic Check passes.

## A precondition Flow

The Flow a precondition names is in one of three states:

- **It has a file**: write `flow: <flow>`.
- **It is a Flow to write, or the knowledge base does not name it**: inspect it. Find its trigger in the code and read far enough to list its own preconditions.
  - When you are confident that none of its preconditions needs a Flow without a file, write it too: steps 2 to 9 for that Flow, then `flow:` in the Flow you came from.
  - Otherwise, or in doubt, leave it: write `flow_to_write: <id>` and add its entry to `flows_to_write`, following "A Flow to write" in the Maintain skill.
- A Flow written on the way is the end of the line: when writing it shows that it needs an unwritten Flow after all, that one becomes a Flow to write, uninspected.

**The budget is five Flows written in one session max**, counting every Flow this session wrote before. Past five, each remaining precondition Flow becomes a Flow to write.
