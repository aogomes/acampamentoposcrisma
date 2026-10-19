import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
  Tent,
  Plus,
  Search,
  AlertCircle,
  Edit,
  Users,
  ChevronDown,
  X,
  Calendar
} from 'lucide-react';

const calcularIdade = (dataNascimento) => {
  if (!dataNascimento) return null;
  const hoje = new Date();
  const nasc = new Date(dataNascimento.includes('T') ? dataNascimento : `${dataNascimento}T12:00:00`);
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) {
    idade--;
  }
  return idade >= 0 ? idade : null;
};

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

  // Estado do Popover de dependentes
  const [popoverDependentes, setPopoverDependentes] = useState({
    isOpen: false,
    titularNome: '',
    tipoPessoa: '',
    dependentes: [],
    pos: null
  });

  // Fechar popover com tecla Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setPopoverDependentes(prev => ({ ...prev, isOpen: false }));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleOpenDependentes = (e, item) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const popoverWidth = 370;

    let left = rect.left;
    if (left + popoverWidth > window.innerWidth - 16) {
      left = window.innerWidth - popoverWidth - 16;
    }
    if (left < 16) left = 16;

    let top = rect.bottom + 6;
    if (top + 320 > window.innerHeight) {
      top = Math.max(16, rect.top - 320);
    }

    setPopoverDependentes({
      isOpen: true,
      titularNome: item.apc_pessoa?.nome || 'Participante',
      tipoPessoa: item.apc_pessoa?.tipo_pessoa || 'PADRINHO/MADRINHA',
      dependentes: item.dependentes || [],
      pos: { top, left }
    });
  };

  const carregarDependentesParaInscricoes = async (rawInscricoes) => {
    const idsParaBuscarDeps = new Set();
    rawInscricoes.forEach(item => {
      const p = item.apc_pessoa;
      const tipo = p?.tipo_pessoa?.toUpperCase();
      if (p && (tipo === 'PADRINHO' || tipo === 'MADRINHA')) {
        if (p.id) idsParaBuscarDeps.add(p.id);
        if (p.conjuge_id) idsParaBuscarDeps.add(p.conjuge_id);
      }
    });

    let dependentesMap = {};
    if (idsParaBuscarDeps.size > 0) {
      const { data: depsData, error: depsErr } = await supabase
        .from('apc_dependente')
        .select('*')
        .in('pessoa_id', Array.from(idsParaBuscarDeps));

      if (!depsErr && depsData) {
        depsData.forEach(d => {
          if (!dependentesMap[d.pessoa_id]) dependentesMap[d.pessoa_id] = [];
          dependentesMap[d.pessoa_id].push(d);
        });
      }
    }

    return rawInscricoes.map(item => {
      const p = item.apc_pessoa;
      const tipo = p?.tipo_pessoa?.toUpperCase();
      if (p && (tipo === 'PADRINHO' || tipo === 'MADRINHA')) {
        const dependentesDoItem = [];
        const seenDepIds = new Set();

        const addDeps = (pid) => {
          if (pid && dependentesMap[pid]) {
            dependentesMap[pid].forEach(d => {
              if (!seenDepIds.has(d.id)) {
                seenDepIds.add(d.id);
                dependentesDoItem.push(d);
              }
            });
          }
        };

        addDeps(p.id);
        if (p.conjuge_id) {
          addDeps(p.conjuge_id);
        }

        return {
          ...item,
          dependentes: dependentesDoItem
        };
      }
      return {
        ...item,
        dependentes: null
      };
    });
  };

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
              tipo_pessoa,
              conjuge_id
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
              apc_pessoa!apc_acampamento_pessoa_id_fkey ( id, nome, cpf, tipo_pessoa, conjuge_id )
            `)
            .eq('pessoa_id', pId)
            .order('created_at', { ascending: false });

          if (fbErr) throw fbErr;
          const fallbackComDeps = await carregarDependentesParaInscricoes(fallbackData || []);
          setInscricoes(fallbackComDeps);
          return;
        }
        throw inscricoesPromise.error;
      }

      const inscricoesComDeps = await carregarDependentesParaInscricoes(inscricoesPromise.data || []);
      setInscricoes(inscricoesComDeps);
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
      const dependentesNomes = (item.dependentes || []).map(d => d.nome?.toLowerCase() || '').join(' ');
      const termo = busca.toLowerCase().trim();

      const bateBusca = !termo ||
        participanteNome.includes(termo) ||
        participanteCpf.includes(termo) ||
        eventoDesc.includes(termo) ||
        dependentesNomes.includes(termo);

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
        <>
          {/* Tabela para Desktop */}
          <div className="glass-panel inscricoes-desktop-table" style={{ padding: 0, borderRadius: '10px' }}>
            <table className="table-compact" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ textAlign: 'left', padding: '0.65rem 1rem' }}>Participante</th>
                  <th style={{ textAlign: 'center', padding: '0.65rem 0.85rem' }}>Dependentes</th>
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
                  const tipoUpper = participante?.tipo_pessoa?.toUpperCase();
                  const isPadrinhoOuMadrinha = tipoUpper === 'PADRINHO' || tipoUpper === 'MADRINHA';
                  const deps = item.dependentes || [];
                  const depsCount = deps.length;

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

                      <td style={{ padding: '0.6rem 0.85rem', textAlign: 'center' }}>
                        {isPadrinhoOuMadrinha ? (
                          depsCount > 0 ? (
                            <button
                              type="button"
                              onClick={(e) => handleOpenDependentes(e, item)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                padding: '0.25rem 0.65rem',
                                borderRadius: '999px',
                                fontSize: '0.78rem',
                                fontWeight: '600',
                                background: 'rgba(37, 99, 235, 0.1)',
                                color: '#2563eb',
                                border: '1px solid rgba(37, 99, 235, 0.3)',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(37, 99, 235, 0.18)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(37, 99, 235, 0.1)'}
                              title="Clique para ver quem são os dependentes"
                            >
                              <Users size={13} />
                              <span>{depsCount} {depsCount === 1 ? 'dependente' : 'dependentes'}</span>
                              <ChevronDown size={12} style={{ opacity: 0.7 }} />
                            </button>
                          ) : (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                fontSize: '0.75rem',
                                color: 'var(--text-secondary)',
                                padding: '0.2rem 0.55rem',
                                borderRadius: '6px',
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                opacity: 0.8
                              }}
                              title="Nenhum dependente cadastrado"
                            >
                              <Users size={12} style={{ opacity: 0.6 }} />
                              0 dependentes
                            </span>
                          )
                        ) : (
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }} title="Não aplicável">
                            —
                          </span>
                        )}
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

          {/* Visualização Mobile: Cards Organizados */}
          <div className="inscricoes-mobile-list">
            {inscricoesFiltradas.map((item) => {
              const isMinha = item.pessoa_id === pessoaProfile?.id;
              const participante = item.apc_pessoa;
              const evento = item.apc_evento;
              const dataFormatada = item.created_at ? new Date(item.created_at).toLocaleDateString('pt-BR') : '-';
              const tipoUpper = participante?.tipo_pessoa?.toUpperCase();
              const isPadrinhoOuMadrinha = tipoUpper === 'PADRINHO' || tipoUpper === 'MADRINHA';
              const deps = item.dependentes || [];
              const depsCount = deps.length;

              const cardBorderAccent = isPadrinhoOuMadrinha
                ? '#10b981'
                : tipoUpper === 'AFILHADO'
                  ? '#f59e0b'
                  : '#2563eb';

              return (
                <div
                  key={`mobile-${item.id}`}
                  className="inscricao-card-mobile"
                  style={{ borderLeft: `4px solid ${cardBorderAccent}` }}
                >
                  {/* Cabeçalho do Card Mobile */}
                  <div className="inscricao-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '0.725rem',
                        fontWeight: '700',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '6px',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border-color)'
                      }}>
                        {participante?.tipo_pessoa || 'PARTICIPANTE'}
                      </span>

                      {isMinha ? (
                        <span style={{
                          fontSize: '0.65rem',
                          fontWeight: '700',
                          padding: '0.15rem 0.45rem',
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
                          padding: '0.15rem 0.45rem',
                          borderRadius: '999px',
                          background: '#d1fae5',
                          color: '#065f46'
                        }}>
                          INSCRITO POR VOCÊ
                        </span>
                      )}
                    </div>

                    <span style={{
                      fontSize: '0.725rem',
                      color: 'var(--text-secondary)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}>
                      <Calendar size={12} />
                      <span>{dataFormatada}</span>
                    </span>
                  </div>

                  {/* Corpo do Card Mobile */}
                  <div className="inscricao-card-body">
                    <div>
                      <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)', display: 'block' }}>
                        {participante?.nome || 'Nome não informado'}
                      </strong>
                    </div>

                    {/* Evento */}
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      color: '#15803d',
                      fontSize: '0.825rem',
                      fontWeight: 500
                    }}>
                      <Tent size={14} />
                      <span>{evento?.descricao || 'Acampamento'}</span>
                    </div>

                    {/* Dependentes no Card Mobile (caso Padrinho ou Madrinha) */}
                    {isPadrinhoOuMadrinha && (
                      <div style={{ marginTop: '0.2rem' }}>
                        {depsCount > 0 ? (
                          <button
                            type="button"
                            onClick={(e) => handleOpenDependentes(e, item)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              padding: '0.3rem 0.65rem',
                              borderRadius: '8px',
                              fontSize: '0.775rem',
                              fontWeight: '600',
                              background: 'rgba(37, 99, 235, 0.1)',
                              color: '#2563eb',
                              border: '1px solid rgba(37, 99, 235, 0.3)',
                              cursor: 'pointer',
                              width: 'fit-content'
                            }}
                            title="Clique para ver detalhes dos dependentes"
                          >
                            <Users size={13} />
                            <span>{depsCount} {depsCount === 1 ? 'dependente' : 'dependentes'}</span>
                            <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>(ver)</span>
                            <ChevronDown size={12} style={{ opacity: 0.7 }} />
                          </button>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            fontSize: '0.75rem',
                            color: 'var(--text-secondary)',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '6px',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            width: 'fit-content',
                            opacity: 0.8
                          }}>
                            <Users size={12} style={{ opacity: 0.6 }} />
                            0 dependentes vinculados
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Ações do Card Mobile */}
                  <div className="inscricao-card-actions">
                    <button
                      onClick={() => navigate(`/inscricao/${participante?.id}?eventoId=${evento?.id || ''}`)}
                      className="btn btn-secondary"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.35rem 0.75rem',
                        fontSize: '0.8rem',
                        borderRadius: '6px',
                        fontWeight: '600'
                      }}
                    >
                      <Edit size={13} />
                      <span>Editar Inscrição</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Popover / Caixinha suspensa de Dependentes (Padrinho / Madrinha) */}
      {popoverDependentes.isOpen && (
        <>
          {/* Backdrop semi-transparente para fechar ao clicar fora */}
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9998,
              cursor: 'default',
              background: 'rgba(0, 0, 0, 0.4)',
              backdropFilter: 'blur(2px)'
            }}
            onClick={() => setPopoverDependentes(prev => ({ ...prev, isOpen: false }))}
          />

          {/* Caixa Suspensa do Popover */}
          <div
            className="glass-panel"
            style={{
              position: 'fixed',
              top: typeof window !== 'undefined' && window.innerWidth <= 768 ? '50%' : `${popoverDependentes.pos?.top || 100}px`,
              left: typeof window !== 'undefined' && window.innerWidth <= 768 ? '50%' : `${popoverDependentes.pos?.left || 100}px`,
              transform: typeof window !== 'undefined' && window.innerWidth <= 768 ? 'translate(-50%, -50%)' : 'none',
              width: '370px',
              maxWidth: 'calc(100vw - 32px)',
              maxHeight: '85vh',
              overflowY: 'auto',
              zIndex: 9999,
              background: 'var(--bg-primary, #0f172a)',
              border: '1px solid var(--border-color)',
              borderRadius: '14px',
              boxShadow: '0 20px 40px -8px rgba(0, 0, 0, 0.6), 0 0 15px rgba(37, 99, 235, 0.15)',
              padding: '0.9rem 1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}
          >
            {/* Cabeçalho do Popover */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              borderBottom: '1px solid var(--border-color)',
              paddingBottom: '0.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  background: 'rgba(37, 99, 235, 0.15)',
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Users size={16} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                    Dependentes / Filhos
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.725rem', color: 'var(--text-secondary)' }}>
                    {popoverDependentes.titularNome} ({popoverDependentes.tipoPessoa}) • {popoverDependentes.dependentes.length} dependente(s)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPopoverDependentes(prev => ({ ...prev, isOpen: false }))}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '0.2rem',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Fechar"
              >
                <X size={16} />
              </button>
            </div>

            {/* Lista dos Dependentes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              {popoverDependentes.dependentes.length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.5rem 0', textAlign: 'center' }}>
                  Nenhum dependente cadastrado.
                </p>
              ) : (
                popoverDependentes.dependentes.map((dep, idx) => {
                  const idade = calcularIdade(dep.data_nascimento);
                  const vaiAcampamento = Boolean(dep.acampamento !== undefined ? dep.acampamento : dep.mascote);
                  const ehMascote = vaiAcampamento && Boolean(dep.mascote);

                  return (
                    <div
                      key={dep.id || idx}
                      style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        padding: '0.6rem 0.75rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.4rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
                        <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                          {dep.nome}
                        </strong>
                        {idade !== null && (
                          <span style={{
                            fontSize: '0.7rem',
                            color: 'var(--text-secondary)',
                            background: 'rgba(255, 255, 255, 0.05)',
                            padding: '0.1rem 0.35rem',
                            borderRadius: '4px',
                            border: '1px solid var(--border-color)'
                          }}>
                            {idade} ano{idade === 1 ? '' : 's'}
                          </span>
                        )}
                      </div>

                      {/* Badges de Status */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
                        {ehMascote && (
                          <span style={{
                            fontSize: '0.65rem',
                            fontWeight: '700',
                            background: '#fef3c7',
                            color: '#b45309',
                            border: '1px solid #fde68a',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '999px'
                          }}>
                            Mascote
                          </span>
                        )}

                        <span
                          style={{
                            fontSize: '0.675rem',
                            fontWeight: '600',
                            padding: '0.1rem 0.45rem',
                            borderRadius: '999px',
                            background: vaiAcampamento ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.08)',
                            color: vaiAcampamento ? '#059669' : '#dc2626',
                            border: vaiAcampamento ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(239, 68, 68, 0.2)'
                          }}
                        >
                          {vaiAcampamento ? 'Vai ao acampamento' : 'Não vai ao acampamento'}
                        </span>

                        {dep.tipo_sanguineo && (
                          <span style={{
                            fontSize: '0.65rem',
                            fontWeight: '600',
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: '#dc2626',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '999px'
                          }}>
                            Tipo: {dep.tipo_sanguineo}
                          </span>
                        )}
                      </div>

                      {/* Observações de Saúde / Alimentação se houver */}
                      {(dep.problema_saude === 'SIM' || dep.medicamento_continuo === 'SIM' || dep.restricao_alimentar === 'SIM' || dep.alergia_medicamento === 'SIM') && (
                        <div style={{
                          fontSize: '0.7rem',
                          color: '#b45309',
                          background: 'rgba(245, 158, 11, 0.08)',
                          border: '1px solid rgba(245, 158, 11, 0.2)',
                          borderRadius: '4px',
                          padding: '0.25rem 0.45rem',
                          marginTop: '0.15rem',
                          lineHeight: '1.3'
                        }}>
                          {dep.problema_saude === 'SIM' && (
                            <div>⚠️ Saúde: {dep.problema_saude_qual || 'Sim'}</div>
                          )}
                          {dep.medicamento_continuo === 'SIM' && (
                            <div>💊 Medicamento: {dep.medicamento_continuo_qual || 'Sim'}</div>
                          )}
                          {dep.restricao_alimentar === 'SIM' && (
                            <div>🍽️ Alim.: {dep.restricao_alimentar_qual || 'Sim'}</div>
                          )}
                          {dep.alergia_medicamento === 'SIM' && (
                            <div>⚠️ Alergia: {dep.alergia_medicamento_qual || 'Sim'}</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
