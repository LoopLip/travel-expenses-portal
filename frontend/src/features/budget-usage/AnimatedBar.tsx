import { useEffect, useState } from 'react'
import { LinearProgress } from '@mui/material'

/** Индикатор бюджета: плавно «заполняется» от нуля при появлении и при изменении значения. */
export default function AnimatedBar({ percent }: { percent: number }) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setValue(Math.min(100, percent)))
    return () => cancelAnimationFrame(id)
  }, [percent])

  return (
    <LinearProgress
      variant="determinate"
      value={value}
      color={percent > 90 ? 'error' : percent > 70 ? 'warning' : 'primary'}
      sx={{ height: 8, borderRadius: 4, '& .MuiLinearProgress-bar': { transition: 'transform 0.9s ease' } }}
      aria-label={`Использовано ${percent}%`}
    />
  )
}
