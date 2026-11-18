import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';

async function runtime(host = 'gyeonjeokit.lovable.app') {
  const output = await build({ entryPoints: ['src/lib/pwa.ts'], bundle: true, write: false, platform: 'browser', format: 'iife', globalName: 'Pwa', define: { 'import.meta.env.PROD': 'true' }, plugins: [{ name: 'synthetic-toast', setup(b) {
    b.onResolve({ filter: /^sonner$/ }, () => ({ path: 'toast', namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const toast={info:(text,options)=>globalThis.offers.push({text,options})}' }));
  } }] });
  const handlers = new Map<string, () => void>();
  const intervals: (() => void)[] = [];
  const offers: { options?: { action?: { onClick: () => void } } }[] = [];
  let reloads = 0, registrations = 0, activations = 0;
  const reg = { waiting: { postMessage: () => activations++ }, update: async () => {}, addEventListener: () => {} };
  const window = { location: { hostname: host, href: `https://${host}/`, reload: () => reloads++ }, __jimpickBusy: false, setInterval: (fn: () => void) => { intervals.push(fn); return 1; } };
  Object.assign(window, { self: window, top: window });
  const context = { window, offers, URL, navigator: { serviceWorker: { controller: {}, register: async () => { registrations++; return reg; }, getRegistrations: async () => [], addEventListener: (event: string, fn: () => void) => handlers.set(event, fn) } }, document: { visibilityState: 'visible', querySelector: () => null, addEventListener: () => {} } };
  const file = output.outputFiles?.[0];
  if (!file) throw Error('missing fixture bundle');
  runInNewContext(file.text + '; globalThis.register = Pwa.registerPwa;', context);
  (context as typeof context & { register: () => void }).register();
  await new Promise(resolve => setTimeout(resolve, 0));
  return { window, offers, handlers, intervals, reg, values: () => ({ reloads, registrations, activations }), register: () => (context as typeof context & { register: () => void }).register() };
}

test('production update never interrupts saving, requires explicit application and restarts once', async () => {
  const r = await runtime();
  r.window.__jimpickBusy = true;
  r.handlers.get('controllerchange')?.();
  for (let i = 0; i < 121; i++) r.intervals.forEach(fn => fn());
  assert.equal(r.values().reloads, 0);
  r.offers.find(o => o.options?.action)?.options?.action?.onClick();
  assert.equal(r.values().reloads, 0);
  r.window.__jimpickBusy = false;
  const action = r.offers.find(o => o.options?.action)?.options?.action;
  assert.ok(action);
  action.onClick(); action.onClick();
  assert.equal(r.values().reloads, 1);
  r.register();
  assert.equal(r.values().registrations, 1);
});

test('waiting worker activates only on application and controller change restarts once', async () => {
  const r = await runtime();
  assert.equal(r.values().activations, 0);
  const action = r.offers.find(o => o.options?.action)?.options?.action;
  assert.ok(action);
  action.onClick(); action.onClick();
  assert.equal(r.values().activations, 1);
  assert.equal(r.values().reloads, 0);
  r.handlers.get('controllerchange')?.(); r.handlers.get('controllerchange')?.();
  assert.equal(r.values().reloads, 1);
});

test('production-numbered preview never registers an app updater', async () => {
  const r = await runtime('id-preview-6--9ef0e6b7-7d23-4428-8895-6a82ebf234c8.lovable.app');
  assert.equal(r.values().registrations, 0);
  assert.equal(r.values().reloads, 0);
});