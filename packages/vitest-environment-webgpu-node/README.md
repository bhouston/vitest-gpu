# vitest-environment-webgpu-node

Real, headless WebGPU inside Vitest, with no browser. Powered by Google's Dawn through the
[`webgpu`](https://github.com/dawn-gpu/node-webgpu) npm package.

The environment puts `navigator.gpu` and every `GPU*` class and constant (`GPUBufferUsage`,
`GPUShaderStage`, ...) on the global object before each test file and removes them afterwards.

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

There is no `<canvas>`: render to a `GPUTexture`, copy it to a buffer and read it back. Pair with
[`vitest-screenshot`](../vitest-screenshot) for pixel-diff assertions on that buffer.
