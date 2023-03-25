module.exports = {
  content: ['./src/**/*.{tsx,ts}'],
  theme: {
    fontSize: {
      xxs: '10px',
      xs: '12px',
      sm: '13px',
      base: '14px',
      lg: '18px',
      xl: '20px',
      '2xl': '22px',
      '3xl': '24px',
      '4xl': '38px',
    },
    extend: {
      borderRadius: {
        xs: '1px',
        corner: '7px',
      },
      colors: {
        accent: '#007AFF',
        accentBg: '#007AFF10',
        light: {DEFAULT: 'rgba(255, 255, 255, .80)'},
        lighter: {DEFAULT: 'rgba(255, 255, 255, .90)'},
        dark: {DEFAULT: 'rgba(21, 21, 21, .65)'},
        darker: {DEFAULT: 'rgba(21, 21, 21, .7)'},
        lightHighlight: {DEFAULT: 'rgba(0, 0, 0, .1)'},
        darkHighlight: {DEFAULT: 'rgba(255, 255, 255, .05)'},
        darkBorder: {DEFAULT: 'rgba(255, 255, 255, .1)'},
        lightBorder: {DEFAULT: 'rgba(0, 0, 0, .1)'},
        buttonBorder: {DEFAULT: 'rgba(0, 0, 0, .03)'},
        keyBg: '#F4F5F8',
        proGray: {
          900: 'rgba(21, 22, 25, 0.9)',
        },
      },
    },
  },
}
