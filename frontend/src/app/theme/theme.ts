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
    MuiCssBaseline: { styleOverrides: { a: { color: '#1565c0', textDecorationColor: 'rgba(21,101,192,0.4)' } } },
    MuiCard: { defaultProps: { variant: 'outlined' } },
    MuiButton: { styleOverrides: { root: { textTransform: 'none' } } },
  },
})
