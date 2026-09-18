/**
 * Types for the globals `vitest-environment-webgl-node` installs (node-webgl's `installDOM()`).
 * Pull in with `import 'vitest-environment-webgl-node/globals';` from a `.d.ts` your tsconfig includes.
 */
import type {
  Canvas,
  Image as NodeImage,
  ImageBitmap as NodeImageBitmap,
  ImageData as NodeImageData,
  WebGL2RenderingContext as NodeWebGL2RenderingContext,
  WebGLRenderingContext as NodeWebGLRenderingContext,
  createImageBitmap as nodeCreateImageBitmap,
} from '@onirenaud/node-webgl';

type Listener = (type: string, listener: (event: unknown) => void, options?: unknown) => void;

interface ShimDocument {
  createElement(tag: 'canvas'): Canvas;
  createElement(tag: 'img'): NodeImage;
  createElement(tag: string): unknown;
  createElementNS(namespace: string, tag: 'canvas'): Canvas;
  createElementNS(namespace: string, tag: string): unknown;
  addEventListener: Listener;
  removeEventListener: Listener;
}

interface ShimWindow {
  innerWidth: number;
  innerHeight: number;
  devicePixelRatio: number;
  addEventListener: Listener;
  removeEventListener: Listener;
}

declare global {
  var window: ShimWindow & typeof globalThis;
  var self: ShimWindow & typeof globalThis;
  var document: ShimDocument;
  var innerWidth: number;
  var innerHeight: number;
  var devicePixelRatio: number;
  var HTMLCanvasElement: typeof Canvas;
  var OffscreenCanvas: typeof Canvas;
  var HTMLImageElement: typeof NodeImage;
  var Image: typeof NodeImage;
  var ImageData: typeof NodeImageData;
  var ImageBitmap: typeof NodeImageBitmap;
  var createImageBitmap: typeof nodeCreateImageBitmap;
  var WebGLRenderingContext: typeof NodeWebGLRenderingContext;
  var WebGL2RenderingContext: typeof NodeWebGL2RenderingContext;
  function requestAnimationFrame(callback: (time: number) => void): number;
  function cancelAnimationFrame(handle: number): void;
}
