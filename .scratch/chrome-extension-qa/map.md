# Explore Flows from the running app with a Chrome extension

Label: wayfinder:map
Status: open

## Destination

Define a build-ready specification for a Chrome extension that lets the Builder select a region of an app running on localhost, find the Flows that involve it, and read relevant information from the Knowledge base while doing manual QA.

The map is complete when the product behavior, screen associations, maintenance responsibilities, and local connection are specified well enough to plan implementation. Building the extension is a separate effort.

## Notes

### Starting direction agreed with the Builder

- Use explicit HTML attributes similar to `data-testid` to associate the running screen with the Knowledge base. Changes to the app's source code are acceptable.
- Preserving a Private install is not a constraint for this effort.
- Start from Chrome and an app running on localhost.
- Create only this map now. Keep candidate decision tickets in this description; do not create child tickets or start their investigations yet.

The exact attribute name and value, whether to reuse `data-testid`, and whether attributes remain in production output are still open. A side panel, agent-maintained attributes, and recording QA Results in the extension are proposals, not agreed requirements.

### Product intent

The Builder can point to the running app instead of searching for the right Flow in a separate view. The extension should help the Builder understand expected behavior and discover paths they might otherwise forget to try.

The original ambition is to show every Flow that passes through a selected region at any Step, including Steps in Variants. The specification must define what the extension can actually establish, and how it communicates incomplete or outdated associations.

### Existing foundation and language

- [GLOSSARY.md](../../GLOSSARY.md) defines the language. A screen region is not an Area. A Part is a capability and can span multiple screen locations. An Anchor points from a Part to code; it does not currently identify a rendered element.
- [The view server](../../src/view.ts) already serves Flows, Parts, change information, and QA Results, and accepts QA Result updates. Reusing it is a candidate architecture, not a settled decision.
- [Flow Anchor extraction](../../src/flow-anchors.ts) follows Parts named by Steps in the main path and Variants. That relationship alone does not establish which screen location a Flow visits.
- QA Results remain personal to the Builder under the current glossary. Dropping the Private install constraint does not decide to share QA Results.
- Consult the wayfinder, grilling, and domain-modeling skills when advancing the map. Identify any needed glossary change explicitly before adopting it. Do not silently redefine existing terms.
- Follow repository instructions: the Builder performs UI QA, installs packages, and stages and commits changes.

## Decisions so far

No decision tickets have been resolved. The starting direction from the conversation is recorded in Notes.

## Ticket candidates

These are proposed decision tickets, not created issues or implementation tasks. Their ordering is provisional; dependencies below describe what must be settled before each question can be fully resolved.

### Define what a screen attribute identifies

Suggested type: grilling.

What does an attribute value identify, and where is its relationship to the Knowledge base stored? Decide whether to reuse `data-testid` or introduce a dedicated attribute. Test the proposed model against a Part used on two screens, a repeated row, and a region used by several Steps. Decide whether the model needs a new glossary term while preserving the existing meaning of Anchor.

### Define which Flows match a selected region

Suggested type: grilling. Depends on **Define what a screen attribute identifies**.

What evidence makes a Flow relevant to the selected region? Distinguish Flows that use the same Part elsewhere from Flows whose Steps actually involve this location. Decide how nested regions, Variants, role-dependent behavior, and a Flow to write affect the results. Define how to explain each match and what to show when associations are absent or outdated.

### Choose the first useful QA experience

Suggested type: grilling.

What must the Builder be able to learn or do after selecting a region? Decide which Knowledge base information is essential, whether to follow Manual QA Checks and record QA Results in the extension, and whether to show changes since earlier QA Results. Define observable evidence that the experience helps the Builder find relevant behavior and perform manual QA.

### Choose how selection and app interaction coexist

Suggested type: prototype. Depends on **Define which Flows match a selected region** and **Choose the first useful QA experience**.

How does the Builder enter selection mode, choose a region, read its Flows, and return to operating the app? Compare an overlay and a side panel. Resolve how inspection avoids triggering app actions and how the selected Flow remains available during navigation. The Builder evaluates any UI prototype manually.

### Decide how attributes stay true as the app changes

Suggested type: grilling. Depends on **Define what a screen attribute identifies** and **Define which Flows match a selected region**.

Who adds and maintains attributes and their associations, and during which Fledgy operations? Define the responsibility of the coding agent and the Deterministic Check when a region, Part, or Step changes or disappears. Separate structural verification from claims that require judgment. Decide whether attributes are present only during development or also in production output.

### Establish a supported local connection

Suggested type: research. Depends on **Choose the first useful QA experience** for the required read and write operations.

Can the existing local view server support the extension, and what changes would be needed? Establish Chrome permissions, connection and pairing behavior, and how to select the correct repository when several localhost apps are running. Assess protection of Knowledge base access and QA Result writes, server restarts, and disconnected behavior. Produce evidence for an architecture decision rather than implementing it.

### Set the first supported app boundary

Suggested type: grilling. Informed by **Define what a screen attribute identifies** and **Establish a supported local connection**.

Which app and screen regions should establish whether this approach works? Decide the initial framework and rendering support, and how to handle or explicitly exclude embedded frames, shadow DOM, and canvas content. Choose a small evaluation that covers shared Parts and changing screens, then define what must hold before expanding support.

## Not yet specified

- The detailed Knowledge base format and compatibility path depend on the chosen screen association model.
- The exact changes to mapping and maintenance skills depend on who owns the associations and what can be verified.
- Result ordering and presentation for large numbers of matching Flows depend on matching semantics and the chosen QA experience.
- Installation, updates, and distribution need further definition once the first supported app boundary and local connection are understood.

## Out of scope

- Implementing or releasing the extension during this planning effort.
- Creating or resolving child tickets in this session.
- Preserving a Private install as a design constraint.
- Replacing manual QA with automated interaction or claiming that selecting a region proves its behavior correct.
- Designing support for hosted apps, other browsers, or native apps in the first specification.
