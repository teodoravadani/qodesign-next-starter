import type { NextConfig } from 'next';

// Normal builds (Vercel, `npm run build`) use the default config.
// The live demo on GitHub Pages is a static export under a sub-path:
//   PAGES_BASE_PATH=/qodesign-next-starter npm run build   ->   out/
const base = process.env.PAGES_BASE_PATH;

const nextConfig: NextConfig = base
  ? { output: 'export', basePath: base, trailingSlash: true, images: { unoptimized: true } }
  : {};

export default nextConfig;
