import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { TransitionGroup } from 'react-transition-group'
import {
  Button, Chip, InputAdornment, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import SearchIcon from '@mui/icons-material/Search'
import { categoryLabel, expenseApi, expenseCategories } from '@/entities/expense'
import { usePermissions } from '@/entities/session'
import type { ExpenseCategory } from '@/entities/expense'
import { tripApi } from '@/entities/trip'
import { DeleteExpenseButton, EditExpenseButton, ExpenseDialog, OpenReceiptButton } from '@/features/expense-actions'
import { formatDate, formatMoney, useDebouncedValue, useQuery } from '@/shared/lib'
import { FadeRow, PageHeader, QueryBoundary } from '@/shared/ui'

export default function ExpensesPage() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<'all' | ExpenseCategory>('all')
  const [open, setOpen] = useState(false)
  const allow = usePermissions()
  const q = useDebouncedValue(search.trim())
  const filtered = category !== 'all' || q !== ''
  const query = useQuery(
    async (signal) => {
      // Категория и поиск по описанию — параметры запроса, отбор выполняет сервер
      const [expenses, trips] = await Promise.all([
        expenseApi.list({ category: category === 'all' ? undefined : category, q: q || undefined }, signal),
        tripApi.list({}, signal),
      ])
      return { expenses, trips }
    },
    [category, q],
  )
  // Бухгалтер расходы только просматривает
  const addButton = allow.writeExpense() ? <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>Добавить расход</Button> : undefined

  return (
    <>
      <PageHeader title="Расходы" subtitle="Расходы по командировкам" action={addButton && (
        <Stack direction="row" spacing={1}>
          <Button component={RouterLink} to="/expenses/new">Со страницы чека</Button>
          {addButton}
        </Stack>
      )} />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <TextField size="small" label="Поиск" placeholder="Описание расхода" value={search} onChange={(e) => setSearch(e.target.value)}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }} sx={{ minWidth: 260 }} />
        <TextField size="small" select label="Категория" value={category} onChange={(e) => setCategory(e.target.value as 'all' | ExpenseCategory)} sx={{ minWidth: 200 }}>
          <MenuItem value="all">Все категории</MenuItem>
          {expenseCategories.map((c) => <MenuItem key={c} value={c}>{categoryLabel[c]}</MenuItem>)}
        </TextField>
      </Stack>
      <QueryBoundary
        query={query}
        isEmpty={(d) => d.expenses.length === 0}
        empty={
          filtered
            ? { title: 'Ничего не найдено', action: <Button onClick={() => { setSearch(''); setCategory('all') }}>Сбросить фильтры</Button> }
            : { title: 'Расходов пока нет', description: 'Добавьте первый расход и приложите фото чека.', action: addButton }
        }
      >
        {({ expenses: visible, trips }) => {
          const names = new Map(trips.map((t) => [t.id, t.destination]))
          return (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Дата</TableCell><TableCell>Описание</TableCell><TableCell>Командировка</TableCell><TableCell>Категория</TableCell>
                    <TableCell>Чек</TableCell><TableCell align="right">Сумма</TableCell><TableCell align="right" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TransitionGroup component={null}>
                    {visible.map((e) => (
                      <FadeRow key={e.id}>
                        <TableRow hover data-testid="expense-row">
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(e.expense_date)}</TableCell>
                          <TableCell>{e.description}</TableCell>
                          <TableCell><RouterLink to={`/trips/${e.trip_id}`}>{names.get(e.trip_id) ?? `№${e.trip_id}`}</RouterLink></TableCell>
                          <TableCell>{categoryLabel[e.category]}</TableCell>
                          <TableCell><Chip size="small" label={e.receipt_url ? 'Есть' : 'Нет'} color={e.receipt_url ? 'success' : 'warning'} variant="outlined" /></TableCell>
                          <TableCell align="right">{formatMoney(e.amount)}</TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}><OpenReceiptButton expense={e} />{allow.writeExpense() && <><EditExpenseButton expense={e} /><DeleteExpenseButton expense={e} /></>}</TableCell>
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
      <ExpenseDialog open={open} onClose={() => setOpen(false)} />
    </>
  )
}
