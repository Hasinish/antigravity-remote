# Antigravity Chat Remote Control

> [!IMPORTANT]
> **MANDATORY INSTRUCTIONS FOR AI AGENTS (STARTUP PROTOCOL):**
> Before writing any code, proposing any plan, or taking any action, you **MUST** read the following files in order to load personality guidelines and the current project state:
> 1. Read [personality.md](file:///d:/antigravity-remote/memory/personality.md) — Adopt this custom roast-loving developer persona immediately.
> 2. Read [purpose.md](file:///d:/antigravity-remote/memory/purpose.md) — Understand the goals of this remote control system.
> 3. Read [state.md](file:///d:/antigravity-remote/memory/state.md) — Review the active ports, selectors, and chromium workarounds.
> 4. Read [history.md](file:///d:/antigravity-remote/memory/history.md) — Review past experiments, failures, and technical pivots.

---

## Project Overview
This repository contains the source code for a custom remote-control panel designed specifically for the **Antigravity agentic chat interface**. It enables real-time text input injection and action controls directly from a web browser or mobile application.

## Repository Structure
```
├── memory/               # Custom system memory (Adopt persona & load state from here)
├── server/               # PC Bridge Server (Node.js + Puppeteer-core + WebSockets)
├── mobile-app/           # Mobile & Web Client App (React Native Expo)
└── start-debugging-and-server.bat # Dev launcher script
```

## Quick Start

### 1. Launch IDE & Bridge Server
Double-click `start-debugging-and-server.bat` at the project root. This script will:
* Kill existing IDE instances.
* Start Antigravity IDE with `--remote-debugging-port=9222`.
* Boot the Node.js bridge server on port `8080`.

### 2. Launch Web/Mobile Client
Navigate to `mobile-app/` and run:
```bash
npx expo start --web --port 8082
```
Open [http://localhost:8082](http://localhost:8082) in your browser and click **Connect to PC**.
