import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { networkInterfaces } from 'node:os';
const root = process.cwd();
const lan = process.argv.includes('--lan');
const port = lan ? 5174 : 5173;
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const target = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    const relative = path.relative(root, target);
    if (relative.startsWith('..') || path.isAbsolute(relative) || !['index.html', 'favicon.svg'].includes(relative) && !relative.startsWith(`src${path.sep}`)) { res.writeHead(404); res.end(); return; }
    const data = await readFile(target); res.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(data);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(port, lan ? '0.0.0.0' : '127.0.0.1', () => {
  console.log(`Ladder Game: http://localhost:${port}`);
  if (lan) for (const adapters of Object.values(networkInterfaces())) for (const ip of adapters || []) {
    if (ip.family === 'IPv4' && !ip.internal && !ip.address.startsWith('169.254.')) console.log(`같은 Wi-Fi 스마트폰: http://${ip.address}:${port}`);
  }
});
