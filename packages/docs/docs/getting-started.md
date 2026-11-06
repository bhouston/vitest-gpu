---
sidebar_position: 1
description: Install vitest-environment-webgl-node, configure Vitest and run a first test that renders on a real GPU in Node, with no browser.
---

# Getting started

vitest-gpu runs WebGL and WebGPU code inside Vitest with no browser. Two Vitest environments put a GPU-backed context on `globalThis`, and a matcher compares the pixels you read back with committed image baselines. Native GPU testing is up to 2.4x faster than running the same tests in a browser, see the [blog post](https://ben3d.ca/blog/native-gpu-testing-for-vitest-and-jest).

Using Jest? The equivalent packages are in [jest-gpu](https://jest-gpu.ben3d.ca).

## Requirements

- Vitest 4 or 5. Vitest 3 is not supported: the environments implement only the `viteEnvironment` hook that Vitest 4 introduced.
- Node 22 or later.
- macOS needs no setup (Metal). Windows uses Direct3D, with the WARP software adapter on machines without a GPU. Linux without a GPU needs Mesa, see [CI](./ci.md).

## Install

WebGL is the simplest path:

```sh
pnpm add -D vitest vitest-environment-webgl-node
```

pnpm 12 lists `@onirenaud/node-webgl` and `webgpu` under "Ignored build scripts" when you install them. In a fresh project the tests below passed without approving those scripts. If a context fails to create, approve them with `pnpm approve-builds`.

## Configure Vitest

```ts title="vitest.config.ts"
import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { environment: 'webgl-node' } });
```

## Write a test

```ts title="gl.test.ts"
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

Run it:

```sh
pnpm exec vitest run
```

The test passes with a real WebGL 2 context: `document.createElement('canvas')` returns a canvas whose `getContext('webgl2')` is backed by the GPU driver, and `readPixels` returns what was rendered.

## WebGPU

Install `vitest-environment-webgpu-node` instead and set `environment: 'webgpu-node'`. `navigator.gpu` is then available in every test:

```sh
pnpm add -D vitest vitest-environment-webgpu-node
```

```ts title="gpu.test.ts"
import { expect, it } from 'vitest';

it('has a real GPU device', async () => {
  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter!.requestDevice();
  const buffer = device.createBuffer({ size: 16, usage: GPUBufferUsage.COPY_DST });
  expect(buffer.size).toBe(16);
});
```

## Where to go next

- [WebGL](./webgl.md): what the environment installs, its options and the libraries it runs.
- [WebGPU](./webgpu.md): `navigator.gpu`, Dawn options, TypeScript types and the headless canvas.
- [Screenshots](./screenshots.md): compare a rendered canvas with an image baseline using `toMatchScreenshot()`.
- [CI](./ci.md): run the same tests on runners without a GPU.
- [API reference](./api/index.md): every exported function and type.
