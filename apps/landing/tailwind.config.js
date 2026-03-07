/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'wy-page': 'var(--page)',
        'wy-surface': 'var(--surface-solid)',
        'wy-text': 'var(--text)',
        'wy-text-hero': 'var(--text-on-hero)',
        'wy-muted': 'var(--text-muted)',
        'wy-primary': 'var(--primary)',
        'wy-primary-contrast': 'var(--primary-contrast)',
        'wy-border': 'var(--border)',
        'wy-accent-cyan': 'var(--accent-cyan)',
        'wy-accent-blue': 'var(--accent-blue)',
        'wy-accent-violet': 'var(--accent-violet)',
      },
      spacing: {
        18: '4.5rem',
        88: '22rem',
        128: '32rem',
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
        ring: 'var(--ring)',
      },
      borderRadius: {
        'r-sm': 'var(--r-sm)',
        'r-md': 'var(--r-md)',
        'r-lg': 'var(--r-lg)',
      },
    },
  },
  plugins: [],
};
