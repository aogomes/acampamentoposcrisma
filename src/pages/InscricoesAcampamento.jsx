import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
  Tent,
  Plus,
  Search,
  AlertCircle,
  Edit
} from 'lucide-react';

export const MinhasInscricoesAcampamento = () => {
  const { pessoaProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [inscricoes, setInscricoes] = useState([]);
  const [eventosAtivos, setEventosAtivos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busca, setBusca] = useState('');
  const [filtroEvento, setFiltroEvento] = useState('TODOS');
  const [filtroTipo, setFiltroTipo] = useState('TODOS'); // 'TODOS', 'MINHAS', 'DEPENDENTES'

  const fetchInscricoes = useCallback(async (pId) => {
    try {
      setLoading(true);
      setError('');

      // Executa as duas consultas em paralelo para eliminar o waterfall de rede
      const [evtsPromise, inscricoesPromise] = await Promise.all([
        supabase
          .from('apc_evento')
          .select('id, descricao, status')
          .order('data_inicio', { ascending: false }),
        supabase
          .from('apc_acampamento')
          .select(`
            id,
            evento_id,
            pessoa_id,
            criador_id,
            created_at,
            apc_evento (
              id,
              descricao
            ),
            apc_pessoa!apc_acampamento_pessoa_id_fkey (
              id,
              nome,
              cpf,
              tipo_pessoa
            )
          `)
          .or(`pessoa_id.eq.${pId},criador_id.eq.${pId}`)
          .order('created_at', { ascending: false })
      ]);

      if (evtsPromise.data) {
        setEventosAtivos(evtsPromise.data);
      }

      if (inscricoesPromise.error) {
        // Fallback caso criador_id não exista em algum ambiente legado
        if (inscricoesPromise.error.message?.includes('criador_id')) {
          const { data: fallbackData, error: fbErr } = await supabase
            .from('apc_acampamento')
            .select(`
              id,
              evento_id,
              pessoa_id,
              created_at,
              apc_evento ( id, descricao ),
              apc_pessoa!apc_acampamento_pessoa_id_fkey ( id, nome, cpf, tipo_pessoa )
            `)
            .eq('pessoa_id', pId)
            .order('created_at', { ascending: false });

          if (fbErr) throw fbErr;
          setInscricoes(fallbackData || []);
          return;
        }
        throw inscricoesPromise.error;
      }

      setInscricoes(inscricoesPromise.data || []);
    } catch (err) {
      console.error('Erro ao buscar inscrições do acampamento:', err);
      setError('Não foi possível carregar as inscrições: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (pessoaProfile?.id) {
      fetchInscricoes(pessoaProfile.id);
    } else {
      setLoading(false);
    }
  }, [authLoading, pessoaProfile?.id, fetchInscricoes]);

  // Filtragem memoizada
  const inscricoesFiltradas = useMemo(() => {
    return inscricoes.filter(item => {
      const participanteNome = item.apc_pessoa?.nome?.toLowerCase() || '';
      const participanteCpf = item.apc_pessoa?.cpf || '';
      const eventoDesc = item.apc_evento?.descricao?.toLowerCase() || '';
      const termo = busca.toLowerCase().trim();

      const bateBusca = !termo ||
        participanteNome.includes(termo) ||
        participanteCpf.includes(termo) ||
        eventoDesc.includes(termo);

      const bateEvento = filtroEvento === 'TODOS' || item.evento_id === filtroEvento;

      const isMinhaPropria = item.pessoa_id === pessoaProfile?.id;
      let bateTipo = true;
      if (filtroTipo === 'MINHAS') {
        bateTipo = isMinhaPropria;
      } else if (filtroTipo === 'DEPENDENTES') {
        bateTipo = !isMinhaPropria;
      }

      return bateBusca && bateEvento && bateTipo;
    });
  }, [inscricoes, busca, filtroEvento, filtroTipo, pessoaProfile?.id]);

  const totalInscricoes = inscricoes.length;
  const totalMinhas = useMemo(() => inscricoes.filter(i => i.pessoa_id === pessoaProfile?.id).length, [inscricoes, pessoaProfile?.id]);
  const totalDependentes = useMemo(() => inscricoes.filter(i => i.pessoa_id !== pessoaProfile?.id).length, [inscricoes, pessoaProfile?.id]);

  return (
    <div className="main-content">
      {/* Top Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)'
            }}>
              <Tent size={22} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800', letterSpacing: '-0.02em' }}>
                Minhas Inscrições
              </h1>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                Gerencie suas inscrições.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/inscricao')}
            className="btn btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1.15rem',
              borderRadius: '10px',
              fontWeight: '600'
            }}
          >
            <Plus size={18} />
            <span>Nova Inscrição</span>
          </button>
        </div>
      </div>

      {/* Barra de Filtros e Busca com detalhe de totais */}
      <div className="glass-panel" style={{ padding: '0.85rem 1rem', marginBottom: '1.25rem' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '0.75rem',
          alignItems: 'center'
        }}>
          {/* Campo de Busca */}
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{
              position: 'absolute',
              left: '0.85rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#94a3b8'
            }} />
            <input
              type="text"
              placeholder="Buscar por participante, CPF ou evento..."
              className="form-input"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              style={{ paddingLeft: '2.4rem' }}
            />
          </div>

          {/* Filtro por Evento */}
          <div>
            <select
              className="form-input"
              value={filtroEvento}
              onChange={(e) => setFiltroEvento(e.target.value)}
            >
              <option value="TODOS">Todos os Eventos</option>
              {eventosAtivos.map(evt => (
                <option key={evt.id} value={evt.id}>
                  {evt.descricao} ({evt.status})
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Tipo de Inscrição */}
          <div>
            <select
              className="form-input"
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
            >
              <option value="TODOS">Todas as Inscrições</option>
              <option value="MINHAS">Somente Minha Inscrição</option>
              <option value="DEPENDENTES">Cadastrados por Mim</option>
            </select>
          </div>
        </div>

        {/* Detalhe de Totais logo abaixo dos filtros */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          flexWrap: 'wrap',
          gap: '0.5rem',
          marginTop: '0.65rem',
          paddingTop: '0.65rem',
          borderTop: '1px solid var(--border-color)',
          fontSize: '0.825rem',
          color: 'var(--text-secondary)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span>Total: <strong style={{ color: 'var(--text-primary)' }}>{totalInscricoes}</strong></span>
            <span>•</span>
            <span>Minha Inscrição: <strong style={{ color: '#2563eb' }}>{totalMinhas}</strong></span>
            <span>•</span>
            <span>Cadastrados por você: <strong style={{ color: '#059669' }}>{totalDependentes}</strong></span>
          </div>

          {(busca || filtroEvento !== 'TODOS' || filtroTipo !== 'TODOS') && (
            <span style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: '600' }}>
              Exibindo {inscricoesFiltradas.length} de {totalInscricoes} resultado(s)
            </span>
          )}
        </div>
      </div>

      {/* Alertas */}
      {error && (
        <div className="alert alert-error" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Conteúdo Principal */}
      {(loading || authLoading) ? (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
          <div className="spin" style={{ display: 'inline-block', marginBottom: '0.75rem', color: 'var(--accent-primary)' }}>
            <Tent size={36} />
          </div>
          <p style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Carregando inscrições...</p>
        </div>
      ) : inscricoesFiltradas.length === 0 ? (
        <div className="glass-panel" style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: '#f1f5f9',
            color: '#64748b',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1rem'
          }}>
            <Tent size={32} />
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.5rem' }}>
            Nenhuma inscrição encontrada
          </h3>
          <p style={{ color: 'var(--text-secondary)', margin: '0 auto 1.5rem auto', fontSize: '0.9rem' }}>
            {busca || filtroEvento !== 'TODOS' || filtroTipo !== 'TODOS'
              ? 'Nenhum resultado corresponde aos filtros aplicados. Tente ajustar os termos de busca.'
              : 'Você ainda não possui inscrições cadastradas para o acampamento.'}
          </p>
          <button
            onClick={() => navigate('/inscricao')}
            className="btn btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              borderRadius: '10px',
              fontWeight: '600'
            }}
          >
            <Plus size={18} />
            <span>Fazer Inscrição</span>
          </button>
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: 0, overflowX: 'auto', borderRadius: '10px' }}>
          <table className="table-compact" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ textAlign: 'left', padding: '0.65rem 1rem' }}>Participante</th>
                <th style={{ textAlign: 'left', padding: '0.65rem 0.85rem' }}>Tipo</th>
                <th style={{ textAlign: 'left', padding: '0.65rem 0.85rem' }}>Evento</th>
                <th style={{ textAlign: 'center', padding: '0.65rem 0.85rem' }}>Inscrição</th>
                <th style={{ textAlign: 'right', padding: '0.65rem 1rem' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {inscricoesFiltradas.map((item) => {
                const isMinha = item.pessoa_id === pessoaProfile?.id;
                const participante = item.apc_pessoa;
                const evento = item.apc_evento;
                const dataFormatada = item.created_at ? new Date(item.created_at).toLocaleDateString('pt-BR') : '-';

                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.6rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                          {participante?.nome || 'Nome não informado'}
                        </strong>
                        {isMinha ? (
                          <span style={{
                            fontSize: '0.65rem',
                            fontWeight: '700',
                            padding: '0.12rem 0.45rem',
                            borderRadius: '999px',
                            background: '#dbeafe',
                            color: '#1e40af'
                          }}>
                            TITULAR (VOCÊ)
                          </span>
                        ) : (
                          <span style={{
                            fontSize: '0.65rem',
                            fontWeight: '700',
                            padding: '0.12rem 0.45rem',
                            borderRadius: '999px',
                            background: '#d1fae5',
                            color: '#065f46'
                          }}>
                            INSCRITO POR VOCÊ
                          </span>
                        )}
                      </div>
                    </td>

                    <td style={{ padding: '0.6rem 0.85rem' }}>
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        padding: '0.15rem 0.45rem',
                        borderRadius: '5px',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border-color)'
                      }}>
                        {participante?.tipo_pessoa || 'PARTICIPANTE'}
                      </span>
                    </td>

                    <td style={{ padding: '0.6rem 0.85rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#15803d', fontWeight: 500 }}>
                        <Tent size={14} />
                        <span>{evento?.descricao || 'Acampamento'}</span>
                      </div>
                    </td>

                    <td style={{ padding: '0.6rem 0.85rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.825rem' }}>
                      {dataFormatada}
                    </td>

                    <td style={{ padding: '0.6rem 1rem', textAlign: 'right' }}>
                      <button
                        onClick={() => navigate(`/inscricao/${participante?.id}?eventoId=${evento?.id || ''}`)}
                        className="btn btn-secondary"
                        title="Editar Inscrição"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.3rem 0.65rem',
                          fontSize: '0.8rem',
                          borderRadius: '6px',
                          fontWeight: '600'
                        }}
                      >
                        <Edit size={13} />
                        <span>Editar</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
