import { expect, it, vi } from 'vitest';
import { globals } from 'webgpu';
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

it('destroys devices and detaches mapped buffers on teardown', async () => {
  const raw: Record<string, unknown> = {};
  const { teardown } = environment.setup(raw, {});
  const global = raw as ShimmedGlobal;
  const adapter = await global.navigator.gpu.requestAdapter();
  const device = await adapter!.requestDevice();
  const buffer = device.createBuffer({ size: 16, usage: global.GPUBufferUsage.MAP_READ, mappedAtCreation: true });
  const range = buffer.getMappedRange();
  try {
    await teardown(raw);
    expect(buffer.mapState).toBe('unmapped');
    expect(range.byteLength).toBe(0);
    expect((await device.lost).reason).toBe('destroyed');
  } finally {
    device.destroy();
    await teardown(raw);
  }
});

it('destroys devices whose request finishes after teardown', async () => {
  const raw: Record<string, unknown> = {};
  const { teardown } = environment.setup(raw, {});
  const global = raw as ShimmedGlobal;
  const adapter = await global.navigator.gpu.requestAdapter();
  const pending = adapter!.requestDevice();
  // Attach the rejection handler before teardown can settle the request.
  const rejected = expect(pending).rejects.toThrow(/torn down/);
  await teardown(raw);
  await rejected;
  await expect(adapter!.requestDevice()).rejects.toThrow(/torn down/);
});

it('cancels window and global animation frames, including stale functions', async () => {
  vi.useFakeTimers();
  const raw: Record<string, unknown> = {};
  const { teardown } = environment.setup(raw, {});
  const global = raw as ShimmedGlobal;
  const frame = global.requestAnimationFrame;
  const callback = vi.fn();
  try {
    frame(callback);
    global.window.requestAnimationFrame(callback);
    await teardown(raw);
    vi.advanceTimersByTime(100);
    expect(callback).not.toHaveBeenCalled();
    frame(callback);
    vi.advanceTimersByTime(100);
    expect(callback).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    await teardown(raw);
    vi.useRealTimers();
  }
});

it('returns null when no adapter is available and prevents use of a saved GPU after teardown', async () => {
  const request = vi.spyOn(globals.GPU.prototype, 'requestAdapter').mockResolvedValue(null);
  const raw: Record<string, unknown> = {};
  const { teardown } = environment.setup(raw, {});
  const gpu = (raw as ShimmedGlobal).navigator.gpu;
  try {
    expect(await gpu.requestAdapter()).toBeNull();
    await teardown(raw);
    await expect(gpu.requestAdapter()).rejects.toThrow(/torn down/);
  } finally {
    await teardown(raw);
    request.mockRestore();
  }
});

it('destroys a device returned by a delayed request rather than only rejecting the caller', async () => {
  let resolveDevice!: (device: GPUDevice) => void;
  const destroy = vi.fn();
  const device = { destroy } as unknown as GPUDevice;
  const adapter = {
    requestDevice: () =>
      new Promise<GPUDevice>((resolve) => {
        resolveDevice = resolve;
      }),
  } as GPUAdapter;
  const request = vi.spyOn(globals.GPU.prototype, 'requestAdapter').mockResolvedValue(adapter);
  const raw: Record<string, unknown> = {};
  const { teardown } = environment.setup(raw, {});
  try {
    const wrapped = await (raw as ShimmedGlobal).navigator.gpu.requestAdapter();
    const pending = wrapped!.requestDevice();
    const rejected = expect(pending).rejects.toThrow(/torn down/);
    await teardown(raw);
    resolveDevice(device);
    await rejected;
    expect(destroy).toHaveBeenCalledOnce();
  } finally {
    await teardown(raw);
    request.mockRestore();
  }
});

it('keeps devices from a parent environment alive until the parent tears down', async () => {
  const raw: Record<string, unknown> = {};
  const first = environment.setup(raw, {});
  const parent = await (await (raw as ShimmedGlobal).navigator.gpu.requestAdapter())!.requestDevice();
  const destroy = vi.spyOn(parent, 'destroy');
  const second = environment.setup(raw, {});
  const child = await (await (raw as ShimmedGlobal).navigator.gpu.requestAdapter())!.requestDevice();
  await second.teardown(raw);
  await second.teardown(raw);
  expect((await child.lost).reason).toBe('destroyed');
  expect(destroy).not.toHaveBeenCalled();
  await first.teardown(raw);
  expect(destroy).toHaveBeenCalledOnce();
});
