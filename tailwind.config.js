/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Neutral zinc monochrome surfaces
        brand: {
          dark: '#09090b',     // bg-zinc-950
          surface: '#18181b',  // bg-zinc-900
          card: '#27272a',     // bg-zinc-800
          border: '#3f3f46',   // border-zinc-700
          muted: '#a1a1aa',    // text-zinc-400
          light: '#f4f4f5',    // text-zinc-100
        },
        // Premium minimalist rose/coral/salmon modern accent
        accent: {
          DEFAULT: '#f43f5e',  // rose-500
          hover: '#e11d48',    // rose-600
          light: '#fda4af',    // rose-300
        }
      },
      boxShadow: {
        'premium': '0 4px 20px -2px rgba(0, 0, 0, 0.4), 0 2px 8px -1px rgba(0, 0, 0, 0.2)',
      }
    },
  },
  plugins: [],
}
