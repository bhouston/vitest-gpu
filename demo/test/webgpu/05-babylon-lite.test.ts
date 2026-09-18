import {
  addToScene,
  createBox,
  createDefaultCamera,
  createEngine,
  createHemisphericLight,
  createSceneContext,
  createStandardMaterial,
  disposeEngine,
  registerScene,
  renderFrame,
  waitForGpuIdle,
} from '@babylonjs/lite';
import { expect, it } from 'vitest';
import { createCanvas } from 'vitest-environment-webgpu-node';
import { extendMatchers } from 'vitest-screenshot';

extendMatchers();

it('renders a lit box with Babylon Lite', async () => {
  const canvas = createCanvas(256, 256);
  const engine = await createEngine(canvas.asElement());
  const scene = createSceneContext(engine);
  const box = createBox(engine, 1);
  box.material = createStandardMaterial(); // meshes without a material are not drawn
  addToScene(scene, box);
  addToScene(scene, createHemisphericLight([0, 1, 0], 1));
  const camera = createDefaultCamera(scene); // frames the scene and becomes the active camera
  camera.alpha = Math.PI / 3;
  camera.beta = Math.PI / 3;
  await registerScene(scene);
  // Pipelines compile asynchronously; render a few frames until the box is in.
  for (let i = 0; i < 3; i++) {
    renderFrame(engine, 16);
    await waitForGpuIdle(engine);
  }
  expect(await canvas.readPixels()).toMatchScreenshot('babylon-lite-box', { maxDiffRatio: 0.02 });
  disposeEngine(engine);
});
