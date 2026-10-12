import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const supabase = new URL(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://localhost",
).host;
const isDev = process.env.NODE_ENV !== "production";

// Static CSP. Next's inline bootstrap needs 'unsafe-inline' for scripts; a nonce via proxy.ts
// would tighten that but forces every page to render dynamically. The Supabase host covers
// attachment thumbnails (signed Storage URLs), the REST API and Realtime.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://${supabase}`,
  "font-src 'self' data:",
  `connect-src 'self' https://${supabase} wss://${supabase}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  // The dev-only route indicator sat on top of the sidebar account block.
  // Compile and runtime errors still surface in development without it.
  devIndicators: false,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
