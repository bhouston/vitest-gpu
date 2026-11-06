---
sidebar_position: 2
description: The webgl-node Vitest environment gives tests a real headless WebGL 1 and 2 context in Node through ANGLE, with window, document, canvas and fetch installed.
---

# WebGL

`vitest-environment-webgl-node` is headless WebGL 1 and 2 for Vitest. `canvas.getContext('webgl2')` returns a GPU-backed context, so three.js, regl, PixiJS and plain WebGL code run unchanged. It is powered by [`@onirenaud/node-webgl`](https://github.com/RenaudRohlinger/node-webgl), which statically links Chrome's ANGLE.

```sh
pnpm add -D vitest vitest-environment-webgl-node
```

```ts title="vitest.config.ts"
import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { environment: 'webgl-node' } });
```

## What the environment provides

Before each test file the environment installs `window`, `document`, `HTMLCanvasElement`, `Image`, `requestAnimationFrame`, the `WebGL*` classes and a file-reading `fetch()`. It removes them afterwards.

It is not a browser. The DOM surface is canvas, `Image`, `fetch` and `requestAnimationFrame`. Use Vitest browser mode or Playwright when you need real browser APIs or layout.

## Options

Pass options under `environmentOptions.webglNode`:

```ts title="vitest.config.ts"
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'webgl-node',
    environmentOptions: { webglNode: { baseDir: 'assets' } },
  },
});
```

The options are those of node-webgl's `init()` (`backend`, `api`) and `installDOM()` (`baseDir`, `fetch`, `devicePixelRatio`, `innerWidth`, `innerHeight`, `frameInterval`).

The GL display is initialised once per process. If a later test file asks for a different `backend` or `api`, the environment logs a warning and keeps the first one. Give every test file the same options, or run files in isolation.

## Render with three.js

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

`canvas.getImageData()` returns the rendered pixels, which is also what [`toMatchScreenshot()`](./screenshots.md) reads.

## Other libraries

This repository's demos exercise three.js (`WebGLRenderer`) and Babylon.js. The WebGL backend's upstream docs also name regl, PixiJS and deck.gl. These are compatible use cases, not endorsements.

## TypeScript types for the globals

For a Node-only TypeScript project, opt into types for the installed globals by adding this to a `.d.ts` file your tsconfig includes:

```ts
import 'vitest-environment-webgl-node/globals';
```

Do not include this entry in projects that load TypeScript's DOM library: the real browser globals and node-webgl's shims intentionally have different types. DOM projects can use their standard global declarations and cast a node-webgl canvas at the library boundary when necessary.

## Platforms

- Vitest 4 and 5. Node 22 or later.
- macOS uses Metal. Windows uses Direct3D 11 per the [node-webgl docs](https://github.com/RenaudRohlinger/node-webgl#platforms).
- Linux without a GPU needs Mesa and `LIBGL_ALWAYS_SOFTWARE=1`, see [CI](./ci.md).

## Resource cleanup

Environment teardown destroys contexts first created through `Canvas.getContext()` during the test file, including DOM canvases, `OffscreenCanvas` and imported canvas factories. It also cancels pending callbacks scheduled through its animation-frame shim.

Contexts created directly with the WebGL context constructors, or before setup, remain your responsibility: call `destroy()` on them. Dispose renderers and canvases during a long-running file to release resources sooner.

## Compared to alternatives

| Approach                                                  | Real rendering | Notes                                                                                                                            |
| --------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| jsdom plus a canvas mock (`jest-webgl-canvas-mock`, etc.) | No             | Fast and light, but `getContext()` returns stubs: you can assert calls, not pixels or shader results.                            |
| Raw [`gl`](https://github.com/stackgl/headless-gl)        | Yes            | WebGL 1 only (per node-webgl's docs), runs on the system OpenGL driver, and you wire up the DOM globals yourself.                |
| Vitest browser mode or Playwright                         | Yes            | A real browser: heavier to install and slower to start, and the right choice when you need real browser APIs.                    |
| vitest-environment-webgl-node                             | Yes            | ANGLE in the Node process, WebGL 1 and 2. Not a browser: only canvas, `Image`, `fetch` and `requestAnimationFrame` are provided. |

Using Jest instead? See [`jest-environment-webgl-node`](https://jest-gpu.ben3d.ca/docs/webgl/) in jest-gpu.
