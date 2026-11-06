/** RGBA8 pixels, top row first. Feed it to `vitest-screenshot`'s `toMatchScreenshot`. */
export type RgbaImage = {
  /** Width in pixels. */
  width: number;
  /** Height in pixels. */
  height: number;
  /** RGBA8 bytes, four per pixel, row by row from the top. */
  data: Uint8Array;
};

type DefaultCanvasElement = typeof globalThis extends {
  HTMLCanvasElement: { prototype: infer TElement };
}
  ? TElement
  : HeadlessCanvas;

const COPY_SRC = 0x01;
const RENDER_ATTACHMENT = 0x10;
const MAP_READ = 0x01;
const COPY_DST = 0x08;
const READABLE_FORMATS: ReadonlySet<GPUTextureFormat> = new Set([
  'rgba8unorm',
  'rgba8unorm-srgb',
  'bgra8unorm',
  'bgra8unorm-srgb',
]);

/** Minimal `GPUCanvasContext`: `getCurrentTexture()` is a texture the size of the canvas, kept until reconfigured or resized. */
export class HeadlessCanvasContext {
  #config: GPUCanvasConfiguration | undefined;
  #texture: GPUTexture | undefined;

  /**
   * Creates the context for a canvas. Canvases create their own; you rarely call this.
   *
   * @param canvas - The canvas whose size this context's texture follows.
   */
  constructor(
    /** The canvas this context belongs to. */
    readonly canvas: HeadlessCanvas,
  ) {}

  /**
   * Stores the configuration and discards any texture created under the previous one, as `GPUCanvasContext.configure()` does.
   *
   * @param config - Device, format and usage for the canvas texture.
   */
  configure(config: GPUCanvasConfiguration): void {
    this.#config = config;
    this.#drop();
  }

  /** Clears the configuration and discards the current texture. */
  unconfigure(): void {
    this.#config = undefined;
    this.#drop();
  }

  /** The configuration passed to `configure()`, or `null` before it is called or after `unconfigure()`. */
  getConfiguration(): GPUCanvasConfiguration | null {
    return this.#config ?? null;
  }

  /**
   * The texture the canvas renders into. It is created on first use at the canvas size and reused until the context
   * is reconfigured or the canvas is resized. Throws if `configure()` has not been called.
   */
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
    const config = this.#config;
    if (!config) throw new Error('readPixels() called before configure()');
    const { device, format } = config;
    if (!READABLE_FORMATS.has(format)) {
      throw new Error(
        `readPixels() does not support canvas format "${format}"; supported formats are rgba8unorm, rgba8unorm-srgb, bgra8unorm, and bgra8unorm-srgb`,
      );
    }
    const texture = this.getCurrentTexture();
    const { width, height } = texture;
    const bytesPerRow = Math.ceil((width * 4) / 256) * 256;
    const buffer = device.createBuffer({ size: bytesPerRow * height, usage: MAP_READ | COPY_DST });
    let mapped = false;
    try {
      const encoder = device.createCommandEncoder();
      encoder.copyTextureToBuffer({ texture }, { buffer, bytesPerRow }, [width, height]);
      device.queue.submit([encoder.finish()]);
      await buffer.mapAsync(MAP_READ);
      mapped = true;
      const padded = new Uint8Array(buffer.getMappedRange());
      const data = new Uint8Array(width * height * 4);
      for (let y = 0; y < height; y++)
        data.set(padded.subarray(y * bytesPerRow, y * bytesPerRow + width * 4), y * width * 4);
      if (format.startsWith('bgra')) {
        for (let i = 0; i < data.length; i += 4) [data[i], data[i + 2]] = [data[i + 2]!, data[i]!];
      }
      return { width, height, data };
    } finally {
      try {
        if (mapped) buffer.unmap();
      } finally {
        buffer.destroy();
      }
    }
  }

  #drop(): void {
    this.#texture?.destroy();
    this.#texture = undefined;
  }
}

/** Enough of `HTMLCanvasElement` for three.js `WebGPURenderer`, Babylon Lite and friends. */
export class HeadlessCanvas {
  readonly #context = new HeadlessCanvasContext(this);
  /** A plain object libraries can write CSS properties to; it has no effect on rendering. */
  readonly style: Record<string, string> = {};
  readonly #attributes = new Map<string, string>();

  /**
   * Creates a canvas of the given size. {@link createCanvas} is the usual entry point.
   *
   * @param width - Canvas width in pixels.
   * @param height - Canvas height in pixels.
   */
  constructor(
    /** Canvas width in pixels. */
    public width = 300,
    /** Canvas height in pixels. */
    public height = 150,
  ) {}

  /** Same as `width`; there is no layout in Node. */
  get clientWidth(): number {
    return this.width;
  }

  /** Same as `height`; there is no layout in Node. */
  get clientHeight(): number {
    return this.height;
  }

  /**
   * Returns the canvas's `GPUCanvasContext` for `'webgpu'`.
   *
   * @param id - The context type. Only `'webgpu'` is supported.
   * @returns The context for `'webgpu'`, or `null` for any other type.
   */
  getContext(id: 'webgpu'): HeadlessCanvasContext;
  /**
   * Returns the canvas's `GPUCanvasContext` for `'webgpu'`.
   *
   * @param id - The context type. Only `'webgpu'` is supported.
   * @returns The context for `'webgpu'`, or `null` for any other type.
   */
  getContext(id: string): HeadlessCanvasContext | null;
  getContext(id: string): HeadlessCanvasContext | null {
    return id === 'webgpu' ? this.#context : null;
  }

  /** Reads the current texture back as RGBA8 pixels; see {@link HeadlessCanvasContext.readPixels}. */
  readPixels(): Promise<RgbaImage> {
    return this.#context.readPixels();
  }

  /**
   * This same object, cast to the element type a rendering library expects.
   *
   * @typeParam TElement - The element type to cast to. Defaults to `HTMLCanvasElement` when DOM types are available.
   */
  asElement<TElement = DefaultCanvasElement>(): TElement {
    return this as unknown as TElement;
  }

  /** A rectangle at the origin with the canvas's width and height. */
  getBoundingClientRect(): {
    /** Always 0. */
    x: number;
    /** Always 0. */
    y: number;
    /** The canvas width. */
    width: number;
    /** The canvas height. */
    height: number;
    /** Always 0. */
    top: number;
    /** Always 0. */
    left: number;
  } {
    return { x: 0, y: 0, top: 0, left: 0, width: this.width, height: this.height };
  }

  /**
   * Stores an attribute on the canvas.
   *
   * @param name - Attribute name.
   * @param value - Attribute value.
   */
  setAttribute(name: string, value: string): void {
    this.#attributes.set(name, value);
  }

  /**
   * Reads an attribute stored with `setAttribute()`.
   *
   * @param name - Attribute name.
   * @returns The stored value, or `null` if none was set.
   */
  getAttribute(name: string): string | null {
    return this.#attributes.get(name) ?? null;
  }

  /** Does nothing; present so libraries that register listeners keep working. */
  addEventListener(): void {}
  /** Does nothing; present so libraries that remove listeners keep working. */
  removeEventListener(): void {}
  /** Does nothing and returns `true`. */
  dispatchEvent(): boolean {
    return true;
  }
}

/**
 * Creates a headless canvas for WebGPU tests.
 *
 * @param width - Canvas width in pixels.
 * @param height - Canvas height in pixels.
 * @returns A {@link HeadlessCanvas}; pass `canvas.asElement()` to libraries that expect an `HTMLCanvasElement`.
 */
export const createCanvas = (width: number, height: number): HeadlessCanvas => new HeadlessCanvas(width, height);
