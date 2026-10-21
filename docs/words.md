# Words

Fledgy describes your app with a small set of words. This page explains each one, in the order you meet them: first while your app is mapped, then in the web view. The underlined words in the web view link here, and each entry starts with the same sentence the view shows.

The examples use an app you probably know: Claude on the web, at claude.ai. Its Areas, Flows and code below are imagined to show the words, not taken from its real code.

- [Your app, in plain words](#your-app-in-plain-words): [Knowledge base](#knowledge-base), [Area](#area), [Flow](#flow), [Flow to write](#flow-to-write), [Actor](#actor), [Trigger](#trigger), [Main path](#main-path), [Variant](#variant)
- [What points to the code](#what-points-to-the-code): [System](#system), [Part](#part), [Entity](#entity), [Anchor](#anchor)
- [Testing by hand](#testing-by-hand): [Manual QA Check](#manual-qa-check), [Prepare](#prepare), [QA results](#qa-results), [Could not perform](#could-not-perform)
- [While your app is mapped](#while-your-app-is-mapped): [Mapping record](#mapping-record), [Entry point](#entry-point), [Pilot](#pilot)
- [As your app changes](#as-your-app-changes): [Not committed](#not-committed), [Knowledge base check](#knowledge-base-check)

## Your app, in plain words

### Knowledge base

Files in `knowledge-base/` that describe your app in plain words, so you can understand it without reading the code.

Let’s take Claude on the web as an example: `areas.yaml` would list the Areas, `actors.yaml` the people who use the app, and `flows/` and `parts/` would hold one file per Flow and per Part.

Good to know: the agent writes it, and updates it as it changes the code. You read it in the web view rather than in the files. With a private install it stays on your computer, hidden from git. With a shared install it is committed with the code, for the whole team.

### Area

A region of your app you’d name in conversation, like Chat or Billing. Every Flow belongs to one.

Claude on the web might have: Sign-in, Conversations, Composer, Projects, Billing and Settings. Composer is everything that shapes a message before it’s sent: adding files, skills, connectors or a design system, turning on Research, and picking the model and its thinking effort. Billing is about choosing a plan, paying for it, and getting the invoices.

Good to know: when it first reads your code, Fledgy proposes the Areas it sees, and you correct them before any Flow is written. Areas don’t nest. A Flow can be moved to another Area and stays the same Flow.

### Flow

One thing someone does in your app, from what starts it to what they see at the end, like “Start a thread”.

In Billing, *Upgrade to Pro*: someone on the Free plan clicks Upgrade, picks Pro, pays by card, and sees their account on Pro.

Good to know: a Flow is written as Steps. Each Step says what the person does, what they see, and what the app does. A Flow can need another one done first: *Upgrade to Pro* needs the person signed in, which the web view shows under “Before it starts”. A Flow never contains other Flows, and its name is unique across the app.

### Flow to write

A Flow listed now and written later: the app has it, but nobody has described it yet.

In Settings, *Export your data*: “Someone asks for an export of their chats, and gets an email with a link to download it.”

Good to know: a Flow to write is only a name and one sentence. It has no Steps, no [Manual QA Check](#manual-qa-check), and nothing that points to the code. The web view lists them under “To write”. With nothing that points to the code, they never show on its Changes page. It stops being one the moment its Flow is written.

### Actor

Who the Flow is done by: a person in a role, a schedule, or another system.

In Claude on the web, someone on the Free plan, a Pro subscriber, or the admin of a Team. *Renew a subscription* is done by a schedule, and *Handle a failed renewal* by the payment provider, which tells the app a card was refused.

Good to know: each app has a short list of Actors, each with a name. Fledgy says “a Pro subscriber” or “the people using the app” rather than “Actor”. The Actor doesn’t always start the Flow: something the app does can call for them, like an agent pausing to ask for approval before using a tool that accesses your Gmail.

### Trigger

What starts the Flow.

*Upgrade to Pro* starts when “Someone on the Free plan clicks Upgrade in the menu under their name.”

Good to know: it is usually something the [Actor](#actor) does. It can also be the app calling for the Actor, a schedule firing, or another system sending something in.

### Main path

The way the Flow goes when nothing goes wrong.

The main path of *Upgrade to Pro* has four Steps: the person clicks Upgrade, picks Pro, pays by card, and sees their account on Pro.

Good to know: in the web view, a Flow lists its paths on the left: the main path first, then each [Variant](#variant).

### Variant

Another way the Flow can end, like a refusal or a payment that fails. It leaves the main path at one step and never comes back to it.

*Upgrade to Pro* has three: *The card is declined*, *The bank asks to confirm the payment* and *The person closes the payment page*. *The card is declined* shares the first two Steps of the main path, then leaves it at the third: the person pays, but the card is refused.

Good to know: a Variant says at which Step it leaves, when it happens, and its own Steps through to its own end. It has no Variants of its own. In the web view, the Step where it leaves is tagged “Leaves the main path”, and the Steps before it read “Same as main path”. Each Variant has its own [Manual QA Check](#manual-qa-check).

## What points to the code

### System

What the app does in this step, out of sight of the person using it.

When the person pays: “The app asks the payment provider to charge the card, and moves the account to Pro once the provider confirms. If the charge fails, the plan stays as it was.”

Good to know: when the app does something, the Step names the [Parts](#part) that do it. The Step where the person pays names two, *Card payment* and *Plan change*, and the web view shows both under “Parts”, each opening on where it lives in the code. Some Steps name no Part, like filling in a form, where only the person using the app has something to do.

### Part

A named piece of your app, one thing it can do, described in one sentence. Parts are what point to the code.

In Claude on the web, *Plan change*: “Moves an account to another plan once its payment is confirmed, so it never gets a plan it hasn’t paid for.”

Good to know: a Part is as big as something you’d name in conversation, like *File upload*, *Chat search* or *Google sign-in*, whatever parts of the code it spans. A Part exists because a Step names it, and many Steps and Flows can name the same one: *Usage limits* comes up in every Flow where a message is sent to Claude. Parts don’t nest and have no types, except [Entities](#entity).

### Entity

A Part the app stores and keeps between visits, like a thread, an agent or a light/dark theme setting.

In Claude on the web, *Chat*: “A conversation between someone and Claude, made of their messages and Claude’s answers.” It belongs to one person, may sit in one project, and has many messages.

Good to know: an Entity’s [Anchors](#anchor) point to where the stored record is defined, and it says in plain words how it relates to other Entities. The Step that creates or changes an Entity names it: in *Start a chat*, the Step where the person sends their first message names *Chat*.

### Anchor

A pointer from a Part to the place in the code that makes it, on the screen side or the backend side. A click opens it in VS Code.

*Plan change* has two Anchors. One is “The upgrade request”, on the backend side, at `api/billing/routes.py#upgrade_plan`. The other is “The plan picker and its Pay button”, on the screen side, at `web/src/billing/PlanPicker.tsx#PlanPicker`.

Good to know: an Anchor names a file and, usually, a function, class or component in it, in TypeScript, JavaScript or Python. Only Parts have Anchors: a Step never points to code. When the code an Anchor points to is renamed or moved, the [knowledge base check](#knowledge-base-check) fails until the Anchor is fixed.

## Testing by hand

### Manual QA Check

Steps to test the Flow by hand, ticked in the web view. The main path and each Variant have one.

The one for the main path of *Upgrade to Pro* starts with “Sign in with an account on the Free plan”, then has five steps, from “Click Upgrade in the menu under your name” to checking that “The menu now reads Pro plan.”

Good to know: each step is one thing to do and what you should see. You follow them on your running app and record each result in the web view. When a step fails, either the app has a bug or the Flow describes it wrongly: both are worth telling the agent. A Manual QA Check is written from the Flow, so it can miss what the Flow misses.

### Prepare

What to set up in the app before the first step.

*The card is declined* needs: “Sign in with an account on the Free plan, and have a test card that the payment provider refuses.”

Good to know: it starts from what the Flow needs before it starts, like being signed in.

### QA results

How many steps of the Flow’s tests by hand (its Manual QA Checks) you recorded as passed.

*Upgrade to Pro* has 12 steps across its four Manual QA Checks. With 9 recorded as passed, its chip reads “QA 9/12 passed”. Once one fails, it reads “QA 1 failed”.

Good to know: each step’s result is Passed, Failed or [Could not perform](#could-not-perform), with an optional note. Fledgy also records the commit, the moment, and whether the Flow had changes [not committed](#not-committed) at that moment. Only your latest result per step is kept. Results are yours alone: they live on your computer in `~/.fledgy/`, never in the knowledge base or in git, and they are the same in every branch, worktree and clone of the repo. A change to the Flow never clears them: the web view tells you what changed since, and you record a step again or reset it.

### Could not perform

You could not try the step, for example because its setup was not possible. It is neither a pass nor a fail.

If you have no test card that the bank asks to confirm, record the steps of *The bank asks to confirm the payment* as Could not perform, with a note saying why.

Good to know: since it is not a pass, a Flow with one never shows all its steps passed.

## While your app is mapped

### Mapping record

A working file that lists what the mapping has found and where it stands. It’s deleted when the mapping is done.

For Claude on the web, it might start with 20 pages, 80 endpoints, 2 scheduled jobs and 3 incoming events, each given its Area. Then, Area by Area, each gets the Flow or [Flow to write](#flow-to-write) it belongs to, or the reason it belongs to none: the page `/upgrade` belongs to *Upgrade to Pro*, while the endpoint `/health`, which only tells a monitor the app is up, belongs to no Flow.

Good to know: it is `knowledge-base/mapping-record.md`. It describes the mapping, not your app. It lets a new Claude Code session pick up where the last one stopped: type `/map-the-app` again, or just say “Map the app”.

### Entry point

A place where something outside your app starts something inside it: a page, an endpoint, a scheduled job or an incoming event.

In Claude on the web: the page `/new`, where a chat starts, the job that renews subscriptions each month, or the event the payment provider sends when a renewal fails.

Good to know: every Flow starts at one. One Entry point can serve several Flows, and some serve none. Fledgy lists them all when it first reads your code, so that no part of your app is left out without a reason. The agent says “pages, endpoints, scheduled jobs and incoming events”; the word itself only shows up as a column in the [Mapping record](#mapping-record).

### Pilot

A stop after the first two or three Flows, so you can check they read right to you before more are written.

If the mapping starts with Conversations, the pilot might stop after *Start a chat* and *Share a chat*.

Good to know: read those Flows in the web view and follow their Manual QA Checks, then tell the agent what reads wrong. It fixes the Flows and tells you which of its instructions led to each mistake, so that the instruction itself can be corrected. The pilot runs once per mapping.

## As your app changes

### Not committed

Changed on your computer since the last git commit.

When the agent changes `upgrade_plan` in `api/billing/routes.py`, where *Plan change*’s upgrade request lives, *Upgrade to Pro* shows Not committed until the change is committed.

Good to know: a Flow counts as changed when the code that one of its Parts’ [Anchors](#anchor) points to changes. A change to the knowledge base alone, such as the agent rewording a Flow, doesn’t count: nothing changed in the app, so there is nothing new to test. The web view shows the Flows that aren’t committed, and those changed in the recent commits, to tell you which Manual QA Checks to run again.

### Knowledge base check

The program that checks what can be checked without judgment: that the knowledge base’s files are well formed, that what they name exists, and that every Anchor points to real code.

If `upgrade_plan` in `api/billing/routes.py` is renamed and *Plan change* is not updated, the check fails on its Anchor “The upgrade request”.

Good to know: it runs each time the agent stops. If it fails, the agent is sent back once to fix the knowledge base. If it still fails when the agent stops again, you are shown what is left: ask the agent to fix it. You can run it yourself with `git fledgy check` (private install) or `npx fledgy check` (shared install). It can’t tell whether the words are true: that is the agent’s judgment, and what your Manual QA Checks put to the test. The agent may call it the Deterministic Check.

---

Contributing to Fledgy? [`GLOSSARY.md`](../GLOSSARY.md) has the exact definitions the code and the skills use.
