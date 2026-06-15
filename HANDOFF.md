# Antigravity Chat Remote — Handoff Context

## What this project is
A remote-control system for the **Antigravity IDE's AI chat panel**. Lets the user control the IDE's agentic chat from a phone/browser: type messages, send them, switch models, start new chats, and browse/switch past conversations — all mirrored live in the actual IDE window.

## Architecture
```
Mobile/Web Client (Expo, port 8082)
   <--- WebSocket (port 8080) --->
PC Bridge Server (Node.js, server/index.js)
   <--- CDP (port 9222) --->
Antigravity IDE (Electron/Chromium, VS Code fork)
   <--- chokidar watches --->
~/.gemini/antigravity-ide/brain/<uuid>/.system_generated/logs/transcript.jsonl
```

- **Client**: `mobile-app/` — React Native (Expo) web/mobile app, dark VS Code-style chat UI. Entry point `App.tsx`. Run with `npm run web` (port 8082).
- **Bridge**: `server/index.js` — Node.js + `puppeteer-core` connects to the IDE's remote debug port 9222, drives the UI via native keyboard/mouse emulation, watches the active conversation's `transcript.jsonl`, and bridges everything over a WebSocket on port 8080.
- **IDE**: Must be launched with `--remote-debugging-port=9222` (see `start-debugging-and-server.bat`).

## How to run (manual, two terminals)
1. Make sure Antigravity IDE is running with `--remote-debugging-port=9222`.
2. Terminal 1:
   ```
   cd D:\antigravity-remote\server
   node index.js
   ```
   If you get `EADDRINUSE: 0.0.0.0:8080`, find and kill the stale process first:
   ```
   netstat -ano | grep ':8080' | grep LISTENING
   taskkill /F /PID <pid>
   ```
3. Terminal 2:
   ```
   cd D:\antigravity-remote\mobile-app
   npm run web
   ```
4. Open the web app at `http://localhost:8082` (or the printed LAN IP for phone access — app auto-detects hostname).

## Key implementation details / selectors (reverse-engineered from the live IDE DOM)
- **Chat input**: `div[contenteditable="true"]` whose class contains `max-h-[300px]`. Text is injected via `target.textContent = text` + dispatching `input`/`change` events (Trusted Types-safe). Typing diffs are applied via native `page.keyboard.type`/`Backspace` (see `applyInputDiff`).
- **Send button**: button with `aria-label`/`title` containing "Send message" (with fallback heuristics in `findSendButton`/the `send` handler).
- **New chat button**: `a[data-tooltip-id="new-conversation-tooltip"]`.
- **Model selector**: button with `aria-label` containing "select model"/"model selector"; options are plain text elements matched by string.
- **History / Past Conversations button**: `a[data-tooltip-id="history-tooltip"]`. Clicking it opens `.jetski-fast-pick`, a full-screen overlay (`z-[2600]`) containing:
  - A search input: `.jetski-fast-pick input` (placeholder "Search all convos...")
  - Section headers: "Running", "Recent"
  - Conversation rows: `.jetski-fast-pick [role="option"]`, text format `"<title> | [bots |] <time ago>"`
  - A `"Show N more..."` row — ALSO a `[role="option"]` matching `/show \d+ more/i`. Must be clicked repeatedly (loop) to reveal all conversations; filter it out of any extracted list.
- **Selecting a conversation row** opens a native VS Code `.quick-input-widget` with `.monaco-list-row` items: **"Open in current window"** (default-focused — click this) and "Open in workspace: <path>".

## Currently implemented features (server/index.js)
- `input` — live keystroke sync into the chat box (diff-based, native keyboard emulation)
- `send` — clicks the send button (or presses Enter as fallback)
- `new_chat` — clicks the new-conversation button, clears the feed, and re-arms the transcript watcher on the new file
- `change_model` — opens the model dropdown and clicks the matching model
- `list_conversations` — **NEW this session**: calls `openPastConversationsPanel(page)` which opens the IDE's Past Conversations panel AND clicks every "Show N more..." until fully expanded (so the user sees it mirrored live in the IDE), then sends back the full list from `listConversations()` (built by scanning `~/.gemini/antigravity-ide/brain/*/...transcript.jsonl`)
- `select_conversation` — calls `switchIdeConversation(page, title)`: re-opens the panel, expands all "Show more", clicks the row whose text starts with the conversation's title, then clicks "Open in current window" in the resulting quick-pick. On success, re-arms the live transcript watcher (`switchActiveFile`) and pushes fresh history to all clients.

## Mobile app (App.tsx) state relevant to history feature
- `showHistoryDropdown` (bool) — shows/hides the conversation list dropdown
- `switchingConversation` (bool) — shows a "Switching conversation..." spinner banner while waiting for the new `history` WS message
- On history button tap → sends `{type:'list_conversations'}` → server opens IDE panel + replies `conversation_list`
- On picking a conversation → sends `{type:'select_conversation', id}` → server switches IDE + replies with fresh `history`

## Known issues / open items
- **Title matching**: `switchIdeConversation` matches the IDE panel row by `title.startsWith(conv.title.slice(0,20))`, where `conv.title` comes from `listConversations()` (derived from transcript content, NOT necessarily identical to the IDE panel's displayed title). This worked for the tested case ("hey ma dudeeee") but could mismatch for conversations where the derived title diverges from the IDE's displayed title — worth validating across more conversations.
- **Timing**: all the panel-expansion/click steps use fixed `setTimeout` delays (150–500ms). If the IDE is slow (cold start, many conversations), these may need tuning.
- **End-to-end test status**: the mirrored "list_conversations opens IDE panel" change and the updated `switchIdeConversation` (using the "Show more" loop instead of search-typing) were just implemented and syntax-checked (`node -c index.js` OK) but NOT YET live-tested through the actual mobile app UI — only validated via a standalone `server/test-step.js` script run manually by the user.
- `server/test-step.js` is a scratch/debug file (currently contains the step-5 "click hey ma dudeeee → Open in current window" test) — fine to delete or repurpose.

## Working style notes for whoever picks this up
- The user runs both the bridge server and the Expo app manually in their own terminals (not via background agent processes).
- They prefer iterative, visually-confirmed testing: small script change → user runs it → user reports/screenshots IDE state → next step.
- Repo: `D:\antigravity-remote`. Project memory notes (architecture/history) live in `D:\antigravity-remote\memory\` (`state.md`, `history.md`, `purpose.md`).
