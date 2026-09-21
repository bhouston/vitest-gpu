# vitest-environment-webgpu-node

Real, headless WebGPU inside Vitest, with no browser. Powered by Google's Dawn through the
[`webgpu`](https://github.com/dawn-gpu/node-webgpu) npm package.

The environment puts `navigator.gpu` and every `GPU*` class and constant (`GPUBufferUsage`,
`GPUShaderStage`, ...) on the global object before each test file and removes them afterwards.

Using Jest instead? See the equivalent
[`jest-environment-webgpu-node`](https://github.com/bhouston/jest-gpu/tree/main/packages/jest-environment-webgpu-node)
in [jest-gpu](https://github.com/bhouston/jest-gpu).

## Install

```sh
pnpm add -D vitest vitest-environment-webgpu-node
```

## Usage

```ts
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'webgpu-node',
    environmentOptions: { webgpuNode: { dawnOptions: ['backend=vulkan'] } },
  },
});
```

```ts
import { expect, it } from 'vitest';

it('runs a compute shader', async () => {
  const device = await (await navigator.gpu.requestAdapter())!.requestDevice();
  // ...createShaderModule, dispatch, copy to a MAP_READ buffer, mapAsync, assert
});
```

`dawnOptions` are passed straight to Dawn: `backend=<null|d3d11|d3d12|metal|vulkan|opengl|opengles>`,
`adapter=<name>`, `enable-dawn-features=...`, `disable-dawn-features=...`.

## Canvas

Dawn has no `<canvas>`, so the environment ships a headless one whose `getContext('webgpu')` returns a
`GPUCanvasContext` backed by a texture. `document.createElement('canvas')`, `HTMLCanvasElement`, `window`,
`self` and `requestAnimationFrame` are installed too (only when missing), which is enough for three.js
`WebGPURenderer`, Babylon Lite and vgpu to run unchanged.

```ts
import * as THREE from 'three/webgpu';
import { createCanvas } from 'vitest-environment-webgpu-node';

const canvas = createCanvas(256, 256);
const renderer = new THREE.WebGPURenderer({ canvas: canvas.asElement() });
await renderer.init();
await renderer.renderAsync(scene, camera);
await expect(canvas).toMatchScreenshot('scene.png');
```

`readPixels()` returns `{ width, height, data }` RGBA8 pixels, ready for
[`vitest-screenshot`](../vitest-screenshot). `asElement()` is the same object typed as an
`HTMLCanvasElement` for library signatures that demand one.

## License

MIT
