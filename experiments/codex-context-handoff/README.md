# Context handoff feasibility test

For [Can a selected piece of the plugin UI open a contextual agent conversation?](https://github.com/AlexandreDeMoura/fledgy/issues/14). A disposable host diagnostic, with fictional Steps and native controls. It does not change the design prototype or implement a floating chat. The [research note](../../docs/research/codex-context-handoff.md) distinguishes documented support from the host results still needed.

The single stdio MCP tool supplies a self-contained MCP App with both global and thread entrypoints. There is no HTTP server, build, dependency installation, API key, independent model integration, app-file access, or personal-data store. Only the fixture HTML is read. Every message request explicitly uses `send: false`; the Builder reviews and submits in the host. An acknowledgement alone is not a pass.

## Register and install manually

Requires Node 20+, Codex CLI with local marketplace support, a desktop account/workspace allowing local plugins, and a locally executed Codex conversation. The first-party patterns guide gives desktop 26.928.20710 as the DevDay-2026 extension baseline; advertised capabilities on the installed build remain decisive. See [version guidance](https://github.com/openai/mcp-extensions/blob/39f91ad0bdf1435aadb879172ab2467d0e97cead/docs/patterns.md#versioning).

From this repository's root, run:

```sh
codex plugin marketplace add "$PWD/experiments/codex-context-handoff"
```

This registers the bundled local marketplace. Restart the desktop app. In Plugins, select **Fledgy feasibility tests**, install and enable **context-handoff-test**, then start a fresh local Codex conversation. No npm install is needed. If the host cannot find `node`, run `command -v node`, put that absolute executable path in this fixture's `mcp.json` `command`, then refresh the marketplace and restart.

The marketplace root is this experiment folder, so its `source.path: "./"` points to the plugin beside this README, not to `.agents/plugins/`. No root project or personal marketplace files need manual edits. These are [documented local-marketplace steps](https://developers.openai.com/plugins/build/plugins#add-a-marketplace-from-the-cli), not an install performed by the agent. Discovery and local stdio loading are part of this test; failure there blocks testing the later handoff and does not disprove the message API.

## Manual host procedure

1. Record the desktop product, version/build, OS, current mode (Codex/Work/Chat), and project/checkout. Open **Context handoff test** from the sidebar. If no sidebar entry appears, record that failure separately. In a fresh Codex conversation you can also request: “Use context-handoff-test to open its diagnostic.” That tests a tool-rendered surface, not sidebar support.
2. Expand **Host and capabilities**. Record `hostInfo`, protocol version, and whether `message.text`, `experimental["openai/message"]`, and `updateModelContext.text` exist. Unsupported controls stay disabled. No host bridge means the test is unavailable, not successful.
3. Leave the first two fictional Steps selected. Read **Exact draft payload**, including its random marker. Click **Open new editable draft** once. Observe the actual destination: Codex, Work, or Chat? Which project/checkout, if any? Is the complete marker, selection, and question present and editable? Nothing should have been submitted. If it was sent automatically, record a failure and stop this route. Do not treat an acknowledgement or timeout as successful delivery.
4. Review and send the draft yourself. A real response must reproduce the marker and identify the selected Steps. Then ask a follow-up in the native conversation: “Which selected Step checks for an existing invitation?” Verify continuity. No reply is rendered inside the fixture; the reply is from the host's conversation.
5. Return to the same fixture using host navigation. Observe whether it retains the selection or remounts with a new marker. Select only Step 3, refresh the preview, and repeat with a new draft. Compare the new draft with the preview; prior conversations retaining their earlier content is expected. Highlight a short phrase inside the fictional Flow, click **Use highlighted text**, and repeat to distinguish text-only context from whole Steps. No screenshot is captured or transferred.
6. Separately, in a known local Codex conversation/project, manually open the diagnostic as a conversation content tab, if the host offers the thread entrypoint. Click **Append to this page's conversation draft**. Confirm the same conversation receives the payload without sending. Review, send, and check the marker. An active request from the global sidebar uses that sidebar entrypoint's own thread; it does not promise the previously selected project conversation.
7. In the conversation panel, click **Attach selection**. This updates model context without drafting or submitting. Ask the native conversation to report the attached marker and selected text. Change selection and attach again before asking for the new marker. Click **Clear** before testing that no current attachment remains. Previously submitted messages still remain in conversation history. Selection changes alone do not update host attachments; the attach/clear buttons make those calls explicitly.
8. Record errors and missing controls. If the bridge times out, inspect the host before retrying: the request may have succeeded even though the acknowledgement was lost. An unavailable clipboard has a manual text-copy fallback. **Copy payload** is explicitly manual paste and proves no automatic integration.

Use the observation table in the research note. A new-draft pass requires both visible, unsent context and a real response using the marker after your submission. A Codex pass also requires observing Codex mode and the intended checkout; the request has no project/mode field. Correct fictional context does not prove Knowledge base or code access. That needs a separately authorized, repository-bound test after this handoff is established.

The page generates its marker in the browser, so it cannot be guessed from the server's tool output. It logs only host identity/capabilities, request results, and a bounded context-change indication; it does not dump arbitrary host context or conversation transcripts. No custom floating transcript, canned replies, or unadvertised thread APIs are used.

## Automated checks and limits

```sh
node --test experiments/codex-context-handoff/server.test.mjs
npm test
```

The first command checks only the stdio protocol, entrypoint metadata, resource boundary, and rejection of unsupported operations. It does not run or verify the page. `npm test` is the repository's normal build and test suite. The Builder performs all UI/host QA.

To avoid dependencies, this fixture implements the small JSON-RPC subset directly. Server negotiation deliberately returns MCP `2025-11-25`; the UI uses `2026-01-26`. It implements no newer `server/discover` protocol, sampling, filesystem tools, model API calls, or transcript subscription. A host rejecting this legacy handshake is a fixture/protocol compatibility result and requires an SDK-based retest; it is not evidence that contextual handoff is impossible. The [MCP Apps specification](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/draft/apps.mdx#transport-layer) permits direct JSON-RPC transport, and the [extension specification](https://github.com/openai/mcp-extensions/blob/39f91ad0bdf1435aadb879172ab2467d0e97cead/docs/spec.md#prompt-target-and-send-behavior) defines the draft metadata.

To refresh after changing the fixture, run `codex plugin marketplace upgrade fledgy-feasibility`, restart the desktop app, and use a new conversation. To remove it, uninstall **context-handoff-test** in Plugins, then run:

```sh
codex plugin marketplace remove fledgy-feasibility
```

No installation, UI verification, staging, commit, or publication was performed by the agent. Suggested commit message: `test: add Codex context handoff feasibility experiment`.
