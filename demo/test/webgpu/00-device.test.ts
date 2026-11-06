// @vitest-environment webgpu-node

import { expect, it } from 'vitest';

// Baby step 1: is there a GPU? The environment put Dawn behind navigator.gpu.
it('finds a WebGPU adapter and creates a device', async () => {
  const adapter = await navigator.gpu.requestAdapter();
  expect(adapter).not.toBeNull();
  console.log('WebGPU adapter:', adapter!.info.vendor, adapter!.info.architecture, adapter!.info.device);
  // Software adapters are fine on GPU-less CI (lavapipe, WARP), but never SwiftShader.
  const { vendor, architecture, device: deviceName, description } = adapter!.info;
  expect([vendor, architecture, deviceName, description].join(' ')).not.toMatch(/swiftshader/i);
  expect(adapter!.limits.maxTextureDimension2D).toBeGreaterThanOrEqual(2048);
  const device = await adapter!.requestDevice();
  expect(device.queue).toBeDefined();
  expect(navigator.gpu.getPreferredCanvasFormat()).toMatch(/^(rgba|bgra)8unorm$/);
  device.destroy();
});
