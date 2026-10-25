import { Route, Routes } from 'react-router-dom'
import Layout from './layout/Layout'
import DashboardPage from '../pages/DashboardPage'
import TripsPage from '../pages/TripsPage'
import TripDetailsPage from '../pages/TripDetailsPage'
import TripFormPage from '../pages/TripFormPage'
import ExpensesPage from '../pages/ExpensesPage'
import ExpenseFormPage from '../pages/ExpenseFormPage'
import AdvancesPage from '../pages/AdvancesPage'
import BudgetsPage from '../pages/BudgetsPage'
import NotFoundPage from '../pages/NotFoundPage'
import LoginPage from '../pages/LoginPage'
import RegisterPage from '../pages/RegisterPage'
import UsersPage from '../pages/UsersPage'
import { GuestRoute, ProtectedRoute } from './providers/RouteGuards'

export default function App() {
  return (
    <Routes>
      <Route element={<GuestRoute />}>
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
      </Route>
      <Route element={<ProtectedRoute />}>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="trips" element={<TripsPage />} />
        <Route path="trips/new" element={<TripFormPage />} />
        <Route path="trips/:id" element={<TripDetailsPage />} />
        <Route path="trips/:id/edit" element={<TripFormPage />} />
        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="expenses/new" element={<ExpenseFormPage />} />
        <Route path="advances" element={<AdvancesPage />} />
        <Route path="budgets" element={<BudgetsPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      </Route>
    </Routes>
  )
}
