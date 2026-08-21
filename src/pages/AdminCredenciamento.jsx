import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, UserCheck } from 'lucide-react';

export const AdminCredenciamento = () => {
  const { userProfile } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

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

      setMessage('Perfil atualizado com sucesso!');

      // Atualizar a lista local
      setUsuarios(usuarios.map(u => u.user_id === userId ? { ...u, perfil: novoPerfil } : u));
    } catch (err) {
      setError('Erro ao atualizar perfil: ' + err.message);
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
      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <ShieldCheck size={32} color="var(--accent-primary)" />
          Gerenciamento de Acesso dos Usuários
        </h1>
        <p style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
          Aqui você pode aprovar e gerenciar os perfis de acesso dos usuários cadastrados no sistema.
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <div className="glass-panel" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h4 style={{ fontWeight: 'bold', fontSize: '1.125rem' }}>Usuários do Sistema</h4>
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
                  <th>Ações / Alterar Perfil</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.user_id}>
                    <td style={{ fontWeight: '500' }}>{u.nome}</td>
                    <td>{u.email}</td>
                    <td>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.875rem',
                        fontWeight: 'bold',
                        backgroundColor:
                          u.perfil === 'ADMIN' ? 'rgba(239, 68, 68, 0.1)' :
                            (u.perfil === 'PADRINHO' || u.perfil === 'MADRINHA') ? 'rgba(139, 92, 246, 0.1)' :
                              u.perfil === 'AFILHADO' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                        color:
                          u.perfil === 'ADMIN' ? '#ef4444' :
                            (u.perfil === 'PADRINHO' || u.perfil === 'MADRINHA') ? '#8b5cf6' :
                              u.perfil === 'AFILHADO' ? '#3b82f6' : '#64748b'
                      }}>
                        {u.perfil}
                      </span>
                    </td>
                    <td>
                      <select
                        className="form-input"
                        style={{ padding: '0.4rem', width: 'auto', display: 'inline-block' }}
                        value={u.perfil}
                        onChange={(e) => handleMudarPerfil(u.user_id, e.target.value)}
                        disabled={u.user_id === userProfile.user_id} // Não pode mudar o próprio perfil aqui
                      >
                        <option value="PENDENTE">PENDENTE</option>
                        <option value="AFILHADO">AFILHADO</option>
                        <option value="PADRINHO">PADRINHO</option>
                        <option value="MADRINHA">MADRINHA</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
