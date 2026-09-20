import './globals.d.ts';

const canvas = document.createElement('canvas');
const context: import('@onirenaud/node-webgl').WebGL2RenderingContext | null = canvas.getContext('webgl2');
void context;
