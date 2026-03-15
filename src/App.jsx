import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ProjectsProvider } from './context/ProjectsContext'
import AppLayout from './components/AppLayout'
import LoginView from './views/LoginView'
import { ToastContainer } from './components/ToastContainer'
import { lazy, Suspense } from 'react'

const ProjectsView = lazy(() => import('./views/ProjectsView'))
const CalendarView = lazy(() => import('./views/CalendarView'))
const ClientsView = lazy(() => import('./views/ClientsView'))
const ChangelogView = lazy(() => import('./views/ChangelogView'))

function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '200px' }}>
      <div style={{ width: 28, height: 28, border: '2px solid rgba(124,58,237,0.2)', borderTop: '2px solid #7C3AED', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    </div>
  )
}

function RequireAuth({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <ProjectsProvider>{children}</ProjectsProvider>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginView />} />
      <Route path="/" element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route index element={<Navigate to="/projects" replace />} />
        <Route path="projects" element={<Suspense fallback={<PageLoader />}><ProjectsView /></Suspense>} />
        <Route path="calendar" element={<Suspense fallback={<PageLoader />}><CalendarView /></Suspense>} />
        <Route path="clients" element={<Suspense fallback={<PageLoader />}><ClientsView /></Suspense>} />
        <Route path="changelog" element={<Suspense fallback={<PageLoader />}><ChangelogView /></Suspense>} />
        <Route path="*" element={<Navigate to="/projects" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <ToastContainer />
      </AuthProvider>
    </BrowserRouter>
  )
}
