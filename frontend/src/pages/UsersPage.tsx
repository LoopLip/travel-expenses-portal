import { Chip, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material'
import { accountsApi, roleLabel } from '@/entities/session'
import { useQuery } from '@/shared/lib'
import { PageHeader, QueryBoundary } from '@/shared/ui'

/** Сотрудники: реальные данные из backend (GET /users). Доступно руководителю и бухгалтеру; остальным backend отвечает 403. */
export default function UsersPage() {
  const query = useQuery(() => accountsApi.list())
  return (
    <>
      <PageHeader title="Сотрудники" subtitle="Учётные записи пользователей (данные из backend)" />
      <QueryBoundary query={query} empty={{ title: 'Пользователей нет' }}>
        {(users) => (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Имя</TableCell><TableCell>Email</TableCell><TableCell>Отдел</TableCell><TableCell>Роль</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id} hover data-testid="user-row">
                    <TableCell>{u.full_name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{u.department ?? '—'}</TableCell>
                    <TableCell><Chip size="small" variant="outlined" label={roleLabel[u.role]} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </QueryBoundary>
    </>
  )
}
