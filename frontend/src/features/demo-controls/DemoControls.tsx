import { useState } from 'react'
import { Button, FormControlLabel, Stack, Switch, Typography } from '@mui/material'
import { clearDemoData, getDemoSettings, resetDemoData, setDemoSettings } from '@/shared/api'
import type { DemoSettings } from '@/shared/api'
import { useNotify } from '@/shared/ui'

/** Панель демо-режима: помогает показать состояния «загрузка», «ошибка» и «нет данных». */
export default function DemoControls() {
  const [settings, setSettings] = useState<DemoSettings>(getDemoSettings())
  const notify = useNotify()

  const update = (patch: Partial<DemoSettings>) => {
    setDemoSettings(patch)
    setSettings(getDemoSettings())
  }

  return (
    <Stack spacing={0.5} sx={{ p: 2 }}>
      <Typography variant="overline" color="text.secondary">Демо-режим</Typography>
      <FormControlLabel
        control={<Switch size="small" checked={settings.slowNetwork} onChange={(e) => update({ slowNetwork: e.target.checked })} />}
        label="Медленная сеть"
      />
      <FormControlLabel
        control={<Switch size="small" checked={settings.failRequests} onChange={(e) => update({ failRequests: e.target.checked })} />}
        label="Имитировать ошибку"
      />
      <Button size="small" onClick={() => { resetDemoData(); notify('Демо-данные восстановлены', 'info') }}>Сбросить данные</Button>
      <Button size="small" color="warning" onClick={() => { clearDemoData(); notify('Все демо-данные удалены', 'info') }}>Очистить данные</Button>
    </Stack>
  )
}
