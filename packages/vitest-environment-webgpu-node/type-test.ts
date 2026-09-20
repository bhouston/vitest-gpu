import { createCanvas, type HeadlessCanvasContext } from 'vitest-environment-webgpu-node';

const canvas = createCanvas(1, 1);
const context: HeadlessCanvasContext = canvas.getContext('webgpu');
const element: HTMLCanvasElement = canvas.asElement();
const configuration: GPUCanvasConfiguration | null = context.getConfiguration();
const texture: GPUTexture = context.getCurrentTexture();
void [element, configuration, texture];
