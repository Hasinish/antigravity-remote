# history.md

## Development Timeline

### 2026-06-16 (continued — Markdown Table Support & Zero-Lag Typing)
* **Markdown Table Rendering Support**: Added custom block parsing and layout styles to [MarkdownText.tsx](file:///D:/antigravity-remote/mobile-app/src/components/MarkdownText.tsx) to parse markdown tables and render them with beautiful responsive horizontal scrolling, fixing the broken raw text display for comparison tables.
* **Root cause of typing lag identified**: The `TextInput` component was a React-controlled input (`value={state}`), causing a full React reconciliation on every single keystroke — exactly what made it feel sluggish.
* **Fix — uncontrolled native `<textarea>` on web**: Rewrote `ChatInput.tsx` to render a raw uncontrolled HTML `<textarea>` on `Platform.OS === 'web'`. The browser handles all rendering natively — zero React re-renders per keypress. Result: instant, silky-smooth typing at any speed.
* **App architecture decoupled**: Moved all input state out of `App.tsx` into `ChatInput.tsx`. App now only communicates with ChatInput via a `ChatInputHandle` ref (`setTextExternal` for IDE→App sync) and two stable callbacks (`onTextChange` for debounced WebSocket sync, `onSend`). App never re-renders on typing.
* **Text injection method fixed (Lexical API)**: Discovered the IDE's chat input is powered by the **Lexical** rich-text editor (Meta). Using `execCommand('insertText')` without interacting with Lexical's internal state caused text to duplicate/append. Fixed by using `target.__lexicalEditor.parseEditorState` + `setEditorState` to replace the editor's content atomically. Verified via Puppeteer test script.
* **Quick-pick panel un-stuck**: Resolved the "Open in current window" overlay staying stuck on app after IDE selection. Added error-catch and null-page guards in `startWatchingTranscript` to detect workspace reloads and broadcast `hide_switch_options` immediately.
* **React.memo applied**: Wrapped `Header`, `HistoryPanel`, and `MessageFeed` in `React.memo` to prevent unnecessary re-renders from App-level state changes.
* **Bridge file logger added**: All server logs now also written to `server/bridge-server.log` for real-time diagnostics.

### 2026-06-16 (continued — Bidirectional Mirroring, Panel Sync & Aesthetics)
* **Bidirectional Input Sync (Zero Lag)**: Optimized input diffing logic using direct DOM assignments (`textContent`) and React event dispatching. Bypassed operation queue bottleneck for typing events. Added a 2-second reverse-echo block following mobile input events to resolve cursor resetting and feedback loops.
* **Aesthetics & Premium Styling**: Redesigned the companion app client layout and styling to match the IDE. Integrated sleek Zinc-950 background colors (`#09090b`), custom minimalist dark scrollbars for the Web build, full-width chat bubbles, and nested the model selector dropdown inside the input box matching the IDE's custom aesthetics.
* **Conversation Switching (Subsequence Matcher)**: Added a Puppeteer-based active conversation watcher that scrapes current messages from the IDE pane, normalizes them, and searches the brain directory to find the best subsequence transcript match. Switches active streams instantly.
* **History Panel Sync**: Monitored and synchronized the history panel state. Opening or closing `.jetski-fast-pick` in the IDE instantly slides open/close the recent chats menu on the App (includes automated expansion clicks for "Show more" options).
* **Quick-Pick Panel Mirroring**: Implemented extraction and transmission of IDE quick-pick choices (`.quick-input-widget`) to present interactive overlays on the companion app.
* **Stuck Quick-Pick Sync Fix**: Resolved an issue where selecting "Open in current window" in the IDE would leave the App's overlay stuck. Added error-catch blocks and page nullability checks to automatically detect workspace navigation/reloads and broadcast dismiss events to clear the App overlay.
* **Bridge Logger**: Redirected bridge server console outputs to `server/bridge-server.log` to aid in diagnostic tracing.
* **Release**: Verified end-to-end functionality, committed, and pushed all updates to the remote git repository.

### 2026-06-16 (Trusted Types Bypass & Selector Optimization)
* **DOM Selector Investigation**: Created `inspect2.js` to scan the active IDE shadow DOM and identify correct classes and selectors for the chat elements.
* **Trusted Types Issue**: Identified that DOM-based injection was blocked by Chrome's `TrustedHTML` policy, throwing errors.
* **Pivoted to Native Emulation**: Rewrote injection logic in `index.js` to use Puppeteer's native OS-level keyboard emulation (`page.keyboard.type`) and native coordinate mouse clicks to bypass all DOM restrictions and trigger React event hooks.
* **Expo Web Setup**: Set up Expo web support on port `8082` to make web browser testing easy. Added auto-hostname IP detection to `App.tsx` for seamless connection.
* **Validation**: Verified with `test-inject.js` that text typing and prompt execution succeed.

### 2026-06-15 (Setup & Initial Implementation)
* Project conceived: Remote chat interface for the Antigravity agentic chat.
* Cleaned out old repository, preserving only `memory/`.
* Created the PC bridge server in `server/index.js` and React Native mobile client configs/components under `mobile-app/`.
* Added startup script `start-debugging-and-server.bat`.
