import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LogOut,
  UserPlus,
  Users,
  ChevronLeft,
  ChevronRight,
  Menu,
  ShieldCheck,
  Link as LinkIcon,
  Calendar,
  Tent,
  ClipboardCheck,
  Activity
} from 'lucide-react';

import { ModalAlterarSenhaObrigatoria } from './ModalAlterarSenhaObrigatoria';
import { registrarAuditoria } from '../services/auditoriaService';

export const Layout = ({ children }) => {
  const { user, signOut, userProfile, pessoaProfile } = useAuth();
  const navigate = useNavigate();

  // State for sidebar collapse (desktop) and mobile drawer
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const perfil = userProfile?.perfil || 'PENDENTE';

  // Auto-close mobile menu when clicking outside or resizing
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setIsMobileOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = async () => {
    try {
      await registrarAuditoria({
        acao: 'LOGOUT',
        categoria: 'AUTENTICACAO',
        nivel: 'INFO',
        descricao: `Usuário efetuou logout do sistema: ${user?.email || ''}`
      });
    } catch (_) { }
    await signOut();
    navigate('/login');
  };

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  const toggleMobileMenu = () => {
    setIsMobileOpen(!isMobileOpen);
  };

  // Prevent rendering layout for unauthenticated users
  if (!user) return <>{children}</>;

  return (
    <div className="app-layout">
      {/* Modal Bloqueante se o usuário precisar redefinir senha */}
      <ModalAlterarSenhaObrigatoria />

      {/* Mobile Header (Only visible on small screens) */}
      <div className="mobile-header d-md-none">
        <div className="sidebar-brand">
          <div className="sidebar-logo">A</div>
          <div className="sidebar-brand-text">
            <span>Pós-Crisma</span>
          </div>
        </div>
        <button className="sidebar-toggle" onClick={toggleMobileMenu}>
          <Menu size={24} />
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`sidebar ${isCollapsed ? 'collapsed' : 'expanded'} ${isMobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="sidebar-logo">A</div>
            <div className="sidebar-brand-text">
              <span>Pós-Crisma</span>
            </div>
          </div>
          <button className="sidebar-toggle d-none d-md-flex" onClick={toggleSidebar}>
            {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
          <button className="sidebar-toggle d-md-none" onClick={toggleMobileMenu}>
            <ChevronLeft size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <NavLink
            to="/"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            end
            onClick={() => setIsMobileOpen(false)}
          >
            <div className="nav-item-icon"><Users size={20} /></div>
            <span className="nav-item-text">Meu Painel</span>
          </NavLink>

          <NavLink
            to="/inscricao"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setIsMobileOpen(false)}
          >
            <div className="nav-item-icon"><ClipboardCheck size={20} /></div>
            <span className="nav-item-text">Inscrição 2026</span>
          </NavLink>

          {(pessoaProfile?.tipo_pessoa === 'PADRINHO' || pessoaProfile?.tipo_pessoa === 'MADRINHA') && (
            <NavLink
              to="/meus-afilhados"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setIsMobileOpen(false)}
            >
              <div className="nav-item-icon"><Users size={20} /></div>
              <span className="nav-item-text">Afilhados</span>
            </NavLink>
          )}

          {(perfil === 'ADMIN' || perfil === 'GESTOR') && (
            <>
              <NavLink
                to="/cadastro-pessoa"
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setIsMobileOpen(false)}
              >
                <div className="nav-item-icon"><UserPlus size={20} /></div>
                <span className="nav-item-text">Pessoas</span>
              </NavLink>

              <NavLink
                to="/admin/eventos"
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setIsMobileOpen(false)}
              >
                <div className="nav-item-icon"><Calendar size={20} /></div>
                <span className="nav-item-text">Eventos</span>
              </NavLink>

              {perfil === 'ADMIN' && (
                <>
                  <NavLink
                    to="/admin/credenciamento"
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => setIsMobileOpen(false)}
                  >
                    <div className="nav-item-icon"><ShieldCheck size={20} /></div>
                    <span className="nav-item-text">Usuários</span>
                  </NavLink>

                  <NavLink
                    to="/admin/auditoria"
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => setIsMobileOpen(false)}
                  >
                    <div className="nav-item-icon"><Activity size={20} /></div>
                    <span className="nav-item-text">Auditoria</span>
                  </NavLink>
                </>
              )}
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <button onClick={handleLogout} className="nav-item" style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--error)' }}>
            <div className="nav-item-icon"><LogOut size={20} /></div>
            <span className="nav-item-text">Sair da Conta</span>
          </button>
        </div>
      </aside>

      {/* Overlay for Mobile */}
      {isMobileOpen && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 90 }}
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Main Content Wrapper */}
      <main className={`layout-content ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
        {children}
      </main>
    </div>
  );
};
