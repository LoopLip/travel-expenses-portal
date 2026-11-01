import { useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { TransitionGroup } from 'react-transition-group'
import { Button, IconButton, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import { isStaff, usePermissions, useSession, usersApi } from '@/entities/session'
import { TripStatusChip, tripApi } from '@/entities/trip'
import { DeleteTripButton } from '@/features/trip-delete'
import { TripFilters, initialTripFilter, isFilterActive, toTripListFilter } from '@/features/trip-filter'
import { formatDate, formatMoney, useDebouncedValue, useQuery } from '@/shared/lib'
import { FadeRow, PageHeader, QueryBoundary } from '@/shared/ui'

export default function TripsPage() {
  const [filter, setFilter] = useState(initialTripFilter)
  const search = useDebouncedValue(filter.search)
  const navigate = useNavigate()
  const { user } = useSession()
  const staff = Boolean(user && isStaff(user.role))
  const allow = usePermissions()
  const query = useQuery(
    async (signal) => {
      // Фильтр по статусу и поиск выполняет сервер (GET /trips?status=&q=)
      const [trips, users] = await Promise.all([
        tripApi.list(toTripListFilter({ status: filter.status, search }), signal),
        staff ? usersApi.list(signal) : Promise.resolve(user ? [user] : []),
      ])
      return { trips, users }
    },
    [filter.status, search, staff],
  )
  // Бухгалтер командировки не создаёт и не изменяет — кнопок у него нет
  const newButton = allow.createTrip() ? <Button component={RouterLink} to="/trips/new" variant="contained" startIcon={<AddIcon />}>Новая заявка</Button> : undefined

  return (
    <>
      <PageHeader title="Командировки" subtitle={staff ? 'Заявки сотрудников и их статусы' : 'Ваши заявки и их статусы'} action={newButton} />
      <TripFilters value={filter} onChange={setFilter} />
      <QueryBoundary
        query={query}
        isEmpty={(d) => d.trips.length === 0}
        empty={
          isFilterActive(filter)
            ? { title: 'Ничего не найдено', description: 'Измените условия поиска или сбросьте фильтры.', action: <Button onClick={() => setFilter(initialTripFilter)}>Сбросить фильтры</Button> }
            : { title: 'Командировок пока нет', description: 'Создайте первую заявку, чтобы начать работу.', action: newButton }
        }
      >
        {({ trips, users }) => {
          const names = new Map(users.map((u) => [u.id, u.full_name]))
          return (
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
                    {trips.map((t) => (
                      <FadeRow key={t.id}>
                        <TableRow hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/trips/${t.id}`)} data-testid="trip-row">
                          <TableCell>{t.destination}</TableCell>
                          <TableCell>{names.get(t.user_id) ?? '—'}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(t.start_date)} — {formatDate(t.end_date)}</TableCell>
                          <TableCell align="right">{formatMoney(t.planned_amount)}</TableCell>
                          <TableCell><TripStatusChip status={t.status} /></TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                            {allow.editTrip(t) && (
                              <>
                                <Tooltip title="Редактировать">
                                  <IconButton size="small" aria-label="Редактировать" onClick={(e) => { e.stopPropagation(); navigate(`/trips/${t.id}/edit`) }}>
                                    <EditOutlinedIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <DeleteTripButton trip={t} />
                              </>
                            )}
                          </TableCell>
                        </TableRow>
                      </FadeRow>
                    ))}
                  </TransitionGroup>
                </TableBody>
              </Table>
            </TableContainer>
          )
        }}
      </QueryBoundary>
    </>
  )
}
