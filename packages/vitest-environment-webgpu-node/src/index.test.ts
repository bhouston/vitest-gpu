import { expect, it } from 'vitest';
import environment, { HeadlessCanvas } from './index.ts';

/** Shape the environment's `setup()` shims onto the plain object passed as `global` in these tests. */
type ShimmedGlobal = Record<string, unknown> & {
  GPU: string;
  GPUBufferUsage: { MAP_READ: number; COPY_DST: number };
  GPUMapMode: { READ: number };
  HTMLCanvasElement: typeof HeadlessCanvas;
  document: {
    createElement: (tag: string) => unknown;
    createElementNS: (namespace: string, tag: string) => unknown;
    addEventListener: () => void;
    removeEventListener: () => void;
  };
  self: unknown;
  window: {
    devicePixelRatio: number;
    addEventListener: () => void;
    removeEventListener: () => void;
    requestAnimationFrame: (callback: (time: number) => void) => number;
  };
  requestAnimationFrame: (callback: (time: number) => void) => number;
  cancelAnimationFrame: (id: number) => void;
  navigator: { gpu: { requestAdapter: () => Promise<GPUAdapter | null> } };
};

it('declares the SSR loader metadata required by Vitest 3 and 4', () => {
  expect(environment.viteEnvironment).toBe('ssr');
});

it('adds navigator.gpu backed by Dawn, the GPU* globals and a canvas shim, and removes them on teardown', async () => {
  const raw: Record<string, unknown> = { GPU: 'kept' };
  const { teardown } = await environment.setup(raw, { webgpuNode: { dawnOptions: [] } });
  const global = raw as ShimmedGlobal;
  expect(global.GPU).toBe('kept');
  expect(global.GPUBufferUsage.MAP_READ).toBe(1);
  expect(global.HTMLCanvasElement).toBe(HeadlessCanvas);
  expect(global.document.createElement('canvas')).toBeInstanceOf(HeadlessCanvas);
  expect(global.document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas')).toBeInstanceOf(HeadlessCanvas);
  expect(global.document.createElement('div')).toEqual({});
  expect(global.document.createElementNS('', 'div')).toEqual({});
  expect(global.self).toBe(global.window);
  expect(global.window.devicePixelRatio).toBe(1);
  await new Promise<number>((resolve) => global.requestAnimationFrame(resolve));
  global.cancelAnimationFrame(global.window.requestAnimationFrame(() => {}));
  global.document.addEventListener();
  global.document.removeEventListener();
  global.window.addEventListener();
  global.window.removeEventListener();
  const adapter = await global.navigator.gpu.requestAdapter();
  expect(adapter).not.toBeNull();
  const device = await adapter!.requestDevice();
  const buffer = device.createBuffer({
    size: 16,
    usage: global.GPUBufferUsage.COPY_DST | global.GPUBufferUsage.MAP_READ,
  });
  device.queue.writeBuffer(buffer, 0, new Uint32Array([1, 2, 3, 4]));
  await buffer.mapAsync(global.GPUMapMode.READ);
  expect(Array.from(new Uint32Array(buffer.getMappedRange()))).toEqual([1, 2, 3, 4]);
  buffer.unmap();
  device.destroy();
  await teardown(raw);
  expect(raw).toEqual({ GPU: 'kept' });
});

it('reuses an existing navigator object and defaults options', async () => {
  const navigator = { userAgent: 'x' };
  const raw: Record<string, unknown> = { navigator };
  const { teardown } = await environment.setup(raw, {});
  const global = raw as ShimmedGlobal;
  expect(global.navigator).toBe(navigator);
  expect(typeof global.navigator.gpu.requestAdapter).toBe('function');
  await teardown(raw);
  expect(navigator).toEqual({ userAgent: 'x' });
});

it('restores the exact navigator.gpu descriptor', async () => {
  const originalGpu = { name: 'original' };
  const navigator = {};
  const descriptor: PropertyDescriptor = {
    value: originalGpu,
    writable: true,
    enumerable: true,
    configurable: true,
  };
  Object.defineProperty(navigator, 'gpu', descriptor);
  const raw: Record<string, unknown> = { navigator };
  const { teardown } = await environment.setup(raw, {});
  const global = raw as ShimmedGlobal;
  expect(global.navigator.gpu).not.toBe(originalGpu);
  await teardown(raw);
  expect(Object.getOwnPropertyDescriptor(navigator, 'gpu')).toEqual(descriptor);
});

it('unwinds nested setups in teardown order', async () => {
  const navigator = {};
  const raw: Record<string, unknown> = { navigator };
  const global = raw as ShimmedGlobal;
  const first = await environment.setup(raw, {});
  const firstGpu = global.navigator.gpu;
  const second = await environment.setup(raw, {});
  expect(global.navigator.gpu).not.toBe(firstGpu);
  await second.teardown(raw);
  expect(global.navigator.gpu).toBe(firstGpu);
  await first.teardown(raw);
  expect(navigator).toEqual({});
});

it('removes shims when setup fails after partially installing them', async () => {
  const navigator = {};
  Object.defineProperty(navigator, 'gpu', { value: 'locked', configurable: false });
  const raw: Record<string, unknown> = { navigator };
  const global = raw as ShimmedGlobal;
  expect(() => environment.setup(raw, {})).toThrow(TypeError);
  expect(raw).toEqual({ navigator });
  expect(global.navigator.gpu).toBe('locked');
});
