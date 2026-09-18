# vitest-environment-webgl-node

Real, headless WebGL 1 and WebGL 2 inside Vitest, with no browser. Powered by
[`@onirenaud/node-webgl`](https://github.com/RenaudRohlinger/node-webgl) (Chrome's ANGLE, statically linked).

The environment installs `window`, `document`, `HTMLCanvasElement`, `Image`, `requestAnimationFrame`,
the `WebGL*` classes and a file-reading `fetch()` before each test file, and removes them afterwards.
`document.createElement('canvas').getContext('webgl2')` returns a GPU-backed context, so three.js,
regl, pixi and plain WebGL code run unchanged.

## Install

```sh
pnpm add -D vitest vitest-environment-webgl-node
```

## Usage

```ts
// vitest.config.ts
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
Pair with [`vitest-screenshot`](../vitest-screenshot) for pixel-diff assertions.

On Linux CI install Mesa (`apt-get install libegl1 libgles2 libgl1-mesa-dri`) and set
`LIBGL_ALWAYS_SOFTWARE=1`. macOS and Windows use prebuilt binaries.
