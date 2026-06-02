/** @type {import('next').NextConfig} */
const nextConfig = {
  // Needed for Supabase SSR cookie handling
  experimental: {},
  allowedDevOrigins: ['192.168.1.2'],
}

export default nextConfig
