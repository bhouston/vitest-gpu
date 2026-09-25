import { getDisplayInfo, init, installDOM, type InitOptions, type InstallDOMOptions } from '@onirenaud/node-webgl';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Environment } from 'vitest/runtime';

/** Set under `test.environmentOptions.webglNode` in your Vitest config. */
export type WebglNodeOptions = InitOptions & InstallDOMOptions;

const mimeTypes: Record<string, string> = {
  '.basis': 'application/octet-stream',
  '.bin': 'application/octet-stream',
  '.drc': 'application/octet-stream',
  '.exr': 'image/x-exr',
  '.fbx': 'application/octet-stream',
  '.gif': 'image/gif',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.hdr': 'image/vnd.radiance',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.ktx': 'image/ktx',
  '.ktx2': 'image/ktx2',
  '.mjs': 'text/javascript',
  '.mtl': 'text/plain',
  '.obj': 'text/plain',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
  '.wasm': 'application/wasm',
  '.webp': 'image/webp',
};

type PropertySnapshot = Map<PropertyKey, PropertyDescriptor>;

const snapshot = (target: object): PropertySnapshot =>
  new Map(Reflect.ownKeys(target).map((key) => [key, Object.getOwnPropertyDescriptor(target, key)!]));

const changedProperties = (before: PropertySnapshot, target: object): Set<PropertyKey> => {
  const changed = new Set<PropertyKey>();
  for (const key of new Set([...before.keys(), ...Reflect.ownKeys(target)])) {
    const previous = before.get(key);
    const current = Object.getOwnPropertyDescriptor(target, key);
    if (
      previous?.configurable !== current?.configurable ||
      previous?.enumerable !== current?.enumerable ||
      previous?.get !== current?.get ||
      previous?.set !== current?.set ||
      previous?.value !== current?.value ||
      previous?.writable !== current?.writable
    ) {
      changed.add(key);
    }
  }
  return changed;
};

const restore = (target: object, before: PropertySnapshot, changed: Iterable<PropertyKey>): void => {
  for (const key of changed) {
    const descriptor = before.get(key);
    if (descriptor) Object.defineProperty(target, key, descriptor);
    else Reflect.deleteProperty(target, key);
  }
};

const installFetch = (global: typeof globalThis, baseDir: string): void => {
  const originalFetch = global.fetch;
  const localFetch = async (input: string | URL | Request, requestInit?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (/^(https?|data|blob):/i.test(url)) return originalFetch(input, requestInit);
    const path = url.startsWith('file:') ? fileURLToPath(url) : resolve(baseDir, url.replace(/[?#].*$/, ''));
    try {
      const bytes = await readFile(path);
      return new Response(bytes, {
        status: 200,
        headers: { 'content-type': mimeTypes[extname(path).toLowerCase()] ?? 'application/octet-stream' },
      });
    } catch {
      return new Response(null, { status: 404, statusText: 'Not Found' });
    }
  };
  Object.defineProperty(global, 'fetch', { value: localFetch, writable: true, configurable: true });
};

export default {
  name: 'webgl-node',
  viteEnvironment: 'ssr',
  setup(global: typeof globalThis, { webglNode = {} }: { webglNode?: WebglNodeOptions }) {
    const { backend, api, ...dom } = webglNode;
    if (backend || api) {
      // node-webgl initialises its EGL display once per process; later options cannot change it.
      const display = getDisplayInfo();
      const ignored = [
        backend && backend !== 'default' && backend !== display?.backend && `backend "${backend}"`,
        api && api !== 'auto' && api !== display?.api && `api "${api}"`,
      ].filter(Boolean);
      if (display && ignored.length) {
        console.warn(
          `vitest-environment-webgl-node: ignoring ${ignored.join(' and ')}: the GL display was already initialised in this process (backend "${display.backend}", api "${display.api}"). Give every test file the same options, or run files in isolation.`,
        );
      }
      init({ backend, api });
    }
    const before = snapshot(global);
    const nested: { target: object; before: PropertySnapshot; changed?: Set<PropertyKey> }[] = [];
    try {
      // node-webgl remembers fetch installation at module scope, which cannot represent separate Vitest environments.
      installDOM({ ...dom, fetch: false });
      if (dom.fetch !== false) installFetch(global, dom.baseDir ?? process.cwd());
      // node-webgl's window/document have no event methods; engines like Babylon.js register resize/blur listeners.
      const { window, document } = global as unknown as Record<string, Record<string, unknown>>;
      for (const target of [window, document]) {
        if (!target) continue;
        const targetBefore = snapshot(target);
        nested.push({ target, before: targetBefore });
        target.addEventListener ??= () => {};
        target.removeEventListener ??= () => {};
        nested.at(-1)!.changed = changedProperties(targetBefore, target);
      }
    } catch (error) {
      for (const item of nested.toReversed())
        restore(item.target, item.before, item.changed ?? changedProperties(item.before, item.target));
      restore(global, before, changedProperties(before, global));
      throw error;
    }
    const changed = changedProperties(before, global);
    return {
      teardown(g: Record<string, unknown>) {
        for (const item of nested.toReversed()) restore(item.target, item.before, item.changed!);
        restore(g, before, changed);
      },
    };
  },
} satisfies Environment;
