import { SMS_ENABLED } from './lib/features.js'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Self-contained server build, useful for container hosts and self-hosting.
  output: 'standalone',
  // Mongoose loads native-ish driver code at runtime; keep it out of the bundle.
  serverExternalPackages: ['mongoose'],
  experimental: {},
  allowedDevOrigins: ['192.168.1.2'],
  async redirects() {
    if (!SMS_ENABLED) return []
    // The bulk-SMS page used to live at /text-blasts.
    return [{ source: '/text-blasts', destination: '/sms', permanent: true }]
  },
}

export default nextConfig
