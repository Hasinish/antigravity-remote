const puppeteer = require('puppeteer-core');

async function inspect() {
  try {
    console.log('Connecting to http://localhost:9222...');
    const browser = await puppeteer.connect({
      browserURL: 'http://localhost:9222',
      defaultViewport: null
    });
    
    console.log('CONNECTED! Finding workbench target...');
    const pages = await browser.pages();
    const workbenchPage = pages.find(p => p.url().includes('workbench.html'));
    
    if (!workbenchPage) {
      console.log('Error: workbench.html target not found.');
      await browser.disconnect();
      return;
    }
    
    console.log(`Found workbench.html! Scanning with shadow DOM traversal...`);
    
    const results = await workbenchPage.evaluate(() => {
      // Recursive shadow DOM query selector
      function querySelectorAllShadow(selector, root = document) {
        const elements = [];
        function traverse(node) {
          if (!node) return;
          if (node.querySelectorAll) {
            const matches = node.querySelectorAll(selector);
            elements.push(...matches);
          }
          if (node.children) {
            for (const child of node.children) {
              traverse(child);
            }
          }
          if (node.shadowRoot) {
            traverse(node.shadowRoot);
          }
        }
        traverse(root);
        return elements;
      }
      
      const textareas = querySelectorAllShadow('textarea');
      const inputs = querySelectorAllShadow('input');
      const editables = querySelectorAllShadow('[contenteditable="true"]');
      const buttons = querySelectorAllShadow('button');
      
      return {
        textareas: textareas.map(t => ({ tag: t.tagName, id: t.id, class: t.className, placeholder: t.placeholder })),
        inputs: inputs.map(i => ({ tag: i.tagName, id: i.id, class: i.className, placeholder: i.placeholder, type: i.type })),
        editables: editables.map(e => ({ tag: e.tagName, id: e.id, class: e.className, text: e.innerText.slice(0, 50) })),
        buttons: buttons.map(b => ({ tag: b.tagName, id: b.id, class: b.className, text: b.innerText.slice(0, 30) }))
      };
    });
    
    console.log(`\nTextareas found: ${results.textareas.length}`);
    results.textareas.forEach((t, i) => console.log(`  [${i}] id="${t.id}", class="${t.class}", placeholder="${t.placeholder}"`));
    
    console.log(`\nInputs found: ${results.inputs.length}`);
    results.inputs.forEach((i, idx) => console.log(`  [${idx}] id="${i.id}", class="${i.class}", type="${i.type}", placeholder="${i.placeholder}"`));
    
    console.log(`\nEditables found: ${results.editables.length}`);
    results.editables.forEach((e, i) => console.log(`  [${i}] tag=${e.tag}, id="${e.id}", class="${e.class}", text="${e.text}"`));
    
    console.log(`\nButtons found (first 20): ${results.buttons.length}`);
    results.buttons.slice(0, 20).forEach((b, i) => console.log(`  [${i}] id="${b.id}", class="${b.class}", text="${b.text}"`));
    
    await browser.disconnect();
  } catch (error) {
    console.error('ERROR during inspection:', error);
  }
}

inspect();
