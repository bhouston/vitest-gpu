import * as THREE from 'three/webgpu';
import { expect, it } from 'vitest';
import { createCanvas } from 'vitest-environment-webgpu-node';
import { extendMatchers } from 'vitest-screenshot';

extendMatchers();

// three.js WebGPURenderer draws into the environment's headless canvas; readPixels() gets the frame back.
it('renders a three.js torus knot with WebGPURenderer', async () => {
  const canvas = createCanvas(256, 256);
  const renderer = new THREE.WebGPURenderer({ canvas: canvas.asElement(), antialias: true });
  await renderer.init();
  renderer.setSize(256, 256, false);
  renderer.setClearColor(0x000000, 1);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.z = 3;
  scene.add(new THREE.Mesh(new THREE.TorusKnotGeometry(0.7, 0.25, 128, 32), new THREE.MeshNormalMaterial()));
  await renderer.renderAsync(scene, camera);
  expect(await canvas.readPixels()).toMatchScreenshot('three-torus-knot', { maxDiffRatio: 0.02 });
  renderer.dispose();
});
