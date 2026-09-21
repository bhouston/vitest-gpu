// @vitest-environment webgpu-node

import { expect, it } from 'vitest';
import { extendMatchers } from 'vitest-screenshot';

extendMatchers();

const shader = /* wgsl */ `
  @vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
    let p = array(vec2f(-0.8, -0.8), vec2f(0.8, -0.8), vec2f(0, 0.8));
    return vec4f(p[i], 0, 1);
  }
  @fragment fn fs() -> @location(0) vec4f { return vec4f(1, 0.5, 0, 1); }
`;

it('renders a triangle to a texture and reads it back', async () => {
  const size = 64;
  const device = await (await navigator.gpu.requestAdapter())!.requestDevice();
  const texture = device.createTexture({
    size: [size, size],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
  });
  const module = device.createShaderModule({ code: shader });
  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module },
    fragment: { module, targets: [{ format: 'rgba8unorm' }] },
  });
  const readback = device.createBuffer({
    size: size * size * 4,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [{ view: texture.createView(), loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0.2, 1] }],
  });
  pass.setPipeline(pipeline);
  pass.draw(3);
  pass.end();
  encoder.copyTextureToBuffer({ texture }, { buffer: readback, bytesPerRow: size * 4 }, [size, size]);
  device.queue.submit([encoder.finish()]);
  await readback.mapAsync(GPUMapMode.READ);
  const data = new Uint8Array(readback.getMappedRange()).slice();
  readback.unmap();
  device.destroy();
  expect(Array.from(data.subarray(0, 4))).toEqual([0, 0, 51, 255]);
  // Edge pixels rasterize differently per GPU: allow up to 1% of them to differ by more than 10% in colour.
  await expect({ width: size, height: size, data }).toMatchScreenshot('triangle.png', {
    comparatorName: 'metrics',
    comparatorOptions: { fuzz: 0.1, AE: size * size * 0.01 },
  });
});
