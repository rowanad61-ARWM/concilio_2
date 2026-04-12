import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['@prisma/client', '@prisma/studio-core', 'prisma'],
}

export default nextConfig
