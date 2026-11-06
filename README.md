<p align="center">
  <a href="https://npmjs.com/package/vitest-environment-webgpu-node"><img src="https://img.shields.io/npm/v/vitest-environment-webgpu-node.svg" alt="npm package"></a>
  <a href="https://www.npmtrends.com/vitest-environment-webgpu-node"><img src="https://img.shields.io/npm/dw/vitest-environment-webgpu-node.svg" alt="npm downloads"></a>
  <a href="https://codecov.io/gh/bhouston/vitest-gpu"><img src="https://codecov.io/gh/bhouston/vitest-gpu/branch/main/graph/badge.svg" alt="coverage"></a>
  <a href="https://discord.gg/fwupDN493R"><img src="https://img.shields.io/badge/chat-discord-blue?style=flat&logo=discord" alt="discord chat"></a>
</p>
<br/>

# vitest-gpu

> Real WebGL and WebGPU tests in Vitest, with no browser.

- 🖥️ Real GPU in Node
- 🚫 No Browser or Mocks
- 🎨 WebGL 1, 2 and WebGPU
- 🖼️ Image Snapshot Matcher
- ⚡ Up to 2.4x Faster Than Browsers

Headless GPU testing for CI: two Vitest environments put a GPU-backed context on `globalThis`, and a matcher
diffs the pixels you read back against committed image baselines (png recommended; jpg, gif and webp also work).
Native GPU testing is up to 2.4x faster than running the same tests in a browser, see the
[blog post](https://ben3d.ca/blog/native-gpu-testing-for-vitest-and-jest).

## Packages

| Package                                                                     | Version (click for changelogs)                                                                                                                                          |
| --------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`vitest-environment-webgpu-node`](packages/vitest-environment-webgpu-node) | [![vitest-environment-webgpu-node version](https://img.shields.io/npm/v/vitest-environment-webgpu-node.svg?label=%20)](https://github.com/bhouston/vitest-gpu/releases) |
| [`vitest-environment-webgl-node`](packages/vitest-environment-webgl-node)   | [![vitest-environment-webgl-node version](https://img.shields.io/npm/v/vitest-environment-webgl-node.svg?label=%20)](https://github.com/bhouston/vitest-gpu/releases)   |
| [`vitest-screenshot`](packages/vitest-screenshot)                           | [![vitest-screenshot version](https://img.shields.io/npm/v/vitest-screenshot.svg?label=%20)](https://github.com/bhouston/vitest-gpu/releases)                           |

Each package does one job: `vitest-environment-webgl-node` is headless WebGL 1 and 2 (ANGLE) with `window`,
`document` and `canvas`; `vitest-environment-webgpu-node` is headless WebGPU (Google's Dawn) with `navigator.gpu`
and a headless canvas; `vitest-screenshot` is the `toMatchScreenshot()` image-snapshot matcher for canvases and
pixel data.

Using Jest instead? The equivalent packages live in [jest-gpu](https://github.com/bhouston/jest-gpu):
[`jest-environment-webgpu-node`](https://github.com/bhouston/jest-gpu/tree/main/packages/jest-environment-webgpu-node)
and [`jest-environment-webgl-node`](https://github.com/bhouston/jest-gpu/tree/main/packages/jest-environment-webgl-node).

## Quick start (WebGL)

```sh
pnpm add -D vitest vitest-environment-webgl-node
```

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { environment: 'webgl-node' } });
```

```ts
// gl.test.ts
import { expect, it } from 'vitest';

it('clears to red on a real GPU', () => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 4;
  const gl = canvas.getContext('webgl2')!;
  gl.clearColor(1, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  const pixel = new Uint8Array(4);
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
  expect([...pixel]).toEqual([255, 0, 0, 255]);
});
```

Run it with `pnpm exec vitest run`. For WebGPU, install `vitest-environment-webgpu-node` and set
`environment: 'webgpu-node'`; `navigator.gpu` is then available in every test.

## Compared to alternatives

| Approach                                                  | Real rendering | Notes                                                                                                                                                |
| --------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| jsdom plus a canvas mock (`jest-webgl-canvas-mock`, etc.) | No             | Fast and light, but `getContext()` returns stubs: you can assert calls, not pixels or shader results.                                                |
| Raw [`gl`](https://github.com/stackgl/headless-gl)        | Yes            | WebGL 1 only (per node-webgl's docs), runs on the system OpenGL driver, and you wire up the DOM globals yourself.                                    |
| Vitest browser mode or Playwright                         | Yes            | A real browser: heavier to install and slower to start, and the right choice when you need real browser APIs or layout.                              |
| vitest-gpu                                                | Yes            | ANGLE (WebGL 1 and 2) and Dawn (WebGPU) in the Node process. Not a browser: the DOM surface is canvas, `Image`, `fetch` and `requestAnimationFrame`. |

Output comes from a real GPU driver or a software rasterizer, so edges can differ slightly between
machines. Use a tolerance such as `allowedMismatchedPixelRatio` for baselines shared across machines.

## Supported versions and platforms

- **Vitest 4 and 5.** CI runs the suite against both (`vitest-compat` job). Vitest 3 is not supported:
  the environments implement only the `viteEnvironment` hook that Vitest 4 introduced.
- **Node 22 or later** (`engines`). CI runs Node 22 and 26.
- **macOS** uses Metal for both WebGL and WebGPU and needs no setup. CI runs `macos-latest`.
- **Linux** without a GPU needs Mesa and `LIBGL_ALWAYS_SOFTWARE=1`; WebGPU also needs Mesa's Vulkan
  driver (lavapipe). CI runs `ubuntu-latest` after:

  ```sh
  sudo apt-get update && sudo apt-get install -y libegl1 libgles2 libgl1-mesa-dri mesa-vulkan-drivers
  export LIBGL_ALWAYS_SOFTWARE=1
  ```

- **Windows** uses Direct3D for both WebGL and WebGPU, with the WARP software adapter on GPU-less machines. CI runs
  `windows-latest`.

## What it is useful for

Anything that talks to WebGL or WebGPU and can run unchanged in Node. This repo's demos exercise three.js
(`WebGLRenderer` and `WebGPURenderer`), Babylon.js, Babylon Lite and Vercel's vgpu. The WebGL backend's
upstream docs also name regl, PixiJS and deck.gl; twgl, luma.gl and TypeGPU use the same standard APIs but
are not covered by this repo's tests. Typical uses are shader and compute unit tests, texture upload and
readback checks, render-pipeline regression tests and image-snapshot tests of scenes in CI. Library names are
compatible use cases, not endorsements.

## Render and snapshot

Pair an environment with [`vitest-screenshot`](packages/vitest-screenshot) to compare the rendered canvas
against an image baseline. These examples render a three.js cube.

### WebGPU

```sh
pnpm add -D vitest vitest-environment-webgpu-node vitest-screenshot three
```

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { environment: 'webgpu-node' } });
```

```ts
// cube.test.ts
import * as THREE from 'three/webgpu';
import { expect, it } from 'vitest';
import { createCanvas } from 'vitest-environment-webgpu-node';
import { extendMatchers } from 'vitest-screenshot';

extendMatchers();

it('renders a cube', async () => {
  const canvas = createCanvas(256, 256);
  const renderer = new THREE.WebGPURenderer({ canvas: canvas.asElement() });
  await renderer.init();
  renderer.setSize(256, 256, false);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.z = 3;
  const cube = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshNormalMaterial());
  cube.rotation.set(0.4, 0.6, 0);
  scene.add(cube);

  await renderer.renderAsync(scene, camera);
  await expect(canvas).toMatchScreenshot('cube.png');
  renderer.dispose();
});
```

### WebGL

```sh
pnpm add -D vitest vitest-environment-webgl-node vitest-screenshot three
```

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { environment: 'webgl-node' } });
```

```ts
// cube.test.ts
import * as THREE from 'three';
import { expect, it } from 'vitest';
import { extendMatchers } from 'vitest-screenshot';

extendMatchers();

it('renders a cube', async () => {
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas });
  renderer.setSize(256, 256, false);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.z = 3;
  const cube = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshNormalMaterial());
  cube.rotation.set(0.4, 0.6, 0);
  scene.add(cube);

  renderer.render(scene, camera);
  await expect(canvas).toMatchScreenshot('cube.png');
  renderer.dispose();
});
```

Run either example with `pnpm exec vitest run`. The first local run creates a baseline in
`__screenshots__/` beside the test; commit it so later runs can compare against it.

For more examples, explore [`demo/`](demo): device checks, uploads, readbacks, triangles,
and screenshot tests using three.js, Babylon.js, Babylon Lite and Vercel's vgpu.

## Development

```sh
pnpm install
pnpm test            # builds packages, then runs every project including the demo
pnpm test:coverage
UPDATE_SCREENSHOTS=1 pnpm test   # rewrite baselines
pnpm package:check   # validates the npm package maps and dry-run packs each package
```

The native GPU packages are real dependencies, so tests need a GPU or a software rasterizer
(Metal on macOS, Mesa llvmpipe on Linux). Coverage must stay at or above 95% for statements,
branches, functions, and lines.

## Releases

See [RELEASING.md](RELEASING.md) for how releases are published and [GitHub Releases](https://github.com/bhouston/vitest-gpu/releases) for changes.

## Contribution

See [Contributing Guide](CONTRIBUTING.md).

## License

MIT

## Author

[Ben Houston](https://ben3d.ca), Sponsored by [Land of Assets](https://landofassets.com).
