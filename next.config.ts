import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the dev overlay indicator so it doesn't appear on the TV / screenshots.
  devIndicators: false,
  // Static export: `next build` writes a self-contained `out/` folder. This is
  // what gets bundled into the portable Electron .exe and can also be served by
  // any static server. `next dev` is unaffected.
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
