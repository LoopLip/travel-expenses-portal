import { createTheme } from '@mui/material/styles'

export const theme = createTheme({
  palette: {
    primary: { main: '#1565c0' },
    secondary: { main: '#00897b' },
    background: { default: '#f4f6fa' },
  },
  shape: { borderRadius: 10 },
  typography: { fontFamily: '"Roboto", "Segoe UI", Arial, sans-serif' },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        a: { color: '#1565c0', textDecorationColor: 'rgba(21,101,192,0.4)' },
        // prefers-reduced-motion: отключаем CSS-анимации и переходы
        '@media (prefers-reduced-motion: reduce)': {
          '*, *::before, *::after': {
            animationDuration: '0.01ms !important',
            animationIterationCount: '1 !important',
            transitionDuration: '0.01ms !important',
            scrollBehavior: 'auto !important',
          },
        },
      },
    },
    MuiCard: { defaultProps: { variant: 'outlined' } },
    MuiButton: { styleOverrides: { root: { textTransform: 'none' } } },
  },
})
