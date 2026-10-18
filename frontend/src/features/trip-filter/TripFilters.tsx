import { InputAdornment, TextField, ToggleButton, ToggleButtonGroup, Stack } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import { tripStatusLabel, tripStatuses } from '@/entities/trip'
import type { TripFilterState } from './filter'

interface Props {
  value: TripFilterState
  onChange: (next: TripFilterState) => void
}

export default function TripFilters({ value, onChange }: Props) {
  return (
    <Stack spacing={2} sx={{ mb: 2 }}>
      <TextField
        size="small"
        label="Поиск"
        placeholder="Направление, цель или сотрудник"
        value={value.search}
        onChange={(e) => onChange({ ...value, search: e.target.value })}
        slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
        sx={{ maxWidth: 420 }}
      />
      <ToggleButtonGroup
        size="small"
        exclusive
        value={value.status}
        onChange={(_, status: TripFilterState['status'] | null) => status && onChange({ ...value, status })}
        sx={{ flexWrap: 'wrap' }}
        aria-label="Фильтр по статусу"
      >
        <ToggleButton value="all">Все</ToggleButton>
        {tripStatuses.map((s) => (
          <ToggleButton key={s} value={s}>{tripStatusLabel[s].text}</ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Stack>
  )
}
