/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f7f8fa',
          100: '#eef0f4',
          200: '#dfe3ea',
          300: '#c6ccd8',
          400: '#8e97a8',
          500: '#5d6779',
          600: '#414b5c',
          700: '#2f3846',
          800: '#1f2733',
          900: '#141a23',
        },
        accent: {
          50: '#eef4ff',
          100: '#dbe6ff',
          200: '#bed2ff',
          300: '#91b4ff',
          400: '#5d8bfa',
          500: '#3b6ef0',
          600: '#2a55d4',
          700: '#2344ab',
          800: '#223d87',
          900: '#1f356b',
        },
      },
      fontFamily: {
        serif: ['"Latin Modern Roman"', 'Songti SC', 'SimSun', 'Georgia', 'serif'],
        sans: ['Inter', '"PingFang SC"', '"Microsoft YaHei"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Cascadia Code"', 'Consolas', 'monospace'],
      },
      boxShadow: {
        panel: '0 12px 40px -12px rgba(20, 26, 35, 0.28)',
        hud: '0 18px 46px -14px rgba(20, 26, 35, 0.35)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: { 'fade-up': 'fade-up .18s ease-out' },
    },
  },
  plugins: [],
}
