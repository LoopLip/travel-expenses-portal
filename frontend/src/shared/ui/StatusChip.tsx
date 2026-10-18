import { Chip } from '@mui/material'

export type ChipColor = 'default' | 'warning' | 'success' | 'error' | 'info'

interface Props {
  text: string
  color: ChipColor
}

export default function StatusChip({ text, color }: Props) {
  return <Chip size="small" label={text} color={color} variant={color === 'default' ? 'outlined' : 'filled'} />
}
