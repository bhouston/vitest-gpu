import { expect, it } from 'vitest';

// Baby step 3: run a compute shader and read the result back with mapAsync.
it('runs a compute shader and downloads the result', async () => {
  const device = await (await navigator.gpu.requestAdapter())!.requestDevice();
  const input = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]);
  const storage = device.createBuffer({
    size: input.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
  });
  device.queue.writeBuffer(storage, 0, input);

  const module = device.createShaderModule({
    code: /* wgsl */ `
      @group(0) @binding(0) var<storage, read_write> data: array<f32>;
      @compute @workgroup_size(8) fn main(@builtin(global_invocation_id) id: vec3u) { data[id.x] = data[id.x] * 2.0; }`,
  });
  const pipeline = device.createComputePipeline({ layout: 'auto', compute: { module } });
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: storage } }],
  });

  const readback = device.createBuffer({
    size: input.byteLength,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(1);
  pass.end();
  encoder.copyBufferToBuffer(storage, 0, readback, 0, input.byteLength);
  device.queue.submit([encoder.finish()]);

  await readback.mapAsync(GPUMapMode.READ);
  expect(Array.from(new Float32Array(readback.getMappedRange()))).toEqual([2, 4, 6, 8, 10, 12, 14, 16]);
  readback.unmap();
  device.destroy();
});
