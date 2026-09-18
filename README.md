# vitest-gpu

[![Tests][tests-badge]][tests-url]
[![Coverage][coverage-badge]][coverage-url]

Run real WebGL and WebGPU code inside plain Vitest, with no browser, no Playwright and no mocks.
Two Vitest environments put a GPU-backed context on `globalThis`, and a matcher diffs the pixels
you read back against committed image baselines (png recommended; jpg, gif and webp also work).

| Package                                                                     | What it does                                                                                |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [`vitest-environment-webgl-node`](packages/vitest-environment-webgl-node)   | `document.createElement('canvas').getContext('webgl2')` via ANGLE (`@onirenaud/node-webgl`) |
| [`vitest-environment-webgpu-node`](packages/vitest-environment-webgpu-node) | `navigator.gpu` and the `GPU*` globals via Dawn (`webgpu`)                                  |
| [`vitest-screenshot`](packages/vitest-screenshot)                           | `await expect(canvas).toMatchScreenshot('x.png')` pixel-diff matcher, backend-agnostic      |

The [`demo/`](demo) workspace walks up in baby steps for each API: is there a device, upload data,
download data, draw a triangle, then real libraries: three.js (`WebGLRenderer` and `WebGPURenderer`),
Babylon.js (WebGL `Engine`), Babylon Lite (WebGPU) and Vercel's vgpu, each snapshotted.

## Why environments rather than browser mode

Vitest browser mode drives a real browser through a provider; its shape is `openPage`/`close`.
What node-webgl and Dawn give you is what `jsdom` gives you: globals in a Node process. So these
are environments, selected with `test.environment`, and the screenshot matcher is separate so it
works with browser mode too.

## Why two environments

Each native binding is tens of megabytes, and Linux compiles node-webgl on install. Keeping them
in separate packages means a WebGL-only project never downloads Dawn, and a WebGPU-only project
never builds ANGLE. Use both by listing two [projects](vitest.config.ts) in one config.

## Quick start

```sh
pnpm add -D vitest vitest-environment-webgl-node vitest-screenshot
```

```ts
// vitest.config.ts
export default defineConfig({ test: { environment: 'webgl-node' } });
```

```ts
import * as THREE from 'three';
import { expect, it } from 'vitest';
import { extendMatchers } from 'vitest-screenshot';

extendMatchers();

it('renders', async () => {
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas });
  renderer.setSize(256, 256, false);
  renderer.render(scene, camera);
  await expect(canvas).toMatchScreenshot('scene.png');
});
```

## Development

```sh
pnpm install
pnpm test            # builds packages, then runs every project including the demo
pnpm test:coverage
UPDATE_SCREENSHOTS=1 pnpm test   # rewrite baselines
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the branch, commit and release workflow.

## License

MIT

[tests-badge]: https://github.com/bhouston/vitest-gpu/actions/workflows/ci.yml/badge.svg
[tests-url]: https://github.com/bhouston/vitest-gpu/actions/workflows/ci.yml
[coverage-badge]: https://codecov.io/gh/bhouston/vitest-gpu/graph/badge.svg
[coverage-url]: https://codecov.io/gh/bhouston/vitest-gpu
