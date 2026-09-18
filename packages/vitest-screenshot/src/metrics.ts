import type { Comparator, RgbaImage } from './index.js';

/** ImageMagick `compare -metric` names. Upper bounds: AE PAE MAE MSE RMSE DSSIM. Lower bounds: PSNR SSIM. */
export type Metric = 'AE' | 'PAE' | 'MAE' | 'MSE' | 'RMSE' | 'PSNR' | 'SSIM' | 'DSSIM';

export type MetricsOptions = {
  /** ImageMagick `-fuzz`: per-channel RMS colour distance (0..1) within which two pixels count as equal. Default 0. */
  fuzz?: number;
  /** Absolute error: pixels differing by more than `fuzz`. Default bound when no metric is given: 0. */
  AE?: number;
  /** Peak absolute error, 0..1. */
  PAE?: number;
  /** Mean absolute error, 0..1. */
  MAE?: number;
  /** Mean squared error, 0..1. */
  MSE?: number;
  /** Root mean squared error, 0..1. */
  RMSE?: number;
  /** Peak signal-to-noise ratio in dB (lower bound). `Infinity` for identical images. */
  PSNR?: number;
  /** Structural similarity, 1 = identical (lower bound). Gaussian 11x11 window, sigma 1.5, over RGB. */
  SSIM?: number;
  /** Structural dissimilarity, `(1 - SSIM) / 2`. */
  DSSIM?: number;
};

const LOWER_IS_WORSE = new Set<Metric>(['PSNR', 'SSIM']);
const METRICS = new Set<Metric>(['AE', 'PAE', 'MAE', 'MSE', 'RMSE', 'PSNR', 'SSIM', 'DSSIM']);

/**
 * ImageMagick's IsFuzzyEquivalencePixel: alpha must be within `fuzz`, then the colour distance, scaled by both
 * alphas (a 4D cone: transparent pixels always match), must be within `fuzz` per channel RMS.
 */
const fuzzyEqual = (a: RgbaImage['data'], b: RgbaImage['data'], i: number, fuzz2: number) => {
  const sa = a[i + 3]! / 255;
  const sb = b[i + 3]! / 255;
  const dAlpha = (sa - sb) ** 2;
  if (dAlpha > fuzz2) return false;
  const scale = sa * sb;
  if (scale <= Number.EPSILON) return true;
  let d = 3 * dAlpha;
  for (let c = 0; c < 3; c++) d += scale * ((a[i + c]! - b[i + c]!) / 255) ** 2;
  return d <= 3 * fuzz2;
};

/**
 * AE, PAE, MAE, MSE, RMSE and PSNR in one pass, matching `magick compare` for RGBA images: colour channels are
 * alpha-premultiplied and all four channels are averaged. Also returns which pixels differ by more than `fuzz`.
 */
export function distortion(a: RgbaImage, b: RgbaImage, fuzz: number) {
  const n = a.width * a.height;
  const mask = new Uint8Array(n);
  const fuzz2 = fuzz * fuzz;
  let AE = 0;
  let PAE = 0;
  let sumAbs = 0;
  let sumSq = 0;
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    if (!fuzzyEqual(a.data, b.data, i, fuzz2)) {
      mask[p] = 1;
      AE++;
    }
    const sa = a.data[i + 3]! / 255;
    const sb = b.data[i + 3]! / 255;
    for (let c = 0; c < 4; c++) {
      const d = c === 3 ? Math.abs(sa - sb) : Math.abs((a.data[i + c]! / 255) * sa - (b.data[i + c]! / 255) * sb);
      if (d > PAE) PAE = d;
      sumAbs += d;
      sumSq += d * d;
    }
  }
  const MSE = sumSq / (n * 4);
  return {
    AE,
    PAE,
    MAE: sumAbs / (n * 4),
    MSE,
    RMSE: Math.sqrt(MSE),
    PSNR: MSE > 0 ? 10 * Math.log10(1 / MSE) : Infinity,
    mask,
  };
}

/** Gaussian taps for an 11x11 window with sigma 1.5, normalised to sum 1 (Wang et al. 2004). */
const KERNEL = (() => {
  const k = Float64Array.from({ length: 11 }, (_, i) => Math.exp(-((i - 5) ** 2) / (2 * 1.5 * 1.5)));
  const sum = k.reduce((s, v) => s + v, 0);
  return k.map((v) => v / sum);
})();

/** Separable Gaussian blur of a 3-channel float image, clamping to edge pixels. */
const blur = (src: Float32Array, width: number, height: number) => {
  const pass = (input: Float32Array, dx: number, dy: number) => {
    const out = new Float32Array(input.length);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        for (let c = 0; c < 3; c++) {
          let s = 0;
          for (let k = -5; k <= 5; k++) {
            const sx = Math.min(width - 1, Math.max(0, x + k * dx));
            const sy = Math.min(height - 1, Math.max(0, y + k * dy));
            s += KERNEL[k + 5]! * input[(sy * width + sx) * 3 + c]!;
          }
          out[(y * width + x) * 3 + c] = s;
        }
    return out;
  };
  return pass(pass(src, 1, 0), 0, 1);
};

const mul = (x: Float32Array, y: Float32Array) => x.map((v, i) => v * y[i]!);

/** Mean SSIM over RGB (K1 0.01, K2 0.03), the textbook definition also used by ssim.js and Playwright. */
export function ssim(a: RgbaImage, b: RgbaImage): number {
  const { width, height } = a;
  const rgb = (img: RgbaImage) =>
    Float32Array.from({ length: width * height * 3 }, (_, i) => img.data[i + Math.floor(i / 3)]! / 255);
  const fa = rgb(a);
  const fb = rgb(b);
  const [ma, mb, maa, mbb, mab] = [fa, fb, mul(fa, fa), mul(fb, fb), mul(fa, fb)].map((img) =>
    blur(img, width, height),
  ) as Float32Array[];
  const c1 = 0.01 ** 2;
  const c2 = 0.03 ** 2;
  let sum = 0;
  for (let i = 0; i < fa.length; i++) {
    const va = maa![i]! - ma![i]! ** 2;
    const vb = mbb![i]! - mb![i]! ** 2;
    const cov = mab![i]! - ma![i]! * mb![i]!;
    sum += ((2 * ma![i]! * mb![i]! + c1) * (2 * cov + c2)) / ((ma![i]! ** 2 + mb![i]! ** 2 + c1) * (va + vb + c2));
  }
  return sum / fa.length;
}

/** Diff image in pixelmatch's style: the actual image faded towards white, differing pixels in red. */
const diffImage = (actual: RgbaImage, mask: Uint8Array): RgbaImage => {
  const data = new Uint8Array(actual.data.length);
  for (let p = 0, i = 0; p < mask.length; p++, i += 4) {
    if (mask[p]) data.set([255, 0, 0, 255], i);
    else {
      const grey =
        255 - 0.1 * (255 - (0.299 * actual.data[i]! + 0.587 * actual.data[i + 1]! + 0.114 * actual.data[i + 2]!));
      data.set([grey, grey, grey, 255], i);
    }
  }
  return { width: actual.width, height: actual.height, data };
};

const fmt = (n: number) => (Number.isFinite(n) ? String(Number(n.toPrecision(4))) : String(n));

/**
 * `comparatorName: 'metrics'`: ImageMagick `compare -metric` bounds. Give any subset; all must pass. With no
 * bound given, requires `AE: 0` (an exact match, like `compare -metric AE`).
 */
export const metricsComparator: Comparator<MetricsOptions> = (
  reference,
  actual,
  { createDiff, fuzz = 0, ...bounds },
) => {
  for (const key of Object.keys(bounds)) {
    if (!METRICS.has(key as Metric))
      throw new Error(`unknown metric "${key}"; expected one of ${[...METRICS].join(', ')}`);
  }
  const wanted = (Object.keys(bounds) as Metric[]).filter((k) => bounds[k] !== undefined);
  if (wanted.length === 0) {
    bounds.AE = 0;
    wanted.push('AE');
  }
  const values: Partial<Record<Metric, number>> & ReturnType<typeof distortion> = distortion(reference, actual, fuzz);
  if (wanted.includes('SSIM') || wanted.includes('DSSIM')) {
    values.SSIM = ssim(reference, actual);
    values.DSSIM = (1 - values.SSIM) / 2;
  }
  const failed = wanted.filter((k) => (LOWER_IS_WORSE.has(k) ? values[k]! < bounds[k]! : values[k]! > bounds[k]!));
  const report = [...METRICS]
    .filter((k) => values[k] !== undefined)
    .map((k) => `${k} ${fmt(values[k]!)}${k === 'AE' ? ` (fuzz ${fmt(fuzz)})` : ''}`)
    .join(', ');
  const why = failed
    .map((k) => `${k} ${fmt(values[k]!)} ${LOWER_IS_WORSE.has(k) ? '<' : '>'} ${fmt(bounds[k]!)}`)
    .join(', ');
  return {
    pass: failed.length === 0,
    diff: createDiff ? diffImage(actual, values.mask) : null,
    message: failed.length ? `${report}; failed: ${why}` : report,
  };
};
