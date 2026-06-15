const puppeteer = require('puppeteer-core');
const WebSocket = require('ws');
const chokidar = require('chokidar');
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');

const logFile = path.join(__dirname, 'bridge-server.log');
fs.writeFileSync(logFile, ''); // truncate on start

const originalLog = console.log;
const originalError = console.error;

function logToFile(...args) {
  const msg = args.map(arg => {
    if (arg && typeof arg === 'object') {
      try { return JSON.stringify(arg); } catch (e) { return String(arg); }
    }
    return String(arg);
  }).join(' ') + '\n';
  fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}`);
  originalLog.apply(console, args);
}

function errorToFile(...args) {
  const msg = args.map(arg => {
    if (arg && typeof arg === 'object') {
      try { return JSON.stringify(arg); } catch (e) { return String(arg); }
    }
    return String(arg);
  }).join(' ') + '\n';
  fs.appendFileSync(logFile, `[${new Date().toISOString()}] ERROR: ${msg}`);
  originalError.apply(console, args);
}

console.log = logToFile;
console.error = errorToFile;

const PORT = 8080;
const DEBUG_PORT = 9222;

// CONFIRMED CLASS of the Antigravity chat input box (from inspect2.js output)
const CHAT_INPUT_CLASS = 'max-h-[300px] rounded-md cursor-text overflow-y-auto text-md p-2 outline-none transition-all duration-100 text-sm';

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let browser = null;
let chatPage = null;
let lastSize = 0;
let activeFilePath = null;
let fileWatcher = null;
let cachedConversations = [];
let pendingSwitch = null;
let lastManualSwitchTime = 0;
let lastKnownIDEInput = '';
let isPollingInput = false;
let wasHistoryOpen = false;
let lastHistoryState = '';
let lastQuickPickOptions = null;
let wasModelMenuOpen = false;
let lastActiveModel = '';
let lastMobileInputTime = 0;

// All keyboard/mouse operations against the IDE page are chained through this
// so overlapping requests (e.g. fast typing) can't interleave Ctrl+A / modifier
// sequences and leave a key stuck "down", which fires IDE shortcuts.
let opQueue = Promise.resolve();

// Find the latest transcript.jsonl file under the brain directory
function getLatestTranscriptPath() {
  const brainDir = path.resolve(os.homedir(), '.gemini/antigravity-ide/brain');
  if (!fs.existsSync(brainDir)) {
    console.log(`[!] Brain directory not found at: ${brainDir}`);
    return null;
  }
  const contents = fs.readdirSync(brainDir);
  let latestTime = 0;
  let latestFolder = null;
  
  for (const name of contents) {
    const fullPath = path.join(brainDir, name);
    try {
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        const transcriptFile = path.join(fullPath, '.system_generated', 'logs', 'transcript.jsonl');
        if (fs.existsSync(transcriptFile)) {
          const tStat = fs.statSync(transcriptFile);
          if (tStat.mtimeMs > latestTime) {
            latestTime = tStat.mtimeMs;
            latestFolder = fullPath;
          }
        }
      }
    } catch (e) {
      // Ignore directory access errors
    }
  }
  return latestFolder ? path.join(latestFolder, '.system_generated', 'logs', 'transcript.jsonl') : null;
}

// Puppeteer helper to find the page containing the chat box
async function findChatPage(browserInstance) {
  try {
    const pages = await browserInstance.pages();
    for (const page of pages) {
      const url = page.url();
      if (url.includes('workbench.html')) {
        console.log(`[+] Identified workbench page: ${url}`);
        return page;
      }
    }
  } catch (error) {
    console.error(`[-] Error locating workbench page:`, error.message);
  }
  return null;
}

async function connectToIDE() {
  try {
    console.log(`[~] Connecting to IDE at http://localhost:${DEBUG_PORT}...`);
    browser = await puppeteer.connect({
      browserURL: `http://localhost:${DEBUG_PORT}`,
      defaultViewport: null
    });
    console.log(`[+] Connected to Puppeteer!`);
    
    chatPage = await findChatPage(browser);
    if (!chatPage) {
      console.log(`[!] Chat page not found. Will scan again when a message is received.`);
    } else {
      console.log(`[+] Chat page is ready.`);
    }
  } catch (error) {
    console.error(`[-] Connection failed. Is the IDE running with --remote-debugging-port=${DEBUG_PORT}?`);
    console.error(error.message);
  }
}

// Inject text into the confirmed Antigravity chat input div
const INJECT_TEXT_FN = `
async function injectText(text) {
  // Find all contenteditable divs with the exact confirmed class
  const allEditables = Array.from(document.querySelectorAll('div[contenteditable="true"]'));
  
  // Filter to only the Antigravity chat input (has max-h-[300px] in class)
  const chatInputs = allEditables.filter(el => el.className.includes('max-h-[300px]'));
  
  console.log('[DOM] Total contenteditable divs:', allEditables.length);
  console.log('[DOM] Chat input candidates:', chatInputs.length);
  
  if (chatInputs.length === 0) {
    console.log('[DOM] ERROR: No chat input found with max-h-[300px] class!');
    return false;
  }
  
  // Use the last one (most recently active chat panel)
  const target = chatInputs[chatInputs.length - 1];
  console.log('[DOM] Targeting chat input:', target.className.substring(0, 60));
  
  // Focus the element first
  target.focus();
  
  // Clear existing content using selection and delete command (Trusted Types safe)
  try {
    const selection = window.getSelection();
    selection.selectAllChildren(target);
    document.execCommand('delete', false);
  } catch (e) {
    console.error('[DOM] Failed to clear using Selection + delete:', e.message);
  }
  
  // Set textContent directly (this is fast and Trusted Types safe)
  target.textContent = text;
  
  // Dispatch React events so state updates
  target.dispatchEvent(new Event('input', { bubbles: true }));
  target.dispatchEvent(new Event('change', { bubbles: true }));
  
  // Place cursor at end
  try {
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(target);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  } catch (e) {
    console.error('[DOM] Failed to position caret:', e.message);
  }
  
  console.log('[DOM] Text injected. Current content:', (target.innerText || target.textContent).substring(0, 50));
  return true;
}
`;

const FIND_SEND_BUTTON_FN = `
function findSendButton() {
  const allEditables = Array.from(document.querySelectorAll('div[contenteditable="true"]'));
  const chatInput = allEditables.filter(el => el.className.includes('max-h-[300px]')).pop();
  
  if (!chatInput) return null;
  
  // Walk up to the container that holds the input
  let container = chatInput.parentElement;
  for (let i = 0; i < 5; i++) {
    if (!container) break;
    const buttons = Array.from(container.querySelectorAll('button'));
    
    // First pass: look specifically for "Send message" or "Send" label/title/text
    for (const btn of buttons) {
      const label = (btn.getAttribute('aria-label') || '').toLowerCase();
      const title = (btn.getAttribute('title') || '').toLowerCase();
      const text = (btn.innerText || '').toLowerCase();
      const rect = btn.getBoundingClientRect();
      
      if (rect.width > 0 && rect.height > 0) {
        if (label.includes('send message') || title.includes('send message') || text.includes('send message') ||
            label === 'send' || title === 'send' || text === 'send') {
          return btn;
        }
      }
    }
    
    // Second pass fallback: look for any button that contains "send" or class bg-primary/text-primary-foreground
    for (const btn of buttons) {
      const label = (btn.getAttribute('aria-label') || '').toLowerCase();
      const title = (btn.getAttribute('title') || '').toLowerCase();
      const text = (btn.innerText || '').toLowerCase();
      const className = (btn.className || '').toLowerCase();
      const rect = btn.getBoundingClientRect();
      
      if (rect.width > 0 && rect.height > 0) {
        if (label.includes('send') || title.includes('send') || text.includes('send') || 
            className.includes('bg-primary') || className.includes('text-primary-foreground')) {
          // Avoid matching "Add context" or "Record voice"
          if (!label.includes('context') && !label.includes('voice') && !label.includes('record')) {
            return btn;
          }
        }
      }
    }
    container = container.parentElement;
  }
  return null;
}
`;

// Send all lines of the transcript as history
function sendTranscriptHistory(filePath, client) {
  try {
    if (!fs.existsSync(filePath)) return;
    const data = fs.readFileSync(filePath, 'utf8');
    const lines = data.split('\n').filter(l => l.trim());
    const messages = lines.map(line => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean);
    
    console.log(`[i] Streaming ${messages.length} historical messages to client.`);
    client.send(JSON.stringify({ type: 'history', messages }));
  } catch (error) {
    console.error('[-] Error sending history:', error.message);
  }
}

// Read and broadcast newly appended lines
function readNewLines(filePath) {
  try {
    const stats = fs.statSync(filePath);
    const newSize = stats.size;
    if (newSize <= lastSize) {
      lastSize = newSize;
      return;
    }
    
    const stream = fs.createReadStream(filePath, {
      start: lastSize,
      end: newSize
    });
    
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk.toString();
    });
    
    stream.on('end', () => {
      lastSize = newSize;
      const lines = buffer.split('\n').filter(l => l.trim());
      for (const line of lines) {
        try {
          const msg = JSON.parse(line);
          console.log(`[Transcript Update]: ${msg.source} - ${msg.type}`);
          broadcast({ type: 'update', message: msg });
        } catch (e) {
          // Ignore partial read errors
        }
      }
    });
  } catch (error) {
    console.error('[-] Error reading new lines:', error.message);
  }
}

// Switch the live-watched transcript to `filePath`, re-arm the file watcher,
// and push fresh history to every connected client.
function switchActiveFile(filePath, title) {
  console.log(`[+] Watching transcript: ${filePath}`);
  const isFirstLoad = !activeFilePath;
  activeFilePath = filePath;
  lastManualSwitchTime = Date.now();
  lastSize = fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;

  if (fileWatcher) {
    fileWatcher.close();
  }

  fileWatcher = chokidar.watch(filePath, { persistent: true });
  fileWatcher.on('change', () => {
    readNewLines(filePath);
  });

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      // Send a toast notification if this is a switch (not first load) and we have a title
      if (!isFirstLoad && title) {
        client.send(JSON.stringify({ type: 'conversation_switched', title }));
      }
      sendTranscriptHistory(filePath, client);
    }
  });
}

const transcriptCache = new Map();

function getTranscriptInputsCached(filePath) {
  try {
    const stats = fs.statSync(filePath);
    const cached = transcriptCache.get(filePath);
    if (cached && cached.mtime === stats.mtimeMs) {
      return cached.inputs;
    }
    
    const data = fs.readFileSync(filePath, 'utf8');
    const lines = data.split('\n').filter(l => l.trim());
    const inputs = [];
    for (const line of lines) {
      try {
        const msg = JSON.parse(line);
        if (msg.source === 'USER_EXPLICIT' && msg.type === 'USER_INPUT' && msg.content) {
          const reqMatch = msg.content.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/i);
          const text = (reqMatch ? reqMatch[1] : msg.content).trim();
          if (text) {
            inputs.push(text.trim());
          }
        }
      } catch {}
    }
    
    transcriptCache.set(filePath, { mtime: stats.mtimeMs, inputs });
    return inputs;
  } catch (e) {
    return [];
  }
}

function normalizeText(str) {
  if (!str) return '';
  return str
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function findMatchingTranscript(cleanDomInputs) {
  const brainDir = path.resolve(os.homedir(), '.gemini/antigravity-ide/brain');
  if (!fs.existsSync(brainDir)) return null;

  const contents = fs.readdirSync(brainDir);
  const candidates = [];

  for (const name of contents) {
    const fullPath = path.join(brainDir, name);
    try {
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        const transcriptFile = path.join(fullPath, '.system_generated', 'logs', 'transcript.jsonl');
        if (fs.existsSync(transcriptFile)) {
          const tStat = fs.statSync(transcriptFile);
          const inputs = getTranscriptInputsCached(transcriptFile);
          candidates.push({
            path: transcriptFile,
            inputs: inputs,
            mtime: tStat.mtimeMs,
            id: name
          });
        }
      }
    } catch (e) {
      // Ignore
    }
  }

  if (cleanDomInputs.length === 0) {
    const emptyTranscripts = candidates.filter(c => c.inputs.length === 0);
    if (emptyTranscripts.length > 0) {
      emptyTranscripts.sort((a, b) => b.mtime - a.mtime);
      return emptyTranscripts[0];
    }
    candidates.sort((a, b) => b.mtime - a.mtime);
    return candidates[0];
  }

  const normalizedDom = cleanDomInputs.map(normalizeText);
  const matchedCandidates = [];

  for (const cand of candidates) {
    const normalizedCand = cand.inputs.map(normalizeText);
    
    let score = 0;
    let candIdx = normalizedCand.length - 1;
    for (let domIdx = normalizedDom.length - 1; domIdx >= 0; domIdx--) {
      const domVal = normalizedDom[domIdx];
      let foundIdx = -1;
      for (let i = candIdx; i >= 0; i--) {
        if (normalizedCand[i] === domVal) {
          foundIdx = i;
          break;
        }
      }
      if (foundIdx !== -1) {
        score++;
        candIdx = foundIdx - 1;
      }
    }

    if (score > 0) {
      matchedCandidates.push({
        candidate: cand,
        score: score
      });
    }
  }

  if (matchedCandidates.length > 0) {
    matchedCandidates.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return b.candidate.mtime - a.candidate.mtime;
    });
    return matchedCandidates[0].candidate;
  }

  return null;
}

function startWatchingTranscript() {
  const checkFile = async () => {
    // Cooldown after manual switches to allow DOM to stabilize
    if (Date.now() - lastManualSwitchTime < 3000) {
      setTimeout(checkFile, 1500);
      return;
    }

    try {
      const page = await ensureChatPage();
      if (page) {
        // Check if the history panel (.jetski-fast-pick) is open in the IDE DOM
        const isHistoryOpenInIDE = await page.evaluate(() => {
          return !!document.querySelector('.jetski-fast-pick');
        });

        if (isHistoryOpenInIDE) {
          const conversations = await listConversations(page);
          const stateStr = JSON.stringify(conversations);
          if (!wasHistoryOpen || stateStr !== lastHistoryState) {
            console.log('[Watcher] IDE history panel opened/updated! Syncing to App.');
            wasHistoryOpen = true;
            lastHistoryState = stateStr;
            broadcast({ type: 'conversation_list', conversations });
          }
        } else if (!isHistoryOpenInIDE && wasHistoryOpen) {
          console.log('[Watcher] IDE history panel closed! Syncing to App.');
          wasHistoryOpen = false;
          lastHistoryState = '';
          broadcast({ type: 'hide_history_panel' });
        }

        // Check if the quick-pick menu (.quick-input-widget) is open/visible in the IDE
        const quickPickState = await page.evaluate(() => {
          const widget = document.querySelector('.quick-input-widget');
          if (!widget || widget.style.display === 'none') return null;
          const rows = Array.from(widget.querySelectorAll('.monaco-list-row'));
          const options = rows.map(r => {
            const labelEl = r.querySelector('.label-name');
            const descEl = r.querySelector('.label-description');
            const label = labelEl ? (labelEl.innerText || labelEl.textContent || '').trim() : '';
            const description = descEl ? (descEl.innerText || descEl.textContent || '').trim() : '';
            return { label, description };
          }).filter(o => o.label);
          return options;
        });

        if (quickPickState && quickPickState.length > 0) {
          const stateStr = JSON.stringify(quickPickState);
          if (stateStr !== lastQuickPickOptions) {
            console.log('[Watcher] IDE quick-pick opened/changed! Syncing to App.');
            lastQuickPickOptions = stateStr;
            const switchId = pendingSwitch ? pendingSwitch.conv.id : 'ide_initiated';
            broadcast({ type: 'switch_options', id: switchId, options: quickPickState });
          }
        } else {
          if (lastQuickPickOptions || pendingSwitch) {
            console.log('[Watcher] IDE quick-pick closed! Syncing to App.');
            lastQuickPickOptions = null;
            pendingSwitch = null;
            broadcast({ type: 'hide_switch_options' });
          }
        }

        // Check active model in IDE DOM
        const activeModel = await page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => {
            const label = (b.getAttribute('aria-label') || '').toLowerCase();
            return label.includes('select model');
          });
          return btn ? (btn.innerText || btn.textContent || '').trim() : null;
        });

        if (activeModel && activeModel !== lastActiveModel) {
          lastActiveModel = activeModel;
          console.log(`[Watcher] IDE active model changed to: ${activeModel}`);
          broadcast({ type: 'model_changed', model: activeModel });
        }

        // Check if the model selector dropdown menu is open in IDE DOM
        const modelMenuState = await page.evaluate(() => {
          const popovers = Array.from(document.querySelectorAll('button[class*="group/popover-item"]'));
          if (popovers.length === 0) return null;
          return popovers.map(el => {
            const text = (el.innerText || el.textContent || '').trim();
            return text.split('\n')[0].trim();
          }).filter(Boolean);
        });

        if (modelMenuState && modelMenuState.length > 0) {
          if (!wasModelMenuOpen) {
            console.log('[Watcher] IDE model menu opened! Syncing to App.');
            wasModelMenuOpen = true;
            broadcast({ type: 'show_model_dropdown', models: modelMenuState });
          }
        } else if (!modelMenuState && wasModelMenuOpen) {
          console.log('[Watcher] IDE model menu closed! Syncing to App.');
          wasModelMenuOpen = false;
          broadcast({ type: 'hide_model_dropdown' });
        }

        const domUserInputs = await page.evaluate(() => {
          const elements = Array.from(document.querySelectorAll('div[class*="group/user-input-step"]'));
          return elements.map(el => (el.innerText || el.textContent || ''));
        });

        const cleanDomInputs = domUserInputs.map(text => {
          return text.replace(/\s+\d{1,2}:\d{2}\s+(?:AM|PM)\s*$/i, '').trim();
        }).filter(Boolean);

        const matched = findMatchingTranscript(cleanDomInputs);
        if (matched && matched.path !== activeFilePath) {
          console.log(`[Watcher] Switch detected! Auto-switching to: ${matched.path}`);
          let title = null;
          const conv = cachedConversations.find(c => c.path === matched.path);
          if (conv) {
            title = conv.title;
          } else {
            const diskConversations = getConversationsFromDisk();
            const diskConv = diskConversations.find(c => c.path === matched.path);
            if (diskConv) {
              title = diskConv.title;
            }
          }
          switchActiveFile(matched.path, title);
        }
      } else {
        if (lastQuickPickOptions || pendingSwitch) {
          console.log('[Watcher] IDE page unavailable. Clearing quick-pick state.');
          lastQuickPickOptions = null;
          pendingSwitch = null;
          broadcast({ type: 'hide_switch_options' });
        }
      }
    } catch (e) {
      console.log(`[Watcher] Error in checkFile: ${e.message}`);
      if (lastQuickPickOptions || pendingSwitch) {
        console.log('[Watcher] Error in checkFile. Clearing quick-pick state.');
        lastQuickPickOptions = null;
        pendingSwitch = null;
        broadcast({ type: 'hide_switch_options' });
      }
    }

    setTimeout(checkFile, 1500);
  };
  checkFile();
}

// Poll the IDE chat input div every 300ms and broadcast changes to all clients
async function startWatchingIDEInput() {
  if (isPollingInput) return;
  isPollingInput = true;

  const poll = async () => {
    try {
      const page = await ensureChatPage();
      if (!page) {
        setTimeout(poll, 1000);
        return;
      }
      const currentText = await page.evaluate(() => {
        const allEditables = Array.from(document.querySelectorAll('div[contenteditable="true"]'));
        const chatInputs = allEditables.filter(el => el.className.includes('max-h-[300px]'));
        if (chatInputs.length === 0) return null;
        const target = chatInputs[chatInputs.length - 1];
        return (target.innerText || target.textContent || '').replace(/\n+$/, '');
      });

      if (currentText !== null && currentText !== lastKnownIDEInput) {
        lastKnownIDEInput = currentText;
        // Only broadcast changes from the IDE if the mobile app hasn't sent typing updates in the last 2 seconds
        if (Date.now() - lastMobileInputTime > 2000) {
          broadcast({ type: 'ide_input', text: currentText });
        }
      }
    } catch (e) {
      // Silently ignore - page may be temporarily unavailable
    }
    setTimeout(poll, 300);
  };

  poll();
}

// List all past conversations (one per brain folder with a non-empty
// transcript), newest first.
//
// Antigravity generates a short AI title for each conversation, but only
// stores it inside the "## Conversation <id>: <title>" lines of OTHER,
// later conversations' CONVERSATION_HISTORY blocks - never in the
// conversation's own transcript. So we do one pass over every transcript to
// harvest those references into a global id->title map. The most recent
// conversation won't have one yet (nothing newer references it), so it
// falls back to the raw <USER_REQUEST> text of its first user message.
// Scan disk transcripts to resolve titles and fallbacks (Pass 1 & Pass 2 global map)
function getConversationsFromDisk() {
  const brainDir = path.resolve(os.homedir(), '.gemini/antigravity-ide/brain');
  if (!fs.existsSync(brainDir)) return [];

  const titleMap = {};
  const entries = [];
  const titleRefRegex = /## Conversation ([0-9a-fA-F-]{36}): (.+)/;

  for (const name of fs.readdirSync(brainDir)) {
    try {
      const fullPath = path.join(brainDir, name);
      if (!fs.statSync(fullPath).isDirectory()) continue;
      const transcriptFile = path.join(fullPath, '.system_generated', 'logs', 'transcript.jsonl');
      if (!fs.existsSync(transcriptFile)) continue;
      const tStat = fs.statSync(transcriptFile);
      if (tStat.size === 0) continue;

      const data = fs.readFileSync(transcriptFile, 'utf8');
      const lines = data.split('\n').filter(l => l.trim());
      let firstUserRequest = '';

      for (const line of lines) {
        try {
          const msg = JSON.parse(line);
          if (msg.content) {
            const match = titleRefRegex.exec(msg.content);
            if (match) {
              const referencedId = match[1];
              const cleanTitle = match[2].split(/\r?\n|\\n/)[0].replace(/\\"/g, '"').replace(/^"|"$/g, '').trim();
              if (cleanTitle && !titleMap[referencedId]) {
                titleMap[referencedId] = cleanTitle;
              }
            }

            if (!firstUserRequest && msg.source === 'USER_EXPLICIT' && msg.type === 'USER_INPUT') {
              const reqMatch = msg.content.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/i);
              const text = (reqMatch ? reqMatch[1] : msg.content).trim();
              if (text) {
                firstUserRequest = text.split(/\r?\n|\\n/)[0].trim().substring(0, 150);
              }
            }
          }
        } catch {}
      }

      entries.push({ id: name, path: transcriptFile, firstUserRequest, mtime: tStat.mtimeMs, rawContent: data });
    } catch {}
  }

  const diskItems = entries.map(({ id, path, firstUserRequest, mtime, rawContent }) => {
    return {
      id,
      path,
      title: titleMap[id] || firstUserRequest || 'New conversation',
      mtime,
      rawContent,
      active: path === activeFilePath
    };
  });

  diskItems.sort((a, b) => b.mtime - a.mtime);
  return diskItems;
}

// Scrape the active/visible conversations from the IDE DOM overlay, then map them to disk folders.
async function listConversations(page) {
  try {
    const domItems = await page.evaluate(() => {
      const options = Array.from(document.querySelectorAll('.jetski-fast-pick [role="option"]'));
      return options.filter(o => !/show \d+ more/i.test(o.innerText || '')).map(o => {
        const text = o.innerText || '';
        const parts = text.split('\n').map(p => p.trim()).filter(Boolean);
        const title = parts[0] || '';
        const classes = (o.className || '').split(/\s+/);
        const active = classes.includes('bg-secondary');
        const timePart = parts.find(p => p.includes('ago') || p === 'now') || parts[parts.length - 1] || '';
        const id = o.getAttribute('id') ? o.getAttribute('id').replace('fastpick-item-', '') : '';
        return { id, title, active, timeText: timePart };
      });
    });

    console.log(`[Bridge] Scraped ${domItems.length} options from IDE Past Conversations panel.`);

    const brainDir = path.resolve(os.homedir(), '.gemini/antigravity-ide/brain');
    const conversations = domItems.map(dom => {
      const transcriptFile = path.join(brainDir, dom.id, '.system_generated', 'logs', 'transcript.jsonl');
      
      let mtime = Date.now();
      try {
        if (fs.existsSync(transcriptFile)) {
          mtime = fs.statSync(transcriptFile).mtimeMs;
        }
      } catch (e) {}

      return {
        id: dom.id,
        path: transcriptFile,
        title: dom.title,
        active: dom.active,
        mtime: mtime
      };
    });

    const activeDom = conversations.find(c => c.active);
    if (activeDom && activeDom.path !== activeFilePath) {
      console.log(`[Bridge] Syncing active file to IDE's active conversation: ${activeDom.path}`);
      lastManualSwitchTime = Date.now();
      switchActiveFile(activeDom.path);
    }

    cachedConversations = conversations;
    return conversations;
  } catch (error) {
    console.error('[-] Error scraping conversations:', error.message);
    return [];
  }
}

function broadcast(payloadObj) {
  const payload = JSON.stringify(payloadObj);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

async function ensureChatPage() {
  try {
    if (!chatPage || chatPage.isClosed()) {
      if (browser) {
        chatPage = await findChatPage(browser);
      } else {
        await connectToIDE();
      }
    }
  } catch (e) {
    console.error('[-] ensureChatPage error:', e.message);
    chatPage = null;
  }
  return chatPage;
}

// Sync the chat input box to `newText` using minimal native keyboard ops.
// Reads the box's actual current text and only types/backspaces the
// difference, so fast typing is almost always a single type() call with
// no modifier keys - avoiding the stuck-Ctrl/garbled-shortcuts issue.
async function applyInputDiff(page, newText) {
  try {
    return await page.evaluate((text) => {
      const allEditables = Array.from(document.querySelectorAll('div[contenteditable="true"]'));
      const chatInputs = allEditables.filter(el => el.className.includes('max-h-[300px]'));
      if (chatInputs.length === 0) return false;

      const target = chatInputs[chatInputs.length - 1];
      target.focus();

      // Instantly set text content (Trusted Types safe)
      target.textContent = text;

      // Dispatch React inputs/change events so the state updates in the IDE
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));

      // Reposition caret at the end of the text
      try {
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(target);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      } catch (e) {}

      return true;
    }, newText);
  } catch (e) {
    console.error('[-] Error applying input diff:', e.message);
    return false;
  }
}

// Open the IDE's "Past Conversations" picker and expand it fully by
// clicking every "Show N more..." row, so the user sees the same panel
// in the IDE that the app is about to display.
async function openPastConversationsPanel(page) {
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 150));

  const histCoord = await page.evaluate(() => {
    const btn = document.querySelector('a[data-tooltip-id="history-tooltip"]');
    if (!btn) return null;
    const rect = btn.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  });
  if (!histCoord) {
    console.log('[-] History button not found in IDE DOM');
    return false;
  }
  await page.mouse.click(histCoord.x, histCoord.y);
  await new Promise(r => setTimeout(r, 400));

  const opened = await page.evaluate(() => !!document.querySelector('.jetski-fast-pick'));
  if (!opened) {
    console.log('[-] Past conversations panel (.jetski-fast-pick) failed to open');
    return false;
  }

  console.log('[~] Expanding history panel ("Show N more..." buttons)...');
  let clicks = 0;
  for (let i = 0; i < 20; i++) {
    const showMoreCoord = await page.evaluate(() => {
      const options = Array.from(document.querySelectorAll('.jetski-fast-pick [role="option"]'));
      const target = options.find(o => /show \d+ more/i.test(o.innerText || ''));
      if (!target) return null;
      const rect = target.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, text: target.innerText.trim() };
    });
    if (!showMoreCoord) break;
    console.log(`[+] Clicking "${showMoreCoord.text}" at x=${showMoreCoord.x.toFixed(1)}, y=${showMoreCoord.y.toFixed(1)}`);
    await page.mouse.click(showMoreCoord.x, showMoreCoord.y);
    clicks++;
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`[+] Expanded panel successfully. Clicked "Show more" ${clicks} times.`);
  return true;
}

// Drive the IDE's own "Past Conversations" picker to make `targetId` the
// active conversation in the current window - mirrors the manual flow:
// click the history clock icon -> search/select the conversation -> choose
// "Open in current window" from the resulting quick-pick.
// Step 1: Open history panel, expand all, click conversation row
async function openAndClickConversationInHistory(page, targetId) {
  // Close any stray pickers left open from a previous attempt.
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 150));

  const histCoord = await page.evaluate(() => {
    const btn = document.querySelector('a[data-tooltip-id="history-tooltip"]');
    if (!btn) return null;
    const rect = btn.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  });
  if (!histCoord) return false;
  await page.mouse.click(histCoord.x, histCoord.y);
  await new Promise(r => setTimeout(r, 400));

  const opened = await page.evaluate(() => !!document.querySelector('.jetski-fast-pick'));
  if (!opened) return false;

  // Repeatedly click "Show N more..." until every conversation is listed.
  for (let i = 0; i < 20; i++) {
    const showMoreCoord = await page.evaluate(() => {
      const options = Array.from(document.querySelectorAll('.jetski-fast-pick [role="option"]'));
      const target = options.find(o => /show \d+ more/i.test(o.innerText || ''));
      if (!target) return null;
      const rect = target.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    });
    if (!showMoreCoord) break;
    await page.mouse.click(showMoreCoord.x, showMoreCoord.y);
    await new Promise(r => setTimeout(r, 250));
  }

  const rowCoord = await page.evaluate((tid) => {
    const el = document.getElementById(`fastpick-item-${tid}`);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, targetId);
  if (!rowCoord) {
    await page.keyboard.press('Escape');
    return false;
  }
  await page.mouse.click(rowCoord.x, rowCoord.y);
  await new Promise(r => setTimeout(r, 400)); // Wait for quick-pick
  return true;
}

// Step 2: Read quick-pick options if any are open
async function getQuickPickOptions(page) {
  return await page.evaluate(() => {
    const widget = document.querySelector('.quick-input-widget');
    if (!widget || widget.style.display === 'none') return null;
    const rows = Array.from(widget.querySelectorAll('.monaco-list-row'));
    return rows.map(r => {
      const labelEl = r.querySelector('.label-name');
      const descEl = r.querySelector('.label-description');
      const label = labelEl ? (labelEl.innerText || labelEl.textContent || '').trim() : '';
      const description = descEl ? (descEl.innerText || descEl.textContent || '').trim() : '';
      return { label, description };
    }).filter(o => o.label);
  });
}

// Step 3: Select one of the quick-pick options
async function selectQuickPickOption(page, optionText, optionIndex) {
  const openCoord = await page.evaluate((optText, optIdx) => {
    const rows = Array.from(document.querySelectorAll('.quick-input-widget .monaco-list-row'));
    let target = null;
    if (typeof optIdx === 'number' && optIdx >= 0 && optIdx < rows.length) {
      target = rows[optIdx];
    } else {
      target = rows.find(r => {
        const text = (r.innerText || r.textContent || '').trim();
        return text === optText || text.includes(optText);
      });
    }
    if (!target) return null;
    const rect = target.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, optionText, optionIndex);

  if (openCoord) {
    await page.mouse.click(openCoord.x, openCoord.y);
    await new Promise(r => setTimeout(r, 500));
    return true;
  }
  return false;
}

// WebSocket events from Mobile
wss.on('connection', (ws) => {
  console.log('[+] Mobile client connected');

  // Send existing history immediately
  if (activeFilePath) {
    sendTranscriptHistory(activeFilePath, ws);
  }

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'input') {
        // Fast-path for inputs: bypass sequential queue entirely to execute in parallel
        handleMessage(ws, message).catch((error) => {
          console.error('[-] Error handling instant socket input:', error.message);
        });
      } else {
        // Clicks, model changes, and switches remain serialized to prevent stick modifiers
        opQueue = opQueue.then(() => handleMessage(ws, message)).catch((error) => {
          console.error('[-] Error handling WebSocket message:', error.message);
          try {
            ws.send(JSON.stringify({ type: 'error', message: error.message }));
          } catch {}
        });
      }
    } catch (e) {
      console.error('[-] WebSocket message parsing error:', e.message);
    }
  });

  ws.on('close', () => {
    console.log('[-] Mobile client disconnected');
  });
});

async function handleMessage(ws, message) {
  const data = JSON.parse(message);
  console.log(`[Mobile -> PC]: Action = ${data.type}`, data.text ? `| text="${data.text}"` : '');

  const page = await ensureChatPage();
  if (!page) {
    console.error('[-] Cannot inject action: Chat page not found.');
    ws.send(JSON.stringify({ type: 'error', message: 'Chat page not found. Is the IDE open?' }));
    return;
  }

  if (data.type === 'input') {
    lastMobileInputTime = Date.now();
    const ok = await applyInputDiff(page, data.text);
    if (ok) {
      ws.send(JSON.stringify({ type: 'ack', action: 'input', text: data.text }));
    } else {
      ws.send(JSON.stringify({ type: 'error', message: 'Failed to focus chat input' }));
    }

  } else if (data.type === 'send') {
        console.log('[Bridge] Natively clicking send button');
        
        // Find coordinates of the send button
        const btnCoord = await page.evaluate(() => {
          const allEditables = Array.from(document.querySelectorAll('div[contenteditable="true"]'));
          const chatInput = allEditables.filter(el => el.className.includes('max-h-[300px]')).pop();
          if (!chatInput) return null;
          
          let container = chatInput.parentElement;
          for (let i = 0; i < 5; i++) {
            if (!container) break;
            const buttons = Array.from(container.querySelectorAll('button'));
            for (const btn of buttons) {
              const label = (btn.getAttribute('aria-label') || '').toLowerCase();
              const title = (btn.getAttribute('title') || '').toLowerCase();
              if (label.includes('send message') || title.includes('send message')) {
                const rect = btn.getBoundingClientRect();
                return {
                  x: rect.left + rect.width / 2,
                  y: rect.top + rect.height / 2
                };
              }
            }
            container = container.parentElement;
          }
          return null;
        });
        
        let result = {};
        if (btnCoord) {
          await page.mouse.click(btnCoord.x, btnCoord.y);
          result = { method: 'native_mouse_click', success: true };
        } else {
          await page.keyboard.press('Enter');
          result = { method: 'enter_key_fallback', success: true };
        }
        
        console.log('[Bridge] Send result:', result);
        ws.send(JSON.stringify({ type: 'ack', action: 'send', result }));

      } else if (data.type === 'test_input') {
        // Quick test: just check if we can find the chat input
        const result = await page.evaluate(() => {
          const allEditables = Array.from(document.querySelectorAll('div[contenteditable="true"]'));
          const chatInputs = allEditables.filter(el => el.className.includes('max-h-[300px]'));
          return {
            totalEditables: allEditables.length,
            chatInputs: chatInputs.length,
            lastInputClass: chatInputs.length > 0 ? chatInputs[chatInputs.length - 1].className : 'NOT FOUND'
          };
        });
        console.log('[Bridge] Test result:', result);
        ws.send(JSON.stringify({ type: 'test_result', result }));

      } else if (data.type === 'new_chat') {
        console.log('[Bridge] Triggering new chat action');
        // The "New Chat" control is an icon-only link with no aria-label/title,
        // identified by its tooltip id. Click it natively so React's handler fires.
        const coord = await page.evaluate(() => {
          const btn = document.querySelector('a[data-tooltip-id="new-conversation-tooltip"]');
          if (!btn) return null;
          const rect = btn.getBoundingClientRect();
          return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        });

        let success = false;
        if (coord) {
          await page.mouse.click(coord.x, coord.y);
          success = true;
        }
        console.log('[Bridge] New chat result:', success);

        if (success) {
          // Wipe the feed immediately - the new conversation's transcript
          // file may not exist on disk yet, so don't wait for the poll.
          broadcast({ type: 'clear' });

          // Briefly poll for the new transcript file to appear and switch
          // the live watcher to it as soon as it shows up.
          let attempts = 0;
          const tryFindNew = () => {
            attempts++;
            const filePath = getLatestTranscriptPath();
            if (filePath && filePath !== activeFilePath) {
              lastManualSwitchTime = Date.now();
              switchActiveFile(filePath);
            } else if (attempts < 10) {
              setTimeout(tryFindNew, 500);
            }
          };
          setTimeout(tryFindNew, 500);
        }

        ws.send(JSON.stringify({ type: 'ack', action: 'new_chat', success }));

      } else if (data.type === 'list_conversations') {
        console.log('[Bridge] Opening Past Conversations panel in IDE');
        await openPastConversationsPanel(page);
        const conversations = await listConversations(page);
        ws.send(JSON.stringify({ type: 'conversation_list', conversations }));

      } else if (data.type === 'select_conversation') {
        let conv = cachedConversations.find(c => c.id === data.id);
        if (!conv) {
          const diskConversations = getConversationsFromDisk();
          conv = diskConversations.find(c => c.id === data.id);
        }

        if (!conv) {
          ws.send(JSON.stringify({ type: 'error', message: 'Conversation not found' }));
        } else if (conv.path === activeFilePath) {
          // Already the live conversation - just resend its history.
          sendTranscriptHistory(conv.path, ws);
        } else {
          console.log(`[Bridge] Switching IDE to conversation ID: ${conv.id} ("${conv.title}")`);
          const clicked = await openAndClickConversationInHistory(page, conv.id);
          if (clicked) {
            // Check if quick-pick options are shown
            const options = await getQuickPickOptions(page);
            if (options && options.length > 0) {
              console.log(`[Bridge] Quick-pick opened with options:`, options);
              pendingSwitch = { ws, conv };
              lastQuickPickOptions = JSON.stringify(options);
              ws.send(JSON.stringify({ type: 'switch_options', id: conv.id, options }));
            } else {
              // No quick-pick shown, means it switched immediately (e.g. same workspace)
              console.log(`[Bridge] Switched immediately (no quick-pick)`);
              lastManualSwitchTime = Date.now();
              switchActiveFile(conv.path);
            }
          } else {
            ws.send(JSON.stringify({ type: 'error', message: 'Could not click the conversation in history panel' }));
          }
        }

      } else if (data.type === 'confirm_switch') {
        if (data.id === 'ide_initiated') {
          console.log(`[Bridge] Selecting IDE-initiated quick-pick option: index = ${data.optionIndex}, text = "${data.optionText}"`);
          const selected = await selectQuickPickOption(page, data.optionText, data.optionIndex);
          if (selected) {
            lastManualSwitchTime = Date.now();
            ws.send(JSON.stringify({ type: 'ack', action: 'confirm_switch', success: true }));
          } else {
            ws.send(JSON.stringify({ type: 'error', message: `Could not select option: ${data.optionText}` }));
          }
        } else if (!pendingSwitch || pendingSwitch.conv.id !== data.id) {
          ws.send(JSON.stringify({ type: 'error', message: 'No pending switch for that conversation' }));
        } else {
          console.log(`[Bridge] Selecting quick-pick option: index = ${data.optionIndex}, text = "${data.optionText}"`);
          const selected = await selectQuickPickOption(page, data.optionText, data.optionIndex);
          if (selected) {
            lastManualSwitchTime = Date.now();
            switchActiveFile(pendingSwitch.conv.path);
          } else {
            ws.send(JSON.stringify({ type: 'error', message: `Could not select option: ${data.optionText}` }));
          }
          pendingSwitch = null;
        }

      } else if (data.type === 'cancel_switch') {
        console.log(`[Bridge] Cancelling switch, closing quick-pick`);
        await page.keyboard.press('Escape');
        pendingSwitch = null;
        ws.send(JSON.stringify({ type: 'ack', action: 'cancel_switch' }));

      } else if (data.type === 'open_model_dropdown') {
          console.log('[Bridge] Opening model dropdown in IDE');
          const opened = await page.evaluate(() => {
            const isOpen = !!document.querySelector('button[class*="group/popover-item"]');
            if (!isOpen) {
              const btn = Array.from(document.querySelectorAll('button')).find(b => {
                const label = (b.getAttribute('aria-label') || '').toLowerCase();
                return label.includes('select model');
              });
              if (btn) {
                btn.click();
                return true;
              }
            }
            return false;
          });
          ws.send(JSON.stringify({ type: 'ack', action: 'open_model_dropdown', success: opened }));

        } else if (data.type === 'close_model_dropdown') {
          console.log('[Bridge] Closing model dropdown in IDE');
          const closed = await page.evaluate(() => {
            return !!document.querySelector('button[class*="group/popover-item"]');
          });
          if (closed) {
            await page.keyboard.press('Escape');
          }
          ws.send(JSON.stringify({ type: 'ack', action: 'close_model_dropdown', success: closed }));

        } else if (data.type === 'change_model') {
          console.log(`[Bridge] Triggering change model action to: ${data.model}`);
          const success = await page.evaluate(async (model) => {
            let options = Array.from(document.querySelectorAll('button[class*="group/popover-item"]'));
            
            if (options.length === 0) {
              const allButtons = Array.from(document.querySelectorAll('button'));
              const modelBtn = allButtons.find(b => {
                const label = (b.getAttribute('aria-label') || '').toLowerCase();
                return label.includes('select model') || label.includes('model selector');
              });
              if (!modelBtn) return false;
              
              modelBtn.click();
              await new Promise(resolve => setTimeout(resolve, 300));
              options = Array.from(document.querySelectorAll('button[class*="group/popover-item"]'));
            }
            
            const targetOpt = options.find(o => {
              const text = (o.innerText || '').toLowerCase();
              const target = model.toLowerCase();
              return text === target || text.includes(target);
            });
            
            if (targetOpt) {
              targetOpt.click();
              return true;
            }
            return false;
          }, data.model);
          console.log('[Bridge] Change model result:', success);
          ws.send(JSON.stringify({ type: 'ack', action: 'change_model', success }));
  }
}

server.listen(PORT, '0.0.0.0', async () => {
  console.log(`[+] Bridge Server running on port ${PORT}`);
  await connectToIDE();
  startWatchingTranscript();
  startWatchingIDEInput();
});
