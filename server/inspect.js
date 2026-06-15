const puppeteer = require('puppeteer-core');

async function inspect() {
  try {
    console.log('Connecting to http://localhost:9222...');
    const browser = await puppeteer.connect({
      browserURL: 'http://localhost:9222',
      defaultViewport: null
    });
    
    console.log('CONNECTED! Finding targets...');
    const targets = browser.targets();
    console.log(`Found ${targets.length} targets.`);
    
    for (const target of targets) {
      const type = target.type();
      const url = target.url();
      console.log(`\n--------------------------------------------------`);
      console.log(`Target: type="${type}", url="${url}"`);
      
      if (type === 'page' || type === 'webview') {
        const page = await target.page().catch(() => null);
        if (!page) {
          console.log('  Page context not accessible.');
          continue;
        }
        
        const title = await page.title().catch(() => '');
        console.log(`  Page Title: "${title}"`);
        
        // Check main page
        const textareasOnPage = await page.$$eval('textarea', els => els.map(el => ({ id: el.id, class: el.className, placeholder: el.placeholder }))).catch(() => []);
        console.log(`  Main Page textareas: ${textareasOnPage.length}`);
        textareasOnPage.forEach((t, i) => console.log(`    [${i}] id="${t.id}", class="${t.class}", placeholder="${t.placeholder}"`));
        
        const buttonsOnPage = await page.$$eval('button', els => els.map(el => ({ id: el.id, class: el.className, text: el.innerText }))).catch(() => []);
        console.log(`  Main Page buttons: ${buttonsOnPage.length}`);
        buttonsOnPage.slice(0, 5).forEach((b, i) => console.log(`    [${i}] id="${b.id}", class="${b.class}", text="${b.text.slice(0, 30)}"`));
        
        // Inspect all frames
        const frames = page.frames();
        console.log(`  Frames: ${frames.length}`);
        for (let idx = 0; idx < frames.length; idx++) {
          const frame = frames[idx];
          const frameUrl = frame.url();
          console.log(`    Frame [${idx}]: url="${frameUrl}"`);
          
          const textareasInFrame = await frame.$$eval('textarea', els => els.map(el => ({ id: el.id, class: el.className, placeholder: el.placeholder }))).catch(() => []);
          console.log(`      Textareas in frame: ${textareasInFrame.length}`);
          textareasInFrame.forEach((t, i) => console.log(`        [${i}] id="${t.id}", class="${t.class}", placeholder="${t.placeholder}"`));
          
          const buttonsInFrame = await frame.$$eval('button', els => els.map(el => ({ id: el.id, class: el.className, text: el.innerText }))).catch(() => []);
          console.log(`      Buttons in frame: ${buttonsInFrame.length}`);
          buttonsInFrame.slice(0, 10).forEach((b, i) => console.log(`        [${i}] id="${b.id}", class="${b.class}", text="${b.text.slice(0, 30)}"`));
        }
      }
    }
    
    await browser.disconnect();
  } catch (error) {
    console.error('ERROR during inspection:', error);
  }
}

inspect();
