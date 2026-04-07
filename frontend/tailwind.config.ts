import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  safelist: [
    'bg-kraft-50', 'bg-kraft-100', 'bg-kraft-200', 'bg-kraft-300',
    'bg-kraft-400', 'bg-kraft-500', 'bg-kraft-600', 'bg-kraft-700',
    'bg-kraft-800', 'bg-kraft-900',
    'text-kraft-50', 'text-kraft-100', 'text-kraft-200', 'text-kraft-300',
    'text-kraft-400', 'text-kraft-500', 'text-kraft-600', 'text-kraft-700',
    'text-kraft-800', 'text-kraft-900',
    'border-kraft-200', 'border-kraft-300', 'border-kraft-400',
    'bg-accent-sage', 'bg-accent-rust', 'bg-accent-slate',
    'text-accent-sage', 'text-accent-rust', 'text-accent-slate',
  ],
  theme: {
    extend: {
      colors: {
        kraft: {
          50:  '#fdf8f0',
          100: '#f5ead8',
          200: '#e8d5b7',
          300: '#d4b896',
          400: '#b8956d',
          500: '#8b6b47',
          600: '#6b4f32',
          700: '#4a3320',
          800: '#2d1f12',
          900: '#1a0f07',
        },
        accent: {
          sage:  '#4a7c59',
          rust:  '#c0562a',
          slate: '#4a5568',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
} satisfies Config
