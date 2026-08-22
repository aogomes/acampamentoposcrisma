import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Users, Info, Edit2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Dashboard = () => {
  const { user, userProfile, loading: authLoading } = useAuth();
  const [afilhados, setAfilhados] = useState([]);
  const [padrinho, setPadrinho] = useState(null);
  const [madrinha, setMadrinha] = useState(null);
  const [pessoaProfile, setPessoaProfile] = useState(null);
  const [ano, setAno] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userProfile) {
      loadDashboardData();
    }
  }, [userProfile]);

  const loadDashboardData = async () => {
    setLoading(true);

    try {
      // 1. Fetch user's apc_pessoa mapping
      let currentPessoa = null;
      const { data: pessoaData, error: pessoaErr } = await supabase
        .from('apc_pessoa')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!pessoaErr && pessoaData) {
        currentPessoa = pessoaData;
        setPessoaProfile(currentPessoa);
      }

      if (currentPessoa) {
        if (currentPessoa.tipo_pessoa === 'PADRINHO' || currentPessoa.tipo_pessoa === 'MADRINHA') {
          // Buscar afilhados vinculados a este padrinho/madrinha
          const { data: vinculos, error: errV } = await supabase
            .from('apc_vinculo')
            .select('afilhado_id, madrinha_id, padrinho_id, ano')
            .eq(currentPessoa.tipo_pessoa === 'PADRINHO' ? 'padrinho_id' : 'madrinha_id', currentPessoa.id);

          if (!errV && vinculos && vinculos.length > 0) {
            const idsAfilhados = vinculos.map(v => v.afilhado_id);
            const idsPadrinhos = vinculos.map(v => v.padrinho_id);
            const idsMadrinhas = vinculos.map(v => v.madrinha_id);
            const allIds = [...new Set([...idsAfilhados, ...idsPadrinhos, ...idsMadrinhas])].filter(Boolean);

            const { data: perfis, error: errP } = await supabase
              .from('apc_pessoa')
              .select('*')
              .in('id', allIds);

            if (!errP && perfis) {
              const afilhadosMapeados = idsAfilhados.map(id => {
                const p = perfis.find(perfil => perfil.id === id);
                const v = vinculos.find(v => v.afilhado_id === id);

                const padrinhoPerfil = perfis.find(perfil => perfil.id === v?.padrinho_id);
                const madrinhaPerfil = perfis.find(perfil => perfil.id === v?.madrinha_id);

                return {
                  ...p,
                  ano: v ? v.ano : null,
                  nomePadrinho: padrinhoPerfil ? padrinhoPerfil.nome : 'Desconhecido',
                  nomeMadrinha: madrinhaPerfil ? madrinhaPerfil.nome : 'Desconhecido'
                };
              });
              setAfilhados(afilhadosMapeados);
            }
          }
        }
        else if (currentPessoa.tipo_pessoa === 'AFILHADO') {
          // Buscar o padrinho deste afilhado
          const { data: vinculo, error: errV } = await supabase
            .from('apc_vinculo')
            .select('padrinho_id, madrinha_id, ano')
            .eq('afilhado_id', currentPessoa.id)
            .maybeSingle();

          if (!errV && vinculo) {
            setAno(vinculo.ano);

            if (vinculo.padrinho_id) {
              const { data: pData } = await supabase.from('apc_pessoa').select('*').eq('id', vinculo.padrinho_id).single();
              if (pData) setPadrinho(pData);
            }
            if (vinculo.madrinha_id) {
              const { data: mData } = await supabase.from('apc_pessoa').select('*').eq('id', vinculo.madrinha_id).single();
              if (mData) setMadrinha(mData);
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return <div className="main-content"><p>Verificando sessão...</p></div>;
  }

  if (!userProfile) {
    return (
      <div className="main-content">
        <div className="glass-panel" style={{ padding: '2rem', maxWidth: '500px', margin: '2rem auto', textAlign: 'center' }}>
          <h2 style={{ marginBottom: '1rem', color: 'var(--accent-primary)' }}>Sessão Expirada</h2>
          <p style={{ marginBottom: '2rem' }}>Não foi possível carregar seu perfil. Sua sessão pode ter expirado ou houve um problema de conexão. Por favor, faça login novamente.</p>

          <button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = '/login';
            }}
          >
            Ir para o Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content">
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0, fontSize: '1.75rem', flexWrap: 'wrap' }}>
          <Users size={32} color="var(--accent-primary)" />
          Meu Painel
        </h1>
        <div>
          <p style={{ margin: 0, fontSize: '1.1rem' }}>
            Olá, <strong style={{ color: 'var(--text-primary)' }}>{userProfile.nome}</strong>!
          </p>
          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{
              background: 'rgba(59, 130, 246, 0.1)',
              color: 'var(--accent-primary)',
              padding: '0.25rem 0.75rem',
              borderRadius: '99px',
              fontSize: '0.875rem',
              fontWeight: 'bold'
            }}>
              Perfil: {userProfile.perfil}
            </span>
            {userProfile.perfil === 'PENDENTE' && (
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                (Aguardando aprovação do administrador)
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h4 style={{ fontWeight: 'bold', fontSize: '1rem' }}>Meus Dados</h4>
          {pessoaProfile && (
            <Link
              to={`/editar-pessoa/${pessoaProfile.id}`}
              className="btn btn-secondary"
              style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
            >
              <Edit2 size={16} />
              <span className="d-none d-md-flex" style={{ marginLeft: '0.25rem' }}>Atualizar Dados</span>
            </Link>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div><strong>E-mail:</strong> {userProfile.email || '-'}</div>
          <div><strong>Telefone:</strong> {pessoaProfile?.telefone || userProfile.telefone || '-'}</div>
          <div><strong>Nascimento:</strong> {pessoaProfile?.data_nascimento ? new Date(pessoaProfile.data_nascimento).toLocaleDateString('pt-BR') : '-'}</div>
        </div>
      </div>

      {(pessoaProfile?.tipo_pessoa === 'PADRINHO' || pessoaProfile?.tipo_pessoa === 'MADRINHA') && (
        <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h4 style={{ fontWeight: 'bold', fontSize: '1rem', marginBottom: '0.5rem' }}>Meus Afilhados</h4>
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                Você tem <strong style={{ color: 'var(--accent-primary)' }}>{afilhados.length}</strong> afilhados vinculados a você.
              </p>
            </div>
            <Link
              to="/meus-afilhados"
              className="btn btn-primary"
              style={{ padding: '0.5rem 1rem' }}
            >
              Ver e Editar Afilhados
            </Link>
          </div>
        </div>
      )}

      {pessoaProfile?.tipo_pessoa === 'AFILHADO' && (
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h4 style={{ fontWeight: 'bold', fontSize: '1rem', marginBottom: '1rem' }}>Meus Padrinhos</h4>

          {loading ? (
            <p>Carregando...</p>
          ) : (!padrinho && !madrinha) ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
              <p>Você ainda não foi vinculado a nenhum Padrinho/Madrinha.</p>
            </div>
          ) : (
            <>
              {ano && <p style={{ fontWeight: 'bold', color: 'var(--accent-primary)', marginBottom: '1rem' }}>Turma {ano}</p>}
              <div className="form-grid">
                {padrinho && (
                  <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '8px' }}>
                    <h5 style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.875rem', textTransform: 'uppercase' }}>Padrinho</h5>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '24px', background: 'var(--accent-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 'bold' }}>
                        {padrinho.nome.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1.125rem' }}>{padrinho.nome}</h3>
                        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{padrinho.email}</p>
                      </div>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.875rem' }}><strong>Telefone:</strong> {padrinho.telefone || 'Não informado'}</p>
                  </div>
                )}

                {madrinha && (
                  <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '8px' }}>
                    <h5 style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.875rem', textTransform: 'uppercase' }}>Madrinha</h5>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '24px', background: 'var(--accent-secondary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 'bold' }}>
                        {madrinha.nome.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1.125rem' }}>{madrinha.nome}</h3>
                        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{madrinha.email}</p>
                      </div>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.875rem' }}><strong>Telefone:</strong> {madrinha.telefone || 'Não informado'}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* {(userProfile.perfil === 'ADMIN' || userProfile.perfil === 'GESTOR') && (
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h4 style={{ fontWeight: 'bold', fontSize: '1.125rem', marginBottom: '1.5rem' }}>Visão da Coordenação</h4>
          <p>Utilize os menus laterais para gerenciar os cadastros, eventos e realizar os vínculos do Acampamento.</p>
        </div>
      )} */}
    </div>
  );
};
