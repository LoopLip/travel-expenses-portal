import { Card, CardContent, Grid, LinearProgress, Typography } from '@mui/material'
import PageHeader from '../shared/ui/PageHeader'
import { budgets } from '../entities/budget'
import { trips } from '../entities/trip'
import { formatMoney } from '../shared/lib/format'
export default function BudgetsPage() {
  return (
    <>
      <PageHeader title="Бюджеты" subtitle="Лимиты отделов и резерв под согласованные поездки" />
      <Grid container spacing={2}>
        {budgets.map((b) => {
          const reserved = trips
            .filter((t) => t.budgetId === b.id && t.status !== 'rejected' && t.status !== 'draft')
            .reduce((s, t) => s + t.plannedAmount, 0)
          const pct = Math.round((reserved / b.limit) * 100)
          return (
            <Grid key={b.id} size={{ xs: 12, md: 4 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6">{b.department}</Typography>
                  <Typography color="text.secondary" gutterBottom>{b.period}</Typography>
                  <Typography>Лимит: {formatMoney(b.limit)}</Typography>
                  <Typography>Зарезервировано: {formatMoney(reserved)}</Typography>
                  <Typography>Остаток: {formatMoney(b.limit - reserved)}</Typography>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(100, pct)}
                    color={pct > 90 ? 'error' : pct > 70 ? 'warning' : 'primary'}
                    sx={{ height: 8, borderRadius: 4, mt: 2 }}
                  />
                  <Typography variant="caption" color="text.secondary">Использовано {pct}%</Typography>
                </CardContent>
              </Card>
            </Grid>
          )
        })}
      </Grid>
    </>
  )
}
