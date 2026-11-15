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

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The repo sits next to other package-lock.json files; pin tracing to this
  // project so Next does not treat the parent folder as the workspace root.
  outputFileTracingRoot: rootDir,
  // Mongoose loads native-ish driver code at runtime; keep it out of the bundle.
  serverExternalPackages: ['mongoose'],
  allowedDevOrigins: devOrigins(),
  async redirects() {
    if (!SMS_ENABLED) return []
    // The bulk-SMS page used to live at /text-blasts.
    return [{ source: '/text-blasts', destination: '/sms', permanent: true }]
  },
}

export default nextConfig
