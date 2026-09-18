import * as THREE from 'three';
import { expect, it } from 'vitest';
import { extendMatchers } from 'vitest-screenshot';

extendMatchers();

it('renders a three.js torus knot with WebGLRenderer', () => {
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(256, 256, false);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.z = 3;
  scene.add(new THREE.Mesh(new THREE.TorusKnotGeometry(0.7, 0.25, 128, 32), new THREE.MeshNormalMaterial()));
  renderer.render(scene, camera);
  expect(canvas.getImageData()).toMatchScreenshot('torus-knot', { maxDiffRatio: 0.02 });
  renderer.dispose();
});
