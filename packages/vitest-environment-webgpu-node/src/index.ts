import type { Environment } from 'vitest/runtime';
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

type SavedProperty = { target: object; key: PropertyKey; descriptor?: PropertyDescriptor };

const restore = (properties: SavedProperty[]): void => {
  for (const { target, key, descriptor } of properties.toReversed()) {
    if (descriptor) Object.defineProperty(target, key, descriptor);
    else Reflect.deleteProperty(target, key);
  }
};

export default {
  name: 'webgpu-node',
  viteEnvironment: 'ssr',
  setup(global: Record<string, unknown>, { webgpuNode = {} }: { webgpuNode?: WebgpuNodeOptions }) {
    const shims = { ...globals, ...domShims() } as Record<string, unknown>;
    const modified: SavedProperty[] = [];
    try {
      for (const key of Object.keys(shims)) {
        if (key in global) continue;
        modified.push({ target: global, key, descriptor: Object.getOwnPropertyDescriptor(global, key) });
        global[key] = shims[key];
      }
      if (global.navigator == null) {
        modified.push({
          target: global,
          key: 'navigator',
          descriptor: Object.getOwnPropertyDescriptor(global, 'navigator'),
        });
        global.navigator = {};
      }
      const navigator = global.navigator as object;
      modified.push({ target: navigator, key: 'gpu', descriptor: Object.getOwnPropertyDescriptor(navigator, 'gpu') });
      Object.defineProperty(navigator, 'gpu', {
        value: create(webgpuNode.dawnOptions ?? []),
        writable: false,
        enumerable: false,
        configurable: true,
      });
    } catch (error) {
      restore(modified);
      throw error;
    }
    return {
      teardown(_global?: Record<string, unknown>) {
        restore(modified);
      },
    };
  },
} satisfies Environment;
