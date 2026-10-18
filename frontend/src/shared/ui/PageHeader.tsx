import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'

interface Props {
  title: string
  subtitle?: string
  action?: ReactNode
}

export default function PageHeader({ title, subtitle, action }: Props) {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
      <Box>
        <Typography variant="h4" component="h1" sx={{ fontSize: { xs: '1.5rem', sm: '2rem' } }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography color="text.secondary">{subtitle}</Typography>
        )}
      </Box>
      {action}
    </Box>
  )
}
