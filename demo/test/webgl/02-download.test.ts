// @vitest-environment webgl-node

import { expect, it } from 'vitest';

// Baby step 3: get data back from the GPU, from the framebuffer and from a buffer object.
it('downloads pixels and buffer contents', () => {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 4;
  const gl = canvas.getContext('webgl2')!;
  gl.clearColor(0, 0.5, 1, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  const pixels = new Uint8Array(4 * 4 * 4);
  gl.readPixels(0, 0, 4, 4, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  expect(Array.from(pixels.subarray(0, 4))).toEqual([0, 128, 255, 255]);
  expect(canvas.getImageData().data.length).toBe(64);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([1, 2, 3, 4]), gl.STATIC_DRAW);
  const out = new Float32Array(4);
  gl.getBufferSubData(gl.ARRAY_BUFFER, 0, out);
  expect(Array.from(out)).toEqual([1, 2, 3, 4]);
});
