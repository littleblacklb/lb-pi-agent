import { createJiti } from '../../npm/node_modules/jiti/lib/jiti.mjs';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// Pi supplies this host-package alias when loading extensions.
const jiti = createJiti(import.meta.url, { alias: {
  '@earendil-works/pi-coding-agent': '/Users/lb/.pi/agent/install/releases/1.3.0/node_modules/@earendil-works/pi-coding-agent/dist/index.js',
} });
const { createUltrafastExtension } = await jiti.import('./index.ts');
const dir = await mkdtemp(join(tmpdir(), 'pi-ultrafast-test-'));
const state = join(dir, 'ultra.json');
async function boot() {
  const events = new Map(), commands = new Map();
  const ctx = { cwd: dir, hasUI: false, model: { provider: 'openai-codex', id: 'gpt-6-astra' } };
  const pi = {
    on(name, fn) { const list = events.get(name) ?? []; list.push(fn); events.set(name, list); },
    registerCommand(name, def) { assert(!commands.has(name)); commands.set(name, def); },
    registerFlag() {}, getFlag() { return false; },
  };
  createUltrafastExtension(state, dir)(pi);
  for (const fn of events.get('session_start')) await fn({}, ctx);
  return { ctx, command: (name, args) => commands.get(name).handler(args, ctx),
    payload: async () => {
      let payload = { model: ctx.model.id, input: 'test' };
      for (const fn of events.get('before_provider_request')) payload = await fn({ payload }, ctx) ?? payload;
      return payload;
    } };
}
try {
  let app = await boot();
  assert.equal((await app.payload()).service_tier, undefined);
  await app.command('fast', 'on');
  assert.equal((await app.payload()).service_tier, 'priority');
  await app.command('ultrafast', 'on');
  assert.equal((await app.payload()).service_tier, 'ultrafast');
  await app.command('fast', 'off');
  assert.equal((await app.payload()).service_tier, 'ultrafast');
  app = await boot();
  assert.equal((await app.payload()).service_tier, 'ultrafast');
  await app.command('ultrafast', 'invalid');
  assert.equal((await app.payload()).service_tier, 'ultrafast');
  await app.command('ultrafast', 'status');
  assert.equal(JSON.parse(await readFile(state, 'utf8')).enabled, true);
  app.ctx.model = { provider: 'anthropic', id: 'gpt-6-astra' };
  assert.equal((await app.payload()).service_tier, undefined);
  app.ctx.model = { provider: 'openai', id: 'gpt-6.1-sol' };
  assert.equal((await app.payload()).service_tier, 'ultrafast');
  app.ctx.model = { provider: 'openai-codex', id: 'gpt-5.4' };
  assert.equal((await app.payload()).service_tier, undefined);
  app.ctx.model.id = 'gpt-6-astra';
  await app.command('fast', 'on');
  await app.command('ultrafast', 'off');
  assert.equal((await app.payload()).service_tier, 'priority');
  await app.command('ultrafast', 'toggle');
  assert.equal((await app.payload()).service_tier, 'ultrafast');
  await app.command('ultrafast', '');
  assert.equal((await app.payload()).service_tier, 'priority');
  console.log('PASS: defaults, fast compatibility, override, persistence/reload, invalid args, status, provider/model guards, off and toggle');
} finally { await rm(dir, { recursive: true, force: true }); }
