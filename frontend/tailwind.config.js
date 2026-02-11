/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './src/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                background: '#0F0F0F',
                surface: '#1A1A2E',
                'surface-hover': '#252542',
                border: '#2A2A4A',
                'border-active': '#6366F1',
                primary: {
                    DEFAULT: '#6366F1',
                    hover: '#818CF8',
                    light: '#A5B4FC',
                    dark: '#4F46E5',
                },
                accent: {
                    green: '#10B981',
                    red: '#EF4444',
                    yellow: '#F59E0B',
                    blue: '#3B82F6',
                    purple: '#8B5CF6',
                },
                text: {
                    primary: '#FFFFFF',
                    secondary: '#9CA3AF',
                    muted: '#6B7280',
                },
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                mono: ['JetBrains Mono', 'Menlo', 'monospace'],
            },
            boxShadow: {
                glow: '0 0 20px rgba(99, 102, 241, 0.15)',
                'glow-lg': '0 0 40px rgba(99, 102, 241, 0.25)',
                card: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -2px rgba(0, 0, 0, 0.2)',
            },
            borderRadius: {
                xl: '1rem',
                '2xl': '1.5rem',
            },
            animation: {
                'fade-in': 'fadeIn 0.3s ease-out',
                'slide-up': 'slideUp 0.4s ease-out',
                'pulse-glow': 'pulseGlow 2s infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                pulseGlow: {
                    '0%, 100%': { boxShadow: '0 0 20px rgba(99, 102, 241, 0.15)' },
                    '50%': { boxShadow: '0 0 30px rgba(99, 102, 241, 0.3)' },
                },
            },
        },
    },
    plugins: [],
};
