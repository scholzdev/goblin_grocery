// Renders the desktop app icon (build/icon.png, 1024²) from the game's own SVG art via system Chrome.
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
const head = readFileSync('public/assets/svg/goblin_head.svg', 'utf8');
const cart = readFileSync('public/assets/svg/icon_toaster.svg', 'utf8');
const uri = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
const html = `<html><body style="margin:0;background:transparent">
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect x="64" y="64" width="896" height="896" rx="200" fill="#F45F52" stroke="#30203F" stroke-width="28"/>
  <path d="M64 640 L960 560 L960 760 Q960 960 760 960 L264 960 Q64 960 64 760Z" fill="#B8DED2" stroke="#30203F" stroke-width="0"/>
  <rect x="64" y="64" width="896" height="896" rx="200" fill="none" stroke="#30203F" stroke-width="28"/>
  <image href="${uri(cart)}" x="520" y="470" width="400" height="400"/>
  <image href="${uri(head)}" x="70" y="150" width="720" height="600"/>
</svg></body></html>`;
mkdirSync('build', { recursive: true });
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1024, height: 1024 } });
await p.setContent(html);
await p.screenshot({ path: 'build/icon.png', omitBackground: true, clip: { x: 0, y: 0, width: 1024, height: 1024 } });
await b.close();
console.log('wrote build/icon.png');
