import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Users, Info, Edit2, Trash2, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Dashboard = () => {
  const { user, userProfile, loading: authLoading } = useAuth();
  const [afilhados, setAfilhados] = useState([]);
  const [padrinho, setPadrinho] = useState(null);
  const [madrinha, setMadrinha] = useState(null);
  const [pessoaProfile, setPessoaProfile] = useState(null);
  const [ano, setAno] = useState(null);
  const [loading, setLoading] = useState(true);

  const [eventoAtivo, setEventoAtivo] = useState(null);
  const [inscricaoAtual, setInscricaoAtual] = useState(null);
  const [isUpdatingInscricao, setIsUpdatingInscricao] = useState(false);

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

      // Buscar evento ativo
      const { data: eventoData } = await supabase
        .from('apc_evento')
        .select('id, descricao, equipes')
        .eq('status', 'ATIVO')
        .order('data_inicio', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (eventoData) {
        setEventoAtivo(eventoData);

        // Buscar inscrição no evento ativo
        if (currentPessoa) {
          const { data: inscricaoData } = await supabase
            .from('apc_acampamento')
            .select('*')
            .eq('evento_id', eventoData.id)
            .eq('pessoa_id', currentPessoa.id)
            .maybeSingle();

          setInscricaoAtual(inscricaoData);
        }
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

  const handleToggleInscricao = async (checked) => {
    if (!eventoAtivo || !pessoaProfile) return;

    setIsUpdatingInscricao(true);
    try {
      if (checked) {
        // Criar inscrição
        const { data, error } = await supabase
          .from('apc_acampamento')
          .insert([{
            evento_id: eventoAtivo.id,
            pessoa_id: pessoaProfile.id,
            equipe: []
          }])
          .select()
          .single();

        if (error) throw error;
        setInscricaoAtual(data);
      } else {
        // Remover inscrição
        if (inscricaoAtual) {
          const { error } = await supabase
            .from('apc_acampamento')
            .delete()
            .eq('id', inscricaoAtual.id);

          if (error) throw error;
          setInscricaoAtual(null);
        }
      }
    } catch (err) {
      console.error('Erro ao atualizar inscrição:', err.message);
      alert('Não foi possível atualizar a inscrição: ' + err.message);
    } finally {
      setIsUpdatingInscricao(false);
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
            {/* <span style={{
              background: 'rgba(59, 130, 246, 0.1)',
              color: 'var(--accent-primary)',
              padding: '0.25rem 0.75rem',
              borderRadius: '99px',
              fontSize: '0.875rem',
              fontWeight: 'bold'
            }}>
              Perfil: {userProfile.perfil}
            </span> */}
            {userProfile.perfil === 'PENDENTE' && (
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                (Aguardando aprovação do administrador)
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '1rem' }}>
        <h4 style={{ fontWeight: 'bold', fontSize: '1rem', marginBottom: '1rem' }}>Meus Dados</h4>
        <hr style={{ border: 'none', borderTop: '1px solid #d1dff0ff', marginBottom: '1rem' }} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem', marginBottom: '1rem' }}>
          <div>
            <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Nome Completo</strong>
            {userProfile.nome || '-'}
          </div>
          <div>
            <strong style={{ display: 'block', marginBottom: '0.25rem' }}>E-mail</strong>
            {userProfile.email || '-'}
          </div>
          <div>
            <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Telefone</strong>
            {pessoaProfile?.telefone || userProfile.telefone || '-'}
          </div>
          <div>
            <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Data de Nascimento</strong>
            {pessoaProfile?.data_nascimento ? new Date(pessoaProfile.data_nascimento).toLocaleDateString('pt-BR') : '-'}
          </div>
        </div>

        {pessoaProfile && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Link
              to={`/editar-pessoa/${pessoaProfile.id}`}
              className="btn btn-primary"
              style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
            >
              <Edit2 size={16} />
              <span style={{ marginLeft: '0.5rem' }}>Atualizar Dados</span>
            </Link>
          </div>
        )}
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
          <h4 style={{ fontWeight: 'bold', fontSize: '1rem', marginBottom: '1rem' }}>Meus Padrinhos {ano && <span style={{ fontWeight: 'bold', color: 'var(--accent-primary)', marginBottom: '1rem' }}>Turma {ano}</span>}</h4>

          {loading ? (
            <p>Carregando...</p>
          ) : (!padrinho && !madrinha) ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
              <p>Você ainda não foi vinculado a nenhum Padrinho/Madrinha.</p>
            </div>
          ) : (
            <>

              <div className="form-grid">
                {padrinho && (
                  <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '24px', background: 'var(--accent-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 'bold' }}>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '24px', background: 'var(--accent-secondary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 'bold' }}>
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

      {eventoAtivo && pessoaProfile && userProfile.perfil !== 'PENDENTE' && (
        <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem', borderLeft: '4px solid var(--success)' }}>
          <h4 style={{ fontWeight: 'bold', fontSize: '1rem', marginBottom: '1rem' }}>Confirmação para {eventoAtivo.descricao}</h4>
          {inscricaoAtual ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(16, 185, 129, 0.1)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <span style={{ color: 'var(--success)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={20} />
                {pessoaProfile.tipo_pessoa.charAt(0) + pessoaProfile.tipo_pessoa.slice(1).toLowerCase()} está confirmado(a) no {eventoAtivo.descricao}
              </span>
              <button
                onClick={() => handleToggleInscricao(false)}
                disabled={isUpdatingInscricao}
                className="btn btn-secondary"
                style={{ padding: '0.4rem', color: 'var(--error)' }}
                title="Remover confirmação"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '1rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>
                Você ainda não confirmou presença no <strong style={{ color: 'var(--accent-primary)' }}>{eventoAtivo.descricao}</strong>.
              </span>
              <button
                onClick={() => handleToggleInscricao(true)}
                disabled={isUpdatingInscricao}
                className="btn btn-primary"
                style={{ padding: '0.5rem 1rem' }}
              >
                Confirmar Inscrição
              </button>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
