/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      /**
       * 色板全部走 CSS 变量（见 src/index.css 的 :root / html.dark）。
       * 这样切换深色时不用给几百个类名各写一份 dark: 变体——
       * 变量一换，`bg-white`、`text-ink-700`、`border-ink-200` 自动跟着变。
       * 具体做法是把 ink 的明暗顺序在深色下整条倒过来：ink-50 变最深、
       * ink-900 变最亮，于是「浅底深字」的组件在深色下自然是「深底浅字」。
       */
      colors: {
        ink: {
          50: 'rgb(var(--c-ink-50) / <alpha-value>)',
          100: 'rgb(var(--c-ink-100) / <alpha-value>)',
          200: 'rgb(var(--c-ink-200) / <alpha-value>)',
          300: 'rgb(var(--c-ink-300) / <alpha-value>)',
          400: 'rgb(var(--c-ink-400) / <alpha-value>)',
          500: 'rgb(var(--c-ink-500) / <alpha-value>)',
          600: 'rgb(var(--c-ink-600) / <alpha-value>)',
          700: 'rgb(var(--c-ink-700) / <alpha-value>)',
          800: 'rgb(var(--c-ink-800) / <alpha-value>)',
          900: 'rgb(var(--c-ink-900) / <alpha-value>)',
        },
        accent: {
          50: 'rgb(var(--c-accent-50) / <alpha-value>)',
          100: 'rgb(var(--c-accent-100) / <alpha-value>)',
          200: 'rgb(var(--c-accent-200) / <alpha-value>)',
          300: 'rgb(var(--c-accent-300) / <alpha-value>)',
          400: 'rgb(var(--c-accent-400) / <alpha-value>)',
          500: 'rgb(var(--c-accent-500) / <alpha-value>)',
          600: 'rgb(var(--c-accent-600) / <alpha-value>)',
          700: 'rgb(var(--c-accent-700) / <alpha-value>)',
          800: 'rgb(var(--c-accent-800) / <alpha-value>)',
          900: 'rgb(var(--c-accent-900) / <alpha-value>)',
        },
        /* 面板色：随主题走（白 / 深灰）。界面上一切「白底」都用 bg-surface */
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        /* 反色块：深色代码框、遮罩。深浅模式下都保持深，不参与反转 */
        solid: 'rgb(var(--c-solid) / <alpha-value>)',
        /* 纯白：只用于「深底上的浅字」，永远不变 */
        white: '#ffffff',
        /* 语义色：纸张永远是纸，界面底色跟着主题走 */
        canvas: 'rgb(var(--c-canvas) / <alpha-value>)',
        paper: 'rgb(var(--c-paper) / <alpha-value>)',
      },
      fontFamily: {
        serif: ['"Latin Modern Roman"', 'Songti SC', 'SimSun', 'Georgia', 'serif'],
        sans: ['Inter', '"PingFang SC"', '"Microsoft YaHei"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Cascadia Code"', 'Consolas', 'monospace'],
      },
      boxShadow: {
        panel: '0 12px 40px -12px rgb(var(--c-shadow) / 0.28)',
        hud: '0 18px 46px -14px rgb(var(--c-shadow) / 0.35)',
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
