import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { TransitionGroup } from 'react-transition-group'
import { Button, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, ToggleButton, ToggleButtonGroup } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { AdvanceStatusChip, advanceApi, advanceStatusLabel, advanceStatuses } from '@/entities/advance'
import type { AdvanceStatus } from '@/entities/advance'
import { tripApi } from '@/entities/trip'
import { AdvanceRequestDialog, AdvanceStatusMenu, DeleteAdvanceButton } from '@/features/advance-actions'
import { useSession } from '@/entities/session'
import { formatDate, formatMoney, useQuery } from '@/shared/lib'
import { EmptyState, FadeRow, PageHeader, QueryBoundary } from '@/shared/ui'

export default function AdvancesPage() {
  const [status, setStatus] = useState<'all' | AdvanceStatus>('all')
  const [open, setOpen] = useState(false)
  const role = useSession().user?.role
  const query = useQuery(async () => {
    const [advances, trips] = await Promise.all([advanceApi.list(), tripApi.list()])
    return { advances, trips }
  })
  const requestButton = <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>Запросить аванс</Button>

  return (
    <>
      <PageHeader title="Авансы" subtitle="Запросы и выдача авансов на командировки" action={requestButton} />
      <QueryBoundary
        query={query}
        isEmpty={(d) => d.advances.length === 0}
        empty={{ title: 'Авансов пока нет', description: 'Запросите аванс под командировку.', action: requestButton }}
      >
        {({ advances, trips }) => {
          const names = new Map(trips.map((t) => [t.id, t.destination]))
          const visible = advances.filter((a) => status === 'all' || a.status === status)
          return (
            <>
              <ToggleButtonGroup size="small" exclusive value={status} onChange={(_, v: typeof status | null) => v && setStatus(v)} sx={{ mb: 2, flexWrap: 'wrap' }} aria-label="Фильтр по статусу аванса">
                <ToggleButton value="all">Все</ToggleButton>
                {advanceStatuses.map((s) => <ToggleButton key={s} value={s}>{advanceStatusLabel[s].text}</ToggleButton>)}
              </ToggleButtonGroup>
              {visible.length === 0 ? (
                <EmptyState title="Нет авансов с таким статусом" action={<Button onClick={() => setStatus('all')}>Показать все</Button>} />
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Командировка</TableCell><TableCell>Дата запроса</TableCell>
                        <TableCell align="right">Сумма</TableCell><TableCell>Статус</TableCell><TableCell align="right">Действия</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TransitionGroup component={null}>
                        {visible.map((a) => (
                          <FadeRow key={a.id}>
                            <TableRow hover data-testid="advance-row">
                              <TableCell><RouterLink to={`/trips/${a.trip_id}`}>{names.get(a.trip_id) ?? `№${a.trip_id}`}</RouterLink></TableCell>
                              <TableCell>{formatDate(a.requested_at)}</TableCell>
                              <TableCell align="right">{formatMoney(a.amount)}</TableCell>
                              <TableCell><AdvanceStatusChip status={a.status} /></TableCell>
                              <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                <Stack direction="row" sx={{ justifyContent: 'flex-end', alignItems: 'center' }}>{role === 'accountant' && <AdvanceStatusMenu advance={a} />}<DeleteAdvanceButton advance={a} /></Stack>
                              </TableCell>
                            </TableRow>
                          </FadeRow>
                        ))}
                      </TransitionGroup>
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </>
          )
        }}
      </QueryBoundary>
      <AdvanceRequestDialog open={open} onClose={() => setOpen(false)} />
    </>
  )
}
