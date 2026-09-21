import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getDisplayInfo } from '@onirenaud/node-webgl';
import { expect, it, vi } from 'vitest';
import environment from './index.ts';

const listener = () => {};

it('declares the SSR loader metadata required by Vitest 3 and 4', () => {
  expect(environment.transformMode).toBe('ssr');
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
