import type { Environment } from 'vitest/runtime';
import { create, globals } from 'webgpu';
import { HeadlessCanvas } from './canvas.js';

export { createCanvas, HeadlessCanvas, HeadlessCanvasContext, type RgbaImage } from './canvas.js';

/** Set under `test.environmentOptions.webgpuNode` in your Vitest config. */
export type WebgpuNodeOptions = {
  /** Dawn options, e.g. `['backend=vulkan', 'enable-dawn-features=allow_unsafe_apis']`. */
  dawnOptions?: string[];
};

/** Each environment owns its frame callbacks; unref alone does not release them. */
const domShims = () => {
  const frames = new Set<NodeJS.Timeout>();
  let disposed = false;
  const requestAnimationFrame = (callback: (time: number) => void): NodeJS.Timeout | number => {
    if (disposed) return 0;
    const frame = setTimeout(() => {
      frames.delete(frame);
      callback(performance.now());
    }, 16).unref();
    frames.add(frame);
    return frame;
  };
  const cancelAnimationFrame = (frame: NodeJS.Timeout) => {
    frames.delete(frame);
    clearTimeout(frame);
  };
  const dispose = () => {
    disposed = true;
    for (const frame of frames) clearTimeout(frame);
    frames.clear();
  };
  const window = {
    devicePixelRatio: 1,
    requestAnimationFrame,
    cancelAnimationFrame,
    addEventListener() {},
    removeEventListener() {},
  };
  const shims = {
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
    cancelAnimationFrame,
  };
  return { shims, dispose };
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
    const dom = domShims();
    const shims = { ...globals, ...dom.shims } as Record<string, unknown>;
    const devices = new Set<GPUDevice>();
    let disposed = false;
    const dispose = () => {
      disposed = true;
      dom.dispose();
      for (const device of devices) device.destroy();
      devices.clear();
    };
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
      const gpu = create(webgpuNode.dawnOptions ?? []);
      const requestAdapter = gpu.requestAdapter.bind(gpu);
      gpu.requestAdapter = async (options) => {
        if (disposed) throw new Error('WebGPU environment has been torn down');
        const adapter = await requestAdapter(options);
        if (adapter) {
          const requestDevice = adapter.requestDevice.bind(adapter);
          adapter.requestDevice = async (descriptor) => {
            if (disposed) throw new Error('WebGPU environment has been torn down');
            const device = await requestDevice(descriptor);
            if (disposed) {
              device.destroy();
              throw new Error('WebGPU environment has been torn down');
            }
            devices.add(device);
            return device;
          };
        }
        return adapter;
      };
      Object.defineProperty(navigator, 'gpu', {
        value: gpu,
        writable: false,
        enumerable: false,
        configurable: true,
      });
    } catch (error) {
      dispose();
      restore(modified);
      throw error;
    }
    return {
      teardown(_global?: Record<string, unknown>) {
        if (disposed) return;
        try {
          dispose();
        } finally {
          restore(modified);
          modified.length = 0;
        }
      },
    };
  },
} satisfies Environment;
