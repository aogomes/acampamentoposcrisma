import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { CadastroPessoa } from './pages/CadastroPessoa';
import { EditarPessoa } from './pages/EditarPessoa';
import { AdminCredenciamento } from './pages/AdminCredenciamento';
import { AdminVinculos } from './pages/AdminVinculos';
import { AdminNovoVinculo } from './pages/AdminNovoVinculo';
import './index.css';

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="app-container">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            {/* Protected Routes */}
            <Route path="/" element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/cadastro-pessoa" element={
              <ProtectedRoute>
                <Layout>
                  <CadastroPessoa />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/editar-pessoa/:id" element={
              <ProtectedRoute>
                <Layout>
                  <EditarPessoa />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/admin/credenciamento" element={
              <ProtectedRoute>
                <Layout>
                  <AdminCredenciamento />
                </Layout>
              </ProtectedRoute>
            } />

            <Route path="/admin/vinculos" element={
              <ProtectedRoute>
                <Layout>
                  <AdminVinculos />
                </Layout>
              </ProtectedRoute>
            } />

            <Route path="/admin/vinculos/novo" element={
              <ProtectedRoute>
                <Layout>
                  <AdminNovoVinculo />
                </Layout>
              </ProtectedRoute>
            } />
          </Routes>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
