import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { createCanvas } from './canvas.ts';
import environment from './index.ts';

let teardown: (g: unknown) => unknown;
let device: GPUDevice;
beforeAll(async () => {
  ({ teardown } = await environment.setup(globalThis, {}));
  device = await (await navigator.gpu.requestAdapter())!.requestDevice();
});
afterAll(async () => {
  device.destroy();
  await teardown(globalThis);
});

const clearTo = (canvas: ReturnType<typeof createCanvas>, color: GPUColor) => {
  const encoder = device.createCommandEncoder();
  const view = canvas.getContext('webgpu').getCurrentTexture().createView();
  encoder.beginRenderPass({ colorAttachments: [{ view, loadOp: 'clear', storeOp: 'store', clearValue: color }] }).end();
  device.queue.submit([encoder.finish()]);
};

it('behaves like a canvas element', () => {
  const canvas = createCanvas(10, 20);
  expect(canvas.clientWidth).toBe(10);
  expect(canvas.clientHeight).toBe(20);
  expect(canvas.getBoundingClientRect()).toMatchObject({ width: 10, height: 20, top: 0, left: 0 });
  expect(canvas.getContext('2d')).toBeNull();
  expect(canvas.style).toEqual({});
  expect(canvas.getAttribute('id')).toBeNull();
  canvas.setAttribute('id', 'c');
  expect(canvas.getAttribute('id')).toBe('c');
  canvas.addEventListener();
  canvas.removeEventListener();
  expect(canvas.dispatchEvent()).toBe(true);
  expect(canvas.asElement()).toBe(canvas);
  expect(createCanvas(300, 150).width).toBe(300);
});

it('requires configure() before accessing pixels', async () => {
  const context = createCanvas(4, 4).getContext('webgpu');
  expect(context.getConfiguration()).toBeNull();
  expect(() => context.getCurrentTexture()).toThrow(/configure/);
  await expect(context.readPixels()).rejects.toThrow('readPixels() called before configure()');
});

it('renders into the current texture and reads pixels back, swizzling bgra', async () => {
  const canvas = createCanvas(70, 3); // 70 * 4 = 280 bytes per row forces 512-byte padding
  const context = canvas.getContext('webgpu');
  context.configure({ device, format: 'bgra8unorm' });
  expect(context.getConfiguration()?.format).toBe('bgra8unorm');
  clearTo(canvas, [1, 0.5, 0, 1]);
  const image = await canvas.readPixels();
  expect(image).toMatchObject({ width: 70, height: 3 });
  expect(Array.from(image.data.subarray(0, 4))).toEqual([255, 128, 0, 255]);
  expect(Array.from(image.data.subarray(-4))).toEqual([255, 128, 0, 255]);
  expect(image.data.length).toBe(70 * 3 * 4);
});

it('accepts wider canvas formats but clearly rejects unsupported readback', async () => {
  const canvas = createCanvas(2, 2);
  const context = canvas.getContext('webgpu');
  context.configure({ device, format: 'rgba16float' });
  expect(context.getConfiguration()?.format).toBe('rgba16float');
  clearTo(canvas, [1, 0, 0, 1]);
  await expect(canvas.readPixels()).rejects.toThrow(
    'readPixels() does not support canvas format "rgba16float"; supported formats are rgba8unorm, rgba8unorm-srgb, bgra8unorm, and bgra8unorm-srgb',
  );
});

it('destroys the staging buffer when mapping fails', async () => {
  const destroy = vi.fn();
  const buffer = {
    mapAsync: vi.fn().mockRejectedValue(new Error('map failed')),
    destroy,
  };
  const texture = { width: 1, height: 1, destroy: vi.fn() };
  const encoder = { copyTextureToBuffer: vi.fn(), finish: vi.fn() };
  const fakeDevice = {
    createTexture: vi.fn().mockReturnValue(texture),
    createBuffer: vi.fn().mockReturnValue(buffer),
    createCommandEncoder: vi.fn().mockReturnValue(encoder),
    queue: { submit: vi.fn() },
  } as unknown as GPUDevice;
  const canvas = createCanvas(1, 1);
  canvas.getContext('webgpu').configure({ device: fakeDevice, format: 'rgba8unorm' });

  await expect(canvas.readPixels()).rejects.toThrow('map failed');
  expect(destroy).toHaveBeenCalledOnce();
});

it('keeps the texture across frames, but recreates it on resize or reconfigure', async () => {
  const canvas = createCanvas(4, 4);
  const context = canvas.getContext('webgpu');
  context.configure({ device, format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING });
  const first = context.getCurrentTexture();
  expect(context.getCurrentTexture()).toBe(first);
  expect(first.usage & GPUTextureUsage.TEXTURE_BINDING).toBeTruthy();
  canvas.width = 8;
  const resized = context.getCurrentTexture();
  expect(resized).not.toBe(first);
  expect(resized.width).toBe(8);
  clearTo(canvas, [0, 0, 1, 1]);
  expect(Array.from((await canvas.readPixels()).data.subarray(0, 4))).toEqual([0, 0, 255, 255]);
  context.configure({ device, format: 'rgba8unorm' });
  expect(context.getCurrentTexture()).not.toBe(resized);
  context.unconfigure();
  expect(context.getConfiguration()).toBeNull();
});
