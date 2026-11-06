<p align="center">
  <a href="https://npmjs.com/package/vitest-environment-webgpu-node"><img src="https://img.shields.io/npm/v/vitest-environment-webgpu-node.svg" alt="npm package"></a>
  <a href="https://www.npmtrends.com/vitest-environment-webgpu-node"><img src="https://img.shields.io/npm/dw/vitest-environment-webgpu-node.svg" alt="npm downloads"></a>
  <a href="https://codecov.io/gh/bhouston/vitest-gpu"><img src="https://codecov.io/gh/bhouston/vitest-gpu/branch/main/graph/badge.svg" alt="coverage"></a>
  <a href="https://discord.gg/fwupDN493R"><img src="https://img.shields.io/badge/chat-discord-blue?style=flat&logo=discord" alt="discord chat"></a>
  <a href="https://vitest-gpu.ben3d.ca/"><img src="https://img.shields.io/badge/docs-read-blue?style=flat" alt="documentation"></a>
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

[Read the Docs to Learn More](https://vitest-gpu.ben3d.ca/): getting started, the WebGL and WebGPU environments,
screenshot testing, running on GPU-less CI, and the full API reference.

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

Using Jest instead? The equivalent packages live in [jest-gpu](https://github.com/bhouston/jest-gpu), documented at
[jest-gpu.ben3d.ca](https://jest-gpu.ben3d.ca/).

## Quick start

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

## Learn more

- [Getting started](https://vitest-gpu.ben3d.ca/docs/getting-started/): install, configure and run a first test, plus supported Vitest and Node versions.
- [WebGL](https://vitest-gpu.ben3d.ca/docs/webgl/): ANGLE-backed WebGL 1 and 2, options, three.js and Babylon.js, and how it compares with canvas mocks and browsers.
- [WebGPU](https://vitest-gpu.ben3d.ca/docs/webgpu/): Dawn-backed `navigator.gpu`, Dawn options, TypeScript types and the headless canvas.
- [Screenshots](https://vitest-gpu.ben3d.ca/docs/screenshots/): `toMatchScreenshot()`, baselines, comparators and the three.js cube examples.
- [CI](https://vitest-gpu.ben3d.ca/docs/ci/): Mesa llvmpipe and lavapipe on Linux, Metal on macOS and Direct3D on Windows.
- [API reference](https://vitest-gpu.ben3d.ca/docs/api/): every exported function and type.

For more examples, explore [`demo/`](demo): device checks, uploads, readbacks, triangles,
and screenshot tests using three.js, Babylon.js, Babylon Lite and Vercel's vgpu.

## Development

```sh
pnpm install
pnpm test            # builds packages, then runs every project including the demo
pnpm test:coverage
UPDATE_SCREENSHOTS=1 pnpm test   # rewrite baselines
pnpm package:check   # validates the npm package maps and dry-run packs each package
pnpm docs:dev        # documentation site, see packages/docs
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
