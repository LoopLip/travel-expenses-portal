import { useNavigate, useParams } from 'react-router-dom'
import { Card, CardContent } from '@mui/material'
import { budgetApi } from '@/entities/budget'
import { usePermissions, useSession, usersApi } from '@/entities/session'
import { tripApi } from '@/entities/trip'
import { TripForm } from '@/features/trip-save'
import { useQuery } from '@/shared/lib'
import { ErrorState, PageHeader, QueryBoundary } from '@/shared/ui'
import NotFoundPage from './NotFoundPage'

/** Страница создания (`/trips/new`) и редактирования (`/trips/:id/edit`) командировки. */
export default function TripFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useSession()
  const editId = id ? Number(id) : undefined
  const allow = usePermissions()
  // Выбирать сотрудника может только руководитель; сотрудник оформляет командировку на себя
  const chooseEmployee = allow.chooseTripEmployee()
  const query = useQuery(
    async (signal) => {
      const [users, budgets, trip] = await Promise.all([
        chooseEmployee ? usersApi.list(signal) : Promise.resolve([]),
        budgetApi.list(signal),
        editId ? tripApi.get(editId, signal) : Promise.resolve(undefined),
      ])
      return { users, budgets, trip }
    },
    [editId, chooseEmployee],
  )

  if (query.errorStatus === 404) return <NotFoundPage />
  const forbidden = editId ? query.data?.trip && !allow.editTrip(query.data.trip) : !allow.createTrip()

  return (
    <>
      <PageHeader
        title={editId ? 'Редактирование командировки' : 'Новая заявка на командировку'}
        subtitle={editId ? 'Измените данные поездки и сохраните' : 'Заполните данные поездки и создайте заявку'}
      />
      {forbidden ? (
        <ErrorState
          title="Доступ запрещён"
          message={editId ? 'Недостаточно прав для изменения этой командировки.' : 'Недостаточно прав: бухгалтер командировки не создаёт.'}
        />
      ) : (
      <QueryBoundary query={query} isEmpty={() => false} empty={{ title: '' }} skeletonRows={5}>
        {({ users, budgets, trip }) => (
          <Card>
            <CardContent>
              <TripForm
                trip={trip}
                users={users}
                currentUserId={user?.id ?? 0}
                budgets={budgets}
                onSaved={(saved) => navigate(`/trips/${saved.id}`)}
                onCancel={() => navigate(editId ? `/trips/${editId}` : '/trips')}
              />
            </CardContent>
          </Card>
        )}
      </QueryBoundary>
      )}
    </>
  )
}
