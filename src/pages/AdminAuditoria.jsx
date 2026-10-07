import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import * as XLSX from 'xlsx';
import {
  Activity,
  Search,
  RefreshCw,
  FileSpreadsheet,
  Eye,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  User,
  Clock,
  KeyRound,
  ShieldCheck,
  X,
  Copy,
  Check,
  ClipboardList,
  Filter
} from 'lucide-react';

export const AdminAuditoria = () => {
  const { userProfile } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filtros
  const [busca, setBusca] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('TODAS');
  const [nivelFiltro, setNivelFiltro] = useState('TODOS');
  const [periodoFiltro, setPeriodoFiltro] = useState('7DIAS'); // 'HOJE', '7DIAS', '30DIAS', 'TODOS'

  // Modal de Detalhes
  const [modalDetalhes, setModalDetalhes] = useState({ open: false, log: null, copiado: false });

  const perfil = userProfile?.perfil || 'PENDENTE';

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError('');

      let query = supabase
        .from('apc_auditoria')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      // Filtro de data no banco se aplicável
      if (periodoFiltro === 'HOJE') {
        const hojeInicio = new Date();
        hojeInicio.setHours(0, 0, 0, 0);
        query = query.gte('created_at', hojeInicio.toISOString());
      } else if (periodoFiltro === '7DIAS') {
        const seteDiasAtras = new Date();
        seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
        query = query.gte('created_at', seteDiasAtras.toISOString());
      } else if (periodoFiltro === '30DIAS') {
        const trintaDiasAtras = new Date();
        trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
        query = query.gte('created_at', trintaDiasAtras.toISOString());
      }

      const { data, error: errQuery } = await query;
      if (errQuery) throw errQuery;

      setLogs(data || []);
    } catch (err) {
      console.error('Erro ao buscar logs de auditoria:', err);
      setError(err.message || 'Erro ao carregar logs de auditoria.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (perfil === 'ADMIN') {
      fetchLogs();
    }
  }, [perfil, periodoFiltro]);

  // Filtragem local
  const logsFiltrados = useMemo(() => {
    return logs.filter((log) => {
      // Categoria
      if (categoriaFiltro !== 'TODAS' && log.categoria !== categoriaFiltro) {
        return false;
      }
      // Nível
      if (nivelFiltro !== 'TODOS' && log.nivel !== nivelFiltro) {
        return false;
      }
      // Busca textual
      if (busca.trim()) {
        const termo = busca.toLowerCase();
        const texto = `
          ${log.acao || ''}
          ${log.descricao || ''}
          ${log.user_nome || ''}
          ${log.user_email || ''}
          ${log.pagina || ''}
          ${JSON.stringify(log.detalhes || {})}
        `.toLowerCase();
        if (!texto.includes(termo)) return false;
      }
      return true;
    });
  }, [logs, categoriaFiltro, nivelFiltro, busca]);

  // Contadores para os Cards
  const totalEventos = logs.length;
  const totalLogins = logs.filter(l => l.acao === 'LOGIN' || l.acao === 'LOGIN_GOOGLE').length;
  const totalRecuperacoes = logs.filter(l => l.acao?.includes('RECUPERAR_SENHA')).length;
  const totalInscricoes = logs.filter(l => l.categoria === 'INSCRICAO').length;
  const totalErros = logs.filter(l => l.nivel === 'ERROR' || l.categoria === 'ERRO').length;

  const formatarDataHora = (dataIso) => {
    if (!dataIso) return '-';
    const d = new Date(dataIso);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getBadgeNivel = (nivel) => {
    switch (nivel) {
      case 'ERROR':
        return (
          <span className="badge" style={{ background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440' }}>
            <AlertCircle size={12} style={{ marginRight: '4px' }} /> ERRO
          </span>
        );
      case 'WARNING':
        return (
          <span className="badge" style={{ background: '#f59e0b20', color: '#f59e0b', border: '1px solid #f59e0b40' }}>
            <AlertTriangle size={12} style={{ marginRight: '4px' }} /> AVISO
          </span>
        );
      default:
        return (
          <span className="badge" style={{ background: '#10b98120', color: '#10b981', border: '1px solid #10b98140' }}>
            <CheckCircle2 size={12} style={{ marginRight: '4px' }} /> INFO
          </span>
        );
    }
  };

  const getBadgeCategoria = (cat) => {
    const cores = {
      AUTENTICACAO: { bg: '#3b82f620', color: '#60a5fa' },
      INSCRICAO: { bg: '#8b5cf620', color: '#a78bfa' },
      ADMIN: { bg: '#ec489920', color: '#f472b6' },
      ERRO: { bg: '#ef444420', color: '#f87171' },
      AFILHADOS: { bg: '#14b8a620', color: '#2dd4bf' },
      SISTEMA: { bg: '#64748b20', color: '#94a3b8' }
    };
    const c = cores[cat] || cores.SISTEMA;
    return (
      <span className="badge" style={{ background: c.bg, color: c.color, border: `1px solid ${c.color}30` }}>
        {cat}
      </span>
    );
  };

  const exportarParaExcel = () => {
    if (!logsFiltrados || logsFiltrados.length === 0) return;

    const rows = logsFiltrados.map((l) => ({
      'Data e Hora': formatarDataHora(l.created_at),
      'Nível': l.nivel,
      'Categoria': l.categoria,
      'Ação': l.acao,
      'Usuário Nome': l.user_nome || '-',
      'Usuário E-mail': l.user_email || '-',
      'Página': l.pagina || '-',
      'Descrição': l.descricao || '-',
      'Detalhes (JSON)': l.detalhes ? JSON.stringify(l.detalhes) : ''
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const colWidths = Object.keys(rows[0] || {}).map(k => ({ wch: Math.min(Math.max(k.length + 3, 14), 45) }));
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Auditoria');
    const dataHoraStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    XLSX.writeFile(wb, `auditoria_pos_crisma_${dataHoraStr}.xlsx`);
  };

  const copiarDetalhes = () => {
    if (!modalDetalhes.log) return;
    const txt = JSON.stringify(modalDetalhes.log, null, 2);
    navigator.clipboard.writeText(txt);
    setModalDetalhes(prev => ({ ...prev, copiado: true }));
    setTimeout(() => {
      setModalDetalhes(prev => ({ ...prev, copiado: false }));
    }, 2000);
  };

  if (perfil !== 'ADMIN') {
    return (
      <div className="main-content">
        <div className="alert alert-error">Acesso restrito. Apenas administradores e gestores podem acessar a auditoria.</div>
      </div>
    );
  }

  return (
    <div className="main-content">
      {/* Header */}
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0, fontSize: '1.75rem' }}>
              <Activity size={30} color="var(--accent-primary)" />
              Auditoria & Monitoramento
            </h1>
            <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              Rastreamento em tempo real de logins, recuperação de senhas, inscrições e ocorrências de erro.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              onClick={fetchLogs}
              disabled={loading}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Atualizar
            </button>

            <button
              onClick={exportarParaExcel}
              disabled={logsFiltrados.length === 0}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <FileSpreadsheet size={16} color="#10b981" />
              Exportar Excel
            </button>
          </div>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Total de Eventos</span>
            <ClipboardList size={20} color="var(--accent-primary)" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '0.5rem' }}>{totalEventos}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>no período selecionado</div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Logins Efetuados</span>
            <User size={20} color="#3b82f6" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '0.5rem', color: '#60a5fa' }}>{totalLogins}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>acessos ao sistema</div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Recuperações de Senha</span>
            <KeyRound size={20} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '0.5rem', color: '#fbbf24' }}>{totalRecuperacoes}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>solicitações de código</div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Inscrições / Fichas</span>
            <ShieldCheck size={20} color="#8b5cf6" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '0.5rem', color: '#c084fc' }}>{totalInscricoes}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>ações na ficha</div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Erros Registrados</span>
            <AlertCircle size={20} color="#ef4444" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '0.5rem', color: totalErros > 0 ? '#f87171' : 'var(--text-primary)' }}>
            {totalErros}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>falhas e exceções</div>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem', alignItems: 'center' }}>
          {/* Busca */}
          <div style={{ flex: '1 1 280px', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Buscar por usuário, e-mail, ação ou descrição..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="form-input"
                style={{
                  paddingLeft: '2.5rem',
                  paddingRight: busca ? '2.5rem' : '1rem',
                  paddingTop: '0.65rem',
                  paddingBottom: '0.65rem',
                  fontSize: '0.9rem'
                }}
              />
              {busca && (
                <button
                  type="button"
                  onClick={() => setBusca('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'rgba(0, 0, 0, 0.08)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '22px',
                    height: '22px',
                    cursor: 'pointer',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    zIndex: 2
                  }}
                  title="Limpar texto da busca"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Nível */}
          <div style={{ flex: '0 1 150px' }}>
            <select
              value={nivelFiltro}
              onChange={(e) => setNivelFiltro(e.target.value)}
              className="form-input"
              style={{ paddingTop: '0.65rem', paddingBottom: '0.65rem', fontSize: '0.9rem' }}
            >
              <option value="TODOS">Níveis</option>
              <option value="INFO">INFO</option>
              <option value="WARNING">AVISO</option>
              <option value="ERROR">ERRO</option>
            </select>
          </div>

          {/* Categoria */}
          <div style={{ flex: '0 1 180px' }}>
            <select
              value={categoriaFiltro}
              onChange={(e) => setCategoriaFiltro(e.target.value)}
              className="form-input"
              style={{ paddingTop: '0.65rem', paddingBottom: '0.65rem', fontSize: '0.9rem' }}
            >
              <option value="TODAS">Categorias</option>
              <option value="AUTENTICACAO">Autenticação</option>
              <option value="INSCRICAO">Inscrição</option>
              <option value="AFILHADOS">Afilhados</option>
              <option value="ADMIN">Administração</option>
              <option value="ERRO">Erros</option>
              <option value="SISTEMA">Sistema</option>
            </select>
          </div>

          {/* Período */}
          <div style={{ flex: '0 1 170px' }}>
            <select
              value={periodoFiltro}
              onChange={(e) => setPeriodoFiltro(e.target.value)}
              className="form-input"
              style={{ paddingTop: '0.65rem', paddingBottom: '0.65rem', fontSize: '0.9rem' }}
            >
              <option value="HOJE">Hoje</option>
              <option value="7DIAS">Últimos 7 dias</option>
              <option value="30DIAS">Últimos 30 dias</option>
              <option value="TODOS">Histórico Completo</option>
            </select>
          </div>

          {/* Botão Limpar Filtros quando há filtro ativo */}
          {(busca || categoriaFiltro !== 'TODAS' || nivelFiltro !== 'TODOS' || periodoFiltro !== '7DIAS') && (
            <button
              onClick={() => {
                setBusca('');
                setCategoriaFiltro('TODAS');
                setNivelFiltro('TODOS');
                setPeriodoFiltro('7DIAS');
              }}
              className="btn btn-secondary"
              style={{
                padding: '0.65rem 1rem',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                whiteSpace: 'nowrap'
              }}
              title="Restaurar filtros padrão"
            >
              <X size={15} /> Limpar Filtros
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>{error}</div>}

      {/* Tabela de Logs */}
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', background: 'rgba(255, 255, 255, 0.02)' }}>
                <th style={{ padding: '1rem', width: '170px' }}>Data / Hora</th>
                <th style={{ padding: '1rem', width: '110px' }}>Nível</th>
                <th style={{ padding: '1rem', width: '140px' }}>Categoria</th>
                <th style={{ padding: '1rem', width: '220px' }}>Ação</th>
                <th style={{ padding: '1rem' }}>Descrição</th>
                <th style={{ padding: '1rem', width: '90px', textAlign: 'center' }}>Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem' }}>
                      <RefreshCw size={20} className="animate-spin" /> Carregando registros de auditoria...
                    </div>
                  </td>
                </tr>
              ) : logsFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                    Nenhum evento de auditoria encontrado com os filtros atuais.
                  </td>
                </tr>
              ) : (
                logsFiltrados.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      {formatarDataHora(log.created_at)}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      {getBadgeNivel(log.nivel)}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      {getBadgeCategoria(log.categoria)}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>
                      <code>{log.acao}</code>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-primary)' }}>
                      {log.descricao || '-'}
                      {log.pagina && (
                        <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          Rota: <code>{log.pagina}</code>
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                      <button
                        onClick={() => setModalDetalhes({ open: true, log, copiado: false })}
                        className="btn btn-secondary"
                        style={{ padding: '0.35rem 0.6rem' }}
                        title="Ver detalhes completos do evento"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Detalhes do Evento */}
      {modalDetalhes.open && modalDetalhes.log && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '720px', maxHeight: '90vh', overflowY: 'auto', padding: '1.75rem', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Activity size={24} color="var(--accent-primary)" />
                <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Detalhes do Evento de Auditoria</h3>
              </div>
              <button
                onClick={() => setModalDetalhes({ open: false, log: null, copiado: false })}
                className="btn-icon"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Data / Hora</span>
                <div style={{ fontWeight: 600 }}>{formatarDataHora(modalDetalhes.log.created_at)}</div>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Nível / Categoria</span>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
                  {getBadgeNivel(modalDetalhes.log.nivel)}
                  {getBadgeCategoria(modalDetalhes.log.categoria)}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Ação</span>
                <div style={{ fontWeight: 600 }}><code>{modalDetalhes.log.acao}</code></div>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Rota / Página</span>
                <div style={{ fontWeight: 500 }}><code>{modalDetalhes.log.pagina || '-'}</code></div>
              </div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Usuário</span>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '8px', marginTop: '0.25rem' }}>
                <div><strong>Nome:</strong> {modalDetalhes.log.user_nome || 'Não informado'}</div>
                <div><strong>E-mail:</strong> {modalDetalhes.log.user_email || 'Não informado'}</div>
                <div><strong>ID:</strong> <code style={{ fontSize: '0.8rem' }}>{modalDetalhes.log.user_id || 'Não associado'}</code></div>
              </div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Descrição</span>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '8px', marginTop: '0.25rem' }}>
                {modalDetalhes.log.descricao}
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Metadados e Detalhes (JSON)</span>
                <button
                  onClick={copiarDetalhes}
                  className="btn btn-secondary"
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  {modalDetalhes.copiado ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                  {modalDetalhes.copiado ? 'Copiado!' : 'Copiar JSON'}
                </button>
              </div>
              <pre style={{
                background: 'rgba(0, 0, 0, 0.4)',
                padding: '1rem',
                borderRadius: '8px',
                fontSize: '0.82rem',
                overflowX: 'auto',
                border: '1px solid var(--border-color)',
                color: '#38bdf8',
                maxHeight: '260px'
              }}>
                {JSON.stringify(modalDetalhes.log.detalhes || {}, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
