const defaultTheme = require('tailwindcss/defaultTheme')

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', ...defaultTheme.fontFamily.sans],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      boxShadow: {
        card:     '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.05)',
        'card-hover': '0 4px 12px -2px rgb(15 23 42 / 0.08), 0 2px 4px -2px rgb(15 23 42 / 0.05)',
        popover:  '0 10px 38px -10px rgb(15 23 42 / 0.25), 0 10px 20px -15px rgb(15 23 42 / 0.2)',
        glow:     '0 0 0 1px rgb(99 102 241 / 0.15), 0 8px 24px -6px rgb(99 102 241 / 0.35)',
      },
      keyframes: {
        'fade-in':   { from: { opacity: '0' }, to: { opacity: '1' } },
        'scale-in':  { from: { opacity: '0', transform: 'scale(0.96) translateY(4px)' }, to: { opacity: '1', transform: 'scale(1) translateY(0)' } },
        'slide-up':  { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'slide-down':{ from: { opacity: '0', transform: 'translateY(-4px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'toast-in':  { from: { opacity: '0', transform: 'translateY(12px) scale(0.97)' }, to: { opacity: '1', transform: 'translateY(0) scale(1)' } },
        shimmer:     { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-in':    'fade-in 150ms ease-out',
        'scale-in':   'scale-in 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-up':   'slide-up 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down': 'slide-down 140ms ease-out',
        'toast-in':   'toast-in 260ms cubic-bezier(0.16, 1, 0.3, 1)',
        shimmer:      'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
}
