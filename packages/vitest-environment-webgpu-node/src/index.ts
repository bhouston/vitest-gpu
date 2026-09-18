import type { Environment } from 'vitest/environments';
import { create, globals } from 'webgpu';
import { HeadlessCanvas } from './canvas.js';

export { createCanvas, HeadlessCanvas, HeadlessCanvasContext, type RgbaImage } from './canvas.js';

/** Set under `test.environmentOptions.webgpuNode` in your Vitest config. */
export type WebgpuNodeOptions = {
  /** Dawn options, e.g. `['backend=vulkan', 'enable-dawn-features=allow_unsafe_apis']`. */
  dawnOptions?: string[];
};

/** Just enough DOM for libraries that make their own canvas and drive a frame loop. Only installed when missing. */
const requestAnimationFrame = (callback: (time: number) => void): NodeJS.Timeout =>
  setTimeout(() => callback(performance.now()), 16).unref();

const domShims = (): Record<string, unknown> => {
  const window = {
    devicePixelRatio: 1,
    requestAnimationFrame,
    cancelAnimationFrame: clearTimeout,
    addEventListener() {},
    removeEventListener() {},
  };
  return {
    HTMLCanvasElement: HeadlessCanvas,
    document: {
      createElement: (tag: string) => (tag === 'canvas' ? new HeadlessCanvas() : {}),
      createElementNS: (_ns: string, tag: string) => (tag === 'canvas' ? new HeadlessCanvas() : {}),
      addEventListener() {},
      removeEventListener() {},
    },
    window,
    self: window,
    requestAnimationFrame,
    cancelAnimationFrame: clearTimeout,
  };
};

export default <Environment>{
  name: 'webgpu-node',
  viteEnvironment: 'ssr',
  setup(global: Record<string, unknown>, { webgpuNode = {} }: { webgpuNode?: WebgpuNodeOptions }) {
    const shims = { ...globals, ...domShims() } as Record<string, unknown>;
    const added = Object.keys(shims).filter((key) => !(key in global));
    for (const key of added) global[key] = shims[key];
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
