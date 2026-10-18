import { Link as RouterLink } from 'react-router-dom'
import { Button, Card, CardContent, Grid, MenuItem, Stack, TextField } from '@mui/material'
import PageHeader from '../shared/ui/PageHeader'
import { budgets } from '../entities/budget'
// Лаб. №1: только вёрстка формы. Отправка и валидация появятся в следующих работах.
export default function TripFormPage() {
  return (
    <>
      <PageHeader title="Новая заявка на командировку" subtitle="Заполните данные поездки и отправьте на согласование" />
      <Card>
        <CardContent>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Направление" fullWidth />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Бюджет" select fullWidth defaultValue={budgets[0].id}>
                {budgets.map((b) => (
                  <MenuItem key={b.id} value={b.id}>{b.department} ({b.period})</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField label="Цель поездки" fullWidth multiline minRows={2} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField label="Дата начала" type="date" fullWidth slotProps={{ inputLabel: { shrink: true } }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField label="Дата окончания" type="date" fullWidth slotProps={{ inputLabel: { shrink: true } }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField label="Плановая сумма, ₽" type="number" fullWidth />
            </Grid>
          </Grid>
          <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
            <Button variant="contained">Отправить на согласование</Button>
            <Button component={RouterLink} to="/trips">Отмена</Button>
          </Stack>
        </CardContent>
      </Card>
    </>
  )
}
