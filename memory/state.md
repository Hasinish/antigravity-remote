# state.md

## Current Project State

### Active Components
1. **PC Bridge Server (`server/index.js`)**
   - **Port**: `8080` (WebSocket)
   - **Puppeteer connection**: Hooked into the IDE debugging instance at `http://localhost:9222`.
   - **File Watcher**: chokidar watches the workspace's active `transcript.jsonl` log.
   - **Input Sync Method**: Uses Puppeteer's native keyboard emulation (`page.keyboard.type`) after focusing the element and clearing it with selection (`Ctrl+A` + `Backspace`) to satisfy Chromium's **Trusted Types** policy and correctly trigger React state updates.
   - **Send Method**: Locates the Send Message button using bounding boxes and performs a native click at the coordinates.

2. **Mobile/Web App Client (`mobile-app/`)**
   - **Port**: `8082` (served via Expo Metro)
   - **Entry point**: `App.tsx`
   - **Features**: Live message feed (renders User, Model, and Tool execution blocks), model selector dropdown, connection IP configuration (auto-defaults to current web hostname), and real-time input sync.

### Known Workaround & Selector Configs
* **Chat Input Selector**: `div[contenteditable="true"]` containing `max-h-[300px]` in its class.
* **Send Button Selector**: Button with `aria-label` or `title` containing `"Send message"`.
* **Model Dropdown Selector**: Button with `aria-label` containing `"Select model"`, dropdown options are simple span elements matching the model text.

### "Past Conversations" Panel — Conversation Switching (IN PROGRESS, not yet live-validated)
Goal: when the user picks a past conversation in the mobile app's "Recent Conversations" list, the bridge drives the IDE itself to switch to that conversation (mirrors the real IDE's "Past Conversations → click conversation → Open in current window" flow), so future messages go to the right conversation in both app and IDE.

* **History button**: `a[data-tooltip-id="history-tooltip"]` — click opens the `.jetski-fast-pick` overlay panel (full-screen, `z-[2600]`).
* **Search input**: `.jetski-fast-pick input`, placeholder `"Search all convos..."`.
* **Conversation rows**: `.jetski-fast-pick [role="option"]`, text format `"<title> | [bots |] <time ago>"`. Section headers are "Running" and "Recent".
* **"Show N more..."**: also a `[role="option"]` matching `/show \d+ more/i` — must be clicked (possibly repeatedly) to reveal all conversations; filter these out of the final list.
* **Selecting a row** opens a VS Code-native `.quick-input-widget` with `.monaco-list-row` items: "Open in current window" (default-focused) and "Open in workspace: <path>". Click the row starting with "Open in current window" to switch the IDE's active chat to that conversation.
* **Implemented**: `switchIdeConversation(page, title)` in `server/index.js` — Escape → click history button → click search input → type `title.slice(0,40)` → click matching `[role="option"]` (match via `startsWith(title.slice(0,20))`) → click "Open in current window" row if present.
* **`select_conversation` WS handler** (server/index.js): if the requested conversation is already the live one, just resends transcript history; otherwise calls `switchIdeConversation` and on success calls `switchActiveFile(conv.path)`, on failure sends `{type:'error'}`.
* **`request_live_history` handler was removed entirely** — no more read-only "viewing history" mode.
* **App.tsx**: removed `viewingHistory`/`viewingTitle`/`backToLive`/history banner; added `switchingConversation` boolean state + a "Switching conversation..." spinner banner shown while waiting for the new `history` message.
* **Status**: code written and syntax-checked (`node -c index.js` OK) but NOT yet run end-to-end. Currently doing step-by-step DOM verification via a scratch `server/test-step.js` script, run one step at a time with the user visually confirming the IDE state after each step (steps 1–3 confirmed: history button opens panel, panel structure dumped, "Show 1 more" reveals a 6th conversation). Next step (written, not yet run): loop-click all "Show N more..." until none remain, then dump the full conversation list — to be followed by testing search-filter typing, row click, and the "Open in current window" quick-pick.
