import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['@prisma/client', '@prisma/studio-core', 'prisma'],
  turbopack: {
    root: 'C:/Projects/concilio_2/concilio',
  },
}

export default nextConfig
