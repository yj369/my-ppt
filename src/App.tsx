import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { DashboardPage } from './pages/DashboardPage'
import { EditorPage } from './pages/EditorPage'
import { ConfirmDialog } from './components/layout/ConfirmDialog'
import { ToastContainer } from './components/layout/ToastContainer'

function App() {
  return (
    <BrowserRouter>
      <ConfirmDialog />
      <ToastContainer />
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/editor/:id" element={<EditorPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
