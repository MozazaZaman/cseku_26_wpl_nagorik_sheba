/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Theme-aware palette driven by CSS variables (see src/index.css).
        // Dark values are the defaults on <html>; .light overrides them.
        night: 'rgb(var(--ns-night) / <alpha-value>)',
        panel: 'rgb(var(--ns-panel) / <alpha-value>)',
        accent: 'rgb(var(--ns-accent) / <alpha-value>)',
        accent2: 'rgb(var(--ns-accent2) / <alpha-value>)',
        accent3: 'rgb(var(--ns-accent3) / <alpha-value>)',
        mint: 'rgb(var(--ns-mint) / <alpha-value>)',
        amber: 'rgb(var(--ns-amber) / <alpha-value>)',

        // Neutrals remapped to theme tokens so every existing
        // text-white / text-slate-* / bg-white usage flips with the theme.
        white: 'rgb(var(--ns-fg) / <alpha-value>)',
        black: 'rgb(var(--ns-black) / <alpha-value>)',
        slate: {
          50: 'rgb(var(--ns-slate-50) / <alpha-value>)',
          100: 'rgb(var(--ns-slate-100) / <alpha-value>)',
          200: 'rgb(var(--ns-slate-200) / <alpha-value>)',
          300: 'rgb(var(--ns-slate-300) / <alpha-value>)',
          400: 'rgb(var(--ns-slate-400) / <alpha-value>)',
          500: 'rgb(var(--ns-slate-500) / <alpha-value>)',
          600: 'rgb(var(--ns-slate-600) / <alpha-value>)',
          700: 'rgb(var(--ns-slate-700) / <alpha-value>)',
          800: 'rgb(var(--ns-slate-800) / <alpha-value>)',
          900: 'rgb(var(--ns-slate-900) / <alpha-value>)'
        },

        // Status hues keep their identity but soften/darken in light mode
        sky: {
          300: 'rgb(var(--ns-sky-300) / <alpha-value>)',
          400: 'rgb(var(--ns-sky-400) / <alpha-value>)',
          500: 'rgb(var(--ns-sky-500) / <alpha-value>)'
        },
        violet: {
          300: 'rgb(var(--ns-violet-300) / <alpha-value>)',
          400: 'rgb(var(--ns-violet-400) / <alpha-value>)',
          500: 'rgb(var(--ns-violet-500) / <alpha-value>)'
        },
        amber: {
          300: 'rgb(var(--ns-warn-300) / <alpha-value>)',
          400: 'rgb(var(--ns-warn-400) / <alpha-value>)',
          500: 'rgb(var(--ns-warn-500) / <alpha-value>)'
        },
        emerald: {
          300: 'rgb(var(--ns-emerald-300) / <alpha-value>)',
          400: 'rgb(var(--ns-emerald-400) / <alpha-value>)',
          500: 'rgb(var(--ns-emerald-500) / <alpha-value>)'
        },
        rose: {
          300: 'rgb(var(--ns-rose-300) / <alpha-value>)',
          400: 'rgb(var(--ns-rose-400) / <alpha-value>)',
          500: 'rgb(var(--ns-rose-500) / <alpha-value>)'
        },
        onaccent: 'rgb(var(--ns-on-accent) / <alpha-value>)'
      },
      fontFamily: {
        display: ['Sora', 'sans-serif'],
        body: ['Inter', 'sans-serif']
      },
      boxShadow: {
        glow: '0 0 40px -8px rgb(var(--ns-accent) / 0.45)',
        glowPink: '0 0 40px -8px rgb(var(--ns-accent3) / 0.4)'
      },
      keyframes: {
        floaty: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-14px)' } },
        pulseRing: {
          '0%': { transform: 'scale(.8)', opacity: '.9' },
          '100%': { transform: 'scale(2.1)', opacity: '0' }
        },
        shimmer: { '0%': { backgroundPosition: '-400px 0' }, '100%': { backgroundPosition: '400px 0' } }
      },
      animation: {
        floaty: 'floaty 7s ease-in-out infinite',
        pulseRing: 'pulseRing 1.6s ease-out infinite'
      }
    }
  },
  plugins: []
};
