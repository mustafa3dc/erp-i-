/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f3ff',
          100: '#ede9fe',
          500: '#6366f1', // Indigo primary
          600: '#4f46e5',
          700: '#4338ca',
        }
      },
      fontFamily: {
        tajawal: ["Tajawal", "sans-serif"],
        outfit: ["Outfit", "sans-serif"],
      }
    },
  },
  plugins: [],
}
