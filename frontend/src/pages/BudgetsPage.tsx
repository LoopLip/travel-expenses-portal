import { Grow, Grid, Card, CardContent, Typography } from '@mui/material'
import { AnimatedBar, useBudgetUsage } from '@/features/budget-usage'
import { formatMoney } from '@/shared/lib'
import { useMotionTimeout } from '@/shared/lib'
import { PageHeader, QueryBoundary } from '@/shared/ui'

export default function BudgetsPage() {
  const query = useBudgetUsage()
  const timeout = useMotionTimeout(400)
  return (
    <>
      <PageHeader title="Бюджеты" subtitle="Лимиты отделов и резерв под согласованные поездки" />
      <QueryBoundary query={query} empty={{ title: 'Бюджетов нет', description: 'Бюджеты появятся после их создания.' }} skeletonRows={3}>
        {(budgets) => (
          <Grid container spacing={2}>
            {budgets.map((b, i) => (
              <Grow in appear key={b.id} timeout={timeout} style={{ transitionDelay: `${i * 80}ms` }}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Card data-testid="budget-card"><CardContent>
                    <Typography variant="h6">{b.department}</Typography>
                    <Typography color="text.secondary" gutterBottom>{b.period}</Typography>
                    <Typography>Лимит: {formatMoney(b.limit_amount)}</Typography>
                    <Typography>Зарезервировано: {formatMoney(b.reserved)}</Typography>
                    <Typography>Остаток: {formatMoney(b.remaining)}</Typography>
                    <div style={{ marginTop: 16 }}><AnimatedBar percent={b.percent} /></div>
                    <Typography variant="caption" color="text.secondary">Использовано {b.percent}%</Typography>
                  </CardContent></Card>
                </Grid>
              </Grow>
            ))}
          </Grid>
        )}
      </QueryBoundary>
    </>
  )
}
