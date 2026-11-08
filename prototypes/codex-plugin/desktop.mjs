import { spawn } from 'node:child_process';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

export function prototypeURL(port = '5178') {
  if (!/^\d+$/.test(String(port)) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error('FLEDGY_PROTOTYPE_PORT must be an integer port from 1 to 65535.');
  }
  return `http://127.0.0.1:${Number(port)}`;
}

export function desktopArguments(url, profile) {
  return [
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    `--app=${url}`,
    '--start-fullscreen',
  ];
}

export async function probePrototype(url, fetcher = fetch) {
  try {
    const response = await fetcher(url, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(1500) });
    return response.ok && response.headers.get('X-Fledgy-Prototype') === 'codex-plugin' ? 'ready' : 'occupied';
  } catch (error) {
    if (error.cause?.code === 'ECONNREFUSED') return 'offline';
    throw error;
  }
}

async function launch() {
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (process.platform !== 'darwin') throw new Error('This desktop launcher is for macOS. Use serve.mjs and the prototype’s fullscreen button on other systems.');
  try { await access(chrome); } catch { throw new Error('Google Chrome was not found in /Applications. Use serve.mjs and the prototype’s fullscreen button instead.'); }
  const url = prototypeURL(process.env.FLEDGY_PROTOTYPE_PORT);
  let server, browser, profile, serverExit, browserExit;
  let stopping = false;
  const stop = () => { stopping = true; browser?.kill('SIGTERM'); };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    const state = await probePrototype(url);
    if (state === 'occupied') throw new Error(`Port ${new URL(url).port} is already occupied. If your old prototype server is running, stop it and retry. Otherwise set FLEDGY_PROTOTYPE_PORT=5179.`);
    if (state === 'offline') {
      server = spawn(process.execPath, [fileURLToPath(new URL('./serve.mjs', import.meta.url))], { stdio: 'inherit', env: process.env });
      serverExit = new Promise(resolve => { server.once('exit', resolve); server.once('error', resolve); });
      let ready = false;
      for (let attempt = 0; attempt < 40 && !stopping; attempt++) {
        await delay(100);
        if (server.exitCode !== null) throw new Error('The prototype server stopped before it was ready.');
        const nextState = await probePrototype(url);
        if (nextState === 'ready') { ready = true; break; }
        if (nextState === 'occupied') throw new Error('Another application took the prototype port. Choose a different FLEDGY_PROTOTYPE_PORT.');
      }
      if (!ready && !stopping) throw new Error('The prototype server did not become ready.');
    }
    if (stopping) return;
    profile = await mkdtemp(join(tmpdir(), 'fledgy-prototype-chrome-'));
    if (stopping) return;
    browser = spawn(chrome, desktopArguments(url, profile), { stdio: 'ignore' });
    browserExit = new Promise((resolve, reject) => { browser.once('exit', resolve); browser.once('error', reject); });
    console.log('Opening Fledgy in a separate Chrome app window, requesting fullscreen.');
    console.log('If Chrome opens windowed, click the fullscreen icon at the top right.');
    console.log('Quit this separate app with Cmd+Q, or press Ctrl+C here to close it.');
    console.log('Your regular Chrome profile and tabs are not used.');
    await browserExit;
  } finally {
    if (browser && browser.exitCode === null) browser.kill('SIGTERM');
    if (browserExit) await browserExit.catch(() => {});
    if (server && server.exitCode === null) server.kill('SIGTERM');
    if (serverExit) await serverExit;
    if (profile) await rm(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  launch().catch(error => { console.error(error.message); process.exitCode = 1; });
}
