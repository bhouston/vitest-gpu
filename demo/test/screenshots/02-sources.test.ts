import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadImage, quadrants, quadrantsCanvas } from './quadrants.js';

const baseline = join(import.meta.dirname, '__screenshots__', 'quadrants.png');

describe('received value', () => {
  it('ImageData', async () => {
    await expect(quadrants()).toMatchScreenshot('quadrants.png');
  });
  it('raw { width, height, data }', async () => {
    const { width, height, data } = quadrants();
    await expect({ width, height, data: new Uint8Array(data) }).toMatchScreenshot('quadrants.png');
  });
  it('canvas', async () => {
    await expect(quadrantsCanvas()).toMatchScreenshot('quadrants.png');
  });
  it('Image', async () => {
    await expect(await loadImage(baseline)).toMatchScreenshot('quadrants.png');
  });
});

describe('reference value', () => {
  it('absolute path', async () => {
    await expect(quadrants()).toMatchScreenshot(baseline);
  });
  it('ImageData', async () => {
    await expect(quadrantsCanvas()).toMatchScreenshot(quadrants());
  });
  it('canvas', async () => {
    await expect(quadrants()).toMatchScreenshot(quadrantsCanvas());
  });
  it('Image', async () => {
    await expect(quadrantsCanvas()).toMatchScreenshot(await loadImage(baseline));
  });
  it('reports a mismatch against an in-memory reference', async () => {
    const other = quadrants();
    other.data.fill(0, 0, other.data.length / 2); // blank the top half
    await expect(expect(quadrants()).toMatchScreenshot(other)).rejects.toThrow(/2048 pixels \(50.000%\) differ/);
  });
});
