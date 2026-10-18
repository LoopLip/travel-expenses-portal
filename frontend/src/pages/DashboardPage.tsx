import { Link as RouterLink } from 'react-router-dom'
import { Button, Card, CardContent, Grid, LinearProgress, List, ListItem, ListItemText, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import PageHeader from '../shared/ui/PageHeader'
import StatusChip from '../shared/ui/StatusChip'
import { advances } from '../entities/advance'
import { budgets } from '../entities/budget'
import { expenses } from '../entities/expense'
import { trips, tripStatusLabel } from '../entities/trip'
import { formatDate, formatMoney } from '../shared/lib/format'
export default function DashboardPage() {
  const pending = trips.filter((t) => t.status === 'pending').length
  const upcoming = trips.filter((t) => t.status === 'approved').length
  const advanceTotal = advances.filter((a) => a.status === 'issued').reduce((s, a) => s + a.amount, 0)
  const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0)

  const stats = [
    { label: 'На согласовании', value: String(pending) },
    { label: 'Предстоящие поездки', value: String(upcoming) },
    { label: 'Выданные авансы', value: formatMoney(advanceTotal) },
    { label: 'Расходы по чекам', value: formatMoney(expenseTotal) },
  ]

  return (
    <>
      <PageHeader
        title="Обзор"
        subtitle="Сводка по командировкам, авансам и бюджетам"
        action={
          <Button component={RouterLink} to="/trips/new" variant="contained" startIcon={<AddIcon />}>
            Новая заявка
          </Button>
        }
      />

      <Grid container spacing={2}>
        {stats.map((s) => (
          <Grid key={s.label} size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" variant="body2">{s.label}</Typography>
                <Typography variant="h5" sx={{ mt: 0.5 }}>{s.value}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}

        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Ближайшие командировки</Typography>
              <List disablePadding>
                {trips.slice(0, 4).map((t) => (
                  <ListItem key={t.id} disableGutters divider secondaryAction={<StatusChip {...tripStatusLabel[t.status]} />}>
                    <ListItemText
                      sx={{ pr: 12 }}
                      primary={<RouterLink to={`/trips/${t.id}`}>{t.destination}</RouterLink>}
                      secondary={`${formatDate(t.startDate)} — ${formatDate(t.endDate)}`}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Использование бюджетов</Typography>
              {budgets.map((b) => {
                const spent = trips.filter((t) => t.budgetId === b.id && t.status !== 'rejected').reduce((s, t) => s + t.plannedAmount, 0)
                const pct = Math.min(100, Math.round((spent / b.limit) * 100))
                return (
                  <div key={b.id} style={{ marginBottom: 16 }}>
                    <Typography variant="body2">{b.department}: {formatMoney(spent)} из {formatMoney(b.limit)}</Typography>
                    <LinearProgress variant="determinate" value={pct} sx={{ height: 8, borderRadius: 4, mt: 0.5 }} />
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </>
  )
}
