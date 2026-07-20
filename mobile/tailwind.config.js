/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        bsplic: {
          background: '#090005',
          card: '#1a050d',
          primary: '#ff0a54',
          yellow: '#ffe14a',
        },
      },
    },
  },
  plugins: [],
};
