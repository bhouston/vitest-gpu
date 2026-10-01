# vitest-environment-webgpu-node

[![npm version][npm-badge]][npm-url]
[![npm downloads][downloads-badge]][npm-url]
[![Tests][tests-badge]][tests-url]
[![Coverage][coverage-badge]][coverage-url]
[![Discord][discord-badge]][discord-url]

Run real WebGPU tests in Vitest on Node, without a browser, Playwright or mocks. Headless GPU testing
for CI: `navigator.gpu` is backed by Google's Dawn through the
[`webgpu`](https://github.com/dawn-gpu/node-webgpu) npm package. Native GPU testing is up to 2.4x faster
than running the same tests in a browser, see the
[blog post](https://ben3d.ca/blog/native-gpu-testing-for-vitest-and-jest).

```sh
pnpm add -D vitest vitest-environment-webgpu-node
```

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { environment: 'webgpu-node' } });
```

```ts
// gpu.test.ts
import { expect, it } from 'vitest';

it('has a real GPU device', async () => {
  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter!.requestDevice();
  const buffer = device.createBuffer({ size: 16, usage: GPUBufferUsage.COPY_DST });
  expect(buffer.size).toBe(16);
});
```

The environment puts `navigator.gpu` and every `GPU*` class and constant (`GPUBufferUsage`,
`GPUShaderStage`, ...) on the global object before each test file and removes them afterwards.

Using Jest instead? See the equivalent
[`jest-environment-webgpu-node`](https://github.com/bhouston/jest-gpu/tree/main/packages/jest-environment-webgpu-node)
in [jest-gpu](https://github.com/bhouston/jest-gpu).

## Compared to alternatives

WebGPU has no mock equivalent of a canvas stub that runs shaders, so the realistic options are a browser or
Dawn in Node.

| Approach                          | Real rendering | Notes                                                                                                         |
| --------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------- |
| Hand-written `navigator.gpu` mock | No             | You can assert calls, not shader output or readbacks.                                                         |
| Vitest browser mode or Playwright | Yes            | A real browser with WebGPU enabled: heavier to install and slower to start; right when you need browser APIs. |
| vitest-environment-webgpu-node    | Yes            | Dawn in the Node process (Metal, Vulkan, D3D12 and others via `dawnOptions`). Not a browser.                  |

## Supported versions and platforms

- Vitest 4 and 5 (CI tests both). Vitest 3 is not supported.
- Node 22 or later. CI runs Node 22 and 26 on `macos-latest` and `ubuntu-latest`.
- Type checking needs TypeScript 6 or later (see [TypeScript types](#typescript-types)).
- Linux without a GPU needs Mesa's software Vulkan driver, see [Linux and CI](#linux-and-ci). This repo's CI does
  not run on Windows.

## Useful for

three.js `WebGPURenderer`, Babylon Lite, Vercel's vgpu and raw WebGPU compute or render code. The demos exercise
those three; other WebGPU libraries such as TypeGPU or luma.gl use the same API but are not covered by this
repo's tests. These are compatible use cases, not endorsements.

## Usage

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'webgpu-node',
    environmentOptions: { webgpuNode: { dawnOptions: ['backend=vulkan'] } },
  },
});
```

### TypeScript types

Requires TypeScript 6 or later, whose DOM library declares the WebGPU API. Include the DOM library in
`lib` (a project without it can add `@webgpu/types` to `types` instead):

```json
{
  "compilerOptions": {
    "lib": ["ES2024", "DOM"],
    "types": ["node"],
    "skipLibCheck": false
  }
}
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

## Linux and CI

Dawn needs Vulkan. On a Linux box or CI runner without a real GPU, install Mesa's software Vulkan
driver (lavapipe) and force software rendering:

```sh
sudo apt-get update && sudo apt-get install -y libegl1 libgles2 libgl1-mesa-dri mesa-vulkan-drivers
export LIBGL_ALWAYS_SOFTWARE=1
```

This repo's own [CI workflow](https://github.com/bhouston/vitest-gpu/blob/main/.github/workflows/ci.yml) does exactly this, so WebGPU tests run
for real (not mocked) on `ubuntu-latest` on every PR. macOS runners use Dawn's Metal backend and need no
extra setup.

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
[`vitest-screenshot`](https://github.com/bhouston/vitest-gpu/tree/main/packages/vitest-screenshot). Readback supports `rgba8unorm`, `rgba8unorm-srgb`,
`bgra8unorm`, and `bgra8unorm-srgb`; other canvas formats remain valid for rendering but
`readPixels()` rejects them with an unsupported-format error. `asElement()` returns the same object and
defaults to `HTMLCanvasElement` when DOM types are available. You can also request a library-specific type
explicitly with `canvas.asElement<HTMLCanvasElement>()`.

## Image snapshots

`await expect(canvas).toMatchScreenshot('scene.png')` comes from [`vitest-screenshot`](https://github.com/bhouston/vitest-gpu/tree/main/packages/vitest-screenshot).
Call `extendMatchers()` from it once, then pass the canvas as in the example above.

## See also

- [`vitest-environment-webgl-node`](https://github.com/bhouston/vitest-gpu/tree/main/packages/vitest-environment-webgl-node) for headless WebGL.
- [`vitest-screenshot`](https://github.com/bhouston/vitest-gpu/tree/main/packages/vitest-screenshot) for `toMatchScreenshot()`.
- [`demo/`](https://github.com/bhouston/vitest-gpu/tree/main/demo/test/webgpu) for device, upload, readback, triangle, three.js, Babylon Lite and vgpu tests,
  and the [repository README](https://github.com/bhouston/vitest-gpu#readme).

## Author

Created by [Ben Houston](https://ben3d.ca) and sponsored by [Land of Assets](https://landofassets.com).

## License

MIT

[npm-badge]: https://img.shields.io/npm/v/vitest-environment-webgpu-node.svg
[npm-url]: https://www.npmjs.com/package/vitest-environment-webgpu-node
[downloads-badge]: https://img.shields.io/npm/dm/vitest-environment-webgpu-node.svg
[tests-badge]: https://github.com/bhouston/vitest-gpu/actions/workflows/ci.yml/badge.svg
[tests-url]: https://github.com/bhouston/vitest-gpu/actions/workflows/ci.yml
[discord-badge]: https://img.shields.io/badge/Discord-Join%20Chat-5865F2?logo=discord&logoColor=white
[discord-url]: https://discord.gg/fwupDN493R
[coverage-badge]: https://codecov.io/gh/bhouston/vitest-gpu/branch/main/graph/badge.svg
[coverage-url]: https://codecov.io/gh/bhouston/vitest-gpu
