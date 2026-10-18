import { useState } from 'react'
import { Button, Menu, MenuItem } from '@mui/material'
import { tripApi, tripStatusLabel, tripStatuses } from '@/entities/trip'
import type { Trip, TripStatus } from '@/entities/trip'
import { errorMessage } from '@/shared/api'
import { useNotify } from '@/shared/ui'

/** Смена статуса командировки (PATCH /trips/{id} с одним полем status). */
export default function TripStatusMenu({ trip }: { trip: Trip }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [busy, setBusy] = useState(false)
  const notify = useNotify()

  const change = async (status: TripStatus) => {
    setAnchor(null)
    if (status === trip.status) return
    setBusy(true)
    try {
      await tripApi.update(trip.id, { status })
      notify(`Статус изменён: ${tripStatusLabel[status].text}`)
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button variant="outlined" size="small" disabled={busy} onClick={(e) => setAnchor(e.currentTarget)} aria-haspopup="menu">
        {busy ? 'Меняем…' : 'Изменить статус'}
      </Button>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {tripStatuses.map((s) => (
          <MenuItem key={s} selected={s === trip.status} onClick={() => change(s)}>
            {tripStatusLabel[s].text}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}
