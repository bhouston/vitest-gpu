import { describe, expect, it } from 'vitest';
import { quadrants } from './quadrants.js';

// The same pixels checked against baselines in every format sharp reads. PNG is lossless and recommended;
// jpg and webp are re-encoded lossily on write, so give them some slack.
describe('baseline formats', () => {
  it('png', async () => {
    await expect(quadrants()).toMatchScreenshot('quadrants.png');
  });
  it('jpg', async () => {
    await expect(quadrants()).toMatchScreenshot('quadrants.jpg', { maxDiffRatio: 0.05 });
  });
  it('gif', async () => {
    await expect(quadrants()).toMatchScreenshot('quadrants.gif');
  });
  it('webp', async () => {
    await expect(quadrants()).toMatchScreenshot('quadrants.webp', { maxDiffRatio: 0.05 });
  });
  it('rejects a reference without an extension', async () => {
    await expect(expect(quadrants()).toMatchScreenshot('quadrants')).rejects.toThrow(/needs an image extension/);
  });
});
