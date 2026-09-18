import { ArcRotateCamera, Engine, HemisphericLight, MeshBuilder, Scene, Vector3 } from '@babylonjs/core';
import { expect, it } from 'vitest';
import { extendMatchers } from 'vitest-screenshot';

extendMatchers();

it('renders a lit box with Babylon.js WebGL Engine', async () => {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  // node-webgl's Canvas is not an HTMLCanvasElement to TypeScript, but it has everything Babylon uses at runtime.
  const engine = new Engine(canvas as unknown as HTMLCanvasElement, true);
  const scene = new Scene(engine);
  scene.activeCamera = new ArcRotateCamera('camera', Math.PI / 3, Math.PI / 3, 4, Vector3.Zero(), scene);
  const light = new HemisphericLight('light', new Vector3(0, 1, 0), scene);
  light.intensity = 1;
  MeshBuilder.CreateBox('box', { size: 1 }, scene);
  await scene.whenReadyAsync(); // shaders compile asynchronously (KHR_parallel_shader_compile)
  scene.render();
  await expect(canvas.getImageData()).toMatchScreenshot('babylon-box.png', { maxDiffRatio: 0.02 });
  engine.dispose();
});
