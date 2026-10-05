import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Canvas, createCanvas, getDisplayInfo } from '@onirenaud/node-webgl';
import { expect, it, vi } from 'vitest';
import environment from './index.ts';

const listener = () => {};

it('declares the SSR loader metadata required by Vitest 3 and 4', () => {
  expect(environment.viteEnvironment).toBe('ssr');
});

it('installs the DOM shim with a real WebGL2 canvas and removes it on teardown', async () => {
  expect(globalThis.document).toBeUndefined();
  const { teardown } = await environment.setup(globalThis, { webglNode: { innerWidth: 320, api: 'auto' } });
  expect(globalThis.window.innerWidth).toBe(320);
  window.addEventListener('resize', listener);
  document.addEventListener('visibilitychange', listener);
  window.removeEventListener('resize', listener);
  document.removeEventListener('visibilitychange', listener);
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 4;
  const gl = canvas.getContext('webgl2');
  expect(gl).toBeInstanceOf(WebGL2RenderingContext);
  if (!gl) throw new Error('unreachable');
  gl.clearColor(1, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  const pixels = new Uint8Array(4);
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  expect(Array.from(pixels)).toEqual([255, 0, 0, 255]);
  await teardown(globalThis);
  expect(globalThis.document).toBeUndefined();
  expect(globalThis.window).toBeUndefined();
});

it('defaults options when none are given', async () => {
  const { teardown } = await environment.setup(globalThis, {});
  expect(globalThis.window.innerWidth).toBe(1920);
  await teardown(globalThis);
});

it('restores overwritten descriptors and nested listener properties', async () => {
  const originalFetch = globalThis.fetch;
  const fetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'fetch')!;
  const window = { addEventListener: undefined as (() => void) | undefined };
  const document = { removeEventListener: undefined as (() => void) | undefined };
  Object.defineProperty(globalThis, 'window', { value: window, writable: true, configurable: true });
  Object.defineProperty(globalThis, 'document', { value: document, writable: true, configurable: true });
  try {
    const { teardown } = await environment.setup(globalThis, {});
    expect(globalThis.fetch).not.toBe(originalFetch);
    expect(window.addEventListener).toBeTypeOf('function');
    expect(document.removeEventListener).toBeTypeOf('function');
    await teardown(globalThis);
    expect(Object.getOwnPropertyDescriptor(globalThis, 'fetch')).toEqual(fetchDescriptor);
    expect(Object.getOwnPropertyDescriptor(window, 'addEventListener')).toEqual({
      value: undefined,
      writable: true,
      enumerable: true,
      configurable: true,
    });
    expect(Object.getOwnPropertyDescriptor(document, 'removeEventListener')).toEqual({
      value: undefined,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  } finally {
    delete (globalThis as { window?: unknown }).window;
    delete (globalThis as { document?: unknown }).document;
    Object.defineProperty(globalThis, 'fetch', fetchDescriptor);
  }
});

it('honors fetch and baseDir options across repeated setups', async () => {
  const firstDir = await mkdtemp(join(tmpdir(), 'webgl-first-'));
  const secondDir = await mkdtemp(join(tmpdir(), 'webgl-second-'));
  await writeFile(join(firstDir, 'value.txt'), 'first');
  await writeFile(join(secondDir, 'value.txt'), 'second');
  try {
    const originalFetch = globalThis.fetch;
    const disabled = await environment.setup(globalThis, { webglNode: { fetch: false, baseDir: firstDir } });
    expect(globalThis.fetch).toBe(originalFetch);
    await disabled.teardown(globalThis);

    const first = await environment.setup(globalThis, { webglNode: { baseDir: firstDir } });
    expect(await (await fetch('value.txt')).text()).toBe('first');
    expect((await fetch('missing.txt')).status).toBe(404);
    expect(await (await fetch(new URL('data:text/plain,remote'))).text()).toBe('remote');
    await first.teardown(globalThis);

    const second = await environment.setup(globalThis, { webglNode: { baseDir: secondDir } });
    expect(await (await fetch('value.txt')).text()).toBe('second');
    await second.teardown(globalThis);
    expect(globalThis.fetch).toBe(originalFetch);
  } finally {
    await Promise.all([rm(firstDir, { recursive: true }), rm(secondDir, { recursive: true })]);
  }
});

it('warns when backend or api options cannot be applied to an already-initialised display', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    const display = getDisplayInfo()!;
    const same = await environment.setup(globalThis, {
      webglNode: { backend: display.backend as never, api: display.api },
    });
    await same.teardown(globalThis);
    const generic = await environment.setup(globalThis, { webglNode: { backend: 'default', api: 'auto' } });
    await generic.teardown(globalThis);
    expect(warn).not.toHaveBeenCalled();

    const other = display.backend === 'null' ? 'swiftshader' : 'null';
    const different = await environment.setup(globalThis, { webglNode: { backend: other } });
    await different.teardown(globalThis);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]![0]).toMatch(
      new RegExp(`ignoring backend "${other}": the GL display was already initialised .*backend "${display.backend}"`),
    );
  } finally {
    warn.mockRestore();
  }
});

it('destroys contexts from DOM, offscreen, constructor and imported canvases on teardown', async () => {
  const original = Canvas.prototype.getContext;
  const { teardown } = environment.setup(globalThis, {});
  const getContext = Canvas.prototype.getContext;
  const canvases = [document.createElement('canvas'), new OffscreenCanvas(4, 4), new Canvas(4, 4), createCanvas(4, 4)];
  const contexts = canvases.map((canvas) => canvas.getContext('webgl2')!);
  try {
    expect(contexts.every(Boolean)).toBe(true);
    await teardown(globalThis);
    expect(contexts.map((context) => (context as unknown as { _destroyed: boolean })._destroyed)).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect(Canvas.prototype.getContext).toBe(original);
    expect(() => getContext.call(canvases[0]! as Canvas, 'webgl2')).toThrow(/torn down/);
  } finally {
    canvases.forEach((canvas) => (canvas as unknown as Canvas).dispose());
    await teardown(globalThis);
  }
});

it('cancels pending animation frames and prevents stale frame loops after teardown', async () => {
  vi.useFakeTimers();
  const { teardown } = environment.setup(globalThis, {});
  const frame = globalThis.requestAnimationFrame;
  const callback = vi.fn();
  try {
    frame(callback);
    await teardown(globalThis);
    vi.advanceTimersByTime(100);
    expect(callback).not.toHaveBeenCalled();
    frame(callback);
    vi.advanceTimersByTime(100);
    expect(callback).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    await teardown(globalThis);
    vi.useRealTimers();
  }
});

it('preserves existing contexts and host animation frame functions', async () => {
  const canvas = createCanvas(4, 4);
  const context = canvas.getContext('webgl2')!;
  const frame = vi.fn();
  const cancel = vi.fn();
  Object.defineProperty(globalThis, 'requestAnimationFrame', { value: frame, writable: true, configurable: true });
  Object.defineProperty(globalThis, 'cancelAnimationFrame', { value: cancel, writable: true, configurable: true });
  try {
    const { teardown } = environment.setup(globalThis, {});
    expect(canvas.getContext('webgl2')).toBe(context);
    expect(globalThis.requestAnimationFrame).toBe(frame);
    await teardown(globalThis);
    expect(context._destroyed).toBe(false);
    expect(globalThis.cancelAnimationFrame).toBe(cancel);
  } finally {
    canvas.dispose();
    delete (globalThis as { requestAnimationFrame?: unknown }).requestAnimationFrame;
    delete (globalThis as { cancelAnimationFrame?: unknown }).cancelAnimationFrame;
  }
});

it('runs and cancels frames using the configured interval', async () => {
  vi.useFakeTimers();
  const { teardown } = environment.setup(globalThis, { webglNode: { frameInterval: 5 } });
  try {
    const canceled = vi.fn();
    cancelAnimationFrame(requestAnimationFrame(canceled));
    const callback = vi.fn();
    requestAnimationFrame(callback);
    vi.advanceTimersByTime(4);
    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledOnce();
    expect(canceled).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    await teardown(globalThis);
    vi.useRealTimers();
  }
});

it('restores the parent canvas wrapper after nested teardown and makes teardown idempotent', async () => {
  const first = environment.setup(globalThis, {});
  const canvas = createCanvas(4, 4);
  const parent = canvas.getContext('webgl2')!;
  const second = environment.setup(globalThis, {});
  const child = createCanvas(4, 4).getContext('webgl2')!;
  await second.teardown(globalThis);
  await second.teardown(globalThis);
  expect(child._destroyed).toBe(true);
  expect(parent._destroyed).toBe(false);
  const later = createCanvas(4, 4).getContext('webgl2')!;
  await first.teardown(globalThis);
  expect(parent._destroyed).toBe(true);
  expect(later._destroyed).toBe(true);
});

it('restores the canvas prototype when DOM installation fails', () => {
  const original = Canvas.prototype.getContext;
  const window = Object.freeze({ addEventListener: undefined });
  Object.defineProperty(globalThis, 'window', { value: window, configurable: true });
  try {
    expect(() => environment.setup(globalThis, {})).toThrow(TypeError);
    expect(Canvas.prototype.getContext).toBe(original);
    expect(globalThis.window).toBe(window);
    expect(globalThis.document).toBeUndefined();
  } finally {
    delete (globalThis as { window?: unknown }).window;
  }
});
