import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './contexts/AuthContext'
import { Toaster } from 'react-hot-toast'
import ProtectedRoute from './components/ProtectedRoute'
import MainLayout from './components/layout/MainLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import POSPage from './pages/POSPage'
import MySalesPage from './pages/MySalesPage'
import InventoryPage from './pages/InventoryPage'
import CustomersPage from './pages/CustomersPage'
import SuppliersPage from './pages/SuppliersPage'
import PurchaseOrdersPage from './pages/PurchaseOrdersPage'
import ReportsPage from './pages/ReportsPage'
import UsersPage from './pages/UsersPage'
import SettingsPage from './pages/SettingsPage'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              
              <Route
                path="dashboard"
                element={
                  <ProtectedRoute allowedRoles={['owner', 'admin', 'accountant']}>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              
              <Route path="pos" element={<POSPage />} />
              
              <Route
                path="my-sales"
                element={
                  <ProtectedRoute allowedRoles={['cashier']}>
                    <MySalesPage />
                  </ProtectedRoute>
                }
              />
              
              <Route
                path="inventory"
                element={
                  <ProtectedRoute allowedRoles={['owner', 'admin', 'accountant']}>
                    <InventoryPage />
                  </ProtectedRoute>
                }
              />
              
              <Route path="customers" element={<CustomersPage />} />
              
              <Route
                path="suppliers"
                element={
                  <ProtectedRoute allowedRoles={['owner', 'admin', 'accountant']}>
                    <SuppliersPage />
                  </ProtectedRoute>
                }
              />
              
              <Route
                path="purchase-orders"
                element={
                  <ProtectedRoute allowedRoles={['owner', 'admin', 'accountant']}>
                    <PurchaseOrdersPage />
                  </ProtectedRoute>
                }
              />
              
              <Route
                path="reports"
                element={
                  <ProtectedRoute allowedRoles={['owner', 'admin', 'accountant']}>
                    <ReportsPage />
                  </ProtectedRoute>
                }
              />
              
              <Route
                path="users"
                element={
                  <ProtectedRoute allowedRoles={['owner', 'admin']}>
                    <UsersPage />
                  </ProtectedRoute>
                }
              />
              
              <Route
                path="settings"
                element={
                  <ProtectedRoute allowedRoles={['owner', 'admin']}>
                    <SettingsPage />
                  </ProtectedRoute>
                }
              />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App