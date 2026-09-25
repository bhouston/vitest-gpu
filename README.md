# vitest-gpu

[![Tests][tests-badge]][tests-url]
[![Coverage][coverage-badge]][coverage-url]
[![Discord][discord-badge]][discord-url]

Run real WebGL and WebGPU code inside plain Vitest, with no browser, no Playwright and no mocks.
Native GPU testing is up to 2.4x faster than running the same tests in a browser — see the
[blog post](https://ben3d.ca/blog/native-gpu-testing-for-vitest-and-jest) for details.
Two Vitest environments put a GPU-backed context on `globalThis`, and a matcher diffs the pixels
you read back against committed image baselines (png recommended; jpg, gif and webp also work).

Using Jest instead? The equivalent packages live in [jest-gpu](https://github.com/bhouston/jest-gpu):
[`jest-environment-webgpu-node`](https://github.com/bhouston/jest-gpu/tree/main/packages/jest-environment-webgpu-node)
and [`jest-environment-webgl-node`](https://github.com/bhouston/jest-gpu/tree/main/packages/jest-environment-webgl-node).

## Render and snapshot with WebGPU

Use [`vitest-environment-webgpu-node`](packages/vitest-environment-webgpu-node/README.md)
for headless WebGPU rendering and [`vitest-screenshot`](packages/vitest-screenshot/README.md)
to compare the rendered canvas against an image baseline. This example renders a three.js cube.

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

## Render and snapshot with WebGL

Use [`vitest-environment-webgl-node`](packages/vitest-environment-webgl-node/README.md)
for headless WebGL rendering and [`vitest-screenshot`](packages/vitest-screenshot/README.md)
to compare the rendered canvas against an image baseline. This example renders a three.js cube.

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
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the branch, commit and release workflow.

## Author

Created by [Ben Houston](https://ben3d.ca) and sponsored by [Land of Assets](https://landofassets.com).

## License

MIT

[tests-badge]: https://github.com/bhouston/vitest-gpu/actions/workflows/ci.yml/badge.svg
[tests-url]: https://github.com/bhouston/vitest-gpu/actions/workflows/ci.yml
[coverage-badge]: https://codecov.io/gh/bhouston/vitest-gpu/graph/badge.svg
[coverage-url]: https://codecov.io/gh/bhouston/vitest-gpu
[discord-badge]: https://img.shields.io/badge/Discord-Join%20Chat-5865F2?logo=discord&logoColor=white
[discord-url]: https://discord.gg/fwupDN493R
