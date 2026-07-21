import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the dev overlay indicator so it doesn't appear on the TV / screenshots.
  devIndicators: false,
};

export default nextConfig;
