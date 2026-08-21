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
      if (userProfile.perfil === 'PADRINHO' || userProfile.perfil === 'MADRINHA') {
        // Buscar afilhados vinculados a este padrinho/madrinha
        const { data: vinculos, error: errV } = await supabase
          .from('apc_vinculo')
          .select('afilhado_id, madrinha_id, padrinho_id, ano')
          .eq(userProfile.perfil === 'PADRINHO' ? 'padrinho_id' : 'madrinha_id', user.id);
          
        if (!errV && vinculos && vinculos.length > 0) {
          const idsAfilhados = vinculos.map(v => v.afilhado_id);
          const idsPadrinhos = vinculos.map(v => v.padrinho_id);
          const idsMadrinhas = vinculos.map(v => v.madrinha_id);
          const allIds = [...new Set([...idsAfilhados, ...idsPadrinhos, ...idsMadrinhas])].filter(Boolean);
          
          const { data: perfis, error: errP } = await supabase
            .from('apc_perfil')
            .select('*')
            .in('user_id', allIds);
            
            if (!errP && perfis) {
              const afilhadosMapeados = idsAfilhados.map(id => {
                const p = perfis.find(perfil => perfil.user_id === id);
                const v = vinculos.find(v => v.afilhado_id === id);
                
                const padrinhoPerfil = perfis.find(perfil => perfil.user_id === v?.padrinho_id);
                const madrinhaPerfil = perfis.find(perfil => perfil.user_id === v?.madrinha_id);
                
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
      else if (userProfile.perfil === 'AFILHADO') {
        // Buscar o padrinho deste afilhado
        const { data: vinculo, error: errV } = await supabase
          .from('apc_vinculo')
          .select('padrinho_id, madrinha_id, ano')
          .eq('afilhado_id', user.id)
          .maybeSingle();
          
        if (!errV && vinculo) {
          setAno(vinculo.ano);
          
          if (vinculo.padrinho_id) {
            const { data: pData } = await supabase.from('apc_perfil').select('*').eq('user_id', vinculo.padrinho_id).single();
            if (pData) setPadrinho(pData);
          }
          if (vinculo.madrinha_id) {
            const { data: mData } = await supabase.from('apc_perfil').select('*').eq('user_id', vinculo.madrinha_id).single();
            if (mData) setMadrinha(mData);
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
          <h2 style={{ marginBottom: '1rem', color: 'var(--accent-primary)' }}>Finalizar Cadastro</h2>
          <p style={{ marginBottom: '2rem' }}>Percebemos que o seu perfil ainda não foi gerado no banco de dados. Clique no botão abaixo para gerar seu perfil agora mesmo.</p>
          
          <button 
            className="btn btn-primary" 
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={async () => {
              try {
                setLoading(true);
                const { error } = await supabase
                  .from('apc_perfil')
                  .insert([{ 
                    user_id: user.id, 
                    nome: user.user_metadata?.nome || 'Usuário ' + user.email.split('@')[0], 
                    email: user.email, 
                    perfil: 'PENDENTE' 
                  }]);
                  
                if (error) throw error;
                
                // Recarrega a página para puxar o perfil novo
                window.location.reload();
              } catch (err) {
                alert('Erro ao criar perfil: ' + err.message);
                setLoading(false);
              }
            }}
          >
            Gerar Meu Perfil
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content">
      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Users size={32} color="var(--accent-primary)" />
          Dashboard
        </h1>
        <p style={{ marginTop: '0.5rem', fontSize: '1.1rem' }}>
          Olá, <strong style={{ color: 'var(--text-primary)' }}>{userProfile.nome}</strong>!
        </p>
        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
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

      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h4 style={{ fontWeight: 'bold', fontSize: '1.125rem' }}>Meus Dados</h4>
          <Link 
            to={`/editar-pessoa/${userProfile.id}`} 
            className="btn btn-secondary"
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.875rem' }}
          >
            <Edit2 size={16} />
            <span className="d-none d-md-flex" style={{ marginLeft: '0.25rem' }}>Atualizar Dados</span>
          </Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div><strong>E-mail:</strong> {userProfile.email || '-'}</div>
          <div><strong>Telefone:</strong> {userProfile.telefone || '-'}</div>
          <div><strong>Nascimento:</strong> {userProfile.data_nascimento ? new Date(userProfile.data_nascimento).toLocaleDateString('pt-BR') : '-'}</div>
        </div>
      </div>

      {(userProfile.perfil === 'PADRINHO' || userProfile.perfil === 'MADRINHA') && (
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h4 style={{ fontWeight: 'bold', fontSize: '1.125rem' }}>Meus Afilhados</h4>
            <span style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-primary)', padding: '0.25rem 0.75rem', borderRadius: '99px', fontSize: '0.875rem', fontWeight: 'bold' }}>
              {afilhados.length} Total
            </span>
          </div>

          {loading ? (
            <p>Carregando...</p>
          ) : afilhados.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
              <p>Você ainda não possui afilhados vinculados.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Nome do Afilhado</th>
                    <th>Padrinhos</th>
                    <th>E-mail</th>
                    <th>Telefone</th>
                    <th>Ano</th>
                  </tr>
                </thead>
                <tbody>
                  {afilhados.map((afilhado) => (
                    <tr key={afilhado.user_id}>
                      <td style={{ fontWeight: '500' }}>{afilhado.nome}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{afilhado.nomePadrinho} e {afilhado.nomeMadrinha}</td>
                      <td>{afilhado.email || '-'}</td>
                      <td>{afilhado.telefone || '-'}</td>
                      <td>{afilhado.ano || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {userProfile.perfil === 'AFILHADO' && (
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h4 style={{ fontWeight: 'bold', fontSize: '1.125rem', marginBottom: '1.5rem' }}>Meus Padrinhos</h4>
          
          {loading ? (
            <p>Carregando...</p>
          ) : (!padrinho && !madrinha) ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
              <p>Você ainda não foi vinculado a nenhum Padrinho/Madrinha.</p>
            </div>
          ) : (
            <>
              {ano && <p style={{ fontWeight: 'bold', color: 'var(--accent-primary)', marginBottom: '1.5rem' }}>Acampamento de {ano}</p>}
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

      {userProfile.perfil === 'ADMIN' && (
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h4 style={{ fontWeight: 'bold', fontSize: '1.125rem', marginBottom: '1.5rem' }}>Visão do Administrador</h4>
          <p>Utilize os menus laterais para gerenciar os usuários e realizar os vínculos do Acampamento.</p>
        </div>
      )}
    </div>
  );
};
