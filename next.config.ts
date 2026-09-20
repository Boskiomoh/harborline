import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // The dev-only route indicator sat on top of the sidebar account block.
  // Compile and runtime errors still surface in development without it.
  devIndicators: false,
};

export default withNextIntl(nextConfig);
