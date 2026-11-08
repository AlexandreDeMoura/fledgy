import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const port = Number(process.env.FLEDGY_PROTOTYPE_PORT || 5178);
const publicFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/app.mjs', ['app.mjs', 'text/javascript; charset=utf-8']],
  ['/model.mjs', ['model.mjs', 'text/javascript; charset=utf-8']],
  ['/fonts/InterVariable.woff2', ['fonts/InterVariable.woff2', 'font/woff2']],
]);

const server = createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  const file = publicFiles.get(path);
  if (!file || !['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(404, { 'Content-Type': 'text/plain' });
    response.end('Not found');
    return;
  }
  try {
    const body = await readFile(new URL(file[0], import.meta.url));
    response.writeHead(200, { 'Content-Type': file[1], 'Cache-Control': 'no-store', 'X-Fledgy-Prototype': 'codex-plugin' });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.writeHead(500, { 'Content-Type': 'text/plain' });
    response.end('Could not read a prototype file.');
  }
});
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE'
    ? `Port ${port} is in use. Try: FLEDGY_PROTOTYPE_PORT=5179 node prototypes/codex-plugin/serve.mjs`
    : error.message);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Fledgy Codex plugin prototype: http://127.0.0.1:${port}`);
  console.log('Fake data only. No packages, accounts, or repository access required.');
  console.log('Press Ctrl+C to stop.');
});
