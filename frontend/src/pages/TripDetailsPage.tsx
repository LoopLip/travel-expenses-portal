import { useState } from 'react'
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom'
import { TransitionGroup } from 'react-transition-group'
import {
  Box, Button, Card, CardContent, Chip, Collapse, Grid, List, ListItem, ListItemText, Stack, Tab, Tabs, Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { AdvanceStatusChip, advanceApi } from '@/entities/advance'
import { budgetApi } from '@/entities/budget'
import { categoryLabel, expenseApi } from '@/entities/expense'
import { TripStatusChip, tripApi } from '@/entities/trip'
import { userApi } from '@/entities/user'
import { AdvanceRequestDialog, AdvanceStatusMenu, DeleteAdvanceButton, advanceLimitError } from '@/features/advance-actions'
import { DeleteExpenseButton, ExpenseDialog } from '@/features/expense-actions'
import { DeleteTripButton } from '@/features/trip-delete'
import { TripStatusMenu } from '@/features/trip-status'
import { ApiError } from '@/shared/api'
import { formatDate, formatMoney, fromKopecks, sumKopecks, toKopecks, useQuery } from '@/shared/lib'
import { EmptyState, FadeRow, PageHeader, QueryBoundary } from '@/shared/ui'
import NotFoundPage from './NotFoundPage'

type Tab = 'advances' | 'expenses' | 'summary'

export default function TripDetailsPage() {
  const { id } = useParams()
  const tripId = Number(id)
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('advances')
  const [more, setMore] = useState(false)
  const [advanceOpen, setAdvanceOpen] = useState(false)
  const [expenseOpen, setExpenseOpen] = useState(false)

  const query = useQuery(async () => {
    try {
      const trip = await tripApi.get(tripId)
      const [advances, expenses, budget, user] = await Promise.all([
        advanceApi.list(), expenseApi.list(), budgetApi.get(trip.budget_id), userApi.get(trip.user_id),
      ])
      return {
        trip,
        budget,
        user,
        advances: advances.filter((a) => a.trip_id === tripId),
        expenses: expenses.filter((e) => e.trip_id === tripId),
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null
      throw e
    }
  }, [tripId])

  if (query.data === null) return <NotFoundPage />

  return (
    <>
      <Button component={RouterLink} to="/trips" startIcon={<ArrowBackIcon />} sx={{ mb: 1 }}>К списку</Button>
      <QueryBoundary query={query} isEmpty={() => false} empty={{ title: '' }} skeletonRows={5}>
        {(data) => {
          if (!data) return null
          const { trip, budget, user, advances, expenses } = data
          const issued = sumKopecks(advances.map((a) => a.amount))
          const spent = sumKopecks(expenses.map((e) => e.amount))
          const planned = toKopecks(trip.planned_amount)
          return (
            <>
              <PageHeader
                title={trip.destination}
                subtitle={`${user.full_name} · ${formatDate(trip.start_date)} — ${formatDate(trip.end_date)}`}
                action={
                  <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    <TripStatusChip status={trip.status} />
                    <TripStatusMenu trip={trip} />
                    <Button size="small" startIcon={<EditOutlinedIcon />} component={RouterLink} to={`/trips/${trip.id}/edit`}>Изменить</Button>
                    <DeleteTripButton trip={trip} onDone={() => navigate('/trips')} />
                  </Stack>
                }
              />
              <Button size="small" onClick={() => setMore((m) => !m)} aria-expanded={more} endIcon={<ExpandMoreIcon sx={{ transform: more ? 'rotate(180deg)' : 'none', transition: 'transform .25s' }} />}>
                {more ? 'Скрыть подробности' : 'Подробнее'}
              </Button>
              <Collapse in={more}>
                <Card sx={{ my: 1 }}><CardContent>
                  <Typography><b>Цель:</b> {trip.purpose || '—'}</Typography>
                  <Typography><b>Бюджет:</b> {budget.department} ({budget.period})</Typography>
                  <Typography><b>Создана:</b> {formatDate(trip.created_at)}</Typography>
                </CardContent></Card>
              </Collapse>

              <Tabs value={tab} onChange={(_, v: Tab) => setTab(v)} sx={{ mt: 2, mb: 2 }} variant="scrollable">
                <Tab value="advances" label={`Авансы (${advances.length})`} />
                <Tab value="expenses" label={`Расходы (${expenses.length})`} />
                <Tab value="summary" label="Сводка" />
              </Tabs>

              {tab === 'advances' && (
                <Box>
                  <Button variant="contained" size="small" sx={{ mb: 2 }} onClick={() => setAdvanceOpen(true)}>Запросить аванс</Button>
                  {advances.length === 0 ? (
                    <EmptyState title="Авансы не запрашивались" description="Запросите аванс в пределах плановой суммы." />
                  ) : (
                    <List disablePadding>
                      <TransitionGroup component={null}>
                        {advances.map((a) => (
                          <FadeRow key={a.id}>
                            <ListItem divider disableGutters data-testid="advance-item"
                              secondaryAction={<Stack direction="row" sx={{ alignItems: 'center' }}><AdvanceStatusMenu advance={a} /><DeleteAdvanceButton advance={a} /></Stack>}>
                              <ListItemText primary={formatMoney(a.amount)} secondary={`Запрос от ${formatDate(a.requested_at)}`} sx={{ pr: 18 }} />
                              <AdvanceStatusChip status={a.status} />
                            </ListItem>
                          </FadeRow>
                        ))}
                      </TransitionGroup>
                    </List>
                  )}
                </Box>
              )}

              {tab === 'expenses' && (
                <Box>
                  <Button variant="contained" size="small" sx={{ mb: 2 }} onClick={() => setExpenseOpen(true)}>Добавить расход</Button>
                  {expenses.length === 0 ? (
                    <EmptyState title="Расходов пока нет" description="Добавьте расход и приложите фото чека." />
                  ) : (
                    <List disablePadding>
                      <TransitionGroup component={null}>
                        {expenses.map((e) => (
                          <FadeRow key={e.id}>
                            <ListItem divider disableGutters data-testid="expense-item"
                              secondaryAction={<Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}><Typography>{formatMoney(e.amount)}</Typography><DeleteExpenseButton expense={e} /></Stack>}>
                              <ListItemText primary={e.description} secondary={`${categoryLabel[e.category]} · ${formatDate(e.expense_date)}`} sx={{ pr: 14 }} />
                              {e.receipt_url ? <Chip size="small" color="success" variant="outlined" label="Чек" /> : <Chip size="small" color="warning" variant="outlined" label="Без чека" />}
                            </ListItem>
                          </FadeRow>
                        ))}
                      </TransitionGroup>
                    </List>
                  )}
                </Box>
              )}

              {tab === 'summary' && (
                <Grid container spacing={2}>
                  {[
                    ['Плановая сумма', formatMoney(trip.planned_amount)],
                    ['Запрошено авансов', formatMoney(fromKopecks(issued))],
                    ['Можно запросить ещё', formatMoney(fromKopecks(Math.max(0, planned - issued)))],
                    ['Расходы', formatMoney(fromKopecks(spent))],
                  ].map(([label, value]) => (
                    <Grid key={label} size={{ xs: 12, sm: 6, md: 3 }}>
                      <Card><CardContent>
                        <Typography color="text.secondary" variant="body2">{label}</Typography>
                        <Typography variant="h6">{value}</Typography>
                      </CardContent></Card>
                    </Grid>
                  ))}
                  {advanceLimitError(planned, issued, 0) && (
                    <Grid size={{ xs: 12 }}><Typography color="error">Авансов запрошено больше плановой суммы.</Typography></Grid>
                  )}
                </Grid>
              )}

              <AdvanceRequestDialog open={advanceOpen} onClose={() => setAdvanceOpen(false)} tripId={trip.id} />
              <ExpenseDialog open={expenseOpen} onClose={() => setExpenseOpen(false)} tripId={trip.id} />
            </>
          )
        }}
      </QueryBoundary>
    </>
  )
}
