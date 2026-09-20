import { expect, it } from 'vitest';
import { extendMatchers, type RgbaImage } from '../src/index.js';

extendMatchers();

it('updates a screenshot baseline', async () => {
  const image: RgbaImage = { width: 2, height: 2, data: new Uint8Array(16) };
  for (let i = 0; i < image.data.length; i += 4) {
    image.data[i + 2] = 255;
    image.data[i + 3] = 255;
  }
  await expect(image).toMatchScreenshot(process.env.SCREENSHOT_BASELINE!);
});
