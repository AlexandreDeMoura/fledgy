# auxilia Chat: the 10 possible bugs, read from code

Answers [#2](https://github.com/AlexandreDeMoura/fledgy/issues/2). For each possible bug that `map-the-app` reported in auxilia's Chat Area, this file gives what auxilia's code does and how the Builder would run into it on screen.

- **Source read:** auxilia at commit `be7bad9` (`~/Desktop/dev/auxilia`), read only. Paths below are relative to that repo. `web/…` is the screen side and `backend/…` the backend side.
- **Library read:** `@langchain/react` 1.0.33 and `@langchain/langgraph-sdk` 1.10.0, from `web/node_modules`. Next.js is 16.3.2.
- **Flows compared:** the ones in `knowledge-base/flows/*.yaml` and the Parts they name.
- **Not run:** nothing here was tried in a running auxilia. Each verdict comes from reading code, and each repro script is how the Builder can settle it.

Verdicts use three words: **likely true** (the code produces the behaviour), **likely false** (it does not), **can't tell** (the code alone doesn't settle it).

## Summary

| # | Flow / Step | Verdict | Why |
|---|---|---|---|
| 1 | start-a-thread / `send` | likely true, and worse | The error only goes to the console, and the composer has already wiped the typed message and its files. |
| 2 | start-a-thread precondition `turn-on-models` / `send` | likely true, and worse | `handleSubmit` returns early after a console error, and the text box has already been cleared. |
| 3 | start-a-thread / `open` (state made in Flow to write `add-an-mcp-server-to-an-agent`) | **likely false**: the notice is reachable | The editor saves an MCP server whose tools were never listed (`tools: null`), for example an OAuth server the editor hasn't connected to. Readiness then answers `not_configured`. |
| 4 | queue-a-message-while-the-agent-works / `queue`→`sent`, with come-back-to-a-thread | likely true | The queue lives only in the thread page's React state. Reloading or leaving the page drops it, with no warning. |
| 5 | stop-a-reply / `stop`, reached through come-back-to-a-thread `still-running` or approve-a-tool-call `run` | likely true, and wider than reported | The SDK cancels only a run id that this page's own `submit` received. A joined run has no id, and neither does a run resumed by Approve/Deny. |
| 6 | connect-an-agents-servers / `authenticate` | likely true | When `window.open` returns null, the code only does `console.error`. The popup also opens after an `await`, so a slow `list-tools` can get it blocked even with popups allowed. |
| 7 | delete-a-thread / `delete` (on the thread on screen) | likely true | `handleDeleteThread` takes the row out of the list and never navigates away. |
| 8 | rename-a-thread / `save`; delete-a-thread / `delete` | likely true | Both `catch` blocks only log. |
| 9 | rename-a-thread / `open` + `save` (trigger thread) | likely true | A trigger thread's row title is its firing time. A rename writes `first_message_content`, which that row shows as its *second* line. |
| 10 | read-another-users-thread / `open`, crossing retry-a-reply / `retry` and approve-a-tool-call / `decide` | likely true | Retry and Approve/Deny are gated on `modelUnavailable` only, never on `viewerRole`. The backend's `/commands` is owner-only. |

---

## 1. Creating the thread fails silently

**Where it sits:** start-a-thread, Step `send`. The Flow has no failure Variant for this Step.

**What the code does:**
- `web/src/app/(protected)/agents/[id]/chat/page.tsx#StarterChatPage` → `handleSubmit` (l.51-102). On a rejected `threadsApi.createThread`, the `catch` (l.98-101) runs `console.error` and `setIsCreating(false)`. Nothing else happens.
- The thread resource promises "no toasts" (`web/src/lib/api/resources/threads.ts`, header comment). Toasts are only used on the agent editor and MCP-server pages.
- The typed message is lost too. The page calls `handleSubmit` as `void handleSubmit(message)` from a **synchronous** `ChatPromptInput.handleSubmit` (`…/chat/components/prompt-input.tsx` l.181-190).
- So `PromptInput` takes its "sync path" (`web/src/components/ai-elements/prompt-input.tsx` l.806-811) and clears the text box and the attachments as soon as Send is pressed, before the request has answered. Its "don't clear on error" branch only applies to an `onSubmit` that returns a Promise.
- The message was also parked in `usePendingMessageStore` (l.75) under a thread id that will never open, so nothing ever sends it.
- While the request is in flight, `status="streaming"` and the box is empty, so the round button shows the Stop square. `stop` is undefined, so clicking it does nothing.

**Verdict:** likely true. Beyond the report, the User also loses what they typed and attached.

**Repro script**
- setup:
  - Sign in as an admin.
  - Click "New thread", and wait for the composer to show a model pill.
- steps:
  1. do: Open Chrome DevTools > Network and set throttling to "Offline". (Or ask whoever runs the backend to stop it.) → expect: nothing changes on the page.
  2. do: Type "Hello" and press Enter. → expect (bug): the text box empties. The round button may flash a square, then shows the greyed send arrow. No thread appears in RECENT THREADS and no message is shown.
  3. do: Set the network back to "No throttling". → expect (bug): "Hello" is gone and has to be typed again.

---

## 2. No model turned on: Send does nothing

**Where it sits:**
- start-a-thread, when its precondition `turn-on-models` does not hold.
- It shows at Step `open`: the pill reads "Select model" where the Flow promises "a pill naming the model".
- It bites at Step `send`.

**What the code does:**
- `…/chat/page.tsx` l.62-66: `const modelId = selectedModel ?? getDefaultModel(models)`, then `if (!modelId) { console.error("No model available to create thread"); return; }`.
- `getDefaultModel` (`web/src/lib/utils/get-default-model.ts`) returns `undefined` for an empty list.
- That list is empty when the backend's `GET /model-providers/models` (`backend/app/model_providers/router.py#get_models` → `ModelService.list_available`) finds nothing that is whitelisted, has a provider key and is admin-enabled.
- It is also empty when that fetch fails: `useModelsStore.refreshModels` only logs.
- As in #1, the composer has already cleared the text box.
- Clicking the pill opens "Select a model" showing "No models found." (`prompt-input.tsx` l.314-317). That is the only hint on the screen.

**Verdict:** likely true, and the typed message is wiped.

**Repro script**
- setup:
  - Sign in as an admin.
  - In Settings, turn every model off.
- steps:
  1. do: Click "New thread". → expect: the model pill reads "Select model" in grey.
  2. do: Type "Hello" and press Enter. → expect (bug): the text box empties and nothing else happens. There is no message, no thread and no notice.
  3. do: Click the "Select model" pill. → expect: "Select a model" opens with "No models found."
  4. do: Turn a model back on in Settings. → expect: back on the chat page, the pill names a model (reload the page if it doesn't).

---

## 3. "This agent's MCP tools aren't configured yet…": reachable after all

**Where it sits:**
- start-a-thread, Step `open`, and come-back-to-a-thread, Step `open`. Neither Flow has a Variant for this notice.
- The state is created in the Flow to write `add-an-mcp-server-to-an-agent`, when the agent is saved.
- Part: `agent-readiness`.

**What the code does**

The notice:
- It is drawn when readiness answers `status: "not_configured"`.
  - Starter page: `…/chat/page.tsx` l.176-185.
  - Thread page: `…/chat/[threadId]/page.tsx` l.218-227.
- People who may configure the agent see "This agent's MCP tools aren't configured yet. Configure them in the agent's settings."
- Everyone else sees "Agent is not configured yet. Contact agent owner to configure it first."

The backend side:
- `backend/app/agents/core/service.py#AgentService.describe_readiness` (l.723-767) returns `not_configured` as soon as **any** MCP binding has `tools is None`. That includes the bindings of the agent's subagents.
- This check runs *before* the per-user sign-in check, so it wins over "Connect".

How a binding gets saved with `tools = null`:
1. **Agent editor, the normal Save.**
   - "Add tool" adds the server as `{ mcpServerId, tools: null }` (`web/src/app/(protected)/agents/[id]/components/agent-tool-list.tsx#AgentToolList` → `handleAddServer`, l.146-152).
   - The map only fills in when `AgentMCPServer.fetchTools` gets the tool list and seeds it (`agent-mcp-server.tsx` l.165-257). It never fills in when:
     - the server uses OAuth and the editor isn't connected. The card shows NOT CONNECTED and no fetch runs until they click Connect.
     - `list-tools` fails. The `catch` does `setTools([])` and leaves the map null.
     - the editor clicks Save before a slow `list-tools` returns. The backend docstring mentions a ~15 s wedge.
   - Save is gated only on name and instructions (`agent-editor.tsx` l.163, `canSave`).
   - `PUT /agents/{id}/config` → `AgentMCPServerService.set_for_agent` then writes `tools` exactly as sent: "no discovery and no merge" (`backend/app/agents/mcp_servers/service.py` l.117-145). The same happens for `POST /agents` (create).
2. **API, `POST /agents/{id}/mcp-servers/{server_id}`** → `create_or_update`:
   - It creates the binding with `tools=None`, and only syncs when the server is keyless or uses an API key, or when the caller already holds an OAuth token (l.84-100).
   - A failed sync is swallowed (l.63-64, `FIXME(P3-12)`), so the binding stays `None`.
3. **API, `PUT /agents/{id}/config`** with `"tools": null`. The schema allows it: `AgentConfig` says "None = never synced".

How it heals:
- An editor opens the agent page in read mode, with the server connected.
- `persistIfStale` (`agent-mcp-server.tsx` l.122-149) then calls `sync-tools`, which writes the map. Simply viewing the page fixes it once `list-tools` works.

**Verdict:** **likely false.** The notice can appear, through ordinary editor use. The real finding is something else: a binding saved before its tools were known blocks the agent for everyone, and says "not configured" where the person may only need to connect.

**Repro script A (OAuth server)**
- setup:
  - Sign in as an admin who has never connected to an MCP server of the workspace that signs in with OAuth.
  - Have an agent you may edit, with no MCP server.
- steps:
  1. do: Open the agent's page, click Edit, then "Add tool", and pick the OAuth server. → expect: its card reads NOT CONNECTED, opened, with a Connect action and no tools listed.
  2. do: Without connecting, click Save. → expect: the save goes through with no warning.
  3. do: Click "Test in chat". → expect: in place of the composer, a red notice reads "This agent's MCP tools aren't configured yet. Configure them in the agent's settings." "Ask me anything to begin" is gone and there is no "Connect" button.
  4. do: Sign in as a Member who has access to the agent, and open its chat. → expect: "Agent is not configured yet. Contact agent owner to configure it first."
  5. do: As the admin, open the agent's page (not Edit), click Connect on the server's card and sign in. Then open its chat again. → expect: the composer is back (for the admin, or "Connect" for anyone not yet connected).

**Repro script B (any server, forced failure)**
- setup:
  - Sign in as an admin.
  - Have an agent you may edit, and a workspace MCP server without OAuth.
- steps:
  1. do: Open DevTools > Network > Request blocking, and add the pattern `*list-tools*`. → expect: nothing yet.
  2. do: Edit the agent, add that server, and click Save. → expect: the card shows CONNECTED with no tools, and Save succeeds.
  3. do: Click "Test in chat". → expect: the red "MCP tools aren't configured yet" notice.
  4. do: Remove the blocking pattern, open the agent's page (read mode), then its chat again. → expect: the composer is back (viewing the page healed it).

**New shape found nearby (not in the list):**
- If `GET /agents/{id}/is-ready` itself fails, `useAgentConnectionStatus` (`web/src/hooks/use-agent-connection-status.ts` l.32-37) sets `ready=false, status="disconnected", disconnectedServers=[]`.
- The composer then locks with a **Connect** button. The window it opens reads "To use this agent, you need to authenticate with 0 services." and has no button (`connect-servers-dialog.tsx` l.139-141, l.190).
- Repro:
  1. do: Block `*is-ready*` in DevTools, then click "New thread". → expect: the text box is greyed out with "Connect".
  2. do: Click "Connect". → expect: "…authenticate with 0 services." with nothing to click.
- A 403 on the same endpoint does the same. That happens when someone opens the chat of an agent they may not use.

---

## 4. Queued messages lost on leaving the thread

**Where it sits:**
- queue-a-message-while-the-agent-works, between Steps `queue` and `sent`.
- It happens when the User then goes through come-back-to-a-thread (leaves, then comes back) or reloads.

**What the code does:**
- The queue is `useState` inside `useThreadSession` (`web/src/lib/thread-session/use-thread-session.ts` l.240-258, `QUEUE_LIMIT` l.44). The authors chose it over the SDK's own `enqueue` (comment l.228-236).
- Queued messages are sent only by the effect at l.297-302, which runs only while that page is mounted. Nothing persists them, and nothing sends them on unmount.
- A reload always drops them.
- Switching to another thread drops them too. Next 16's router keys the page segment by its param (`createRouterCacheKey` → `threadId|<id>|d`), and keeps only one entry in its back-cache unless `cacheComponents` is on (`MAX_BF_CACHE_ENTRIES = 1` in `next/dist/client/components/bfcache-state-manager.js`). auxilia's `next.config.ts` does not turn it on, so the thread page remounts.
- There is no `beforeunload` warning on the thread page. The only ones in the app are in the agent and skill editors.
- The composer draft, by contrast, survives navigation: `PromptInputProvider` sits in `agents/layout.tsx`.

**Verdict:** likely true.

**Repro script**
- setup:
  - Sign in as an admin, and start a thread with any agent.
- steps:
  1. do: Send "Write a 1500-word story about a lighthouse." → expect: the story streams and the round button is a square.
  2. do: While it streams, type "Now give it a title." and press Enter. → expect: it waits dimmed above the composer with × and "Send now".
  3. do: Click another thread in RECENT THREADS (or Agents in the sidebar). → expect: no question is asked before leaving.
  4. do: Click the first thread again and wait for the story to end. → expect (bug): "Now give it a title." is not above the composer and is never sent. The thread ends with the story.
  5. do: Repeat steps 1-2, then reload the page. → expect (bug): no "Leave site?" prompt, and the queued message is gone after the reload.

---

## 5. Stop may not stop the run

**Where it sits:**
- stop-a-reply, Step `stop`, when the reply under way was **not started by this page**.
- That covers come-back-to-a-thread Variant `still-running` (after a reload, or on coming back), and approve-a-tool-call Step `run` (after Approve or Deny).
- Parts: `run-stop`, `live-conversation`.

**What the code does**

auxilia's side:
- The Stop square calls `actions.stop` → `useThreadSession.stop` (l.329-332): `selectorStream.stop()`, then an active-runs poll.

The SDK's side, in `@langchain/langgraph-sdk/dist/stream/controller.js`:
- `StreamController.stop` (l.885-894) sends `client.runs.cancel(threadId, runId)` **only if `this.#activeRunId != null`**, then `submitter.stop()`.
- `#activeRunId` is written in exactly one place: `#notifyCreated` (l.908-912).
- `#notifyCreated` is reached only from `onRunCreated` in the submit coordinator (`submit-coordinator.js` l.291-293), when a `run.start` command made by this controller's `submit()` returns a `run_id`.
- It is cleared on completion (l.914-915) and on a reset (l.1313).

Where the run id goes missing:
- **Hydrate / join (reload, remount, coming back):** this path never sets `#activeRunId`. A run the page joined has no id, so Stop sends no cancel request.
- **Approve / Deny:**
  - `respond()` → `submitter.dispatchResume` (`submit-coordinator.js` l.385-422) → `thread.respondInput` sends `input.respond`.
  - The backend answers that command with `{}` and no `run_id` (`backend/app/runtime/api/protocol_service.py` l.74-79, against l.76 for `run.start`).
  - So the run that resumes after an approval cannot be cancelled from the page either, even without a reload.

What Stop does do in those cases:
- `SubmitCoordinator.stop` (l.429-435) aborts only `#runAbort` and forces `isLoading=false`.
- For a joined run `#runAbort` is unset, so the root subscription stays open and the run's events can keep arriving.

The backend's side:
- It would cancel properly if asked: `POST /threads/{id}/runs/{run_id}/cancel` → `runs_router.py#cancel_run` → `RunService.cancel` (`backend/app/runtime/runs/service.py` l.330-347).
- No one asks. auxilia never looks up the active run (`GET /threads/{id}/runs/active` exists) to cancel it itself.

How it looks on screen:
- The square turns back into the arrow.
- The sidebar spinner comes back, or stays, on the next active-runs poll (every 5 s, `use-active-runs.ts`).
- The answer probably keeps growing. That last part can't be told from code alone.
- A message sent right after goes out with `multitaskStrategy: "enqueue"`, so it waits server-side until the "stopped" run really ends.

**Verdict:** likely true. It is also wider than reported, because it covers runs resumed by Approve/Deny, not just reloads.

**Repro script A (reload)**
- setup:
  - Sign in as an admin, and start a thread with any agent.
  - Keep DevTools > Network open, filtered on `cancel`.
- steps:
  1. do: Send "Write a 1500-word story about a lighthouse." and click the square mid-way. → expect (control, works): the story stops, and one `POST …/runs/<id>/cancel` shows in Network.
  2. do: Send "Write another 1500-word story, about a harbour." and, while it streams, reload the page. → expect: the story shows as far as it got and keeps streaming, with the square and the sidebar spinner.
  3. do: Click the square. → expect (bug): the arrow comes back but **no** `cancel` request shows in Network. Within ~5 s the sidebar spinner is still or again there, and the story may keep growing.
  4. do: Type "Stop." and press Enter. → expect (bug): your message waits with no answer until the harbour story has finished on the server.
  5. do: Wait a minute and reload. → expect (bug): the harbour story is complete, not cut where you clicked.

**Repro script B (after an approval)**
- setup:
  - Sign in as an admin.
  - Have an agent with a tool set to "Needs approval", and ask it something that makes it call that tool and then write a long answer.
- steps:
  1. do: Click "Approve", and while the tool step spins or the answer streams, click the square. → expect (bug): no `cancel` request in Network, the spinner stays in the sidebar, and on reload the answer is complete.

**What the Flow says that the code contradicts:**
- stop-a-reply, Step `stop`, says "The app asks the backend to stop the run". That is false for joined and resumed runs.
- come-back-to-a-thread, Variant `still-running`, promises "the Stop square in the composer" with no hint that this square does not stop.

---

## 6. Blocked MCP sign-in popup: the button resets silently

**Where it sits:**
- connect-an-agents-servers, Step `authenticate`.
- Variant `not-finished` covers a closed popup ("A minute after the click…"), not a blocked one. A blocked popup resets the button *at once*.
- Part: `mcp-sign-in`.

**What the code does:**
- `web/src/app/(protected)/agents/[id]/chat/components/connect-servers-dialog.tsx#ConnectServersDialog` → `handleConnect` (l.69-127).
- When `window.open` returns null (l.86-91) the code runs `console.error("Popup blocked for", …)` and `setConnectingId(null)`. The comment there says "tell the user instead of silently timing out", but nothing tells the user.
- A failing `list-tools` lands in the `catch` (l.121-126) and does the same.
- `window.open` runs after `await listMcpServerTools(...)`. Chrome only allows a popup within a few seconds of the click (transient user activation). So a slow `list-tools` can get the popup blocked even when the site may open popups. That is an inference about browsers, not something checked here.

**Verdict:** likely true.

**Repro script**
- setup:
  - Have an agent with an OAuth MCP server, and an account never connected to it.
  - Sign in with it, open the agent's chat, and click "Connect".
- steps:
  1. do: In Chrome, click the site-info icon left of the address > Site settings > "Pop-ups and redirects" > Block. Go back to the tab. → expect: "Authentication required" is still open.
  2. do: Click "Authenticate with" the server. → expect (bug): the button may flash "Waiting for authentication…", then reads "Authenticate with" again. No popup opens and nothing says why (Chrome may show its own blocked-popup icon in the address bar).
  3. do: If a popup did open in step 2, close it. Set DevTools > Network throttling to a custom profile with 6000 ms latency and click again. → expect (bug): same as step 2, after ~6 s.
  4. do: DevTools > Request blocking `*list-tools*`, click again. → expect (bug): the button resets and nothing is said.

---

## 7. Deleting the thread on screen leaves you on it

**Where it sits:**
- delete-a-thread, Step `delete`, when the thread deleted is the one open.
- The Flow's QA setup avoids this case on purpose ("Open another page, so the 'Delete me' thread is not the one on screen").
- Part: `thread-delete`.

**What the code does:**
- `web/src/components/layout/app-sidebar/index.tsx#AppSidebar` → `handleDeleteThread` (l.171-180): `deleteThread(id).then(() => removeThread(id))`.
- There is no `router.push` and no check against `pathname`, which is right there (l.120, l.263).
- The thread page keeps its loaded conversation and its composer.
- A message sent then is a `run.start` on a deleted thread. `authorize_thread` → `ThreadService.get` answers 404 "Thread not found", which likely shows as "An error occurred." under the message.

**Verdict:** likely true.

**Repro script**
- setup:
  - Sign in as an admin, and start a thread by sending "Delete me". Stay on it.
- steps:
  1. do: Point at that thread in RECENT THREADS, click its three dots, then Delete. → expect (bug): the row leaves the list but the page still shows "Delete me", the answer and the composer.
  2. do: Send "Still here?" → expect (bug): "An error occurred." with an error such as "Thread not found".
  3. do: Reload. → expect: "Thread not found" in red with Retry.

---

## 8. A failed rename or delete shows nothing

**Where it sits:**
- rename-a-thread, Step `save`.
- delete-a-thread, Step `delete`.
- Parts: `thread-rename`, `thread-delete`.

**What the code does:**
- Rename: `web/src/components/layout/app-sidebar/rename-thread-dialog.tsx#RenameThreadDialog` → `handleSubmit` (l.34-52). The `catch` logs and `finally` resets "Saving…". The window stays open with the typed title and no message.
- Delete: `AppSidebar.handleDeleteThread` (l.171-180). The `catch` logs and the row stays.
- The backend can refuse with a 404 (thread already gone) or a 403 (not the owner: `threads/router.py#update_thread`, `#delete_thread`). A network failure does the same.

**Verdict:** likely true.

**Repro script**
- setup:
  - Sign in as an admin, have two threads, A and B, and open the app in two tabs.
- steps:
  1. do: In tab 1, delete thread A. In tab 2, where A is still listed, open A's menu, click Rename, type "New name" and click Save. → expect (bug): "Saving…" turns back into "Save", the window stays open and nothing says why.
  2. do: In tab 2, close the window, then open A's menu again and click Delete. → expect (bug): the row stays in the list and nothing is said.
  3. do: (no second tab) Set DevTools to "Offline", open B's menu and click Delete. → expect (bug): B's row stays and nothing is said.

---

## 9. Renaming a trigger thread changes its second line

**Where it sits:**
- rename-a-thread, Step `open` (the Title field) and Step `save`, for a thread started by a trigger.
- Parts: `thread-rename`, `thread-list`.

**What the code does:**
- A trigger firing stores the trigger's name as the thread's `first_message_content` (`backend/app/triggers/service.py` l.271).
- The sidebar shows trigger threads with the **firing time as the title** and `firstMessageContent` as the **subtitle** (`app-sidebar/index.tsx` l.264-277).
- Rename always writes `first_message_content` (`ThreadPatch`, `RenameThreadDialog`), so:
  - the window opens holding the trigger's name, not the title on the row.
  - Save changes the second line, and the first line keeps the time.
- The chat header's trigger name comes from the same field (`session-reducer.ts#chatHeaderFromThread` l.160 → `chat-header.tsx` l.178-196), so it changes too, the next time the thread loads.

**Verdict:** likely true.

**Repro script**
- setup:
  - Sign in as an admin, with a trigger that has fired at least once (use its manual run on the Triggers page if needed).
  - Its thread is in RECENT THREADS with a clock icon: a time as its first line and the trigger's name under it.
- steps:
  1. do: Open that row's menu and click Rename. → expect (bug): the Title field holds the trigger's name, not the time shown as the title.
  2. do: Type "Morning digest check" and click Save. → expect (bug): the first line still shows the time, and the second line now reads "Morning digest check".
  3. do: Open the thread and reload. → expect (bug): the chat header names the trigger "Morning digest check".

**What the Flow says that the code contradicts:** rename-a-thread, Step `save`, says "the row shows the new title". For a trigger thread, the new text lands on the row's second line instead.

---

## 10. An admin reading someone else's thread still sees Retry and Approve/Deny

**Where it sits:**
- read-another-users-thread, Step `open`, which promises a read-only thread.
- It reaches retry-a-reply, Step `retry`, and approve-a-tool-call, Step `decide`.
- Parts: `thread-availability`, `answer-retry`, `tool-approval`.

**What the code does:**
- The page replaces the composer when `meta.viewerRole === "admin"` (`…/[threadId]/page.tsx` l.151-160). It does not pass `viewerRole` to `ConversationBody`.
- Retry is drawn when `!isLoading && isLast && !modelUnavailable` (`conversation-body.tsx` l.208-213).
- Approve/Deny are disabled only by `modelUnavailable` (`conversation-body.tsx` l.501, `subagent-card.tsx` l.267, `tool-step.tsx#ApprovalButton` l.264).
- The backend refuses both actions. `POST /threads/{id}/commands` depends on `authorize_thread`, which is owner-only and returns 403 "Not authorized to access this thread" (`backend/app/runtime/api/runs_router.py` l.57-66; `protocol_router.py` l.75-79).
- On the page, the refusal probably lands as the stream's error ("An error occurred." plus an error text). After an Approve the two buttons stay locked until a reload. The exact text can't be told from code.

**Verdict:** likely true.

**Repro script**
- setup:
  - Have a Member account with access to an agent that has a tool set to "Needs approval".
  - As the Member, start thread 1 by sending "Hello from the member" and let it answer.
  - Start thread 2 by asking for something that needs that tool, and leave it at NEEDS APPROVAL.
  - Sign in as a workspace admin.
- steps:
  1. do: Agents > the agent > three dots > "View thread history", then open thread 1. → expect: "Viewing as admin — this thread belongs to another user and is read-only." in place of the composer, and (bug) the Retry icon under the answer.
  2. do: Click Retry. → expect (bug): "An error occurred." with an error text. After a reload the Member's answer is unchanged.
  3. do: Open thread 2. → expect (bug): the step shows "NEEDS APPROVAL" with Approve and Deny enabled.
  4. do: Click Approve. → expect (bug): both buttons lock and an error shows. After a reload the step still shows NEEDS APPROVAL.

**What the Flow says that the code contradicts:**
- read-another-users-thread promises "without being able to write in it", but the controls to act are still on screen.
- retry-a-reply, Step `retry`, lists when the icon is hidden ("not when the thread's model has been turned off"). It is not hidden for an admin viewer either, though it should be.

---

## Surprises worth a decision

- **#3 is not a missing path. It is a missing Variant, plus a misleading notice.**
  - start-a-thread and come-back-to-a-thread need a Variant for "the agent's tools were never listed".
  - The Flow to write `add-an-mcp-server-to-an-agent` should say that Save accepts a server whose tools aren't loaded yet.
  - Because `not_configured` is checked before sign-in, a User who only needed to connect is told to contact the owner.
- **New shape:**
  - A failed or refused `is-ready` shows "Connect", and the window it opens says "authenticate with 0 services" with no button (see #3).
  - It is not in the list, and no Flow describes it.
- **#5 is wider than reported.** Stop after Approve/Deny also never cancels on the server, with no reload involved. stop-a-reply's `stop` Step describes the app wrongly for joined and resumed runs.
- **#1 and #2 share a cause the list didn't name.** `ChatPromptInput.onSubmit` is synchronous, so the composer clears the typed text and files before the app knows whether the send worked. Any silent early return loses the message.
- **Flow wording:**
  - delete-a-thread's QA setup steers around #7 instead of covering it.
  - rename-a-thread's `save` Step is wrong for trigger threads (#9).
- **Seen in passing, not checked further:** `POST /threads` (`ThreadService.create`) does not check that the caller may use `agent_id`. Whether a run on such a thread is refused later was not traced.
