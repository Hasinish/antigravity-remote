const puppeteer = require('puppeteer-core');

async function main() {
  console.log('[test] Connecting to browser...');
  const browser = await puppeteer.connect({
    browserURL: 'http://localhost:9222',
    defaultViewport: null
  });

  const pages = await browser.pages();
  const page = pages.find(p => p.url().includes('workbench.html'));
  if (!page) {
    console.error('workbench.html not found');
    await browser.disconnect();
    return;
  }

  page.on('console', msg => console.log('[PAGE CONSOLE]', msg.text()));

  console.log('[test] Found workbench page. Focus and clear chat input...');
  
  // Inject "hello world"
  let ok = await page.evaluate((text) => {
    const allEditables = Array.from(document.querySelectorAll('div[contenteditable="true"]'));
    const chatInputs = allEditables.filter(el => el.className.includes('max-h-[300px]'));
    if (chatInputs.length === 0) return false;

    const target = chatInputs[chatInputs.length - 1];
    target.focus();

    const editor = target.__lexicalEditor;
    if (!editor) {
      console.log('__lexicalEditor not found!');
      return false;
    }

    const stateJson = {
      root: {
        children: [
          {
            children: [
              {
                detail: 0,
                format: 0,
                mode: "normal",
                style: "",
                text: text,
                type: "text",
                version: 1
              }
            ],
            direction: "ltr",
            format: "",
            indent: 0,
            type: "paragraph",
            version: 1
          }
        ],
        direction: "ltr",
        format: "",
        indent: 0,
        type: "root",
        version: 1
      }
    };

    const state = editor.parseEditorState(stateJson);
    editor.setEditorState(state);
    return true;
  }, 'hello world');
  console.log('[test] Injected "hello world" result:', ok);

  // Read current value
  let val = await page.evaluate(() => {
    const allEditables = Array.from(document.querySelectorAll('div[contenteditable="true"]'));
    const chatInputs = allEditables.filter(el => el.className.includes('max-h-[300px]'));
    if (chatInputs.length === 0) return 'NOT FOUND';
    return chatInputs[chatInputs.length - 1].textContent;
  });
  console.log('[test] Current text is:', val);

  // Wait 1.5 seconds
  await new Promise(r => setTimeout(r, 1500));

  // Clear and inject "hello changed"
  ok = await page.evaluate((text) => {
    const allEditables = Array.from(document.querySelectorAll('div[contenteditable="true"]'));
    const chatInputs = allEditables.filter(el => el.className.includes('max-h-[300px]'));
    if (chatInputs.length === 0) return false;

    const target = chatInputs[chatInputs.length - 1];
    target.focus();

    const editor = target.__lexicalEditor;
    if (!editor) return false;

    const stateJson = {
      root: {
        children: [
          {
            children: [
              {
                detail: 0,
                format: 0,
                mode: "normal",
                style: "",
                text: text,
                type: "text",
                version: 1
              }
            ],
            direction: "ltr",
            format: "",
            indent: 0,
            type: "paragraph",
            version: 1
          }
        ],
        direction: "ltr",
        format: "",
        indent: 0,
        type: "root",
        version: 1
      }
    };

    const state = editor.parseEditorState(stateJson);
    editor.setEditorState(state);
    return true;
  }, 'hello changed');
  console.log('[test] Injected "hello changed" result:', ok);

  // Read current value again
  val = await page.evaluate(() => {
    const allEditables = Array.from(document.querySelectorAll('div[contenteditable="true"]'));
    const chatInputs = allEditables.filter(el => el.className.includes('max-h-[300px]'));
    if (chatInputs.length === 0) return 'NOT FOUND';
    return chatInputs[chatInputs.length - 1].textContent;
  });
  console.log('[test] Final text is:', val);

  await browser.disconnect();
}

main().catch(console.error);
