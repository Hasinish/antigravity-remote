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
    const targets = browserInstance.targets();
    for (const target of targets) {
      const type = target.type();
      const url = target.url();
      
      if (type === 'page' || type === 'webview') {
        const page = await target.page().catch(() => null);
        if (!page) continue;
        
        const title = await page.title().catch(() => '');
        console.log(`[i] Scanning target: "${title}" (${url}) [type=${type}]`);
        
        // Check if this page has a non-editor textarea
        const hasTextarea = await page.$('textarea').catch(() => null);
        if (hasTextarea) {
          const isEditor = await page.evaluate(() => {
            const el = document.querySelector('textarea');
            return el && (el.classList.contains('inputarea') || el.className.includes('monaco'));
          }).catch(() => true);
          
          if (!isEditor) {
            console.log(`[+] Identified chat page directly from target: "${title}"`);
            return page;
          }
        }
        
        const frames = page.frames();
        for (const frame of frames) {
          const hasTextareaInFrame = await frame.$('textarea').catch(() => null);
          if (hasTextareaInFrame) {
            const isEditor = await frame.evaluate(() => {
              const el = document.querySelector('textarea');
              return el && (el.classList.contains('inputarea') || el.className.includes('monaco'));
            }).catch(() => true);
            
            if (!isEditor) {
              console.log(`[+] Identified chat page inside target frame: ${frame.url()}`);
              return frame; // Return the FRAME itself!
            }
          }
        }
      }
    }
  } catch (error) {
    console.error(`[-] Error scanning targets:`, error.message);
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
    
    // Find active chat page
    chatPage = await findChatPage(browser);
    if (!chatPage) {
      console.log(`[!] Chat page not found. Will scan again when a message is received.`);
    }
  } catch (error) {
    console.error(`[-] Connection failed. Is the IDE running with --remote-debugging-port=${DEBUG_PORT}?`);
  }
}

// Send all lines of the transcript as history
function sendTranscriptHistory(filePath, client) {
  try {
    if (!fs.existsSync(filePath)) return;
    const data = fs.readFileSync(filePath, 'utf8');
    const lines = data.split('\n').filter(l => l.trim());
    const messages = lines.map(line => JSON.parse(line));
    
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
      console.log(`[Mobile -> PC]: Action = ${data.type}`);
      
      const isPageClosed = chatPage && typeof chatPage.isClosed === 'function' ? chatPage.isClosed() : false;
      const isFrameDetached = chatPage && typeof chatPage.isDetached === 'function' ? chatPage.isDetached() : false;
      
      if (!chatPage || isPageClosed || isFrameDetached) {
        if (browser) {
          chatPage = await findChatPage(browser);
        } else {
          await connectToIDE();
        }
      }
      
      if (!chatPage) {
        console.error('[-] Cannot inject action: Chat page not active.');
        return;
      }
      
      if (data.type === 'input') {
        // Inject text into chat window
        await chatPage.evaluate((val) => {
          const textarea = document.querySelector('textarea') || document.querySelector('[contenteditable="true"]');
          if (textarea) {
            if (textarea.tagName === 'TEXTAREA' || textarea.tagName === 'INPUT') {
              textarea.value = val;
            } else {
              textarea.innerText = val;
            }
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            textarea.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }, data.text);
      } else if (data.type === 'send') {
        // Click send button or hit Enter
        await chatPage.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const sendBtn = buttons.find(b => 
            b.innerText.toLowerCase().includes('send') || 
            b.innerHTML.includes('send') ||
            b.className.toLowerCase().includes('send') ||
            b.getAttribute('aria-label')?.toLowerCase().includes('send') ||
            b.querySelector('svg')
          );
          if (sendBtn) {
            sendBtn.click();
          } else {
            const textarea = document.querySelector('textarea') || document.querySelector('[contenteditable="true"]');
            if (textarea) {
              textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
            }
          }
        });
      } else if (data.type === 'new_chat') {
        await chatPage.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button, a'));
          const newChatBtn = buttons.find(b => 
            b.innerText.toLowerCase().includes('new chat') || 
            b.className.toLowerCase().includes('new-chat') ||
            b.getAttribute('aria-label')?.toLowerCase().includes('new chat')
          );
          if (newChatBtn) newChatBtn.click();
        });
      } else if (data.type === 'change_model') {
        // Look for model dropdown and select the specified model
        await chatPage.evaluate((model) => {
          const select = document.querySelector('select');
          if (select) {
            select.value = model;
            select.dispatchEvent(new Event('change', { bubbles: true }));
          } else {
            // Check custom dropdown elements
            const dropdowns = Array.from(document.querySelectorAll('button, div[role="button"]'));
            const modelDropdown = dropdowns.find(d => d.innerText.toLowerCase().includes('gemini') || d.innerText.toLowerCase().includes('model'));
            if (modelDropdown) {
              modelDropdown.click();
              // Try to find the item in dropdown options and click it
              setTimeout(() => {
                const options = Array.from(document.querySelectorAll('div, li, a'));
                const targetOption = options.find(o => o.innerText.toLowerCase().includes(model.toLowerCase()));
                if (targetOption) targetOption.click();
              }, 100);
            }
          }
        }, data.model);
      }
    } catch (error) {
      console.error('[-] Error handling WebSocket message:', error.message);
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
