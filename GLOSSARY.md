# Fledgy

A library and set of agent skills that keep a code-pointing knowledge base alongside an AI-built app, so the person shipping it can understand it without reading the code.

## Language

**Builder**:
A technical person who ships production apps with AI agents, does not review the generated code, and rarely reads it.
_Avoid_: Main user, human, human builder, user

**Knowledge base**:
The set of files, kept alongside an app's code, that describe the app well enough for the **Builder** to understand it without reading the code.

**Knowledge base version**:
One saved copy of the whole **Knowledge base**, with the app commit it describes and the moment it was saved.

**History store**:
Where one **Builder**'s **Knowledge base versions** of one app are kept, on their computer, next to their **QA Results**. Like QA Results, it is not part of the Knowledge base and is never committed to the app.

**Private install**:
The library added to an app for one **Builder** only: nothing it adds is committed, so teammates and their agents never see it, and the **Knowledge base** stays on that Builder's computer. The default way to install.
_Avoid_: Local install, personal setup

**Shared install**:
The library added to an app for the whole team: what it adds, the **Knowledge base** included, is committed with the code.
_Avoid_: Public install, team install

**Area**:
A coarse region of the app that groups **Flows**. A **Flow** belongs to exactly one Area and can be moved to another: it is the same **Flow**, since what identifies a **Flow** is its name, unique across the app, not its Area. Areas do not nest.
_Avoid_: Module, domain, feature

**Flow**:
One goal pursued from a trigger to an observable outcome. The trigger is the event that starts the Flow: usually something the **Actor** does, but it may be something the system does that calls for the **Actor**, such as an agent pausing to ask for approval. A Flow may state preconditions, some of which name another Flow or a **Flow to write**; Flows never contain other Flows.
_Avoid_: User flow, journey, use case, scenario

**Flow to write**:
A **Flow** the app is known to have and the **Knowledge base** names, under its **Area**, with one sentence, but that nobody has written yet. It has no **Steps**, no **Manual QA Check** and names no **Parts**. It stops being one the moment the **Flow** is written.
_Avoid_: Missing Flow, unwritten Flow, stub, gap

**Actor**:
Whoever or whatever, outside the system, a **Flow** is carried out by: a person in a role, a schedule, or an external system. The Actor acts in the **Flow** and observes its outcome, but does not always start it. Each app has a short named list of Actors.
_Avoid_: User

**Step**:
One moment in a **Flow**, described by what the **Actor** does, what the **Actor** sees, and what the system does. Any of the three may be empty, but not all. A new Step starts whenever the **Actor** acts or the system does a distinct thing, so an **Actor** who is waiting has Steps where they do nothing and see what is on screen.

**Variant**:
A named alternative path of a **Flow**, such as a rejection or a failure: the **Step** it diverges at, the condition that triggers it, and its own **Steps** through to its own outcome. A Variant never rejoins the main path and has no Variants of its own.
_Avoid_: Branch, edge case, alternate flow

**Part**:
A named piece of the system, sized as one capability the **Builder** would name in conversation and describable in one sentence, whatever layers of the code it spans. It is the only kind that points to code, through one or more **Anchors**. A Part exists because a **Step** names it; every **Step** where the system does something names at least one. Parts have no types and do not nest or depend on each other.
_Avoid_: Slice, component, unit, module

**Anchor**:
A labelled pointer from a **Part** to a place in the code, marked with the side of the app it is on: screen or backend. Only **Parts** have Anchors; a **Step** never points to code.
_Avoid_: Link, reference, pointer

**Entity**:
A **Part** that is a thing the app stores and keeps between visits, such as a thread or a run, rather than something the app does. Its **Anchors** point to where the stored record is defined, and it lists in plain words how it relates to other Entities ("belongs to one thread"). Like any **Part** it exists because a **Step** names it: the **Step** that creates or changes an Entity names it. It is the only special case of **Part**.
_Avoid_: Model, table

**Manual QA Check**:
A script the **Builder** follows by hand to verify one path of a **Flow**: the setup, which starts from the **Flow**'s preconditions, then ordered **QA Steps**. The main path and every **Variant** each have exactly one.
_Avoid_: QA Check, check, test, test case

**Deterministic Check**:
The program that verifies what can be verified about the **Knowledge base** without judgment: that its files are well formed, that every reference between them resolves, and that every **Anchor** points to real code. It either passes or fails; whether the words are true is left to an agent's judgment.
_Avoid_: Check, consistency check, validation, lint

**QA Step**:
One action in a **Manual QA Check** together with the result the **Builder** should observe.

**QA Result**:
What one **Builder** recorded after trying one **QA Step**: passed, failed, or could not perform, with an optional note, the commit and the moment it was recorded on, and whether the **Flow** had uncommitted changes at that moment. A **QA Step** has at most one QA Result per **Builder**, the latest; with none it is not checked. A QA Result is personal to its **Builder** and is not part of the **Knowledge base**. A change to the **Flow** never clears a QA Result; only the **Builder** resets it or records the step again.
_Avoid_: Tick, test result, status

**Entry point**:
A place where something outside the system starts something inside it: a page, an endpoint, a scheduled job, an incoming event. Every **Flow** starts at one; one Entry point may serve several **Flows**, and some serve none.
_Avoid_: Way in, route

**Mapping record**:
The working document kept while an app is mapped from zero: the **Areas** found, and for every **Entry point** the **Flow** or **Flow to write** it belongs to, or the reason it belongs to none. It describes the mapping, not the app, and is removed once the app is mapped.
_Avoid_: Map, inventory
