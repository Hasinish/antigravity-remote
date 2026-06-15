const puppeteer = require('puppeteer-core');

async function main() {
  console.log('[inspect] Connecting to browser...');
  const browser = await puppeteer.connect({
    browserURL: 'http://localhost:9222',
    defaultViewport: null
  });

  const pages = await browser.pages();
  console.log(`[inspect] Found ${pages.length} pages:`);
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const url = page.url();
    console.log(`Page ${i}: URL = ${url}`);
    
    if (url.includes('workbench.html')) {
      try {
        const info = await page.evaluate(() => {
          const fastPick = document.querySelector('.jetski-fast-pick');
          const quickInput = document.querySelector('.quick-input-widget');
          const chatInput = Array.from(document.querySelectorAll('div[contenteditable="true"]'))
            .filter(el => el.className.includes('max-h-[300px]')).length;
          
          return {
            hasFastPick: !!fastPick,
            fastPickStyleDisplay: fastPick ? fastPick.style.display : null,
            hasQuickInput: !!quickInput,
            quickInputStyleDisplay: quickInput ? quickInput.style.display : null,
            chatInputCount: chatInput,
            bodyHtmlSnippet: document.body.innerHTML.substring(0, 500)
          };
        });
        console.log(`  -> workbench info:`, JSON.stringify(info, null, 2));
      } catch (e) {
        console.log(`  -> Error evaluating workbench page: ${e.message}`);
      }
    }
  }

  await browser.disconnect();
}

main().catch(console.error);
