/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // 资源色板
        wood: '#a06840',
        clay: '#c9a068',
        iron: '#7a7a7a',
        crop: '#8cab3d',
        // 主题色（通过 CSS 变量驱动，支持外观商城切换主题）
        pop: 'var(--pop)',
        'pop-hover': 'var(--accent-hover)',
        bg: {
          primary: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          card: 'var(--bg-card)',
          'card-hover': 'var(--bg-card-hover)',
        },
        surface: 'var(--bg-card)',
        border: 'var(--border)',
        muted: 'var(--text-muted)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)',
      },
    },
  },
  plugins: [],
}
