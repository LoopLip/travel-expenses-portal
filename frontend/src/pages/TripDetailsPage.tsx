import { Link as RouterLink, useParams } from 'react-router-dom'
import {
  Button, Card, CardContent, Divider, Grid, List, ListItem, ListItemText, Stack, Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PageHeader from '../shared/ui/PageHeader'
import StatusChip from '../shared/ui/StatusChip'
import NotFoundPage from './NotFoundPage'
import { advances, advanceStatusLabel } from '../entities/advance'
import { budgets } from '../entities/budget'
import { expenses, categoryLabel } from '../entities/expense'
import { trips, tripStatusLabel } from '../entities/trip'
import { formatDate, formatMoney } from '../shared/lib/format'
export default function TripDetailsPage() {
  const { id } = useParams()
  const trip = trips.find((t) => t.id === Number(id))
  if (!trip) return <NotFoundPage />

  const tripAdvances = advances.filter((a) => a.tripId === trip.id)
  const tripExpenses = expenses.filter((e) => e.tripId === trip.id)
  const budget = budgets.find((b) => b.id === trip.budgetId)
  const spent = tripExpenses.reduce((s, e) => s + e.amount, 0)

  return (
    <>
      <Button component={RouterLink} to="/trips" startIcon={<ArrowBackIcon />} sx={{ mb: 1 }}>
        К списку
      </Button>
      <PageHeader
        title={trip.destination}
        subtitle={`${trip.purpose} · ${formatDate(trip.startDate)} — ${formatDate(trip.endDate)}`}
        action={<StatusChip {...tripStatusLabel[trip.status]} />}
      />

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Сводка</Typography>
              <Stack spacing={1}>
                <Typography>Сотрудник: {trip.employee}</Typography>
                <Typography>Бюджет: {budget?.department} ({budget?.period})</Typography>
                <Typography>План: {formatMoney(trip.plannedAmount)}</Typography>
                <Typography>Потрачено по чекам: {formatMoney(spent)}</Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Авансы</Typography>
              {tripAdvances.length === 0 && <Typography color="text.secondary">Авансы не запрашивались</Typography>}
              <List disablePadding>
                {tripAdvances.map((a) => (
                  <ListItem key={a.id} disableGutters secondaryAction={<StatusChip {...advanceStatusLabel[a.status]} />}>
                    <ListItemText primary={formatMoney(a.amount)} secondary={`Запрос от ${formatDate(a.requestedAt)}`} />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Расходы</Typography>
              {tripExpenses.length === 0 && <Typography color="text.secondary">Расходов пока нет</Typography>}
              <List disablePadding>
                {tripExpenses.map((e, i) => (
                  <div key={e.id}>
                    {i > 0 && <Divider />}
                    <ListItem disableGutters secondaryAction={<Typography>{formatMoney(e.amount)}</Typography>}>
                      <ListItemText
                        primary={e.description}
                        secondary={`${categoryLabel[e.category]} · ${formatDate(e.date)}`}
                        sx={{ pr: 10 }}
                      />
                    </ListItem>
                  </div>
                ))}
              </List>
              <Button component={RouterLink} to="/expenses/new" sx={{ mt: 1 }}>Добавить расход</Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </>
  )
}
