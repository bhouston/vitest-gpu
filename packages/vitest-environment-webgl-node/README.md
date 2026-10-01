# vitest-environment-webgl-node

[![npm version][npm-badge]][npm-url]
[![npm downloads][downloads-badge]][npm-url]
[![Tests][tests-badge]][tests-url]
[![Coverage][coverage-badge]][coverage-url]
[![Discord][discord-badge]][discord-url]

Run real WebGL 1 and WebGL 2 tests in Vitest on Node, without a browser, Playwright or canvas mocks.
Headless GPU testing for CI: `canvas.getContext('webgl2')` returns a GPU-backed context, so three.js,
regl, PixiJS and plain WebGL code run unchanged. Native GPU testing is up to 2.4x faster than running
the same tests in a browser, see the
[blog post](https://ben3d.ca/blog/native-gpu-testing-for-vitest-and-jest).
Powered by [`@onirenaud/node-webgl`](https://github.com/RenaudRohlinger/node-webgl) (Chrome's ANGLE,
statically linked).

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

The environment installs `window`, `document`, `HTMLCanvasElement`, `Image`, `requestAnimationFrame`,
the `WebGL*` classes and a file-reading `fetch()` before each test file, and removes them afterwards.

Using Jest instead? See the equivalent
[`jest-environment-webgl-node`](https://github.com/bhouston/jest-gpu/tree/main/packages/jest-environment-webgl-node)
in [jest-gpu](https://github.com/bhouston/jest-gpu).

## Stability

As of 1.0.0, the public API (the environment export and its options) is considered stable.
Breaking changes will be released as a new major version.

## Compared to alternatives

| Approach                                                  | Real rendering | Notes                                                                                                                            |
| --------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| jsdom plus a canvas mock (`jest-webgl-canvas-mock`, etc.) | No             | Fast and light, but `getContext()` returns stubs: you can assert calls, not pixels or shader results.                            |
| Raw [`gl`](https://github.com/stackgl/headless-gl)        | Yes            | WebGL 1 only (per node-webgl's docs), runs on the system OpenGL driver, and you wire up the DOM globals yourself.                |
| Vitest browser mode or Playwright                         | Yes            | A real browser: heavier to install and slower to start, and the right choice when you need real browser APIs.                    |
| vitest-environment-webgl-node                             | Yes            | ANGLE in the Node process, WebGL 1 and 2. Not a browser: only canvas, `Image`, `fetch` and `requestAnimationFrame` are provided. |

## Supported versions and platforms

- Vitest 4 and 5 (CI tests both). Vitest 3 is not supported.
- Node 22 or later. CI runs Node 22 and 26 on `macos-latest` and `ubuntu-latest`.
- macOS uses Metal. Linux uses Mesa (see below). Windows uses Direct3D 11 per the
  [node-webgl docs](https://github.com/RenaudRohlinger/node-webgl#platforms); this repo's CI does not run on Windows.

## Useful for

three.js `WebGLRenderer`, Babylon.js, regl, PixiJS, deck.gl and plain WebGL code. The demos exercise three.js and
Babylon.js; node-webgl's docs name regl, PixiJS and deck.gl. These are compatible use cases, not endorsements.

## Usage

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'webgl-node',
    environmentOptions: { webglNode: { backend: 'swiftshader', baseDir: 'assets' } },
  },
});
```

```ts
import * as THREE from 'three';
import { expect, it } from 'vitest';

it('renders', () => {
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas });
  renderer.setSize(64, 64, false);
  renderer.render(new THREE.Scene(), new THREE.PerspectiveCamera());
  expect(canvas.getImageData().width).toBe(64);
});
```

Options are those of node-webgl's `init()` (`backend`, `api`) and `installDOM()`
(`baseDir`, `fetch`, `devicePixelRatio`, `innerWidth`, `innerHeight`, `frameInterval`).

For a Node-only TypeScript project, opt into types for the installed globals by adding
`import 'vitest-environment-webgl-node/globals';` to a `.d.ts` file your tsconfig includes. Do not include
this entry in projects that load TypeScript's DOM library: the real browser globals and node-webgl's shims
intentionally have different types. DOM projects can use their standard global declarations and cast a
node-webgl canvas at the library boundary when necessary.

On Linux CI install Mesa (`apt-get install libegl1 libgles2 libgl1-mesa-dri`) and set
`LIBGL_ALWAYS_SOFTWARE=1`. macOS and Windows use prebuilt binaries.

## Image snapshots

Pair with [`vitest-screenshot`](../vitest-screenshot) to diff the canvas against a committed baseline:

```ts
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
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshNormalMaterial()));

  renderer.render(scene, camera);
  await expect(canvas).toMatchScreenshot('cube.png');
  renderer.dispose();
});
```

## See also

- [`vitest-environment-webgpu-node`](../vitest-environment-webgpu-node) for headless WebGPU.
- [`vitest-screenshot`](../vitest-screenshot) for `toMatchScreenshot()`.
- [`demo/`](../../demo/test/webgl) for WebGL contexts, uploads, readbacks, three.js and Babylon.js tests, and the
  [repository README](../../README.md).

## Author

Created by [Ben Houston](https://ben3d.ca) and sponsored by [Land of Assets](https://landofassets.com).

## License

MIT

[npm-badge]: https://img.shields.io/npm/v/vitest-environment-webgl-node.svg
[npm-url]: https://www.npmjs.com/package/vitest-environment-webgl-node
[downloads-badge]: https://img.shields.io/npm/dm/vitest-environment-webgl-node.svg
[tests-badge]: https://github.com/bhouston/vitest-gpu/actions/workflows/ci.yml/badge.svg
[tests-url]: https://github.com/bhouston/vitest-gpu/actions/workflows/ci.yml
[discord-badge]: https://img.shields.io/badge/Discord-Join%20Chat-5865F2?logo=discord&logoColor=white
[discord-url]: https://discord.gg/fwupDN493R
[coverage-badge]: https://codecov.io/gh/bhouston/vitest-gpu/branch/main/graph/badge.svg
[coverage-url]: https://codecov.io/gh/bhouston/vitest-gpu
