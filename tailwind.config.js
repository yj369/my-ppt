/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        macBg: '#1e1e1e',
        macPanel: '#252526',
        macBorder: '#3e3e42',
        macAccent: '#007acc',
        macText: '#cccccc',
        macTextMuted: '#858585',
        macSelected: '#37373d',
        macButton: '#333333',
        macButtonHover: '#3e3e3e',
        macButtonActive: '#007acc',
        ritualBg: '#05060d',
        edBg: '#1a1a1a',
        edPanel: '#262626',
        edBorder: '#3d3d3d',
        edText: '#eee',
        edTextMuted: '#999',
        edAccent: '#0A84FF',
        edAccentHover: '#0060d1',
      },
      fontFamily: {
        sans: ['Inter', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
        serif: ['Cormorant Garamond', 'STSong', 'Songti SC', 'Georgia', 'serif'],
      },
      boxShadow: {
        ritual: '0 30px 80px rgba(0,0,0,0.6)',
      }
    },
  },
  plugins: [],
}
