/** @type {import('tailwindcss').Config} */
// Theme tokens are the locked "ink on tactical paper" palette (PRD §4).
// Defined here as named utilities so components never hardcode hex values.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#F3F6F3',
        surface: '#FFFFFF',
        border: '#DDE4DF',
        node: '#22312A',
        'node-dim': '#C9D2CC',
        'edge-forward': '#0F9E8E',
        'edge-lateral': '#6B7A82',
        'edge-backward': '#7C3AED',
        spotlight: '#E0A000',
        'cluster-1': '#0072B2',
        'cluster-2': '#009E73',
        'cluster-3': '#D55E00',
        'cluster-4': '#CC79A7',
        'cluster-5': '#56B4E9',
        text: '#22312A',
        'text-muted': '#6B7A82',
        'isolate-veil': '#E8ECE9',
      },
      fontFamily: {
        display: ['Archivo', 'system-ui', 'sans-serif'],
        'display-expanded': ['"Archivo Expanded"', 'Archivo', 'sans-serif'],
        body: ['"Hanken Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
