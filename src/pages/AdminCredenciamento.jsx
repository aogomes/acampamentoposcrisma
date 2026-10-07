import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { registrarAuditoria } from '../services/auditoriaService';
import {
  ShieldCheck,
  KeyRound,
  Trash2,
  Copy,
  Check,
  AlertTriangle,
  X,
  RefreshCw,
  Lock,
} from 'lucide-react';

export const AdminCredenciamento = () => {
  const { userProfile } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Modais
  const [modalReset, setModalReset] = useState({ open: false, usuario: null, senha: '', copiado: false });
  const [modalDelete, setModalDelete] = useState({ open: false, usuario: null });
  const [actionLoading, setActionLoading] = useState(false);

  const fetchUsuarios = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('apc_perfil')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsuarios(data || []);
    } catch (err) {
      setError('Erro ao carregar usuários: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userProfile?.perfil === 'ADMIN') {
      fetchUsuarios();
    }
  }, [userProfile]);

  const handleMudarPerfil = async (userId, novoPerfil) => {
    try {
      setMessage('');
      setError('');

      const { error } = await supabase
        .from('apc_perfil')
        .update({ perfil: novoPerfil })
        .eq('user_id', userId);

      if (error) throw error;

      registrarAuditoria({
        acao: 'ADMIN_MUDAR_PERFIL',
        categoria: 'ADMIN',
        nivel: 'WARNING',
        descricao: `Administrador alterou perfil do usuário para ${novoPerfil}`,
        detalhes: { target_user_id: userId, novo_perfil: novoPerfil }
      });

      setMessage('Perfil atualizado com sucesso!');
      setUsuarios(usuarios.map(u => u.user_id === userId ? { ...u, perfil: novoPerfil } : u));
    } catch (err) {
      registrarAuditoria({
        acao: 'ADMIN_MUDAR_PERFIL_ERRO',
        categoria: 'ERRO',
        nivel: 'ERROR',
        descricao: `Erro ao alterar perfil do usuário: ${err.message}`,
        detalhes: { erro: err.message, target_user_id: userId, novo_perfil: novoPerfil }
      });
      setError('Erro ao atualizar perfil: ' + err.message);
    }
  };

  // Gerador de senha temporária amigável
  const gerarSenhaAleatoria = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let rand = '';
    for (let i = 0; i < 4; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `Apc@${rand}`;
  };

  const handleAbrirReset = (u) => {
    setModalReset({
      open: true,
      usuario: u,
      senha: gerarSenhaAleatoria(),
      copiado: false
    });
  };

  const handleConfirmarReset = async () => {
    if (!modalReset.senha || modalReset.senha.length < 6) {
      alert('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    try {
      setActionLoading(true);
      setError('');
      setMessage('');

      const { error } = await supabase.rpc('admin_resetar_senha', {
        target_user_id: modalReset.usuario.user_id,
        nova_senha: modalReset.senha
      });

      if (error) throw error;

      registrarAuditoria({
        acao: 'ADMIN_RESET_SENHA',
        categoria: 'ADMIN',
        nivel: 'WARNING',
        descricao: `Administrador resetou a senha do usuário ${modalReset.usuario.nome}`,
        detalhes: { target_user_id: modalReset.usuario.user_id, target_email: modalReset.usuario.email }
      });

      setMessage(`Senha de ${modalReset.usuario.nome} resetada com sucesso! O usuário deverá alterá-la no primeiro acesso.`);

      // Atualiza localmente
      setUsuarios(usuarios.map(u => u.user_id === modalReset.usuario.user_id ? { ...u, deve_alterar_senha: true } : u));
      setModalReset({ open: false, usuario: null, senha: '', copiado: false });
    } catch (err) {
      console.error('Erro ao resetar senha:', err);
      registrarAuditoria({
        acao: 'ADMIN_RESET_SENHA_ERRO',
        categoria: 'ERRO',
        nivel: 'ERROR',
        descricao: `Erro ao resetar senha do usuário ${modalReset.usuario?.nome}: ${err.message}`,
        detalhes: { erro: err.message, target_user_id: modalReset.usuario?.user_id }
      });
      alert('Não foi possível resetar a senha: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAbrirDelete = (u) => {
    setModalDelete({ open: true, usuario: u });
  };

  const handleConfirmarDelete = async () => {
    try {
      setActionLoading(true);
      setError('');
      setMessage('');

      const { error } = await supabase.rpc('admin_deletar_usuario', {
        target_user_id: modalDelete.usuario.user_id
      });

      if (error) throw error;

      registrarAuditoria({
        acao: 'ADMIN_EXCLUIR_USUARIO',
        categoria: 'ADMIN',
        nivel: 'WARNING',
        descricao: `Administrador excluiu o usuário ${modalDelete.usuario.nome} (${modalDelete.usuario.email})`,
        detalhes: { target_user_id: modalDelete.usuario.user_id, target_email: modalDelete.usuario.email }
      });

      setMessage(`Usuário ${modalDelete.usuario.nome} excluído com sucesso!`);
      setUsuarios(usuarios.filter(u => u.user_id !== modalDelete.usuario.user_id));
      setModalDelete({ open: false, usuario: null });
    } catch (err) {
      console.error('Erro ao excluir usuário:', err);
      registrarAuditoria({
        acao: 'ADMIN_EXCLUIR_USUARIO_ERRO',
        categoria: 'ERRO',
        nivel: 'ERROR',
        descricao: `Erro ao excluir usuário ${modalDelete.usuario?.nome}: ${err.message}`,
        detalhes: { erro: err.message, target_user_id: modalDelete.usuario?.user_id }
      });
      alert('Não foi possível excluir o usuário: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const copiarSenha = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(modalReset.senha);
      setModalReset(prev => ({ ...prev, copiado: true }));
      setTimeout(() => setModalReset(prev => ({ ...prev, copiado: false })), 2000);
    }
  };

  if (userProfile?.perfil !== 'ADMIN') {
    return (
      <div className="main-content">
        <div className="alert alert-error">Acesso negado. Apenas administradores podem acessar esta página.</div>
      </div>
    );
  }

  return (
    <div className="main-content">
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0, fontSize: '1.75rem', flexWrap: 'wrap' }}>
          <ShieldCheck size={32} color="var(--accent-primary)" />
          Gerenciamento de Acesso dos Usuários
        </h1>
        <p style={{ margin: 0, fontSize: '1rem', color: 'var(--text-secondary)' }}>
          Aqui você pode aprovar perfis, redefinir senhas e gerenciar as contas cadastradas no sistema.
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <div className="glass-panel" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h4 style={{ fontWeight: 'bold', fontSize: '1.125rem', margin: 0 }}>Usuários do Sistema</h4>
          <span style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-primary)', padding: '0.25rem 0.75rem', borderRadius: '99px', fontSize: '0.875rem', fontWeight: 'bold' }}>
            {usuarios.length} Total
          </span>
        </div>

        {loading ? (
          <p>Carregando...</p>
        ) : usuarios.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
            <p>Nenhum usuário encontrado.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table-compact">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Perfil Atual</th>
                  <th style={{ textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => {
                  const isCurrentUser = u.user_id === userProfile.user_id;

                  return (
                    <tr key={u.user_id}>
                      <td style={{ fontWeight: '500' }}>
                        <div>
                          {u.nome}
                          {u.deve_alterar_senha && (
                            <span
                              style={{
                                marginLeft: '0.5rem',
                                fontSize: '0.7rem',
                                background: '#fef3c7',
                                color: '#b45309',
                                padding: '0.15rem 0.4rem',
                                borderRadius: '4px',
                                fontWeight: '600',
                                display: 'inline-block'
                              }}
                              title="Usuário deverá trocar a senha no próximo acesso"
                            >
                              Troca pendente
                            </span>
                          )}
                        </div>
                      </td>
                      <td>{u.email}</td>
                      <td>
                        <span style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.875rem',
                          fontWeight: 'bold',
                          backgroundColor:
                            u.perfil === 'ADMIN' ? 'rgba(239, 68, 68, 0.1)' :
                              u.perfil === 'GESTOR' ? 'rgba(245, 158, 11, 0.1)' :
                                u.perfil === 'USUARIO' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                          color:
                            u.perfil === 'ADMIN' ? '#ef4444' :
                              u.perfil === 'GESTOR' ? '#f59e0b' :
                                u.perfil === 'USUARIO' ? '#3b82f6' : '#64748b'
                        }}>
                          {u.perfil}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                          {/* Selecionar Perfil */}
                          <select
                            className="form-input"
                            style={{ padding: '0.35rem 0.5rem', width: 'auto', fontSize: '0.875rem' }}
                            value={u.perfil}
                            onChange={(e) => handleMudarPerfil(u.user_id, e.target.value)}
                            disabled={isCurrentUser}
                            title="Alterar perfil de acesso"
                          >
                            <option value="PENDENTE">PENDENTE</option>
                            <option value="USUARIO">USUÁRIO COMUM</option>
                            <option value="GESTOR">GESTOR</option>
                            <option value="ADMIN">ADMIN</option>
                          </select>

                          {/* Botão Resetar Senha */}
                          <button
                            type="button"
                            onClick={() => handleAbrirReset(u)}
                            className="btn btn-secondary"
                            style={{
                              padding: '0.35rem 0.6rem',
                              fontSize: '0.875rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              color: '#ea580c'
                            }}
                            title="Resetar senha deste usuário"
                          >
                            <KeyRound size={15} />
                          </button>

                          {/* Botão Excluir Usuário */}
                          <button
                            type="button"
                            onClick={() => handleAbrirDelete(u)}
                            className="btn btn-secondary"
                            disabled={isCurrentUser}
                            style={{
                              padding: '0.35rem 0.6rem',
                              fontSize: '0.875rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              color: isCurrentUser ? '#94a3b8' : '#ef4444',
                              cursor: isCurrentUser ? 'not-allowed' : 'pointer'
                            }}
                            title={isCurrentUser ? 'Você não pode excluir sua própria conta' : 'Excluir usuário'}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: RESETAR SENHA                                                      */}
      {/* ========================================================================= */}
      {modalReset.open && modalReset.usuario && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '480px',
              backgroundColor: '#ffffff',
              padding: '1.75rem',
              borderRadius: '16px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <KeyRound size={22} color="#ea580c" />
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold' }}>Resetar Senha</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalReset({ open: false, usuario: null, senha: '', copiado: false })}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              Defina uma nova senha temporária para <strong>{modalReset.usuario.nome}</strong> ({modalReset.usuario.email}).
              O usuário será obrigado a cadastrar uma nova senha no próximo login.
            </p>

            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <label className="form-label" style={{ margin: 0, fontWeight: '600' }}>Senha Provisória</label>
                <button
                  type="button"
                  onClick={() => setModalReset(prev => ({ ...prev, senha: gerarSenhaAleatoria() }))}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-primary)',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    fontWeight: '600'
                  }}
                >
                  <RefreshCw size={12} /> Gerar Outra
                </button>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  className="form-input"
                  value={modalReset.senha}
                  onChange={(e) => setModalReset(prev => ({ ...prev, senha: e.target.value }))}
                  placeholder="Digite ou gere uma senha"
                  style={{ fontFamily: 'monospace', fontSize: '1rem', fontWeight: 'bold', letterSpacing: '0.5px' }}
                />
                <button
                  type="button"
                  onClick={copiarSenha}
                  className="btn btn-secondary"
                  style={{ padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  title="Copiar senha"
                >
                  {modalReset.copiado ? <Check size={16} color="#16a34a" /> : <Copy size={16} />}
                  <span style={{ fontSize: '0.8rem' }}>{modalReset.copiado ? 'Copiado!' : 'Copiar'}</span>
                </button>
              </div>
            </div>

            <div
              style={{
                background: 'rgba(234, 88, 12, 0.08)',
                border: '1px solid rgba(234, 88, 12, 0.25)',
                borderRadius: '8px',
                padding: '0.75rem',
                marginBottom: '1.5rem',
                fontSize: '0.8rem',
                color: '#9a3412',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.5rem'
              }}
            >
              <Lock size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>
                Copie e envie esta senha para o usuário. Assim que ele fizer login, o sistema exigirá que ele informe uma nova senha de uso pessoal.
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setModalReset({ open: false, usuario: null, senha: '', copiado: false })}
                className="btn btn-secondary"
                disabled={actionLoading}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarReset}
                className="btn btn-primary"
                disabled={actionLoading || !modalReset.senha}
              >
                {actionLoading ? 'Salvando...' : 'Salvar Senha Provisória'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EXCLUIR USUÁRIO                                                    */}
      {/* ========================================================================= */}
      {modalDelete.open && modalDelete.usuario && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '460px',
              backgroundColor: '#ffffff',
              padding: '1.75rem',
              borderRadius: '16px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <AlertTriangle size={22} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold' }}>Excluir Usuário</h3>
            </div>

            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.5' }}>
              Tem certeza que deseja excluir o usuário <strong>{modalDelete.usuario.nome}</strong> ({modalDelete.usuario.email})?
              <br /><br />
              Esta ação removerá o acesso do usuário ao sistema e desvinculará seu login. Essa operação não pode ser desfeita.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setModalDelete({ open: false, usuario: null })}
                className="btn btn-secondary"
                disabled={actionLoading}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarDelete}
                className="btn"
                style={{ backgroundColor: '#ef4444', color: '#ffffff', border: 'none' }}
                disabled={actionLoading}
              >
                {actionLoading ? 'Excluindo...' : 'Sim, Excluir Usuário'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
