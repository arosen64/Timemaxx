import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    path.join(__dirname, './index.html'),
    path.join(__dirname, './src/**/*.{js,ts,jsx,tsx}'),
  ],
  theme: {
    extend: {
      colors: {
        navy: '#002D72',
        teal: '#86C8BC',
        'sky-blue': '#68ACE5',
        'slate-blue': '#4E6A8C',
        'light-blue': '#8FA6C2',
        border: '#D8E4F0',
        'bg-gray': '#F5F7FA',
        'urgent-red': '#CF4520',
        'urgent-red-light': '#FFF0EC',
        'dark-red': '#A6192E',
        success: '#008767',
        'success-light': '#E6F5F0',
        'info-bg': '#EBF5FF',
        'info-emphasis': '#0077D8',
        'info-dark': '#005A8E',
        'today-col': '#F0F5FF',
      },
      spacing: {
        '4.5': '1.125rem',
      },
      fontFamily: {
        heading: ['Space Grotesk', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
