# vitest-screenshot

`await expect(image).toMatchScreenshot(reference)`: pixel-diff an image against a baseline committed next to
your tests. Backend-agnostic: feed it a canvas from
[`vitest-environment-webgl-node`](../vitest-environment-webgl-node) or
[`vitest-environment-webgpu-node`](../vitest-environment-webgpu-node), an `ImageData`, a WebGPU texture
readback, or pixels from a real browser.

## Install

```sh
pnpm add -D vitest vitest-screenshot
```

## Usage

```ts
import { extendMatchers } from 'vitest-screenshot';
extendMatchers();

it('renders the knot', async () => {
  renderer.render(scene, camera);
  await expect(canvas).toMatchScreenshot('knot.png', { maxDiffRatio: 0.01 });
});
```

The matcher is async: always `await` it.

### What you can compare

The received value and the reference can each be any of:

- `{ width, height, data }` with RGBA8 pixels, top row first (an `ImageData`, `canvas.getImageData()`, a WebGPU readback).
- A canvas: node-webgl's `Canvas` (read with `getImageData()`) or the WebGPU environment's `HeadlessCanvas` (read with `readPixels()`).
- An `Image` from `vitest-environment-webgl-node` (decoded with `decode()` first).

The reference may also be a file path. It must include the extension (`'knot.png'`, not `'knot'`), and resolves
relative to `baselineDir` unless absolute.

### Baseline files

- Baselines live in `__screenshots__/` beside the test file (override with `baselineDir`).
- Any format sharp reads and writes works: png, jpg, gif, webp, avif, tiff. **We recommend png**: it is lossless,
  so a baseline written on the first run matches exactly. jpg and webp are re-encoded lossily on write and gif is
  limited to 256 colours, so loosen `maxDiffRatio` (or `threshold`) if you use them.
- A missing baseline is written on first run, except when `CI` is set, where it fails.
- `UPDATE_SCREENSHOTS=1 vitest` (or `update: true`) rewrites baselines.
- On failure `<name>.actual.png` and `<name>.diff.png` are written to `baselineDir` (named after the test when the
  reference is in memory). Gitignore them.
- `threshold` is pixelmatch's per-pixel colour tolerance (default 0.1); `maxDiffRatio` is the fraction
  of pixels allowed to differ (default 0.001). GPUs and drivers rasterize slightly differently, so loosen
  `maxDiffRatio` for baselines shared across platforms.

See [`demo/test/screenshots`](../../demo/test/screenshots) for every source and format combination.
