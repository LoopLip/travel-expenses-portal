import type { ReactNode } from 'react'
import { Box, Card, CardContent, Typography } from '@mui/material'
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff'

/** Общая рамка страниц входа и регистрации: без бокового меню, форма по центру. */
export default function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2, bgcolor: 'background.default' }}>
      <Card sx={{ width: '100%', maxWidth: 440 }}>
        <CardContent sx={{ p: { xs: 2.5, sm: 4 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'primary.main', mb: 2 }}>
            <FlightTakeoffIcon />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Командировки и расходы</Typography>
          </Box>
          <Typography variant="h5" component="h1" gutterBottom>{title}</Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>{subtitle}</Typography>
          {children}
        </CardContent>
      </Card>
    </Box>
  )
}
