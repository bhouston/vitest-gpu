import { expect, it } from 'vitest';
import environment, { HeadlessCanvas } from './index.ts';

it('adds navigator.gpu backed by Dawn, the GPU* globals and a canvas shim, and removes them on teardown', async () => {
  const global: Record<string, any> = { GPU: 'kept' };
  const { teardown } = await environment.setup(global, { webgpuNode: { dawnOptions: [] } });
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
  const device = await adapter.requestDevice();
  const buffer = device.createBuffer({
    size: 16,
    usage: global.GPUBufferUsage.COPY_DST | global.GPUBufferUsage.MAP_READ,
  });
  device.queue.writeBuffer(buffer, 0, new Uint32Array([1, 2, 3, 4]));
  await buffer.mapAsync(global.GPUMapMode.READ);
  expect(Array.from(new Uint32Array(buffer.getMappedRange()))).toEqual([1, 2, 3, 4]);
  buffer.unmap();
  device.destroy();
  await teardown(global);
  expect(global).toEqual({ GPU: 'kept', navigator: {} });
});

it('reuses an existing navigator object and defaults options', async () => {
  const navigator = { userAgent: 'x' };
  const global: Record<string, any> = { navigator };
  const { teardown } = await environment.setup(global, {});
  expect(global.navigator).toBe(navigator);
  expect(typeof global.navigator.gpu.requestAdapter).toBe('function');
  await teardown(global);
  expect(navigator).toEqual({ userAgent: 'x' });
});
