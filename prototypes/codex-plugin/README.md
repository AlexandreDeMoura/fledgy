# Fledgy in Codex — design prototype

A standalone, high fidelity exploration of Fledgy as a Codex desktop plugin, directly below Sites in the app rail. The supplied desktop screenshot guides the shell. The question is how a Builder could understand an app from a persistent Fledgy surface inside Codex.

This is throwaway prototype code, separate from the real `view/`. Nuée is a fictional team workspace app. Its Knowledge base, app commits, Anchors, and agent responses are fake. No repository, Codex agent, email service, or account is connected. All mutable state is in memory and resets on reload.

## Open as a desktop app

From the repository root:

```sh
node prototypes/codex-plugin/desktop.mjs
```

The macOS launcher starts the local server and opens Google Chrome in an app window, requesting fullscreen. App mode removes the tabs, address bar, bookmarks bar, and profile controls. Chrome runs with a temporary, separate profile, so your normal Chrome session is not used. No packages or app installation are needed.

If Chrome opens windowed, click the **fullscreen icon at the top right** of the prototype. That button also works in a regular browser tab. Press **Esc** to leave page fullscreen, or use the same button again. Native macOS fullscreen can be toggled with **Control–Command–F**.

Quit the separate app with **Command–Q**, or press **Control–C** in the launcher terminal. The launcher closes only the Chrome process and server it started, then removes its temporary profile. If it reused an already-running prototype server, that server stays running.

If the previous version of the server is running, stop it once before using the launcher so the new local font route is available. For another port, prefix either launch command with `FLEDGY_PROTOTYPE_PORT=5179`.

The launcher uses [Chromium application mode](https://github.com/chromium/chromium/blob/main/chrome/common/chrome_switches.h). The in-page button uses the [Fullscreen API](https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API); it requires a click and cannot enter fullscreen automatically on page load. These UI behaviors are left for the Builder to verify manually.

## Open in a regular browser

From the repository root:

```sh
node prototypes/codex-plugin/serve.mjs
```

Open **http://127.0.0.1:5178**. No installation or build is needed. The server binds only to your computer and serves only the prototype’s explicitly listed public files, including the local font.

If the port is busy:

```sh
FLEDGY_PROTOTYPE_PORT=5179 node prototypes/codex-plugin/serve.mjs
```

## Explore

- Fledgy appears immediately below Sites. Both rail entries and Codex home can be selected.
- The Overview has three arrangements: [Areas](http://127.0.0.1:5178/?variant=atlas), [Outline](http://127.0.0.1:5178/?variant=outline), and [Flow first](http://127.0.0.1:5178/?variant=focus). Use the bottom control or left/right arrows on the Overview to switch.
- Browse or filter the twelve Flows in four Areas. Three are Flows to write, with no Steps or named Parts.
- Open **Invite a teammate** to explore its Steps, Parts, and two Variants. Each path has its own Manual QA Check.
- Record passed, failed, or could-not-perform QA Results. Add notes or reset an individual result. The QA Results page reflects these changes.
- Open a Part to inspect its fictional Anchors and the Flows that name it.
- Search names and descriptions with **⌘K** or **Ctrl+K**.
- Browse History and open a fictional saved Knowledge base version preview.
- **Ask Codex** opens a simulated conversation. **Write a Flow** uses the same simulation and does not modify the sample Knowledge base.
- **Run again** simulates a successful Deterministic Check; it does not inspect code.

The visual exploration intentionally keeps one coherent desktop shell. The three Overview arrangements compare navigation by Area, a compact outline, and a prominent recent Flow. No design decision is treated as validated until the Builder gives feedback.

## Appearance

The second reference screenshot supplies the exact theme values: **Inter**, background **#111111**, foreground **#FCFCFC**, and accent **#0169CC**. The app rail, sidebar, cards, borders, and secondary text use neutral grays. Blue is used for actions and selection indicators; Area colors and semantic QA Result colors remain distinct.

Inter 4.1 is bundled locally as a variable WOFF2 font, with weights 100–900. It requires no installed system font or network connection. The unmodified font comes from the [official Inter repository](https://github.com/rsms/inter/tree/v4.1), under the SIL Open Font License in `fonts/LICENSE.txt`.

## Validation

Data-model tests cover Flow/Area/Part relationships, search, and replacing individual QA Results. Launcher tests cover Chrome arguments, port validation, and whether an existing server can be reused. They do not open Chrome or verify UI:

```sh
node --test prototypes/codex-plugin/*.test.mjs
```

Repository checks:

```sh
npm test
```

UI verification is reserved for the Builder. No browser automation or screenshots are used. The prototype has not been published: Sites publication requires committing and pushing source, and this repository reserves commits for the Builder.

Suggested commit message: `feat: match Codex theme and add desktop prototype launcher`
