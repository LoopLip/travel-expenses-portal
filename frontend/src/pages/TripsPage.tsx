import { useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import {
  Button, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, ToggleButton, ToggleButtonGroup,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import PageHeader from '../shared/ui/PageHeader'
import StatusChip from '../shared/ui/StatusChip'
import { trips, tripStatusLabel } from '../entities/trip'
import type { TripStatus } from '../entities/trip'
import { formatDate, formatMoney } from '../shared/lib/format'
type Filter = 'all' | TripStatus

export default function TripsPage() {
  const [filter, setFilter] = useState<Filter>('all')
  const navigate = useNavigate()
  const visible = filter === 'all' ? trips : trips.filter((t) => t.status === filter)

  return (
    <>
      <PageHeader
        title="РљРѕРјР°РЅРґРёСЂРѕРІРєРё"
        subtitle="Р—Р°СЏРІРєРё СЃРѕС‚СЂСѓРґРЅРёРєРѕРІ Рё РёС… СЃС‚Р°С‚СѓСЃС‹"
        action={
          <Button component={RouterLink} to="/trips/new" variant="contained" startIcon={<AddIcon />}>
            РќРѕРІР°СЏ Р·Р°СЏРІРєР°
          </Button>
        }
      />

      <ToggleButtonGroup
        size="small"
        exclusive
        value={filter}
        onChange={(_, v: Filter | null) => v && setFilter(v)}
        sx={{ mb: 2, flexWrap: 'wrap' }}
      >
        <ToggleButton value="all">Р’СЃРµ</ToggleButton>
        {(Object.keys(tripStatusLabel) as TripStatus[]).map((s) => (
          <ToggleButton key={s} value={s}>{tripStatusLabel[s].text}</ToggleButton>
        ))}
      </ToggleButtonGroup>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>РќР°РїСЂР°РІР»РµРЅРёРµ</TableCell>
              <TableCell>РЎРѕС‚СЂСѓРґРЅРёРє</TableCell>
              <TableCell>Р”Р°С‚С‹</TableCell>
              <TableCell align="right">РџР»Р°РЅ</TableCell>
              <TableCell>РЎС‚Р°С‚СѓСЃ</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.map((t) => (
              <TableRow key={t.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/trips/${t.id}`)}>
                <TableCell>{t.destination}</TableCell>
                <TableCell>{t.employee}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(t.startDate)} вЂ” {formatDate(t.endDate)}</TableCell>
                <TableCell align="right">{formatMoney(t.plannedAmount)}</TableCell>
                <TableCell><StatusChip {...tripStatusLabel[t.status]} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  )
}
