/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#0A0E17',
        surface: '#131826',
        'surface-2': '#1C2333',
        'border-subtle': 'rgba(255,255,255,0.06)',
        'accent-magenta': '#FF2D78',
        'accent-cyan': '#00D4FF',
        success: '#00C896',
        warning: '#FFB830',
        danger: '#FF4757',
        'text-primary': '#F5F6FA',
        'text-muted': '#8B92A8',
      },
      fontFamily: {
        heading: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'glow-magenta': 'radial-gradient(circle, rgba(255,45,120,0.15) 0%, transparent 70%)',
        'glow-cyan': 'radial-gradient(circle, rgba(0,212,255,0.15) 0%, transparent 70%)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'radar-ring': 'radarRing 3s ease-out infinite',
        'scan-line': 'scanLine 2s ease-in-out infinite',
        'blink': 'blink 1s step-end infinite',
      },
      keyframes: {
        radarRing: {
          '0%': { transform: 'scale(0)', opacity: '0.8' },
          '100%': { transform: 'scale(2.5)', opacity: '0' },
        },
        scanLine: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
      },
      boxShadow: {
        'glow-cyan': '0 0 20px rgba(0,212,255,0.3)',
        'glow-magenta': '0 0 20px rgba(255,45,120,0.3)',
        'glow-danger': '0 0 20px rgba(255,71,87,0.3)',
        'glow-success': '0 0 20px rgba(0,200,150,0.3)',
      },
    },
  },
  plugins: [],
};
