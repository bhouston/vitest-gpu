// @vitest-environment webgl-node

import { expect, it } from 'vitest';

// Baby step 1: is there a GPU? The environment gave document.createElement('canvas') a real ANGLE context.
it('creates WebGL 1 and WebGL 2 contexts', () => {
  const canvas = document.createElement('canvas');
  const gl2 = canvas.getContext('webgl2');
  expect(gl2).toBeInstanceOf(WebGL2RenderingContext);
  const info = gl2!.getExtension('WEBGL_debug_renderer_info');
  console.log('WebGL renderer:', gl2!.getParameter(info!.UNMASKED_RENDERER_WEBGL));
  expect(gl2!.getParameter(gl2!.VERSION)).toMatch(/^WebGL 2/);
  expect(gl2!.getParameter(gl2!.MAX_TEXTURE_SIZE)).toBeGreaterThanOrEqual(2048);
  const gl1 = document.createElement('canvas').getContext('webgl');
  expect(gl1).toBeInstanceOf(WebGLRenderingContext);
});
