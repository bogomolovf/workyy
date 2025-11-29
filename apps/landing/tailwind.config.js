/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'wy-bg': '#ffffff',
        'wy-bg-subtle': '#f0f9ff',
        'wy-primary': '#2563eb',
        'wy-primary-soft': '#dbeafe',
        'wy-secondary': '#60a5fa',
        'wy-text': '#0f172a',
        'wy-muted': '#64748b',
        'wy-border': '#e0f2fe',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      maxWidth: {
        'container-sm': '640px',
        'container-md': '768px',
        'container-lg': '1024px',
        'container-xl': '1280px',
      },
      boxShadow: {
        'theme-sm': 'var(--shadow-sm)',
        'theme-md': 'var(--shadow-md)',
        'theme-lg': 'var(--shadow-lg)',
        'soft': 'var(--shadow-soft)',
      },
      borderRadius: {
        'card': 'var(--radius-card)',
        'pill': 'var(--radius-pill)',
        'button': 'var(--radius-button)',
      },
    },
  },
  plugins: [],
}

