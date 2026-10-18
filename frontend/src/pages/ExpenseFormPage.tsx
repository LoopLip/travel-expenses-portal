import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@mui/material'
import { tripApi } from '@/entities/trip'
import { ExpenseForm } from '@/features/expense-actions'
import { useQuery } from '@/shared/lib'
import { PageHeader, QueryBoundary } from '@/shared/ui'

export default function ExpenseFormPage() {
  const navigate = useNavigate()
  const trips = useQuery(() => tripApi.list())
  return (
    <>
      <PageHeader title="Новый расход" subtitle="Загрузите фото чека — сумма и дата подставятся автоматически" />
      <QueryBoundary query={trips} empty={{ title: 'Нет командировок', description: 'Сначала создайте командировку, к которой относится расход.' }} skeletonRows={5}>
        {(list) => (
          <Card><CardContent>
            <ExpenseForm
              trips={list.map((t) => ({ id: t.id, label: t.destination }))}
              onSaved={() => navigate('/expenses')}
              onCancel={() => navigate('/expenses')}
            />
          </CardContent></Card>
        )}
      </QueryBoundary>
    </>
  )
}
