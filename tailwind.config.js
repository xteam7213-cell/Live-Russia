/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#070707',
          900: '#0b0b0c',
          850: '#101012',
          800: '#141417',
          750: '#19191d',
          700: '#1f1f24',
          600: '#2a2a31',
          500: '#3a3a43',
          400: '#54545f',
          300: '#7a7a86',
          200: '#a8a8b3',
          100: '#d6d6dd',
        },
        gold: {
          50: '#fffbe8',
          100: '#fdf0bf',
          200: '#f7d977',
          300: '#f0c63a',
          400: '#e6b322',
          500: '#d4a017',
          600: '#b8830f',
          700: '#94680b',
          800: '#6b4d09',
          900: '#4a3508',
        },
        accent: {
          green: '#3ecf8e',
          red: '#ef4444',
          amber: '#f59e0b',
          blue: '#3b82f6',
          violet: '#8b5cf6',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Oswald', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        gold: '0 0 0 1px rgba(212,160,23,0.25), 0 8px 30px -8px rgba(212,160,23,0.35)',
        'gold-lg': '0 0 0 1px rgba(212,160,23,0.3), 0 20px 60px -15px rgba(212,160,23,0.45)',
        panel: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 12px 40px -12px rgba(0,0,0,0.6)',
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #f0c63a 0%, #d4a017 50%, #94680b 100%)',
        'gold-sheen': 'linear-gradient(110deg, transparent 30%, rgba(240,198,58,0.18) 50%, transparent 70%)',
        'radial-gold': 'radial-gradient(circle at 50% 0%, rgba(212,160,23,0.15), transparent 60%)',
        'grid-dark': 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
      },
      backgroundSize: {
        'grid-32': '32px 32px',
      },
      keyframes: {
        sheen: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(200%)' },
        },
        pulseRing: {
          '0%': { boxShadow: '0 0 0 0 rgba(62,207,142,0.5)' },
          '70%': { boxShadow: '0 0 0 6px rgba(62,207,142,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(62,207,142,0)' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        sheen: 'sheen 2.5s ease-in-out infinite',
        'pulse-ring': 'pulseRing 2s infinite',
        'fade-up': 'fadeUp 0.4s ease-out both',
        shimmer: 'shimmer 2s infinite',
      },
    },
  },
  plugins: [],
};
