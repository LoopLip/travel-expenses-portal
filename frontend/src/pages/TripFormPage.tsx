import { useNavigate, useParams } from 'react-router-dom'
import { Card, CardContent } from '@mui/material'
import { budgetApi } from '@/entities/budget'
import { tripApi } from '@/entities/trip'
import { userApi } from '@/entities/user'
import { TripForm } from '@/features/trip-save'
import { useQuery } from '@/shared/lib'
import { PageHeader, QueryBoundary } from '@/shared/ui'
import NotFoundPage from './NotFoundPage'
import { ApiError } from '@/shared/api'

/** Страница создания (`/trips/new`) и редактирования (`/trips/:id/edit`) командировки. */
export default function TripFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const editId = id ? Number(id) : undefined
  const query = useQuery(async () => {
    const [users, budgets] = await Promise.all([userApi.list(), budgetApi.list()])
    try {
      const trip = editId ? await tripApi.get(editId) : undefined
      return { users, budgets, trip, missing: false }
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return { users, budgets, trip: undefined, missing: true }
      throw e
    }
  }, [editId])

  if (query.data?.missing) return <NotFoundPage />

  return (
    <>
      <PageHeader
        title={editId ? 'Редактирование командировки' : 'Новая заявка на командировку'}
        subtitle={editId ? 'Измените данные поездки и сохраните' : 'Заполните данные поездки и создайте заявку'}
      />
      <QueryBoundary query={query} isEmpty={() => false} empty={{ title: '' }} skeletonRows={5}>
        {({ users, budgets, trip }) => (
          <Card>
            <CardContent>
              <TripForm
                trip={trip}
                users={users}
                budgets={budgets}
                onSaved={(saved) => navigate(`/trips/${saved.id}`)}
                onCancel={() => navigate(editId ? `/trips/${editId}` : '/trips')}
              />
            </CardContent>
          </Card>
        )}
      </QueryBoundary>
    </>
  )
}
