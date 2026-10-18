import { Link as RouterLink } from 'react-router-dom'
import { Button, Chip, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import PageHeader from '../shared/ui/PageHeader'
import { expenses, categoryLabel } from '../entities/expense'
import { trips } from '../entities/trip'
import { formatDate, formatMoney } from '../shared/lib/format'
export default function ExpensesPage() {
  return (
    <>
      <PageHeader
        title="Расходы"
        subtitle="Авансовые отчёты по командировкам"
        action={
          <Button component={RouterLink} to="/expenses/new" variant="contained" startIcon={<AddIcon />}>
            Добавить расход
          </Button>
        }
      />
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Дата</TableCell>
              <TableCell>Описание</TableCell>
              <TableCell>Командировка</TableCell>
              <TableCell>Категория</TableCell>
              <TableCell>Чек</TableCell>
              <TableCell align="right">Сумма</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {expenses.map((e) => (
              <TableRow key={e.id} hover>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(e.date)}</TableCell>
                <TableCell>{e.description}</TableCell>
                <TableCell>{trips.find((t) => t.id === e.tripId)?.destination}</TableCell>
                <TableCell>{categoryLabel[e.category]}</TableCell>
                <TableCell>
                  <Chip size="small" label={e.hasReceipt ? 'Есть' : 'Нет'} color={e.hasReceipt ? 'success' : 'warning'} variant="outlined" />
                </TableCell>
                <TableCell align="right">{formatMoney(e.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  )
}
