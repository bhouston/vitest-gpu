---
sidebar_position: 3
description: The webgpu-node Vitest environment backs navigator.gpu with Google's Dawn in Node and ships a headless canvas, so WebGPU tests run on a real GPU with no browser.
---

# WebGPU

`vitest-environment-webgpu-node` is headless WebGPU for Vitest. `navigator.gpu` is backed by Google's Dawn through the [`webgpu`](https://github.com/dawn-gpu/node-webgpu) npm package.

```sh
pnpm add -D vitest vitest-environment-webgpu-node
```

```ts title="vitest.config.ts"
import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { environment: 'webgpu-node' } });
```

```ts title="gpu.test.ts"
import { expect, it } from 'vitest';

it('has a real GPU device', async () => {
  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter!.requestDevice();
  const buffer = device.createBuffer({ size: 16, usage: GPUBufferUsage.COPY_DST });
  expect(buffer.size).toBe(16);
});
```

## What the environment provides

The environment puts `navigator.gpu` and every `GPU*` class and constant (`GPUBufferUsage`, `GPUShaderStage`, ...) on the global object before each test file, and removes them afterwards.

## Options

Pass options under `environmentOptions.webgpuNode`. `dawnOptions` are passed straight to Dawn:

```ts title="vitest.config.ts"
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'webgpu-node',
    environmentOptions: { webgpuNode: { dawnOptions: ['backend=vulkan'] } },
  },
});
```

Dawn accepts `backend=<null|d3d11|d3d12|metal|vulkan|opengl|opengles>`, `adapter=<name>`, `enable-dawn-features=...` and `disable-dawn-features=...`.

## TypeScript types

Type checking needs TypeScript 6 or later, whose DOM library declares the WebGPU API. Include the DOM library in `lib`. A project without it can add `@webgpu/types` to `types` instead:

```json
{
  "compilerOptions": {
    "lib": ["ES2024", "DOM"],
    "types": ["node"],
    "skipLibCheck": false
  }
}
```

## Headless canvas

Dawn has no `<canvas>`, so the environment ships a headless one whose `getContext('webgpu')` returns a `GPUCanvasContext` backed by a texture. `document.createElement('canvas')`, `HTMLCanvasElement`, `window`, `self` and `requestAnimationFrame` are installed too, only when missing. That is enough for three.js `WebGPURenderer`, Babylon Lite and Vercel's vgpu to run unchanged.

```ts
import * as THREE from 'three/webgpu';
import { createCanvas } from 'vitest-environment-webgpu-node';

const canvas = createCanvas(256, 256);
const renderer = new THREE.WebGPURenderer({ canvas: canvas.asElement() });
await renderer.init();
await renderer.renderAsync(scene, camera);
await expect(canvas).toMatchScreenshot('scene.png');
```

`readPixels()` returns `{ width, height, data }` RGBA8 pixels, ready for [`toMatchScreenshot()`](./screenshots.md). Readback supports `rgba8unorm`, `rgba8unorm-srgb`, `bgra8unorm` and `bgra8unorm-srgb`. Other canvas formats remain valid for rendering, but `readPixels()` rejects them with an unsupported-format error.

`asElement()` returns the same object and defaults to `HTMLCanvasElement` when DOM types are available. Request a library-specific type with `canvas.asElement<HTMLCanvasElement>()`.

See [`createCanvas`](./api/vitest-environment-webgpu-node.md) in the API reference.

## Other libraries

The demos exercise three.js `WebGPURenderer`, Babylon Lite and Vercel's vgpu. Other WebGPU libraries such as TypeGPU or luma.gl use the same API but are not covered by this repository's tests. These are compatible use cases, not endorsements.

## Platforms

- Vitest 4 and 5. Node 22 or later.
- macOS uses Dawn's Metal backend and needs no setup.
- Linux without a GPU needs Mesa's software Vulkan driver (lavapipe), see [CI](./ci.md).

## Resource cleanup

Environment teardown destroys devices requested through its `navigator.gpu` and cancels pending callbacks scheduled through its animation-frame shim. Device requests that finish after teardown are destroyed and rejected. Devices created through another GPU instance remain your responsibility. Keep disposing renderers, buffers, textures and devices during long-running files to release resources sooner.

## Compared to alternatives

WebGPU has no mock equivalent of a canvas stub that runs shaders, so the realistic options are a browser or Dawn in Node.

| Approach                          | Real rendering | Notes                                                                                                         |
| --------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------- |
| Hand-written `navigator.gpu` mock | No             | You can assert calls, not shader output or readbacks.                                                         |
| Vitest browser mode or Playwright | Yes            | A real browser with WebGPU enabled: heavier to install and slower to start; right when you need browser APIs. |
| vitest-environment-webgpu-node    | Yes            | Dawn in the Node process (Metal, Vulkan, D3D12 and others via `dawnOptions`). Not a browser.                  |

Using Jest instead? See [`jest-environment-webgpu-node`](https://jest-gpu.ben3d.ca/docs/webgpu/) in jest-gpu.
