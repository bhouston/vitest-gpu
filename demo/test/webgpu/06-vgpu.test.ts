// @vitest-environment webgpu-node

import { effect, frame, init, target } from 'vgpu';
import { expect, it } from 'vitest';
import { extendMatchers } from 'vitest-screenshot';

extendMatchers();

// vgpu's browser entry point finds the environment's navigator.gpu; no vgpu/node or Dawn download needed.
it('renders a fullscreen effect with vgpu and reads the target back', async () => {
  const gpu = await init();
  const size = 64;
  const colorTarget = target(gpu, { size: [size, size], format: 'rgba8unorm' });
  const gradient = effect(
    gpu,
    /* wgsl */ `@fragment fn fs(@builtin(position) p: vec4f) -> @location(0) vec4f { return vec4f(p.xy / ${size}.0, 0.0, 1.0); }`,
  );
  frame(gpu, (f) => f.pass(colorTarget, gradient));
  const data = new Uint8Array(await colorTarget.color.read({ mipLevel: 0, region: 'all' }));
  expect(data.length).toBe(size * size * 4);
  // A smooth gradient: judge overall error (PSNR in dB) rather than counting pixels that round differently.
  await expect({ width: size, height: size, data }).toMatchScreenshot('vgpu-gradient.png', {
    comparatorName: 'metrics',
    comparatorOptions: { PSNR: 40 },
  });
  gpu.dispose();
});
