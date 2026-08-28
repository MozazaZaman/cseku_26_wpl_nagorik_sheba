/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        night: '#05070f',
        panel: '#0b1020',
        accent: '#5b8cff',
        accent2: '#a76cff',
        accent3: '#ff6cb5',
        mint: '#2dd4bf',
        amber: '#fbbf24'
      },
      fontFamily: {
        display: ['Sora', 'sans-serif'],
        body: ['Inter', 'sans-serif']
      },
      boxShadow: {
        glow: '0 0 40px -8px rgba(91,140,255,.45)',
        glowPink: '0 0 40px -8px rgba(255,108,181,.4)'
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
