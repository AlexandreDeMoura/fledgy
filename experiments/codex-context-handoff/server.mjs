// Disposable MCP 2025-11-25 stdio fixture. No SDK, network, or app data access.
import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';

const uri = 'ui://context-handoff/diagnostic.html';
const html = await readFile(new URL('./diagnostic.html', import.meta.url), 'utf8');
const ui = { csp: { connectDomains: [], resourceDomains: [] } };
const tool = {
  name: 'open_context_handoff_test',
  title: 'Context handoff test',
  description: 'Open a disposable context-handoff diagnostic with fictional Steps. No repository access.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  _meta: {
    ui: { resourceUri: uri },
    'openai/ui': { entrypoints: [{ type: 'global' }, { type: 'thread' }] },
  },
};

function invalidParams() {
  throw { code: -32602, message: 'This fixture accepts only its own resource and empty tool arguments.' };
}

function handle({ method, params = {} }) {
  switch (method) {
    case 'initialize':
      return {
        protocolVersion: '2025-11-25',
        capabilities: { tools: {}, resources: {} },
        serverInfo: { name: 'context-handoff-test', version: '0.0.0' },
      };
    case 'ping': return {};
    case 'tools/list': return { tools: [tool] };
    case 'resources/list':
      return { resources: [{ uri, name: 'Context handoff diagnostic', mimeType: 'text/html;profile=mcp-app', _meta: { ui } }] };
    case 'resources/read':
      if (params.uri !== uri) invalidParams();
      return { contents: [{ uri, mimeType: 'text/html;profile=mcp-app', text: html, _meta: { ui } }] };
    case 'tools/call':
      if (params.name !== tool.name || (params.arguments !== undefined && (
        params.arguments === null || typeof params.arguments !== 'object' ||
        Array.isArray(params.arguments) || Object.keys(params.arguments).length
      ))) {
        return { isError: true, content: [{ type: 'text', text: 'Only open_context_handoff_test with {} is available.' }] };
      }
      return { content: [{ type: 'text', text: 'Context handoff diagnostic opened. The selection and random marker are generated only in the page.' }] };
    default: throw { code: -32601, message: 'Method not implemented by this disposable fixture.' };
  }
}

for await (const line of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
  let request;
  try {
    request = JSON.parse(line);
  } catch {
    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Invalid JSON' } }) + '\n');
    continue;
  }
  if (!request || request.jsonrpc !== '2.0' || typeof request.method !== 'string') {
    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request?.id ?? null, error: { code: -32600, message: 'Invalid request' } }) + '\n');
    continue;
  }
  if (!Object.hasOwn(request, 'id')) continue;
  try {
    const result = handle(request);
    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }) + '\n');
  } catch (error) {
    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, error: { code: error.code ?? -32603, message: error.message ?? 'Internal error' } }) + '\n');
  }
}
