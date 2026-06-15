const puppeteer = require('puppeteer-core');
const WebSocket = require('ws');
const chokidar = require('chokidar');
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');

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

function startWatchingTranscript() {
  const checkFile = () => {
    const filePath = getLatestTranscriptPath();
    if (!filePath) {
      setTimeout(checkFile, 2000);
      return;
    }
    
    if (filePath !== activeFilePath) {
      console.log(`[+] Watching transcript: ${filePath}`);
      activeFilePath = filePath;
      lastSize = fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;
      
      if (fileWatcher) {
        fileWatcher.close();
      }
      
      fileWatcher = chokidar.watch(filePath, { persistent: true });
      fileWatcher.on('change', () => {
        readNewLines(filePath);
      });
      
      // Update history for all connected clients
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          sendTranscriptHistory(filePath, client);
        }
      });
    }
    
    setTimeout(checkFile, 5000); // Poll for conversation switches
  };
  checkFile();
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

// WebSocket events from Mobile
wss.on('connection', (ws) => {
  console.log('[+] Mobile client connected');
  
  // Send existing history immediately
  if (activeFilePath) {
    sendTranscriptHistory(activeFilePath, ws);
  }
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      console.log(`[Mobile -> PC]: Action = ${data.type}`, data.text ? `| text="${data.text}"` : '');
      
      const page = await ensureChatPage();
      if (!page) {
        console.error('[-] Cannot inject action: Chat page not found.');
        ws.send(JSON.stringify({ type: 'error', message: 'Chat page not found. Is the IDE open?' }));
        return;
      }
      
      if (data.type === 'input') {
        console.log(`[Bridge] Natively typing text: "${data.text}"`);
        
        // Focus the chat input box using evaluate
        const focused = await page.evaluate(() => {
          const allEditables = Array.from(document.querySelectorAll('div[contenteditable="true"]'));
          const chatInputs = allEditables.filter(el => el.className.includes('max-h-[300px]'));
          if (chatInputs.length === 0) return false;
          
          const target = chatInputs[chatInputs.length - 1];
          target.focus();
          return true;
        });
        
        if (focused) {
          // Select all text using Ctrl+A
          await page.keyboard.down('Control');
          await page.keyboard.press('a');
          await page.keyboard.up('Control');
          
          // Delete
          await page.keyboard.press('Backspace');
          await new Promise(resolve => setTimeout(resolve, 50));
          
          // Type the new string natively
          if (data.text) {
            await page.keyboard.type(data.text);
          }
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
        const success = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button, a'));
          const newChatBtn = buttons.find(b => {
            const text = (b.innerText || '').toLowerCase();
            const label = (b.getAttribute('aria-label') || '').toLowerCase();
            const title = (b.getAttribute('title') || '').toLowerCase();
            return text.includes('new chat') || text.includes('new conversation') || text.includes('clear chat') || text.includes('clear conversation') ||
                   label.includes('new chat') || label.includes('new conversation') || label.includes('clear chat') || label.includes('clear conversation') ||
                   title.includes('new chat') || title.includes('new conversation') || title.includes('clear chat') || title.includes('clear conversation');
          });
          if (newChatBtn) {
            newChatBtn.click();
            return true;
          }
          return false;
        });
        console.log('[Bridge] New chat result:', success);
        ws.send(JSON.stringify({ type: 'ack', action: 'new_chat', success }));

      } else if (data.type === 'change_model') {
        console.log(`[Bridge] Triggering change model action to: ${data.model}`);
        const success = await page.evaluate(async (model) => {
          const allButtons = Array.from(document.querySelectorAll('button'));
          const modelBtn = allButtons.find(b => {
            const label = (b.getAttribute('aria-label') || '').toLowerCase();
            return label.includes('select model') || label.includes('model selector');
          });
          if (!modelBtn) return false;
          
          modelBtn.click();
          await new Promise(resolve => setTimeout(resolve, 300));
          
          const options = Array.from(document.querySelectorAll('span, div, li, a, button'));
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
    } catch (error) {
      console.error('[-] Error handling WebSocket message:', error.message);
      try {
        ws.send(JSON.stringify({ type: 'error', message: error.message }));
      } catch {}
    }
  });
  
  ws.on('close', () => {
    console.log('[-] Mobile client disconnected');
  });
});

server.listen(PORT, '0.0.0.0', async () => {
  console.log(`[+] Bridge Server running on port ${PORT}`);
  await connectToIDE();
  startWatchingTranscript();
});
