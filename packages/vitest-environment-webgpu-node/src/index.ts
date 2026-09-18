import type { Environment } from 'vitest/environments';
import { create, globals } from 'webgpu';

/** Set under `test.environmentOptions.webgpuNode` in your Vitest config. */
export type WebgpuNodeOptions = {
  /** Dawn options, e.g. `['backend=vulkan', 'enable-dawn-features=allow_unsafe_apis']`. */
  dawnOptions?: string[];
};

export default <Environment>{
  name: 'webgpu-node',
  viteEnvironment: 'ssr',
  setup(global: Record<string, unknown>, { webgpuNode = {} }: { webgpuNode?: WebgpuNodeOptions }) {
    const added = Object.keys(globals).filter((key) => !(key in global));
    for (const key of added) global[key] = (globals as Record<string, unknown>)[key];
    const navigator = (global.navigator ??= {}) as { gpu?: GPU };
    Object.defineProperty(navigator, 'gpu', { value: create(webgpuNode.dawnOptions ?? []), configurable: true });
    return {
      teardown(g: Record<string, unknown>) {
        delete navigator.gpu;
        for (const key of added) delete g[key];
      },
    };
  },
};
