# Codex plugin context handoff: feasibility test

Researched **2026-11-08**. Documentation and first-party source inspection only. This note supports the isolated [host experiment](../../experiments/codex-context-handoff/README.md). No desktop UI was opened or verified, no plugin or package installed, and no production integration implemented. Host observations below remain empty.

## Recommendation

Test **selection → new editable host conversation**, carrying a small, explicit selection snapshot in the message itself. The documented route is the MCP Apps `ui/message` request with OpenAI's `target: "new"` and `send: false` extension. This can establish whether the installed host accepts a contextual draft; it cannot establish product feasibility until the Builder observes the destination's agent mode and checkout. Current options provide no model, Codex/Work selector, checkout, thread ID, or imperative conversation-panel opener. [Message implementation][message], [official extension overview][extensions]

For an existing conversation, separately test a **conversation panel** opened by the Builder, then attach its selected content through `ui/update-model-context`. This is a different presentation from a sidebar app and should be observed independently. The proposed experiment is a capability probe, not a Fledgy UI design or a decision about the eventual interaction. [Conversation panels][extensions]

No supported contract for rendering a real Codex conversation inside the plugin's own floating chat was established in the inspected documentation. `ui/message` acknowledges a handoff; it does not return the agent's answer or subscribe the page to the conversation transcript. A native conversation beside a thread panel is a documented alternative, with replies handled by the host. This evidence limit does not establish that every possible independent model integration is unavailable; such an integration would require a separate account, execution, and billing investigation. [Message implementation][message], [UI bridge guidance][ui]

## Exact API boundary

| Purpose | Documented API / consequence |
| --- | --- |
| Open sidebar app | Tool `_meta.ui.resourceUri` associates the resource; `_meta["openai/ui"].entrypoints` includes `{ type: "global" }`. Opening supplies `{}` tool arguments. [Global entrypoint][spec] |
| Open conversation panel | A separate tool can declare `{ type: "thread" }`. The Builder opens it manually; each thread gets its own instance. [Thread entrypoint][spec] |
| Send or draft | `ui/message` takes `role: "user"`, `content`, and optional `_meta["openai/message"]` with `target: "active" | "new"` and `send: boolean`. Omitted options mean active conversation and immediate submission. [Message schema][message] |
| SDK spelling | `OpenAIExtensions.message.send(params, options?)` delegates to MCP Apps `app.sendMessage`. This is not a separate thread-management API. [Message implementation][message] |
| Selection context | `OpenAIExtensions.modelContext.update(params, options?)` delegates to `app.updateModelContext`; `getCurrent()` reads only this App's attached context from host state. [Context implementation][context] |
| `createThread` / `openThread` | No documented signature found in the fetched Plugin Reference, extension specification, or extension SDK. Official documentation searches for both names and repository code searches returned no matches. Do not invent either call or infer general unavailability outside these inspected surfaces. [Reference][reference], [SDK][sdk] |

On desktop, active-target requests from a global entrypoint use **that entrypoint's thread**. They do not promise the previously selected project conversation. Context updates replace the prior context from the same App instance. Therefore, a new-draft test should include the selected Flow, Part, or other fixture text directly in its message; it should not assume an earlier sidebar context attachment transfers into the new conversation. The latter is an implementation precaution, not a documented transfer rule. [Entrypoint and context semantics][spec]

Capability evidence comes from `ui/initialize`, after connecting: inspect `hostCapabilities.message.text`, `hostCapabilities.updateModelContext.text`, and `hostCapabilities.experimental["openai/message"]` / `["openai/modelContext"]` as appropriate. The first-party extension wrapper exposes its corresponding helper only when the extension key exists. Missing support must remain visible as an unsupported observation; never silently drop `send: false` and submit. [Capability gates][gates], [SDK initialization][sdk]

The first-party example also handles a resolved message result whose `isError` is true, in addition to thrown errors. A successful request response proves request acceptance, not that the model received the intended content or that the host chose Codex. Those require the Builder's observation. [Bits & Bolts implementation][example]

## ChatGPT bridge versus Codex desktop

The current plugin guide includes **Codex inside the ChatGPT desktop app** among supported plugin surfaces. That does not turn every ChatGPT compatibility API into a guarantee for every Codex conversation or an older standalone Codex app. New UI should use MCP Apps JSON-RPC over `postMessage`; `window.openai` is the optional ChatGPT compatibility/extension bridge. Its documented follow-up alias is `sendFollowUpMessage`, not `createThread` or `openThread`. [Supported surfaces][plugins], [UI bridge guidance][ui], [component bridge reference][reference]

The extension overview advertises new-conversation sending on desktop and Work on the web. The first-party patterns guide recommends desktop **26.928.20710** as the minimum for extensions introduced at DevDay 2026 and still requires feature checks. This is a useful documented baseline, not proof that every later API is present on every newer build. The prior broad [plugin support note](codex-plugin-support.md) did not establish a minimum; this more focused inspection found that guidance. [Extensions][extensions], [version guidance][patterns]

A local stdio plugin requires local execution; public-directory local MCP submissions additionally require approved-partner allowlisting. These submission restrictions are distinct from the Builder's personal-marketplace experiment. Account/workspace access and actual local server launch remain unverified. No authoring entitlement was inferred from the installed app version. [Desktop-only requirements][desktop], [plugin installation][plugins]

## Builder host observations

Use disposable fixture text only. Follow the experiment README's commands and manual procedure. Record failures and missing capabilities as results; do not mark a transport-only test as a host pass.

| Observation | Builder result |
| --- | --- |
| Date; desktop product/version/build; OS; local versus remote conversation | Not performed |
| Personal marketplace discovery; plugin install; stdio launch; sidebar entry opens | Not performed |
| Returned `hostInfo`, protocol version, and only the relevant capability booleans | Not performed |
| New draft: selection marker and question visible, editable, and unsent | Not performed |
| Destination: Codex/Chat/Work; selected project/checkout; source sidebar still available | Not performed |
| After Builder submits: response correctly identifies the supplied selection marker | Not performed |
| Existing conversation panel: correct conversation receives context; next prompt uses marker | Not performed |
| Reopen/restart: any retained attachment or duplicate draft; errors or missing support | Not performed |

Do not copy authentication values, account identifiers, arbitrary transcript contents, or a full host-context dump into this note. Record only the bounded fixture observations needed to answer the feasibility question. This is experiment scope, not a new Fledgy term.

Source inspection used OpenAI MCP Extensions commit [`39f91ad0bdf1435aadb879172ab2467d0e97cead`](https://github.com/openai/mcp-extensions/tree/39f91ad0bdf1435aadb879172ab2467d0e97cead). Hosted documentation was fetched on the research date and can change independently of installed clients. The recommendation remains conditional on Builder QA.

[extensions]: https://developers.openai.com/plugins/build/extensions
[spec]: https://github.com/openai/mcp-extensions/blob/39f91ad0bdf1435aadb879172ab2467d0e97cead/docs/spec.md
[sdk]: https://github.com/openai/mcp-extensions/blob/39f91ad0bdf1435aadb879172ab2467d0e97cead/typescript/README.md
[message]: https://github.com/openai/mcp-extensions/blob/39f91ad0bdf1435aadb879172ab2467d0e97cead/typescript/src/app/message.ts
[context]: https://github.com/openai/mcp-extensions/blob/39f91ad0bdf1435aadb879172ab2467d0e97cead/typescript/src/app/model-context.ts
[gates]: https://github.com/openai/mcp-extensions/blob/39f91ad0bdf1435aadb879172ab2467d0e97cead/typescript/src/app/extensions.ts
[example]: https://github.com/openai/mcp-extensions/blob/39f91ad0bdf1435aadb879172ab2467d0e97cead/plugins/bits-and-bolts/src/app/controller.ts#L1111
[reference]: https://developers.openai.com/plugins/reference
[ui]: https://developers.openai.com/plugins/build/chatgpt-ui
[plugins]: https://learn.chatgpt.com/docs/plugins
[patterns]: https://github.com/openai/mcp-extensions/blob/39f91ad0bdf1435aadb879172ab2467d0e97cead/docs/patterns.md#versioning
[desktop]: https://developers.openai.com/plugins/deploy/desktop-only
