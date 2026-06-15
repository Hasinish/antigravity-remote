# state.md

## Current Project State

### Active Components

1. **PC Bridge Server (`server/index.js`)**
   - **Port**: `8080` (WebSocket)
   - **Puppeteer connection**: Hooked into the IDE debugging instance at `http://localhost:9222`.
   - **File Watcher**: chokidar watches the workspace's active `transcript.jsonl` log.
   - **File Logger**: Redirects stdout logs to `server/bridge-server.log` for execution tracing.
   - **Real-time Input Sync (Zero Lag)**: Uses direct DOM assignments (`target.textContent`) and React event dispatching in parallel (bypassing `opQueue`). Prevents cursor jitter and feedback loop echoes using `lastMobileInputTime` to ignore reverse-broadcasts for 2 seconds after mobile typing.
   - **History List Watcher**: Watcher scans `.jetski-fast-pick` in the IDE DOM, auto-syncs and lists conversations on the App drawer (including automatic expansion of "Show more" options).
   - **Model Select Sync**: Syncs selected models and lists popover dropdown items between the IDE and companion App.
   - **Workspace Selection / Quick-Picks**: Detects `.quick-input-widget` occurrences (e.g., "Open in current window" vs. "Open in workspace: d:\bots") and sends options to the companion app. Clicking or closing this menu on either screen is perfectly synchronized in real-time. Handles window reloads/errors by clearing state and broadcasting dismissal to prevent stuck panels.

2. **Mobile/Web App Client (`mobile-app/`)**
   - **Port**: `8082` (served via Expo Metro)
   - **Entry point**: `App.tsx`
   - **UI Design System**: Sleek Zinc-950 dark theme (`#09090b` background), custom minimalist dark scrollbars on the Web build, full-width message bubbles, and unified typography matching the IDE aesthetics.
   - **Components**: `Header`, `HistoryPanel`, `MessageFeed`, `ChatInput` (with integrated model select button inside the input container), `SetupScreen`.

### Known Workaround & Selector Configs
* **Chat Input Selector**: `div[contenteditable="true"]` containing `max-h-[300px]` in its class.
* **Send Button Selector**: Button with `aria-label` or `title` containing `"Send message"`.
* **Model Dropdown Selector**: Button with `aria-label` containing `"Select model"`, popovers matching `button[class*="group/popover-item"]`.
* **History Panel Selector**: `.jetski-fast-pick` container.
* **Quick-Pick Panel Selector**: `.quick-input-widget` container.
