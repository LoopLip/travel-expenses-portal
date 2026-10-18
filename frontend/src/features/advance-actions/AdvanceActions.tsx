import { useState } from 'react'
import { Button, Menu, MenuItem } from '@mui/material'
import { advanceApi, advanceStatusLabel, advanceStatuses } from '@/entities/advance'
import type { Advance, AdvanceStatus } from '@/entities/advance'
import { errorMessage } from '@/shared/api'
import { ConfirmDeleteButton, useNotify } from '@/shared/ui'

export function AdvanceStatusMenu({ advance }: { advance: Advance }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [busy, setBusy] = useState(false)
  const notify = useNotify()

  const change = async (status: AdvanceStatus) => {
    setAnchor(null)
    if (status === advance.status) return
    setBusy(true)
    try {
      await advanceApi.update(advance.id, { status })
      notify(`Статус аванса: ${advanceStatusLabel[status].text}`)
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button size="small" disabled={busy} onClick={(e) => setAnchor(e.currentTarget)} aria-haspopup="menu">Статус</Button>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {advanceStatuses.map((s) => (
          <MenuItem key={s} selected={s === advance.status} onClick={() => change(s)}>{advanceStatusLabel[s].text}</MenuItem>
        ))}
      </Menu>
    </>
  )
}

export function DeleteAdvanceButton({ advance }: { advance: Advance }) {
  return (
    <ConfirmDeleteButton
      title="Удалить аванс?"
      text="Запись об авансе будет удалена. Это действие нельзя отменить."
      successMessage="Аванс удалён"
      label="Удалить аванс"
      action={() => advanceApi.remove(advance.id)}
    />
  )
}
