import { useState } from 'react'
import { Box, Button, Card, CardContent, Grid, Grow, Stack, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { usePermissions } from '@/entities/session'
import { BudgetDialog, DeleteBudgetButton, EditBudgetButton } from '@/features/budget-manage'
import { AnimatedBar, useBudgetUsage } from '@/features/budget-usage'
import { formatMoney, useMotionTimeout } from '@/shared/lib'
import { PageHeader, QueryBoundary } from '@/shared/ui'

export default function BudgetsPage() {
  const query = useBudgetUsage()
  const timeout = useMotionTimeout(400)
  const [open, setOpen] = useState(false)
  // Создавать, изменять и удалять бюджеты могут руководитель и бухгалтер, сотрудник только смотрит
  const manage = usePermissions().manageBudgets()
  const addButton = manage ? <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>Новый бюджет</Button> : undefined

  return (
    <>
      <PageHeader title="Бюджеты" subtitle="Лимиты отделов и резерв под поездки (кроме черновиков и отклонённых)" action={addButton} />
      <QueryBoundary
        query={query}
        empty={{ title: 'Бюджетов нет', description: manage ? 'Создайте бюджет отдела, чтобы оформлять командировки.' : 'Бюджеты появятся после их создания руководителем или бухгалтером.', action: addButton }}
        skeletonRows={3}
      >
        {(budgets) => (
          <Grid container spacing={2}>
            {budgets.map((b, i) => (
              <Grow in appear key={b.id} timeout={timeout} style={{ transitionDelay: `${i * 80}ms` }}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Card data-testid="budget-card"><CardContent>
                    <Stack direction="row" sx={{ alignItems: 'flex-start' }}>
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography variant="h6" noWrap>{b.department}</Typography>
                        <Typography color="text.secondary" gutterBottom>{b.period}</Typography>
                      </Box>
                      {manage && <><EditBudgetButton budget={b} /><DeleteBudgetButton budget={b} /></>}
                    </Stack>
                    <Typography>Лимит: {formatMoney(b.limit_amount)}</Typography>
                    <Typography>Зарезервировано: {formatMoney(b.reserved)}</Typography>
                    <Typography color={b.percent > 100 ? 'error' : undefined}>Остаток: {formatMoney(b.remaining)}</Typography>
                    <div style={{ marginTop: 16 }}><AnimatedBar percent={b.percent} /></div>
                    <Typography variant="caption" color="text.secondary">Использовано {b.percent}%</Typography>
                  </CardContent></Card>
                </Grid>
              </Grow>
            ))}
          </Grid>
        )}
      </QueryBoundary>
      <BudgetDialog open={open} onClose={() => setOpen(false)} />
    </>
  )
}
