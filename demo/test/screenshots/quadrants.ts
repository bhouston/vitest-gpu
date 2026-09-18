import { extendMatchers } from 'vitest-screenshot';

extendMatchers();

/** A deterministic 64x64 test image: four flat colour quadrants (few colours, so gif's 256-colour palette is exact). */
export const quadrants = () => {
  const size = 64;
  const image = new ImageData(size, size);
  const colours = [
    [255, 0, 0, 255],
    [0, 255, 0, 255],
    [0, 0, 255, 255],
    [255, 255, 0, 255],
  ];
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      image.data.set(colours[(y < size / 2 ? 0 : 2) + (x < size / 2 ? 0 : 1)]!, (y * size + x) * 4);
  return image;
};

/** The same picture drawn with WebGL via scissored clears, so a real node-webgl Canvas can be the source. */
export const quadrantsCanvas = () => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true })!;
  gl.enable(gl.SCISSOR_TEST);
  const fill = (x: number, y: number, r: number, g: number, b: number) => {
    gl.scissor(x, y, 32, 32);
    gl.clearColor(r, g, b, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
  };
  fill(0, 32, 1, 0, 0); // GL rows start at the bottom, so top-left is y = 32
  fill(32, 32, 0, 1, 0);
  fill(0, 0, 0, 0, 1);
  fill(32, 0, 1, 1, 0);
  return canvas;
};

export const loadImage = async (path: string) => {
  const image = new Image();
  image.src = path;
  await image.decode();
  return image;
};
