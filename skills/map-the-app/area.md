# Inside one Area

A session that goes into an Area, or carries on in one. The Flows of an Area are listed first, corrected by the Builder, then written one at a time.

## Steps

1. **Settle what the Builder left open.**
   - `Pilot: waiting for the Builder`: ask what they found reading the pilot Flows in the web view and following their Manual QA Checks. Fix what was wrong in the files, and tell them in one line each which instruction of this skill or of `write-a-flow` led to it, so that the skill is corrected where it comes from. Then set `Pilot: passed`.
   - A difference between your Areas and existing ones that the inventory listed and the Builder has now settled: apply it to the Mapping record, and to `areas.yaml` and each Flow's `area` when a Flow moves.
2. **Settle the Area.** An Area that is `list to correct` or `in progress` comes first. Otherwise the Builder names one; when they have not, recommend one in a line or two with its reason and wait for their answer. For the first Area of a mapping, recommend a small one that depends little on the others.
3. **List the Area's Flows**, when its State is `not gone into`. Read each of its Entry points closely: open the file and follow the code far enough to say which goal an Actor pursues from there.
   - Write each Flow as a Flow to write under the Area in `areas.yaml`, following "A Flow to write" in `../maintain-knowledge-base/SKILL.md`. The Area enters `areas.yaml` now, with its `name` and `is`.
   - Give each Entry point of the Area what it belongs to: its Flows to write, its Flows, or `no Flow:` and the reason. One that turns out to be another Area's changes Area and stays `not looked at yet`.
   - Run the Deterministic Check, set the Area to `list to correct`, and give the Builder the list: one line per Flow to write, then the number of pages, endpoints, jobs and events with no Flow and where to read them. On the first Area of a mapping, say once what a Flow to write is: a Flow listed now and written later. Ask them to correct it, and stop.

   Done when no Entry point of the Area is `not looked at yet`.
4. **Apply the Builder's corrections** to `areas.yaml` and the Mapping record, then set the Area to `in progress`.
5. **Write the Area's Flows, one at a time.** Take next a Flow to write that needs no unwritten Flow before it: the Flow that creates a thing comes before the Flows that use it. Write it with the `write-a-flow` skill, every step of it, yourself and in this session: two Flows written at once would each create the Part they share. After each Flow, bring the Mapping record in line: its Entry points say `Flow: <id>`, and so do those of any precondition Flow that was written on the way.
6. **Record what you meet and move on.** A Flow nobody listed, in this Area or another, becomes a Flow to write under its Area and on its Entry point's row, and is left there. The one exception is `write-a-flow`'s own: a missing precondition Flow that needs nothing further is written on the way.
7. **Stop** at the first of these:
   - **the pilot**: while the record says `Pilot: not run`, stop after the second or third Flow, set `Pilot: waiting for the Builder`, and ask the Builder to read those Flows in the web view and follow their Manual QA Checks before any more is written. Give them the view command: the check command in your instructions, with `view` in place of `check`, run where it says. Say once what the pilot is (a check that these first Flows read right to them before more are written) and what a Manual QA Check is (steps to test the Flow by hand, ticked in the web view);
   - **the budget**: five Flows written in this session, counting those written on the way;
   - **the Area is done**: it has no Flow to write left and every one of its Entry points names a Flow or a reason. Set it to `done`.
8. **Tell the Builder**, one line each: every Flow written, with its Variants; every Flow to write added, with its Area; every possible bug `write-a-flow` found. Say "Variant", never "path". At the pilot stop, where the first Flows are written, say once what a Variant is: another way the Flow can end, like a refusal or a payment that fails. Then one line on where the mapping stands, and what the next session starts with. When an Area was just done, recommend the next one in a line or two.

Done when the Deterministic Check passes, every Flow written in this session is `Flow: <id>` on its Entry points, every Flow to write in `areas.yaml` is on a row of the Mapping record, and each Area's State is what its rows say.
