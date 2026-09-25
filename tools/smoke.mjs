// Headless-Smoke-Test: node tools/smoke.mjs [query] [sekunden] [screenshot.png] [--mobile]
// Braucht Playwright (z. B. in /tmp/pwtest: npm i playwright). Startet eigenen Mini-Server.
import http from 'http';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch (e) { pw = require('/tmp/pwtest/node_modules/playwright'); }

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(root, p);
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); res.end('nope'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' });
    res.end(data);
  });
});
await new Promise(r => server.listen(0, r));
const port = server.address().port;
const args = process.argv.slice(2);
const mobile = args.includes('--mobile') || args.includes('--landscape');
const MOBILE_VP = args.includes('--landscape') ? { width: 844, height: 390 } : { width: 390, height: 844 };
const pos = args.filter(a => !a.startsWith('--'));
const query = pos[0] || '';
const secs = parseFloat(pos[1] || '10');
const shot = pos[2] || '';
const evalFile = (args.find(a => a.startsWith('--eval=')) || '').slice(7);

let browser;
try { browser = await pw.chromium.launch({ channel: 'chrome', headless: true }); }
catch (e) { browser = await pw.chromium.launch({ headless: true }); }
const ctx = await browser.newContext(mobile ? { viewport: MOBILE_VP, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 760 } });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); if (m.type() === 'log' && m.text().startsWith('[T]')) console.log(m.text()); });
page.on('response', r => { if (r.status() >= 400) errors.push('HTTP ' + r.status() + ' ' + r.url()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
await page.goto(`http://localhost:${port}/index.html${query ? '?' + query : ''}`);
if (evalFile) {
  const code = fs.readFileSync(evalFile, 'utf8');
  await page.waitForTimeout(2500);
  const r = await page.evaluate(code);
  if (r !== undefined) console.log('eval:', JSON.stringify(r));
}
await page.waitForTimeout(secs * 1000);
if (shot) await page.screenshot({ path: shot });
const blog = await page.evaluate(() => window.__log || []); if (blog.length) console.log(blog.join('\n'));
const endShown = await page.evaluate(() => (typeof UI !== 'undefined' && UI.overlayMode) || null); console.log('Overlay:', endShown);
const state = await page.evaluate(() => {
  try { return G ? { minute: G.minute, rep: G.rep, rival: G.rivalRep, money: G.money, ended: G.ended } : null; } catch (e) { return String(e); }
});
console.log('Zustand:', JSON.stringify(state));
const filtered = errors.filter(e => !/fonts\.g|Failed to load resource.*fonts/.test(e));
console.log(filtered.length ? 'FEHLER:\n' + filtered.join('\n') : 'Keine Konsolenfehler.');
await browser.close();
server.close();
process.exit(filtered.length ? 1 : 0);
