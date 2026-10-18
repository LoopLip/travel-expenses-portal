import { Link as RouterLink } from 'react-router-dom'
import { Button, Card, CardContent, Grid, List, ListItem, ListItemText, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { advanceApi } from '@/entities/advance'
import { budgetApi } from '@/entities/budget'
import { expenseApi } from '@/entities/expense'
import { TripStatusChip, tripApi } from '@/entities/trip'
import { AnimatedBar, computeBudgetUsage } from '@/features/budget-usage'
import { formatDate, formatMoney, fromKopecks, sumKopecks, todayIso, useQuery } from '@/shared/lib'
import { EmptyState, PageHeader, QueryBoundary } from '@/shared/ui'

export default function DashboardPage() {
  const query = useQuery(async () => {
    const [trips, advances, expenses, budgets] = await Promise.all([tripApi.list(), advanceApi.list(), expenseApi.list(), budgetApi.list()])
    return { trips, advances, expenses, budgets }
  })

  return (
    <>
      <PageHeader
        title="Обзор"
        subtitle="Сводка по командировкам, авансам и бюджетам"
        action={<Button component={RouterLink} to="/trips/new" variant="contained" startIcon={<AddIcon />}>Новая заявка</Button>}
      />
      <QueryBoundary
        query={query}
        skeletonRows={5}
        isEmpty={(d) => d.trips.length === 0 && d.budgets.length === 0}
        empty={{ title: 'Данных пока нет', description: 'Создайте первую командировку, и здесь появится сводка.', action: <Button component={RouterLink} to="/trips/new" variant="contained">Новая заявка</Button> }}
      >
        {({ trips, advances, expenses, budgets }) => {
          const upcoming = trips
            .filter((t) => t.status !== 'rejected' && t.end_date >= todayIso())
            .sort((a, b) => a.start_date.localeCompare(b.start_date))
            .slice(0, 4)
          const stats = [
            { label: 'На согласовании', value: String(trips.filter((t) => t.status === 'pending').length) },
            { label: 'Согласованные поездки', value: String(trips.filter((t) => t.status === 'approved').length) },
            { label: 'Выданные авансы', value: formatMoney(fromKopecks(sumKopecks(advances.filter((a) => a.status === 'issued').map((a) => a.amount)))) },
            { label: 'Расходы с чеками', value: formatMoney(fromKopecks(sumKopecks(expenses.filter((e) => e.receipt_url).map((e) => e.amount)))) },
          ]
          return (
            <Grid container spacing={2}>
              {stats.map((s) => (
                <Grid key={s.label} size={{ xs: 12, sm: 6, md: 3 }}>
                  <Card><CardContent>
                    <Typography color="text.secondary" variant="body2">{s.label}</Typography>
                    <Typography variant="h5" sx={{ mt: 0.5 }}>{s.value}</Typography>
                  </CardContent></Card>
                </Grid>
              ))}
              <Grid size={{ xs: 12, md: 6 }}>
                <Card sx={{ height: '100%' }}><CardContent>
                  <Typography variant="h6" gutterBottom>Ближайшие командировки</Typography>
                  {upcoming.length === 0 ? (
                    <EmptyState title="Нет предстоящих поездок" />
                  ) : (
                    <List disablePadding>
                      {upcoming.map((t) => (
                        <ListItem key={t.id} disableGutters divider secondaryAction={<TripStatusChip status={t.status} />}>
                          <ListItemText
                            sx={{ pr: 12 }}
                            primary={<RouterLink to={`/trips/${t.id}`}>{t.destination}</RouterLink>}
                            secondary={`${formatDate(t.start_date)} — ${formatDate(t.end_date)}`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  )}
                </CardContent></Card>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Card sx={{ height: '100%' }}><CardContent>
                  <Typography variant="h6" gutterBottom>Использование бюджетов</Typography>
                  {computeBudgetUsage(budgets, trips).map((b) => (
                    <div key={b.id} style={{ marginBottom: 16 }}>
                      <Typography variant="body2">{b.department}: {formatMoney(b.reserved)} из {formatMoney(b.limit_amount)}</Typography>
                      <div style={{ marginTop: 4 }}><AnimatedBar percent={b.percent} /></div>
                    </div>
                  ))}
                </CardContent></Card>
              </Grid>
            </Grid>
          )
        }}
      </QueryBoundary>
    </>
  )
}
