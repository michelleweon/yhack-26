import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './client/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        title: ['Bangers', 'cursive'],
        ui: ['"Barlow Condensed"', 'sans-serif'],
        handwritten: ['Caveat', 'cursive'],
        newspaper: ['"Special Elite"', 'cursive'],
        tradeWinds: ['"Trade Winds"', 'cursive'],
      },
      colors: {
        vault: {
          steel: '#4a5568',
          rivet: '#718096',
          dark: '#1a202c',
          darker: '#0d1117',
          gold: '#d69e2e',
          'gold-light': '#ecc94b',
          red: '#e53e3e',
          green: '#38a169',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};

export default config;
