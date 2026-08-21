import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Users, Trash2, Plus } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export const AdminVinculos = () => {
  const { userProfile } = useAuth();
  const location = useLocation();
  const [padrinhos, setPadrinhos] = useState([]);
  const [madrinhas, setMadrinhas] = useState([]);
  const [afilhados, setAfilhados] = useState([]);
  const [vinculos, setVinculos] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);

      // Carregar perfis PADRINHO
      const { data: dataPadrinhos, error: errP } = await supabase
        .from('apc_perfil')
        .select('*')
        .eq('perfil', 'PADRINHO');
      if (errP) throw errP;

      // Carregar perfis MADRINHA
      const { data: dataMadrinhas, error: errM } = await supabase
        .from('apc_perfil')
        .select('*')
        .eq('perfil', 'MADRINHA');
      if (errM) throw errM;

      // Carregar perfis AFILHADO
      const { data: dataAfilhados, error: errA } = await supabase
        .from('apc_perfil')
        .select('*')
        .eq('perfil', 'AFILHADO');
      if (errA) throw errA;

      // Carregar Vínculos
      const { data: dataVinculos, error: errV } = await supabase
        .from('apc_vinculo')
        .select('id, padrinho_id, madrinha_id, afilhado_id, ano')
        .order('ano', { ascending: false });
      if (errV) throw errV;

      setPadrinhos(dataPadrinhos || []);
      setMadrinhas(dataMadrinhas || []);
      setAfilhados(dataAfilhados || []);
      setVinculos(dataVinculos || []);
    } catch (err) {
      setError('Erro ao carregar dados: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userProfile?.perfil === 'ADMIN') {
      fetchData();
    }
  }, [userProfile]);

  useEffect(() => {
    if (location.state?.message) {
      setMessage(location.state.message);
      // Clean up the state so it doesn't persist on reload
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const handleRemoverVinculo = async (id) => {
    try {
      setMessage('');
      setError('');
      const { error } = await supabase.from('apc_vinculo').delete().eq('id', id);
      if (error) throw error;

      setMessage('Vínculo removido!');
      fetchData();
    } catch (err) {
      setError('Erro ao remover vínculo: ' + err.message);
    }
  };

  if (userProfile?.perfil !== 'ADMIN') {
    return (
      <div className="main-content">
        <div className="alert alert-error">Acesso negado.</div>
      </div>
    );
  }

  // Helpers para exibir os nomes na tabela
  const getNome = (id, lista) => {
    const p = lista.find(item => item.user_id === id);
    return p ? p.nome : 'Desconhecido';
  };

  return (
    <div className="main-content">
      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0 }}>
            <Users size={32} color="var(--accent-primary)" />
            Vínculos dos Afilhados
          </h1>
          <p style={{ marginTop: '0.5rem', fontSize: '1.1rem', marginBottom: 0 }}>
            Atribua afilhados aos seus respectivos padrinhos.
          </p>
        </div>
        <Link to="/admin/vinculos/novo" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Plus size={20} />
          Novo Vínculo
        </Link>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '2rem' }}>{error}</div>}
      {message && <div className="alert alert-success" style={{ marginBottom: '2rem' }}>{message}</div>}

      <div className="glass-panel" style={{ padding: '2rem' }}>
        <h4 style={{ fontWeight: 'bold', fontSize: '1.125rem', marginBottom: '1.5rem' }}>Vínculos Ativos</h4>

        {loading ? (
          <p>Carregando...</p>
        ) : vinculos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
            <p>Nenhum vínculo cadastrado.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table-compact">
              <thead>
                <tr>
                  <th>Ano</th>
                  <th>Afilhado</th>
                  <th>Padrinhos</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {vinculos.map((v) => (
                  <tr key={v.id}>
                    <td style={{ fontWeight: '500', color: 'var(--accent-primary)' }}>
                      {v.ano}
                    </td>
                    <td style={{ fontWeight: '500', color: 'var(--accent-primary)' }}>
                      {getNome(v.afilhado_id, afilhados)}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {getNome(v.padrinho_id, padrinhos)} e {getNome(v.madrinha_id, madrinhas)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => handleRemoverVinculo(v.id)}
                        className="btn btn-secondary"
                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.875rem', color: 'var(--error)' }}
                        title="Remover Vínculo"
                      >
                        <Trash2 size={16} />
                      </button>
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
