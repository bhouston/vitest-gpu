const { themes } = require('prism-react-renderer');

const url = process.env.SITE_URL ?? 'https://vitest-gpu.ben3d.ca';
const baseUrl = process.env.BASE_URL ?? '/';
const description =
  'Real WebGL and WebGPU tests in Vitest, with no browser: headless GPU environments for Node and a toMatchScreenshot() image matcher.';

const link = (attributes) => ({ tagName: 'link', attributes });
// Raw head tags: `themeConfig.metadata` goes through Helmet, which keeps one tag per name and would drop a theme-color.
const themeColor = (content, scheme) => ({
  tagName: 'meta',
  attributes: { name: 'theme-color', content, media: `(prefers-color-scheme: ${scheme})` },
});

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'vitest-gpu',
  tagline: 'Real WebGL and WebGPU tests in Vitest, with no browser.',
  url,
  baseUrl,
  favicon: 'img/gpu.svg',
  headTags: [
    link({ rel: 'icon', type: 'image/png', sizes: '32x32', href: `${baseUrl}img/favicon-32x32.png` }),
    link({ rel: 'apple-touch-icon', sizes: '180x180', href: `${baseUrl}img/apple-touch-icon.png` }),
    link({ rel: 'manifest', href: `${baseUrl}site.webmanifest` }),
    themeColor('#ffffff', 'light'),
    themeColor('#11151d', 'dark'),
    {
      tagName: 'script',
      attributes: { type: 'application/ld+json' },
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'vitest-gpu',
        url: new URL(baseUrl, url).href,
        description,
      }),
    },
  ],
  organizationName: 'bhouston',
  projectName: 'vitest-gpu',
  trailingSlash: true,
  onBrokenLinks: 'throw',
  onBrokenAnchors: 'throw',
  markdown: { format: 'detect', hooks: { onBrokenMarkdownLinks: 'throw' } },
  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.js',
          editUrl: 'https://github.com/bhouston/vitest-gpu/edit/main/packages/docs/',
        },
        blog: false,
        theme: { customCss: './src/css/custom.css' },
      },
    ],
  ],
  themeConfig: {
    image: 'img/social-card.png',
    metadata: [
      { property: 'og:site_name', content: 'vitest-gpu' },
      { name: 'twitter:site', content: '@BenHouston3D' },
    ],
    colorMode: { defaultMode: 'light', disableSwitch: true, respectPrefersColorScheme: true },
    navbar: {
      title: 'vitest-gpu',
      logo: { alt: '', src: 'img/gpu.svg' },
      items: [
        { to: '/docs/getting-started', label: 'Docs', position: 'left' },
        { to: '/docs/webgl', label: 'WebGL', position: 'left' },
        { to: '/docs/webgpu', label: 'WebGPU', position: 'left' },
        { to: '/docs/screenshots', label: 'Screenshots', position: 'left' },
        { to: '/docs/ci', label: 'CI', position: 'left' },
        { to: '/docs/api', label: 'API reference', position: 'left' },
        {
          href: 'https://www.npmjs.com/package/vitest-environment-webgpu-node',
          html: '<span class="navbar-npm-icon" aria-hidden="true"></span>',
          'aria-label': 'npm package',
          title: 'npm package',
          position: 'right',
        },
        {
          href: 'https://github.com/bhouston/vitest-gpu',
          html: '<span class="navbar-github-icon" aria-hidden="true"></span>',
          'aria-label': 'GitHub repository',
          title: 'GitHub repository',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Learn',
          items: [
            { label: 'Get started', to: '/docs/getting-started' },
            { label: 'WebGL', to: '/docs/webgl' },
            { label: 'WebGPU', to: '/docs/webgpu' },
          ],
        },
        {
          title: 'Build',
          items: [
            { label: 'Screenshots', to: '/docs/screenshots' },
            { label: 'CI', to: '/docs/ci' },
            { label: 'API reference', to: '/docs/api' },
          ],
        },
        {
          title: 'Project',
          items: [
            { label: 'GitHub', href: 'https://github.com/bhouston/vitest-gpu' },
            { label: 'npm', href: 'https://www.npmjs.com/package/vitest-environment-webgpu-node' },
            { label: 'Report an issue', href: 'https://github.com/bhouston/vitest-gpu/issues' },
            { label: 'Discord', href: 'https://discord.gg/fwupDN493R' },
          ],
        },
      ],
      copyright:
        'Made with ❤️ by <a href="https://ben3d.ca">Ben Houston</a>. Sponsored by <a href="https://landofassets.com">Land of Assets</a>',
    },
    prism: { theme: themes.github, darkTheme: themes.dracula, additionalLanguages: ['bash', 'json'] },
  },
};

module.exports = config;
