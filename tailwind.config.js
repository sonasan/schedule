/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Shift-state palette, referenced throughout the UI.
        state: {
          off: '#9ca3af',
          open: '#2563eb',
          close: '#7c3aed',
          oncall: '#d97706',
          timed: '#059669',
          unknown: '#cbd5e1',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
