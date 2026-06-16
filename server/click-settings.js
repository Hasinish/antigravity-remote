const puppeteer = require('puppeteer-core');

async function main() {
  console.log('[~] Connecting to browser...');
  const browser = await puppeteer.connect({
    browserURL: 'http://localhost:9222',
    defaultViewport: null
  });

  const pages = await browser.pages();
  let page = null;
  for (const p of pages) {
    if (p.url().includes('workbench.html')) {
      page = p;
      break;
    }
  }

  if (!page) {
    console.error('[-] Workbench page not found!');
    await browser.disconnect();
    return;
  }

  console.log('[~] Searching for "Antigravity - Settings" button...');
  const coord = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('*'));
    
    // Exact match filter
    const targets = elements.filter(el => {
      const text = (el.innerText || el.textContent || '').trim();
      return text === 'Antigravity - Settings';
    });

    if (targets.length === 0) {
      console.log('[-] Exact match failed, trying partial match...');
      const partials = elements.filter(el => {
        const text = (el.innerText || el.textContent || '').trim();
        return text.includes('Antigravity - Settings');
      });
      if (partials.length > 0) {
        partials.sort((a, b) => {
          const rA = a.getBoundingClientRect();
          const rB = b.getBoundingClientRect();
          return (rA.width * rA.height) - (rB.width * rB.height);
        });
        const rect = partials[0].getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, text: partials[0].textContent.trim() };
      }
      return null;
    }

    // Sort by smallest area to get the most specific leaf node
    targets.sort((a, b) => {
      const rA = a.getBoundingClientRect();
      const rB = b.getBoundingClientRect();
      return (rA.width * rA.height) - (rB.width * rB.height);
    });

    const rect = targets[0].getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, text: targets[0].textContent.trim() };
  });

  if (!coord) {
    console.error('[-] Could not find the "Antigravity - Settings" button in the DOM!');
  } else {
    console.log(`[+] Found button: "${coord.text}" at x=${coord.x.toFixed(1)}, y=${coord.y.toFixed(1)}`);
    console.log('[~] Clicking button natively...');
    await page.mouse.click(coord.x, coord.y);
    console.log('[+] Clicked!');
  }

  await browser.disconnect();
}

main().catch(console.error);
