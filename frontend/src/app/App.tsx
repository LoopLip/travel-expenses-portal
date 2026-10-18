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

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="trips" element={<TripsPage />} />
        <Route path="trips/new" element={<TripFormPage />} />
        <Route path="trips/:id" element={<TripDetailsPage />} />
        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="expenses/new" element={<ExpenseFormPage />} />
        <Route path="advances" element={<AdvancesPage />} />
        <Route path="budgets" element={<BudgetsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
