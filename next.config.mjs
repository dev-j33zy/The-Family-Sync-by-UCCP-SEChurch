import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SMS_ENABLED } from './lib/features.js'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

// In development the app is often opened from a phone on the same Wi-Fi, which
// Next treats as a cross-origin request. Allow this machine's LAN addresses
// instead of hardcoding one that changes with DHCP.
function devOrigins() {
  const origins = new Set(['localhost', '127.0.0.1'])
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses || []) {
      if (address.family === 'IPv4' && !address.internal) origins.add(address.address)
    }
  }
  return [...origins]
}

const isDev = process.env.NODE_ENV === 'development'

// Next's App Router emits its own inline bootstrap scripts, and the theme
// script in app/layout.js is inline too. With statically generated pages the
// documented approach is 'unsafe-inline' for scripts/styles (nonces would
// force every page to be dynamic). Everything else stays locked down.
// Keep this list in sync with app/layout.js and globals.css (Google Fonts).
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  // HSTS is only meaningful over HTTPS; a stale max-age on localhost is painful.
  ...(isDev
    ? []
    : [
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload',
        },
      ]),
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The repo sits next to other package-lock.json files; pin tracing to this
  // project so Next does not treat the parent folder as the workspace root.
  outputFileTracingRoot: rootDir,
  // Mongoose loads native-ish driver code at runtime; keep it out of the bundle.
  serverExternalPackages: ['mongoose'],
  allowedDevOrigins: devOrigins(),
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
  async redirects() {
    if (!SMS_ENABLED) return []
    // The bulk-SMS page used to live at /text-blasts.
    return [{ source: '/text-blasts', destination: '/sms', permanent: true }]
  },
}

export default nextConfig
