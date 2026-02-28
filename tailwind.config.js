/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'gpt-dark': '#0a0a0f',
        'gpt-secondary': '#13131a',
        'gpt-tertiary': '#1a1a24',
        'gpt-hover': '#242430',
        'gpt-border': '#2d2d3a',
        'gpt-accent': '#10a37f',
        'gpt-accent-hover': '#1a7f64',
      },
      fontFamily: {
        'sans': ['Söhne', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
