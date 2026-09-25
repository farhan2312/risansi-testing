import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Content-Security-Policy. The app loads nothing from other origins (no CDN,
 * no web fonts, no analytics), so everything is pinned to 'self'.
 *
 * - script-src keeps 'unsafe-inline': Next.js emits inline bootstrap/hydration
 *   scripts, and a nonce-based policy needs middleware on every request. This
 *   still stops external script loading, framing, form hijacking and plugins;
 *   moving to nonces is the next hardening step. 'unsafe-eval' is dev-only
 *   (React Refresh).
 * - style-src 'unsafe-inline' because components use inline style attributes.
 * - blob: on img/object/frame: attachments and screenshots are fetched as
 *   blobs and opened in a new tab.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "object-src 'self' blob:",
  "frame-src 'self' blob:",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // One year, this host only -- deliberately no includeSubDomains, because
  // sibling apps under the same domain (sales-portal-next) manage their own.
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  outputFileTracingRoot: import.meta.dirname,
  // Don't advertise the framework in every response.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
