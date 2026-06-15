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
