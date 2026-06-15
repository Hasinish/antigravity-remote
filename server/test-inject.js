/**
 * test-inject.js
 * Quick test: connects to IDE and tries to natively type text and click send.
 * Run: node test-inject.js
 */
const puppeteer = require('puppeteer-core');

async function test() {
  console.log('Connecting to IDE...');
  const browser = await puppeteer.connect({
    browserURL: 'http://localhost:9222',
    defaultViewport: null
  });

  const pages = await browser.pages();
  const workbench = pages.find(p => p.url().includes('workbench.html'));
  if (!workbench) {
    console.error('ERROR: workbench.html not found!');
    await browser.disconnect();
    return;
  }

  console.log('Found workbench! Running native selection + typing test...');

  // Step 1: Focus using evaluate
  await workbench.evaluate(() => {
    const allEditables = Array.from(document.querySelectorAll('div[contenteditable="true"]'));
    const chatInputs = allEditables.filter(el => el.className.includes('max-h-[300px]'));
    if (chatInputs.length > 0) {
      chatInputs[chatInputs.length - 1].focus();
    }
  });

  // Step 2: Select all natively (Ctrl+A)
  await workbench.keyboard.down('Control');
  await workbench.keyboard.press('a');
  await workbench.keyboard.up('Control');

  // Step 3: Backspace to clear
  await workbench.keyboard.press('Backspace');
  await new Promise(resolve => setTimeout(resolve, 50));

  // Step 4: Type text natively
  const testText = 'Hello from bridge test! Please reply with "I hear you clear and loud!"';
  await workbench.keyboard.type(testText);
  console.log('[+] Natively typed text.');
  await new Promise(resolve => setTimeout(resolve, 200));

  // Step 5: Click the send button natively
  const btnCoord = await workbench.evaluate(() => {
    const allEditables = Array.from(document.querySelectorAll('div[contenteditable="true"]'));
    const chatInput = allEditables.filter(el => el.className.includes('max-h-[300px]')).pop();
    if (!chatInput) return null;
    
    // Walk up to find the send message button
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
            y: rect.top + rect.height / 2,
            label: btn.getAttribute('aria-label')
          };
        }
      }
      container = container.parentElement;
    }
    return null;
  });

  if (btnCoord) {
    console.log(`[+] Found send button coordinates: x=${btnCoord.x}, y=${btnCoord.y}, label="${btnCoord.label}"`);
    // Click at the exact coordinates
    await workbench.mouse.click(btnCoord.x, btnCoord.y);
    console.log('[+] Natively clicked the send button!');
  } else {
    console.log('[-] Could not find send button coordinates. Falling back to Enter key.');
    await workbench.keyboard.press('Enter');
  }

  await browser.disconnect();
}

test().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
