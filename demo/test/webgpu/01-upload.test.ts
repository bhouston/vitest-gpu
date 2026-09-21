// @vitest-environment webgpu-node

import { expect, it } from 'vitest';

// Baby step 2: get data onto the GPU with queue.writeBuffer and queue.writeTexture.
it('uploads a buffer and a texture', async () => {
  const device = await (await navigator.gpu.requestAdapter())!.requestDevice();

  const values = new Float32Array([1.5, 2.5, 3.5, 4.5]);
  const buffer = device.createBuffer({
    size: values.byteLength,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
  });
  device.queue.writeBuffer(buffer, 0, values);

  const texture = device.createTexture({
    size: [2, 2],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC,
  });
  const pixels = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]);
  device.queue.writeTexture({ texture }, pixels, { bytesPerRow: 8 }, [2, 2]);

  // Prove it landed by copying back (see 02-download for the readback pattern).
  const bufferCopy = device.createBuffer({ size: 16, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
  const textureCopy = device.createBuffer({ size: 256 * 2, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
  const encoder = device.createCommandEncoder();
  encoder.copyBufferToBuffer(buffer, 0, bufferCopy, 0, 16);
  encoder.copyTextureToBuffer({ texture }, { buffer: textureCopy, bytesPerRow: 256 }, [2, 2]);
  device.queue.submit([encoder.finish()]);

  await Promise.all([bufferCopy.mapAsync(GPUMapMode.READ), textureCopy.mapAsync(GPUMapMode.READ)]);
  expect(Array.from(new Float32Array(bufferCopy.getMappedRange()))).toEqual([1.5, 2.5, 3.5, 4.5]);
  const rows = new Uint8Array(textureCopy.getMappedRange());
  expect(Array.from(rows.subarray(0, 8))).toEqual(Array.from(pixels.subarray(0, 8)));
  expect(Array.from(rows.subarray(256, 264))).toEqual(Array.from(pixels.subarray(8, 16)));
  device.destroy();
});
