# vitest-environment-webgl-node

Real, headless WebGL 1 and WebGL 2 inside Vitest, with no browser. Powered by
[`@onirenaud/node-webgl`](https://github.com/RenaudRohlinger/node-webgl) (Chrome's ANGLE, statically linked).

The environment installs `window`, `document`, `HTMLCanvasElement`, `Image`, `requestAnimationFrame`,
the `WebGL*` classes and a file-reading `fetch()` before each test file, and removes them afterwards.
`document.createElement('canvas').getContext('webgl2')` returns a GPU-backed context, so three.js,
regl, pixi and plain WebGL code run unchanged.

Using Jest instead? See the equivalent
[`jest-environment-webgl-node`](https://github.com/bhouston/jest-gpu/tree/main/packages/jest-environment-webgl-node)
in [jest-gpu](https://github.com/bhouston/jest-gpu).

## Install

```sh
pnpm add -D vitest vitest-environment-webgl-node
```

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
Pair with [`vitest-screenshot`](../vitest-screenshot) for pixel-diff assertions.

For a Node-only TypeScript project, opt into types for the installed globals by adding
`import 'vitest-environment-webgl-node/globals';` to a `.d.ts` file your tsconfig includes. Do not include
this entry in projects that load TypeScript's DOM library: the real browser globals and node-webgl's shims
intentionally have different types. DOM projects can use their standard global declarations and cast a
node-webgl canvas at the library boundary when necessary.

On Linux CI install Mesa (`apt-get install libegl1 libgles2 libgl1-mesa-dri`) and set
`LIBGL_ALWAYS_SOFTWARE=1`. macOS and Windows use prebuilt binaries.

## Author

Created by [Ben Houston](https://ben3d.ca) and sponsored by [Land of Assets](https://landofassets.com).

## License

MIT
