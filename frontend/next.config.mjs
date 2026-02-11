/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    transpilePackages: ['@clawdgod/shared'],
    experimental: {
        serverActions: {
            bodySizeLimit: '2mb',
        },
    },
    env: {
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '',
        NEXT_PUBLIC_ABLY_KEY: process.env.NEXT_PUBLIC_ABLY_KEY || '',
        NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
    },
    // Allow webpack to resolve .js imports to .ts files (needed for ESM-style imports in shared package)
    webpack(config) {
        config.resolve.extensionAlias = {
            '.js': ['.ts', '.tsx', '.js', '.jsx'],
        };
        return config;
    },
    // Proxy /api/* to internal backend (port 3001) when running in combined mode
    async rewrites() {
        const backendUrl = process.env.BACKEND_INTERNAL_URL || 'http://localhost:3001';
        return [
            {
                source: '/api/:path*',
                destination: `${backendUrl}/api/:path*`,
            },
            {
                source: '/health',
                destination: `${backendUrl}/health`,
            },
        ];
    },
};

export default nextConfig;

