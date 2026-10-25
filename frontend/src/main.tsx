import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { CssBaseline, ThemeProvider } from '@mui/material'
import App from './app/App'
import { theme } from './app/theme/theme'
import SessionProvider from './app/providers/SessionProvider'
import { NotificationsProvider } from './shared/ui'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <NotificationsProvider>
        <BrowserRouter>
          <SessionProvider>
            <App />
          </SessionProvider>
        </BrowserRouter>
      </NotificationsProvider>
    </ThemeProvider>
  </StrictMode>,
)
