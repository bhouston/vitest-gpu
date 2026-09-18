# vitest-screenshot

`expect(image).toMatchScreenshot(name)`: pixel-diff an RGBA image against a PNG baseline committed
next to your tests. Backend-agnostic: feed it `canvas.getImageData()` from
[`vitest-environment-webgl-node`](../vitest-environment-webgl-node), a WebGPU texture readback, or
pixels from a real browser.

## Install

```sh
pnpm add -D vitest vitest-screenshot
```

## Usage

```ts
import { extendMatchers } from 'vitest-screenshot';
extendMatchers();

it('renders the knot', () => {
  renderer.render(scene, camera);
  expect(canvas.getImageData()).toMatchScreenshot('knot', { maxDiffRatio: 0.01 });
});
```

- Baselines live in `__screenshots__/<name>.png` beside the test file (override with `baselineDir`).
- A missing baseline is written on first run, except when `CI` is set, where it fails.
- `UPDATE_SCREENSHOTS=1 vitest` (or `update: true`) rewrites baselines.
- On failure `<name>.actual.png` and `<name>.diff.png` are written beside the baseline. Gitignore them.
- `threshold` is pixelmatch's per-pixel colour tolerance (default 0.1); `maxDiffRatio` is the fraction
  of pixels allowed to differ (default 0.001). GPUs and drivers rasterize slightly differently, so loosen
  `maxDiffRatio` for baselines shared across platforms.
