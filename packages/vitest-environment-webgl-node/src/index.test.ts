import { expect, it } from 'vitest';
import environment from './index.ts';

it('installs the DOM shim with a real WebGL2 canvas and removes it on teardown', async () => {
  expect(globalThis.document).toBeUndefined();
  const { teardown } = await environment.setup(globalThis, { webglNode: { innerWidth: 320, api: 'auto' } });
  expect(globalThis.window.innerWidth).toBe(320);
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
