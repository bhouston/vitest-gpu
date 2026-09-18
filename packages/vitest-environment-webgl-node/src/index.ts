import { init, installDOM, type InitOptions, type InstallDOMOptions } from '@onirenaud/node-webgl';
import type { Environment } from 'vitest/environments';

/** Set under `test.environmentOptions.webglNode` in your Vitest config. */
export type WebglNodeOptions = InitOptions & InstallDOMOptions;

export default {
  name: 'webgl-node',
  transformMode: 'ssr',
  viteEnvironment: 'ssr',
  setup(global: typeof globalThis, { webglNode = {} }: { webglNode?: WebglNodeOptions }) {
    const { backend, api, ...dom } = webglNode;
    if (backend || api) init({ backend, api });
    const before = new Set(Object.getOwnPropertyNames(global));
    installDOM(dom);
    // node-webgl's window/document have no event methods; engines like Babylon.js register resize/blur listeners.
    const { window, document } = global as unknown as Record<string, Record<string, unknown>>;
    for (const target of [window, document]) {
      if (!target) continue;
      target.addEventListener ??= () => {};
      target.removeEventListener ??= () => {};
    }
    const added = Object.getOwnPropertyNames(global).filter((key) => !before.has(key));
    return {
      teardown(g: Record<string, unknown>) {
        for (const key of added) delete g[key];
      },
    };
  },
} satisfies Environment;
