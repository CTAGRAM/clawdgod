/** @type {import('next').NextConfig} */
const nextConfig = {
    transpilePackages: ['@clawdgod/shared'],
    experimental: {
        serverActions: {
            bodySizeLimit: '2mb',
        },
    },
    env: {
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
        NEXT_PUBLIC_ABLY_KEY: process.env.NEXT_PUBLIC_ABLY_KEY || '',
    },
};

export default nextConfig;
