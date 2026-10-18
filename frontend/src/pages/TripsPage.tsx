import { useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { TransitionGroup } from 'react-transition-group'
import { Button, IconButton, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import { TripStatusChip, tripApi } from '@/entities/trip'
import { userApi } from '@/entities/user'
import { DeleteTripButton } from '@/features/trip-delete'
import { TripFilters, applyTripFilter, initialTripFilter } from '@/features/trip-filter'
import { formatDate, formatMoney, useQuery } from '@/shared/lib'
import { EmptyState, FadeRow, PageHeader, QueryBoundary } from '@/shared/ui'

export default function TripsPage() {
  const [filter, setFilter] = useState(initialTripFilter)
  const navigate = useNavigate()
  const query = useQuery(async () => {
    const [trips, users] = await Promise.all([tripApi.list(), userApi.list()])
    return { trips, users }
  })
  const newButton = <Button component={RouterLink} to="/trips/new" variant="contained" startIcon={<AddIcon />}>Новая заявка</Button>

  return (
    <>
      <PageHeader title="Командировки" subtitle="Заявки сотрудников и их статусы" action={newButton} />
      <QueryBoundary
        query={query}
        isEmpty={(d) => d.trips.length === 0}
        empty={{ title: 'Командировок пока нет', description: 'Создайте первую заявку, чтобы начать работу.', action: newButton }}
      >
        {({ trips, users }) => {
          const visible = applyTripFilter(trips, users, filter)
          const names = new Map(users.map((u) => [u.id, u.full_name]))
          return (
            <>
              <TripFilters value={filter} onChange={setFilter} />
              {visible.length === 0 ? (
                <EmptyState
                  title="Ничего не найдено"
                  description="Измените условия поиска или сбросьте фильтры."
                  action={<Button onClick={() => setFilter(initialTripFilter)}>Сбросить фильтры</Button>}
                />
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Направление</TableCell>
                        <TableCell>Сотрудник</TableCell>
                        <TableCell>Даты</TableCell>
                        <TableCell align="right">План</TableCell>
                        <TableCell>Статус</TableCell>
                        <TableCell align="right">Действия</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TransitionGroup component={null}>
                        {visible.map((t) => (
                          <FadeRow key={t.id}>
                            <TableRow hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/trips/${t.id}`)} data-testid="trip-row">
                              <TableCell>{t.destination}</TableCell>
                              <TableCell>{names.get(t.user_id) ?? '—'}</TableCell>
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(t.start_date)} — {formatDate(t.end_date)}</TableCell>
                              <TableCell align="right">{formatMoney(t.planned_amount)}</TableCell>
                              <TableCell><TripStatusChip status={t.status} /></TableCell>
                              <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                <Tooltip title="Редактировать">
                                  <IconButton size="small" aria-label="Редактировать" onClick={(e) => { e.stopPropagation(); navigate(`/trips/${t.id}/edit`) }}>
                                    <EditOutlinedIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <DeleteTripButton trip={t} />
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
    </>
  )
}
