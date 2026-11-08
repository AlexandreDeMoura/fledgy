# Fledgy: current Codex plugin support

Researched **2026-11-08**, for [Establish how Codex plugins can support this product](https://github.com/AlexandreDeMoura/fledgy/issues/11). Documentation and source inspection only. No UI was opened or verified, no packages installed, and no production integration implemented. Local references describe the inspected working tree, including existing uncommitted view changes; its base commit was `0ae6452b16d82faece4728fcfdd9989e83ddb22e`.

## Decision

**A local plugin containing Fledgy skills, a stdio MCP server, and an MCP App with a global sidebar entry is a documented integration route.** OpenAI now documents third-party sidebar apps and conversation panels; this is stronger evidence than treating every dedicated desktop surface as undocumented. A sidebar entry launches an app fullscreen. Its exact placement immediately below Sites, continuous mounting while navigating away, and automatic association with the selected Codex project are **unverified**. Those are not manifest guarantees. [Plugin extensions][extensions], [local MCP packaging][desktop], [packaging][pack]

Recommend that route for a **manually installed desktop prototype**, after the Builder verifies the minimum host capabilities below. Keep the Knowledge base and personal stores local. Start with one explicitly configured app checkout. General project switching is a later product decision, not something the global sidebar supplies automatically. This is an integration proposal derived from the documented primitives and [Fledgy's current repository binding](../../src/view.ts#L54).

**Distribution is a separate constraint:** public directory submissions containing a local MCP server require an approved partner and an allowlisted submitting organization. Plugins containing lifecycle hooks are excluded from the public directory. A local/repository marketplace supports authoring and distribution without claiming public-directory eligibility. The partner gate can block discovery and installation through OpenAI's public directory even when the local prototype works; it is not a blanket prohibition on publishing or sharing Fledgy's own Git/npm marketplace. [Desktop-only submission][desktop], [bundled hooks][pack], [marketplace sources][pack], [Claude migration][claude]

## Host boundaries and capability matrix

Here, **Supported** means documented, not tested on this machine. **Unsupported** means an explicit documented exclusion. **Unverified** means no sufficient contract or runtime evidence was found. “Desktop” refers to the current documentation's **ChatGPT desktop app with Codex inside it**; do not silently extend that conclusion to an older standalone Codex app. [Supported plugin surfaces][plugins]

| Capability | Status and scope | Consequence for Fledgy |
| --- | --- | --- |
| Skills and MCP servers in one plugin | Supported in Codex desktop and CLI; ChatGPT also consumes plugins. | Package reusable workflows with local tools. [Plugin surfaces][plugins] |
| Plugin in the Codex IDE extension | Unsupported. Direct MCP configuration is a different capability. | Do not advertise one plugin install as IDE support. [Plugins][plugins], [MCP configuration][mcp] |
| Portable package and compatibility manifests | Supported: root `plugin.json` and `mcp.json`; `.codex-plugin/plugin.json` remains a compatibility path. | Add host packaging; current `.claude-plugin` metadata alone does not wire an MCP App. [Packaging][pack] |
| Local stdio server | Supported for desktop execution; direct stdio configuration also exists in CLI. | Node can reuse Fledgy's filesystem and Git functions. [Desktop-only plugins][desktop], [MCP][mcp] |
| Global sidebar app and thread panel | Supported by current OpenAI MCP Extensions. | Dedicated Fledgy navigation is feasible; a conversation panel is another supported presentation. [Extensions][extensions] |
| Fledgy immediately below Sites; app rail ordering | Unverified. No ordering API found in the opened extension or packaging contracts. | Let the host place the entry; do not reproduce the host rail inside the real component. [Extensions][extensions], [packaging][pack] |
| Permanently running UI / unchanged state after restart | Unverified as a host guarantee. Durable state belongs in storage the plugin controls. | Rehydrate on opening; persist only appropriate view preferences. [UI state guidance][ui] |
| HTML UI in CLI | No rendering contract established by the inspected CLI docs; unverified, not assumed. | Tools and skills must remain useful without UI. [CLI plugin browser][plugins], [UI guidance][ui] |
| ChatGPT web reading local Codex config | Unsupported. Web uses its plugin connections, not local configuration. | A remote plugin cannot simply reuse the Builder's local repository and home folder. [MCP surfaces][mcp] |
| Local plugin hooks under cloud orchestration | Unsupported, even when some tools execute locally. | Promise automatic maintenance only for supported local orchestration/execution. [Hooks][hooks] |
| Command lifecycle hooks in manually installed desktop plugins | Supported after trust review. | A Codex Stop adapter is feasible, with the restrictions below. [Packaging][pack], [Hooks][hooks] |
| Public directory: local MCP / hooks | Local MCP is partner-gated; hooks excluded. | Decide distribution before promising availability to all Builders. [Desktop submission][desktop], [packaging][pack] |
| Read app files, inspect Git, run Deterministic Check | Feasible through the local process; not a browser filesystem entitlement. | Expose bounded Fledgy operations, with explicit checkout selection. [Local launch][desktop], [current functions](../../src/deterministic-check.ts) |
| Access every Codex project / infer current checkout | Unverified. No project-discovery or automatic checkout-binding contract found. | Maintain explicit allowed checkout handles; distinguish a project from a worktree. [MCP configuration][mcp], [tool metadata][reference] |
| Browser fallback beside Codex | Supported, including local development URLs and full/split view. | Existing `git fledgy view` can remain useful while native integration is evaluated. [Browser][browser] |

MCP Apps is a UI protocol, not another product or a grant of local access. It associates a tool with an HTML resource and defines the iframe/host bridge. ChatGPT implements it; OpenAI Extensions add host-specific navigation. ChatGPT's general plugin support does not mean every extension exists in every Chat/Work/web/mobile experience. The extension docs also flag web rollout limitations for Free and Go. [MCP UI quickstart][quickstart], [Extensions][extensions]

The first-party specification additionally establishes: desktop global and thread entrypoints; web in that support table means Work, excluding classic ChatGPT; global/thread openings use empty arguments; thread panels have separate instances per thread. Desktop deep links use `codex://plugins/.../app/...` and deliver an app-relative route through host context. Local-file opening is capability-gated and accepts an absolute path; there is no line or symbol field. File resources are opaque host URIs, with read/subscribe/write support, not raw filesystem access. These contracts do not establish checkout discovery or rail order. [OpenAI extension specification][spec]

## Packaging, installation, development, and updates

For new packages, OpenAI recommends the Agent Plugins schema at root `plugin.json`, fixed `skills/` discovery, and root `mcp.json` with an explicit server transport type. Put OpenAI presentation metadata, onboarding, hooks, and registered connector mappings under `extensions.com.openai`. An inline OpenAI extension replaces rather than merges the compatibility overlay. `.app.json` maps registered MCP integrations; it is not a way to inject an arbitrary desktop page. Keep referenced paths inside the package and relative to its root. [Package format][pack]

A proposed package boundary, not files created by this research:

```text
fledgy-plugin/
  plugin.json                   identity + OpenAI metadata/onboarding
  mcp.json                      stdio launch configuration
  skills/                       maintained Fledgy workflows
  server/                       built local MCP adapter + dependencies
  ui/                           bundled MCP App HTML/assets
  grammars/                     required parser assets
  hooks/hooks.json              optional, manual-distribution variant only
```

The documented stdio launch shape uses `command: "node"`, arguments pointing into `${PLUGIN_ROOT}`, and an explicit `cwd`. Bundle the server and dependencies. **The plugin directory is not the app checkout.** Configure the app checkout separately; do not make `cwd: "${PLUGIN_ROOT}"` accidentally select Fledgy's package as the app. [Local server packaging][desktop], [Fledgy CLI root lookup](../../src/cli.ts#L15)

Local development uses a repo marketplace at `.agents/plugins/marketplace.json` or a personal marketplace at `~/.agents/plugins/marketplace.json`. Its entries identify a plugin, source, category, and install/auth policy. Relative source paths resolve from the marketplace root, not from `.agents/plugins/`. The documented local loop is update that source directory, restart the desktop app, install/refresh through its Plugins Directory, and use a new chat. Project `.codex/config.toml` can enable or disable a local-marketplace plugin, but only in trusted projects. [Local discovery and installation][pack]

CLI marketplace management is documented:

```sh
codex plugin marketplace add /absolute/path/to/marketplace-root
codex plugin marketplace list
codex plugin marketplace upgrade marketplace-name
```

These are future authoring commands, not commands executed here. CLI `/plugins` supports browsing, installation, removal, and enabling/disabling. Marketplace sources can be local directories or Git repositories; entries can also reference npm packages. Git refs/SHAs can be selected. npm-source downloads do not run package lifecycle scripts, so ship built artifacts instead of relying on an install hook to build Fledgy. The docs do not establish a dependable automatic refresh interval for every local host; use explicit refresh and restart when iterating. [Marketplace formats and commands][pack], [CLI browser][plugins]

Read-only help inspection of the installed CLI 0.149.1 also confirmed `codex plugin marketplace add` accepts a local path, Git URL, or owner/repository source, with `--ref` and `--sparse`; `codex plugin add` accepts `PLUGIN@MARKETPLACE` or `PLUGIN --marketplace name`. No add/install command was executed.

Workspace publication requires a workspace admin and stays inside the organization; managed policies can restrict it. Public submission requires an owning organization/project, appropriate submission permission and identity verification. Published package updates use a complete new ZIP/version and review; hosted MCP updates have their own scans. None of those steps has been performed. Future Fledgy release work must separately follow [the repository release procedure](../releasing.md). [Workspace publication][pack], [public submission and updates][submission]

Claude skills can be carried over with their scripts/references and provider-specific wording adapted where necessary. Claude approvals, marketplace listings, commands, agent declarations, and artifact behavior are not automatically transferred. [Official Claude migration guide][claude]

## Runtime, permissions, and communication

```text
Builder opens Fledgy sidebar entry
  → host invokes open tool and loads ui:// resource
  → MCP App initializes host bridge
  → UI calls bounded Fledgy tools through tools/call
  → local stdio server selects an allowed checkout
  → existing Fledgy code reads Knowledge base / Git
     or writes that Builder's QA Results / History store
  → tool result refreshes the view

Codex agent → the same MCP tools or packaged skills
Local trusted Stop hook → Deterministic Check + History capture
```

This is a proposed composition of supported mechanisms, not an implemented connection. Standard MCP Apps initializes over JSON-RPC `postMessage`; tool input/result notifications deliver data; `tools/call` lets UI interactions reach the server without requiring a model turn for each button. `content` and `structuredContent` are model-visible; result `_meta` can carry UI-only data. Avoid treating UI-only metadata as authorization. Keep the server authoritative and validate every write. [Bridge example][quickstart], [UI/data separation][ui], [result visibility][reference]

Keeping the files on the Builder's computer preserves their storage location, not a promise that no data leaves it. Tool results or agent-read files can become conversation context. UI-only result metadata can reduce model exposure but still passes through the host. Scope returned data deliberately; do not advertise an offline or wholly local processing guarantee. [Tool-result visibility][reference], [plugin data sharing][plugins]

OpenAI documents `ui/message` and model-context updates as general communication primitives. That does **not** settle Fledgy's selection → Ask an agent workflow, conversation targeting, or embedded chat product design; those remain the separate [Can a selected piece of the plugin UI open a contextual agent conversation?](https://github.com/AlexandreDeMoura/fledgy/issues/14). A global page's existence is not evidence of permission to read arbitrary chat transcripts. [UI bridge][ui]

Codex sandbox/approval settings govern host operations; bundled MCP servers have enable/disable and tool-level approval policy. **Local stdio MCP processes run outside the local command sandbox.** An allowlisted command does not constrain what that server can access. Fledgy must enforce its own checkout allowlist, canonical-path boundaries, and permitted operations, and limit its OS-level launch privileges appropriately. Do not claim the agent's `workspace-write` policy automatically protects the MCP server or the personal stores. [MCP tool policy][mcp], [explicit sandbox boundary][security]

An iframe should not run Git or accept arbitrary shell strings. Suggested tool responsibilities are reading the Knowledge base, running the Deterministic Check, recording/noting/resetting a QA Result, reading saved Knowledge base versions, and resolving a permitted Anchor for opening. These are proposals, not newly defined Fledgy glossary terms. Accept a server-issued checkout handle rather than arbitrary paths on each call. Keep exact filesystem paths out of model output unless needed; they may be necessary for the host's local-file opener. [Current validation](../../src/view.ts#L113), [QA Result operations](../../src/qa-results.ts), [History store](../../src/history.ts)

For multiple apps, bind each request to both app identity and a concrete checkout; never use one mutable global “current repo” shared by all windows. Branches, worktrees, and clones currently share personal data through the root-commit identity, while the current files and Git state come from the selected checkout. The extension contract does not replace that distinction. This is a proposed safety boundary based on [appDataDirectory](../../src/qa-results.ts#L25) and [history metadata](../../src/history.ts).

## UI resources, theme, navigation, and Anchors

Keep the existing HTML/CSS/JavaScript approach if useful; React is optional. Register an HTML MCP App resource (`text/html;profile=mcp-app`) and a tool pointing to it through `_meta.ui.resourceUri`. Add the documented global entrypoint metadata for the dedicated page, and optionally a thread entrypoint. The current relative `/api/*`, `/view.js`, and stylesheet URLs will not automatically resolve to Fledgy's localhost server inside a host iframe. Bundle/inline assets or provide explicitly permitted resource origins; adapt data calls to MCP tools. [UI quickstart][quickstart], [extensions][extensions], [existing HTML](../../view/index.html), [view calls](../../view/view.js#L172)

Use initial and changed host theme/style context. The first-party TypeScript SDK shows `applyDocumentTheme`, `applyHostStyleVariables`, and bundled CSS; extension features can remain unavailable after initialization and must be detected. Its stdio example supports the current server protocol generations. These are useful implementation examples, not proof that this machine's host supports every API. [First-party SDK examples][sdk]

The first-party stylesheet uses the host's `--font-sans` with platform fallbacks. Prefer the host font/theme over hardcoded assumptions that every desktop uses Inter and the prototype's exact colors. If retaining a custom font, package it with its license or declare its resource origin in CSP. CSP separately controls connections, static resources, and nested frames; it does not establish that a localhost nested iframe is accepted. [Stylesheet source][styles], [resource policy][reference], [prototype font](../../prototypes/codex-plugin/fonts/README.md)

The host mirrors iframe navigation history, and widget-scoped state can help preserve selection. Durable reopen preferences should live with Fledgy's local state, not depend on `localStorage` or a permanently mounted iframe. Restore the chosen checkout and Flow when valid, refresh authoritative data, and handle removed files. Those are proposed behaviors built on the documented state/navigation mechanisms. [Navigation reference][reference], [state ownership][ui]

Anchor opening should use the advertised local-file capability when available, with a path resolved and checked by Fledgy's local server. **Opening the exact line or symbol remains unverified**: the documented local-file request exposes a path, not a location selector. Existing `vscode://file/...` links are a fallback candidate, not guaranteed to survive the iframe/host navigation policy. If precise opening is unavailable, show the Anchor text and permit copying it. [File-opening schema][spec], [current Anchor rendering](../../view/view.js#L609)

## Reuse versus changed assumptions

| Existing asset | Reuse / change |
| --- | --- |
| [Deterministic Check](../../src/deterministic-check.ts), [symbol resolution](../../src/symbols.ts) | Reuse the functions and semantics. Ship parser WASM assets and `web-tree-sitter`/YAML dependencies; don't turn the check into an LLM judgment. |
| [Skills](../../skills) | Reuse the mapping and maintenance procedures. Supply Codex-appropriate commands/instructions; change the source skills, never a private `.claude/skills` install. |
| [CLI](../../src/cli.ts), [init](../../src/init.ts), [first run](../../src/first-run.ts) | Adapter required. Current setup installs npm content, writes Claude settings/instructions/skills, and can launch `claude /map-the-app`. Plugin enablement is a different lifecycle; do not invoke current `init` blindly. |
| [Claude manifest](../../.claude-plugin/plugin.json), [npm package](../../package.json) | Reuse identity and skill assets. New plugin packaging needs MCP configuration, UI resources, and built adapter dependencies. Current package file list does not supply that integration. |
| [View server](../../src/view.ts) | Reuse Knowledge base reading, change calculation, and QA Result validation. It currently binds one repo to `127.0.0.1`; writes only QA Results. There is no existing run-check or History browsing/capture HTTP endpoint to reuse unchanged. |
| [Web view](../../view/view.js) | Reuse presentation where desired. Transport, assets, Anchor opening, host styles, clipboard, and refresh lifecycle need adaptation. Current refresh rereads on load/focus; it is not a filesystem subscription. |
| [QA Results](../../src/qa-results.ts) | Preserve `~/.fledgy/<root-commit-id>/qa-results.json`, timestamps, app commit, and uncommitted-Flow flag. No first commit means no store. Keep results personal and outside the Knowledge base. |
| [History](../../src/history.ts) | Preserve the neighboring bare `history.git` store and Knowledge base version metadata. Capturing creates commits in that separate store; it is not a read-only operation or an app-repository commit. Do not tie capture to every UI render. |
| [Stop hook](../../src/stop-hook.ts) | Reuse check/history logic behind a host adapter. Codex documents similarly shaped input/output, but trust, execution location, and continuation semantics need explicit verification. |
| [Codex design prototype](../../prototypes/codex-plugin/README.md) | Reuse interaction/design ideas only. Fake data, in-memory QA Results, simulated agent/check behavior, Chrome app launcher, and copied desktop shell prove no Codex runtime integration. |

The Codex Stop contract includes `cwd`, `stop_hook_active`, and a blocking decision/reason. Blocking creates a continuation prompt; it does not reject the completed turn. New or changed non-managed hooks are skipped until the exact definition is trusted. Fledgy's adapter must preserve its one-retry behavior and final warning, avoid recursive capture, and use the correct checkout and Builder home. Plugin hook environment provides `PLUGIN_ROOT` and `PLUGIN_DATA`, but the latter is not a reason to move existing QA Results or History store. [Codex hook contract][hooks], [plugin hook environment][pack], [current one-retry implementation](../../src/stop-hook.ts#L22)

## Minimum prerequisites and remaining evidence

Local read-only inventory: ChatGPT desktop **26.1023.51421**, build **22530**; Codex CLI **0.149.1**; Node **v24.20.0**; Git **2.39.5**. Node satisfies Fledgy's current `>=20` engine requirement. This inventory establishes installed executables, not feature availability. Account plan, workspace controls, plugin authoring entitlement, and public submission allowlisting were not inspected. No minimum desktop version for all required extensions was established by the opened docs. [Fledgy runtime requirement](../../package.json), [surface restrictions][plugins], [extension rollout caveat][extensions]

Before implementation is treated as viable for the target installation, the Builder needs:

1. A local desktop conversation/execution environment, plugin installation allowed by account/workspace policy, Node/Git available, and permission for the selected checkout and the Builder's existing personal stores. Local marketplace installation and server launch must be verified on the target host. [Packaging][pack], [desktop requirements][desktop]
2. A minimal disposable local MCP App installed from a personal marketplace, exposing one global entrypoint and a read-only fixture. Record `hostInfo`, negotiated capabilities, lifecycle notifications, and server launch context without secrets. Manually open, leave, reopen, restart, and try a thread panel. This answers local stdio + sidebar composition on the installed build, real placement, persistence, and startup behavior. It is a proposed Builder experiment, not an experiment performed here.
3. A separate explicit checkout configuration, initially one repository with a commit and an existing Knowledge base. Use two fixture checkouts/worktrees to establish request isolation before multi-app scope. Observe whether the host supplies any usable project context; treat no evidence as requiring explicit selection. This belongs with the first supported host/project boundary decision in [Define the first release and the transition from Fledgy](https://github.com/AlexandreDeMoura/fledgy/issues/13).
4. Builder verification of theme updates, asset/font loading, opening/return navigation, clipboard behavior, and the local-file capability. Determine whether exact Anchor positioning has any supported API beyond path opening. This can inform [Evolve the existing prototype into the agreed Codex plugin UI](https://github.com/AlexandreDeMoura/fledgy/issues/12); no screenshot or UI automation was run here.
5. A hook contract exercise against a disposable fixture: trusted/untrusted/changed hook, pass/fail, one continuation, and final warning, with History capture isolated from the real app. Also determine how writes are serialized across concurrent views/hooks; the existing QA writer's atomic rename does not itself prevent concurrent read-modify-write loss. [Trust and Stop behavior][hooks], [QA writer](../../src/qa-results.ts#L50)
6. A distribution decision: manual/personal/repo marketplace now, or seek OpenAI local-MCP submission eligibility for public-directory publication. A directory package requiring hooks needs a different maintenance promise or a separate manual hook setup. [Distribution restrictions][desktop], [hook exclusions][pack]

No dependency installation is needed for this research. If a later spike adopts the first-party SDK examples, have the Builder run its chosen dependency commands; the current SDK README separates server SDK v2 from MCP App SDK v1 dependencies. Do not combine stale quickstart versions blindly. The server example gives `pnpm add @openai/mcp-extensions @modelcontextprotocol/server@^2`; the app example gives `pnpm add @openai/mcp-extensions @modelcontextprotocol/ext-apps@^1.7.5 @modelcontextprotocol/sdk@^1`. These are reference commands for an isolated spike, not instructions to change this repository's package manager. [SDK installation][sdk]

## Alternatives and scope

If the installed desktop cannot load the new entrypoint, retain the existing localhost view in the built-in browser: run `git fledgy view` in an already installed app and open `http://localhost:4173/` beside Codex. This preserves current file ownership with the least integration work. It does not provide the promised dedicated rail entry. A thread panel is another documented presentation if the global page is unsuitable. [Browser][browser], [entrypoints][extensions], [current CLI](../../src/cli.ts)

If a remote public plugin is required, use a hosted HTTPS MCP service with an explicit repository/data synchronization or local connection design. It cannot be assumed to read the Builder's existing home directory. That changes the local-data assumptions and needs a separate decision. A standalone Fledgy desktop/web client could instead use Codex app-server for agent integration; app-server is for building one's own rich client, not an API for placing arbitrary UI into the existing desktop rail. Its embedded-chat implications remain out of scope for this research. [Remote/local MCP distinction][mcp], [app-server purpose][appserver]

The [2026-11-05 browser note](codex-web-view.md) remains a useful fallback analysis. This note strengthens its entrypoint evidence using the current first-party specification and SDK, while retaining the need to verify the installed local host. Documentation on mutable `main` branches can outpace released clients; all primary pages below were actually opened on the research date. No minimum version, exact ordering, or account entitlement was inferred from screenshots. These findings constrain later decisions without changing the destination's scope or treating prototype behavior as implemented. Contextual agent interaction remains a separate feasibility prototype.

[pack]: https://developers.openai.com/plugins/build/plugins
[desktop]: https://developers.openai.com/plugins/deploy/desktop-only
[extensions]: https://developers.openai.com/plugins/build/extensions
[plugins]: https://learn.chatgpt.com/docs/plugins
[mcp]: https://learn.chatgpt.com/docs/extend/mcp
[hooks]: https://learn.chatgpt.com/docs/hooks
[reference]: https://developers.openai.com/plugins/reference
[ui]: https://developers.openai.com/plugins/build/chatgpt-ui
[quickstart]: https://developers.openai.com/plugins/build/app-quickstart
[submission]: https://developers.openai.com/plugins/deploy/submission
[claude]: https://developers.openai.com/plugins/guides/submit-claude-plugin
[browser]: https://learn.chatgpt.com/docs/browser
[security]: https://learn.chatgpt.com/docs/enterprise/security-cookbook#boundaries-2
[appserver]: https://learn.chatgpt.com/docs/app-server
[spec]: https://github.com/openai/mcp-extensions/blob/main/docs/spec.md
[sdk]: https://github.com/openai/mcp-extensions/blob/main/typescript/README.md
[styles]: https://github.com/openai/mcp-extensions/blob/main/typescript/styles.css
