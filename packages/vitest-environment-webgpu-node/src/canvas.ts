/** RGBA8 pixels, top row first. Feed it to `vitest-screenshot`'s `toMatchScreenshot`. */
export type RgbaImage = { width: number; height: number; data: Uint8Array };

const COPY_SRC = 0x01;
const RENDER_ATTACHMENT = 0x10;
const MAP_READ = 0x01;
const COPY_DST = 0x08;

/** Minimal `GPUCanvasContext`: `getCurrentTexture()` is a texture the size of the canvas, kept until reconfigured or resized. */
export class HeadlessCanvasContext {
  #config: GPUCanvasConfiguration | undefined;
  #texture: GPUTexture | undefined;

  constructor(readonly canvas: HeadlessCanvas) {}

  configure(config: GPUCanvasConfiguration): void {
    this.#config = config;
    this.#drop();
  }

  unconfigure(): void {
    this.#config = undefined;
    this.#drop();
  }

  getConfiguration(): GPUCanvasConfiguration | null {
    return this.#config ?? null;
  }

  getCurrentTexture(): GPUTexture {
    const config = this.#config;
    if (!config) throw new Error('getCurrentTexture() called before configure()');
    const { width, height } = this.canvas;
    if (this.#texture && (this.#texture.width !== width || this.#texture.height !== height)) this.#drop();
    this.#texture ??= config.device.createTexture({
      size: [width, height],
      format: config.format,
      usage: (config.usage ?? RENDER_ATTACHMENT) | RENDER_ATTACHMENT | COPY_SRC,
      viewFormats: config.viewFormats,
    });
    return this.#texture;
  }

  /** Copies the current texture to the CPU. BGRA formats are swizzled to RGBA. */
  async readPixels(): Promise<RgbaImage> {
    const texture = this.getCurrentTexture();
    const { device, format } = this.#config!;
    const { width, height } = texture;
    const bytesPerRow = Math.ceil((width * 4) / 256) * 256;
    const buffer = device.createBuffer({ size: bytesPerRow * height, usage: MAP_READ | COPY_DST });
    const encoder = device.createCommandEncoder();
    encoder.copyTextureToBuffer({ texture }, { buffer, bytesPerRow }, [width, height]);
    device.queue.submit([encoder.finish()]);
    await buffer.mapAsync(MAP_READ);
    const padded = new Uint8Array(buffer.getMappedRange());
    const data = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++)
      data.set(padded.subarray(y * bytesPerRow, y * bytesPerRow + width * 4), y * width * 4);
    buffer.unmap();
    buffer.destroy();
    if (format.startsWith('bgra')) {
      for (let i = 0; i < data.length; i += 4) [data[i], data[i + 2]] = [data[i + 2]!, data[i]!];
    }
    return { width, height, data };
  }

  #drop(): void {
    this.#texture?.destroy();
    this.#texture = undefined;
  }
}

/** Enough of `HTMLCanvasElement` for three.js `WebGPURenderer`, Babylon Lite and friends. */
export class HeadlessCanvas {
  readonly #context = new HeadlessCanvasContext(this);
  readonly style: Record<string, string> = {};
  readonly #attributes = new Map<string, string>();

  constructor(
    public width = 300,
    public height = 150,
  ) {}

  get clientWidth(): number {
    return this.width;
  }

  get clientHeight(): number {
    return this.height;
  }

  getContext(id: 'webgpu'): HeadlessCanvasContext;
  getContext(id: string): HeadlessCanvasContext | null;
  getContext(id: string): HeadlessCanvasContext | null {
    return id === 'webgpu' ? this.#context : null;
  }

  readPixels(): Promise<RgbaImage> {
    return this.#context.readPixels();
  }

  /** This same object, typed as an element for libraries whose signatures demand one. */
  asElement(): HTMLCanvasElement {
    return this as unknown as HTMLCanvasElement;
  }

  getBoundingClientRect(): { x: number; y: number; width: number; height: number; top: number; left: number } {
    return { x: 0, y: 0, top: 0, left: 0, width: this.width, height: this.height };
  }

  setAttribute(name: string, value: string): void {
    this.#attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.#attributes.get(name) ?? null;
  }

  addEventListener(): void {}
  removeEventListener(): void {}
  dispatchEvent(): boolean {
    return true;
  }
}

export const createCanvas = (width: number, height: number): HeadlessCanvas => new HeadlessCanvas(width, height);
