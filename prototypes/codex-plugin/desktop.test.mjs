import test from 'node:test';
import assert from 'node:assert/strict';
import { desktopArguments, prototypeURL, probePrototype } from './desktop.mjs';

test('desktop launch isolates Chrome and requests an app window in fullscreen', () => {
  const args = desktopArguments('http://127.0.0.1:5178', '/tmp/Prototype profile');
  assert.ok(args.includes('--app=http://127.0.0.1:5178'));
  assert.ok(args.includes('--start-fullscreen'));
  assert.ok(args.includes('--user-data-dir=/tmp/Prototype profile'));
  assert.ok(args.includes('--no-first-run'));
});

test('the launcher accepts only a valid local port', () => {
  assert.equal(prototypeURL('5179'), 'http://127.0.0.1:5179');
  for (const port of ['0', '65536', '5178/elsewhere', 'NaN', '12.5']) {
    assert.throws(() => prototypeURL(port), /port/i);
  }
});

test('the launcher reuses only an identified Fledgy prototype server', async () => {
  const response = (id, ok = true) => async () => ({ ok, headers: new Headers(id ? { 'X-Fledgy-Prototype': id } : {}) });
  assert.equal(await probePrototype('http://127.0.0.1:5178', response('codex-plugin')), 'ready');
  assert.equal(await probePrototype('http://127.0.0.1:5178', response(null)), 'occupied');
  assert.equal(await probePrototype('http://127.0.0.1:5178', response('codex-plugin', false)), 'occupied');
});

test('the launcher starts a server only when the port refuses a connection', async () => {
  assert.equal(await probePrototype('http://127.0.0.1:5178', async () => {
    throw new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } });
  }), 'offline');
  await assert.rejects(probePrototype('http://127.0.0.1:5178', async () => {
    throw new Error('Unexpected network failure');
  }), /Unexpected network failure/);
});
