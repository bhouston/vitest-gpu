import Link from '@docusaurus/Link';
import CodeBlock from '@theme/CodeBlock';
import Layout from '@theme/Layout';

const workflow = [
  ['Install', 'Add an environment package next to Vitest'],
  ['Configure', 'Set environment to webgl-node or webgpu-node'],
  ['Render', 'Draw to a canvas on a real GPU in Node'],
  ['Compare', 'Match the pixels to a committed baseline'],
];

const cards = [
  {
    name: 'Getting started',
    label: 'Install and first test',
    href: '/docs/getting-started/',
    body: 'Install the WebGL environment, configure Vitest and run a test that clears a canvas to red.',
  },
  {
    name: 'WebGL',
    label: 'WebGL 1 and 2 through ANGLE',
    href: '/docs/webgl/',
    body: 'What the environment installs, its options, and running three.js and Babylon.js unchanged.',
  },
  {
    name: 'WebGPU',
    label: 'navigator.gpu through Dawn',
    href: '/docs/webgpu/',
    body: 'Dawn options, TypeScript types and a headless canvas for WebGPU renderers.',
  },
  {
    name: 'Screenshots',
    label: 'toMatchScreenshot()',
    href: '/docs/screenshots/',
    body: 'Baselines, comparators, tolerances and the diff images written when a test fails.',
  },
  {
    name: 'CI',
    label: 'Runners without a GPU',
    href: '/docs/ci/',
    body: 'Install Mesa llvmpipe and lavapipe on Linux and run the same tests as on your laptop.',
  },
  {
    name: 'API reference',
    label: 'Generated from TSDoc',
    href: '/docs/api/',
    body: 'Every exported function and type of the three packages, from the source comments.',
  },
];

const config = `// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'webgl-node' },
});`;

const test = `// gl.test.ts
import { expect, it } from 'vitest';

it('clears to red on a real GPU', () => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 4;
  const gl = canvas.getContext('webgl2')!;
  gl.clearColor(1, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  const pixel = new Uint8Array(4);
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
  expect([...pixel]).toEqual([255, 0, 0, 255]);
});`;

const snapshot = `import { extendMatchers } from 'vitest-screenshot';

extendMatchers();

it('renders a cube', async () => {
  renderer.render(scene, camera);
  await expect(canvas).toMatchScreenshot('cube.png');
});`;

export default function Home() {
  return (
    <Layout
      title="Real WebGL and WebGPU tests in Vitest"
      description="Real WebGL and WebGPU tests in Vitest, with no browser: headless GPU environments for Node and a toMatchScreenshot() image matcher."
    >
      <header className="home-hero container">
        <div>
          <p className="eyebrow">Vitest · WebGL · WebGPU · Open source</p>
          <h1>
            Test your GPU code.
            <br />
            <em>Skip the browser.</em>
          </h1>
          <p className="hero-description">
            Two Vitest environments put a real WebGL or WebGPU context on globalThis, and a matcher compares the pixels
            you read back with committed image baselines. Native GPU testing is up to 2.4x faster than a browser.
          </p>
          <div className="hero-actions">
            <Link className="button button--primary button--lg" to="/docs/getting-started/">
              Get started <span aria-hidden>→</span>
            </Link>
            <Link className="button button--secondary button--lg" to="/docs/screenshots/">
              Screenshot testing
            </Link>
          </div>
        </div>
        <figure className="hero-preview">
          <CodeBlock language="typescript" title="A WebGL test in Node">
            {test}
          </CodeBlock>
        </figure>
      </header>
      <main>
        <section className="workflow-band" aria-label="How it works">
          <div className="container workflow-steps">
            {workflow.map(([title, detail], index) => (
              <div key={title}>
                <span className="workflow-number">0{index + 1}</span>
                <strong>{title}</strong>
                <p>{detail}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="container story-section" aria-labelledby="gpu-title">
          <div>
            <p className="eyebrow">Real GPU, no mocks</p>
            <h2 id="gpu-title">
              ANGLE for WebGL.
              <br />
              Dawn for WebGPU.
            </h2>
            <p>
              The environments run in the Node process, so there is no browser to install or start. Your code gets real
              drivers: Metal on macOS, Direct3D on Windows, and Mesa on Linux. three.js, Babylon.js and plain WebGL or
              WebGPU code run unchanged.
            </p>
            <Link to="/docs/webgl/">Read about the environments →</Link>
          </div>
          <CodeBlock language="typescript" title="vitest.config.ts">
            {config}
          </CodeBlock>
        </section>
        <section className="container story-section" aria-labelledby="snapshot-title">
          <CodeBlock language="typescript" title="Image snapshots">
            {snapshot}
          </CodeBlock>
          <div>
            <p className="eyebrow">Pixels, not stubs</p>
            <h2 id="snapshot-title">
              Commit a baseline.
              <br />
              Get a diff when it changes.
            </h2>
            <p>
              toMatchScreenshot() takes a canvas, ImageData or raw pixels. It supports png, jpg, gif and webp baselines,
              pixelmatch and ImageMagick-style metric comparators, and writes actual and diff images on failure.
            </p>
            <Link to="/docs/screenshots/">Explore screenshots →</Link>
          </div>
        </section>
        <section className="container package-section" aria-labelledby="docs-title">
          <div className="section-heading">
            <p className="eyebrow">Keep reading</p>
            <h2 id="docs-title">Find the part you need.</h2>
          </div>
          <div className="package-grid">
            {cards.map((card) => (
              <Link key={card.name} to={card.href} className="package-card">
                <p className="package-label">{card.label}</p>
                <h3>{card.name}</h3>
                <p>{card.body}</p>
                <span>Read more →</span>
              </Link>
            ))}
          </div>
        </section>
        <section className="container home-callout">
          <div>
            <p className="eyebrow">Vitest 4 and 5 · Node.js 22+ · MIT</p>
            <h2>From first canvas to green CI.</h2>
            <CodeBlock language="bash">pnpm add -D vitest vitest-environment-webgl-node</CodeBlock>
            <p>
              Using Jest? See <Link href="https://jest-gpu.ben3d.ca/">jest-gpu</Link>.
            </p>
          </div>
          <div className="hero-actions">
            <Link className="button button--primary button--lg" to="/docs/getting-started/">
              Write your first test
            </Link>
            <Link className="button button--secondary button--lg" to="/docs/api/">
              API reference
            </Link>
          </div>
        </section>
      </main>
    </Layout>
  );
}
