# Antigravity Chat Remote Control

This repository contains the source code for a custom remote-control companion system designed for the **Antigravity agentic chat interface**. It enables real-time text input injection, action controls, and diagnostic checks directly from a web/mobile application or terminal.

---

## Repository Structure

```
├── server/               # PC Bridge Server (Node.js + Puppeteer-core + WebSockets)
├── mobile-app/           # Mobile & Web Client App (React Native Expo)
└── start-debugging-and-server.bat # Dev launcher script
```

## Features & Diagnostics

### 1. PC Bridge Server
The bridge server connects to a running Antigravity IDE instance via Puppeteer debugging port `9222` and exposes a WebSocket server on port `8080`. The companion app uses this to inject text and control actions.

### 2. User Status & Session Tracker (`server/get-user.js`)
Queries running Antigravity Language Server processes, probes their Connect-RPC ports with CSRF tokens, and displays details for currently logged-in users.
```bash
node server/get-user.js
```

### 3. Model Quota Tracker (`server/get-quota.js`)
Retrieves active session details and prints remaining model quotas (such as Gemini and Claude limits) for the production endpoint.
```bash
node server/get-quota.js
```

---

## Quick Start

### 1. Launch IDE & Bridge Server
Double-click `start-debugging-and-server.bat` at the project root. This script will:
* Terminate existing IDE instances.
* Start Antigravity IDE with remote debugging enabled (`--remote-debugging-port=9222`).
* Boot the Node.js bridge server on port `8080`.

### 2. Launch Web/Mobile Client
Navigate to `mobile-app/` and run:
```bash
npx expo start --web --port 8082
```
Open [http://localhost:8082](http://localhost:8082) in your browser and click **Connect to PC**.
