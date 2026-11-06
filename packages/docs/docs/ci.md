---
sidebar_position: 5
description: Run vitest-gpu WebGL and WebGPU tests on CI runners without a GPU, using Mesa llvmpipe for WebGL and lavapipe for WebGPU on Linux.
---

# CI

The native GPU packages are real dependencies, so tests need a GPU or a software rasterizer. Output comes from a real GPU driver or a software rasterizer, so edges can differ slightly between machines. Use a tolerance such as `allowedMismatchedPixelRatio` for [screenshot](./screenshots.md) baselines shared across machines.

## Linux without a GPU

Install Mesa and force software rendering. WebGL uses Mesa's llvmpipe. WebGPU also needs Mesa's Vulkan driver (lavapipe), which Dawn uses through its Vulkan backend.

```sh
sudo apt-get update && sudo apt-get install -y libegl1 libgles2 libgl1-mesa-dri mesa-vulkan-drivers
export LIBGL_ALWAYS_SOFTWARE=1
```

In GitHub Actions:

```yaml title=".github/workflows/ci.yml"
jobs:
  test:
    runs-on: ubuntu-latest
    env:
      LIBGL_ALWAYS_SOFTWARE: '1'
    steps:
      - uses: actions/checkout@v6
      - run: sudo apt-get update && sudo apt-get install -y libegl1 libgles2 libgl1-mesa-dri mesa-vulkan-drivers
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 26
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm test
```

This repository's own [CI workflow](https://github.com/bhouston/vitest-gpu/blob/main/.github/workflows/ci.yml) does exactly this, so WebGPU tests run for real, not mocked, on `ubuntu-latest` on every pull request.

## macOS

macOS uses Metal for both WebGL and WebGPU and needs no setup. CI runs `macos-latest`.

## Windows

Windows uses Direct3D for both WebGL and WebGPU, with the WARP software adapter on machines without a GPU. CI runs `windows-latest`.

## Versions

CI runs the suite on Node 22, 24 and 26, and against Vitest 4 and 5.

## Keep failure images

When a screenshot assertion fails, `<name>.actual.png` and `<name>.diff.png` are written next to the baseline. Upload them so you can see what the runner rendered:

```yaml
- uses: actions/upload-artifact@v4
  if: always()
  with:
    name: screenshot-diffs
    path: |
      **/__screenshots__/*.actual.png
      **/__screenshots__/*.diff.png
    if-no-files-found: ignore
```
