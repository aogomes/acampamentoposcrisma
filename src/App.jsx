import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { CadastroPessoa } from './pages/CadastroPessoa';
import { EditarPessoa } from './pages/EditarPessoa';
import { FormularioInscricao } from './pages/FormularioInscricao';
import { AdminCredenciamento } from './pages/AdminCredenciamento';
import { AdminVinculos } from './pages/AdminVinculos';
import { AdminEventos } from './pages/AdminEventos';
import { EditarEvento } from './pages/EditarEvento';
import { AdminAcampamentos } from './pages/AdminAcampamentos';
import { AdminPagamentos } from './pages/AdminPagamentos';
import { MeusAfilhados } from './pages/MeusAfilhados';
import { RedefinirSenha } from './pages/RedefinirSenha';
import './index.css';

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="app-container">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/redefinir-senha" element={<RedefinirSenha />} />
            
            {/* Protected Routes */}
            <Route path="/" element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/inscricao" element={
              <ProtectedRoute>
                <Layout>
                  <FormularioInscricao />
                </Layout>
              </ProtectedRoute>
            } />

            <Route path="/inscricao/:id" element={
              <ProtectedRoute>
                <Layout>
                  <FormularioInscricao />
                </Layout>
              </ProtectedRoute>
            } />

            <Route path="/formulario-inscricao" element={
              <ProtectedRoute>
                <Layout>
                  <FormularioInscricao />
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
            
            <Route path="/meus-afilhados" element={
              <ProtectedRoute>
                <Layout>
                  <MeusAfilhados />
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

            <Route path="/admin/eventos" element={
              <ProtectedRoute>
                <Layout>
                  <AdminEventos />
                </Layout>
              </ProtectedRoute>
            } />

            <Route path="/admin/eventos/:id" element={
              <ProtectedRoute>
                <Layout>
                  <EditarEvento />
                </Layout>
              </ProtectedRoute>
            } />

            <Route path="/admin/acampamentos/:evento_id" element={
              <ProtectedRoute>
                <Layout>
                  <AdminAcampamentos />
                </Layout>
              </ProtectedRoute>
            } />

            <Route path="/admin/pagamentos/:acampamento_id" element={
              <ProtectedRoute>
                <Layout>
                  <AdminPagamentos />
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
