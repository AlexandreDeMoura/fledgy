import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

test('stdio fixture negotiates MCP, exposes entrypoints, and rejects unrelated operations', { timeout: 10000 }, async () => {
  const child = spawn(process.execPath, [new URL('./server.mjs', import.meta.url).pathname], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk; });
  const lines = createInterface({ input: child.stdout })[Symbol.asyncIterator]();
  let id = 0;
  async function request(method, params = {}) {
    const requestId = ++id;
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: requestId, method, params }) + '\n');
    const line = await lines.next();
    assert.equal(line.done, false, `Server exited: ${stderr}`);
    const response = JSON.parse(line.value);
    assert.equal(response.id, requestId);
    return response;
  }
  try {
    // A newer client must receive the older supported version explicitly.
    const init = await request('initialize', { protocolVersion: '2026-07-28', capabilities: {}, clientInfo: { name: 'fixture-test', version: '1' } });
    assert.equal(init.result.protocolVersion, '2025-11-25');
    assert.deepEqual(init.result.capabilities, { tools: {}, resources: {} });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    const list = await request('tools/list');
    assert.equal(list.result.tools.length, 1);
    const tool = list.result.tools[0];
    assert.deepEqual(tool._meta['openai/ui'].entrypoints, [{ type: 'global' }, { type: 'thread' }]);
    assert.equal(tool.annotations.readOnlyHint, true);
    const open = await request('tools/call', { name: tool.name, arguments: {} });
    assert.equal(open.result.isError, undefined);
    const resource = await request('resources/read', { uri: tool._meta.ui.resourceUri });
    assert.equal(resource.result.contents[0].mimeType, 'text/html;profile=mcp-app');
    assert.deepEqual(resource.result.contents[0]._meta.ui.csp, { connectDomains: [], resourceDomains: [] });
    assert.equal((await request('resources/read', { uri: 'file:///etc/passwd' })).error.code, -32602);
    assert.equal((await request('tools/call', { name: 'read_file', arguments: { path: '/etc/passwd' } })).result.isError, true);
    assert.equal((await request('tools/call', { name: tool.name, arguments: { path: '/tmp' } })).result.isError, true);
    assert.equal((await request('sampling/createMessage')).error.code, -32601);
    child.stdin.write('invalid json\n');
    assert.equal(JSON.parse((await lines.next()).value).error.code, -32700);
    assert.deepEqual((await request('ping')).result, {});
  } finally {
    child.kill();
    lines.return?.();
  }
});
