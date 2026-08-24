import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Tent, Plus, Trash2, Edit2, Search, Filter, ArrowLeft, DollarSign, CheckCircle2, XCircle, Users, X, ChevronDown, ChevronRight } from 'lucide-react';
import { useParams, Link } from 'react-router-dom';

const DependentesAccordion = ({ dependentes }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!dependentes || dependentes.length === 0) return null;

  return (
    <div style={{ marginTop: '0.5rem' }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        title='Filho(s) inscrito(s) no acampamento'
        style={{
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          userSelect: 'none',
          padding: '0.2rem 0.5rem',
          background: 'var(--bg-secondary)',
          borderRadius: '4px',
          border: '1px solid var(--border-color)'
        }}
      >
        <Users size={12} />
        {isOpen ? 'Filho(s)' : `Ver Filho(s) (${dependentes.length})`}
        {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </div>

      {isOpen && (
        <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem', paddingLeft: '1rem', borderLeft: '2px solid var(--accent-primary)' }}>
          {dependentes.map(d => (
            <span
              key={d.id}
              title={d.mascote ? "Filho(a): Sim, vai para o acampamento" : "Filho(a): Não vai para o acampamento"}
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-primary)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                whiteSpace: 'nowrap',
                background: 'var(--bg-secondary)',
                padding: '0.25rem 0.5rem',
                borderRadius: '6px',
                border: '1px solid var(--border-color)'
              }}
            >
              {d.nome} {d.mascote ? <CheckCircle2 size={14} color="var(--success)" /> : <X size={14} color="var(--error)" />}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export const AdminAcampamentos = () => {
  const { userProfile } = useAuth();
  const { evento_id } = useParams();

  const [acampamentos, setAcampamentos] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [pessoas, setPessoas] = useState([]);

  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [filterVinculo, setFilterVinculo] = useState('TODOS');
  const [filterEquipe, setFilterEquipe] = useState('TODOS');
  const [filterAno, setFilterAno] = useState('TODOS');

  const [formData, setFormData] = useState({
    evento_id: evento_id || '',
    pessoa_id: '',
    titular_id: null,
    titular_equipe: [],
    titular_inscrito: true,
    conjuge_id: null,
    conjuge_pessoa_id: '',
    conjuge_equipe: [],
    conjuge_inscrito: false
  });

  const [equipesDisponiveis, setEquipesDisponiveis] = useState([]);

  useEffect(() => {
    if (userProfile?.perfil === 'ADMIN' || userProfile?.perfil === 'GESTOR') {
      fetchData();
    }
  }, [userProfile, isCreating]);

  const fetchData = async () => {
    try {
      setLoadingData(true);

      // 1. Busca todos os eventos
      const { data: eventosData } = await supabase
        .from('apc_evento')
        .select('id, descricao, equipes, status')
        .order('data_inicio', { ascending: false });

      setEventos(eventosData || []);

      // 2. Busca todas as pessoas e seus dependentes
      const { data: pessoasData } = await supabase
        .from('apc_pessoa')
        .select(`
          id, nome, tipo_pessoa, conjuge_id, ano,
          apc_dependente ( id, nome, mascote )
        `)
        .order('nome', { ascending: true });

      setPessoas(pessoasData || []);

      // 3. Busca as inscrições se não estiver no modo de criação
      if (!isCreating) {
        const { data: acampData, error: acampError } = await supabase
          .from('apc_acampamento')
          .select(`
            id,
            equipe,
            apc_evento ( id, descricao ),
            apc_pessoa ( id, nome, tipo_pessoa, conjuge_id, ano, apc_dependente ( id, nome, mascote ) )
          `)
          .eq('evento_id', evento_id)
          .order('created_at', { ascending: false });

        if (acampError) throw acampError;

        // Busca vínculos para os afilhados e mescla
        const afilhadoIds = (acampData || [])
          .filter(a => a.apc_pessoa?.tipo_pessoa === 'AFILHADO')
          .map(a => a.apc_pessoa?.id);

        if (afilhadoIds.length > 0) {
          const { data: vinculosData } = await supabase
            .from('apc_vinculo')
            .select('*')
            .in('afilhado_id', afilhadoIds);

          const vinculosMap = {};
          if (vinculosData) {
            vinculosData.forEach(v => {
              const padrinho = pessoasData?.find(p => p.id === v.padrinho_id);
              const madrinha = pessoasData?.find(p => p.id === v.madrinha_id);
              vinculosMap[v.afilhado_id] = { padrinho, madrinha };
            });
          }

          acampData.forEach(a => {
            if (a.apc_pessoa?.tipo_pessoa === 'AFILHADO' && vinculosMap[a.apc_pessoa.id]) {
              a.apc_pessoa.vinculo = vinculosMap[a.apc_pessoa.id];
            }
          });
        }

        // Mapeia o cônjuge para padrinhos/madrinhas e agrupa os dependentes
        acampData.forEach(a => {
          if (a.apc_pessoa) {
            let todosDependentes = [...(a.apc_pessoa.apc_dependente || [])];

            if (a.apc_pessoa.tipo_pessoa === 'PADRINHO' || a.apc_pessoa.tipo_pessoa === 'MADRINHA') {
              if (a.apc_pessoa.conjuge_id) {
                const conjuge = pessoasData?.find(p => p.id === a.apc_pessoa.conjuge_id);
                if (conjuge) {
                  a.apc_pessoa.conjuge = conjuge;
                  // Adiciona os dependentes do cônjuge, evitando duplicação se houver (teoricamente são ids diferentes se salvos por um ou por outro)
                  const conjugeDeps = conjuge.apc_dependente || [];
                  conjugeDeps.forEach(cd => {
                    if (!todosDependentes.find(d => d.id === cd.id)) {
                      todosDependentes.push(cd);
                    }
                  });
                }
              }
            }

            a.apc_pessoa.dependentes_agrupados = todosDependentes;
          }
        });

        const groupedAcampamentos = [];
        const processedIds = new Set();

        (acampData || []).forEach(a => {
          if (!a.apc_pessoa) return;
          if (processedIds.has(a.apc_pessoa.id)) return;

          processedIds.add(a.apc_pessoa.id);
          if (a.apc_pessoa.conjuge_id) {
            processedIds.add(a.apc_pessoa.conjuge_id);
          }

          const conjugeAcamp = acampData.find(c => c.apc_pessoa?.id === a.apc_pessoa.conjuge_id);
          a.conjuge_inscricao = conjugeAcamp || null;
          groupedAcampamentos.push(a);
        });

        setAcampamentos(groupedAcampamentos);
      }

    } catch (err) {
      setError('Erro ao carregar dados: ' + err.message);
    } finally {
      setLoadingData(false);
    }
  };

  // Quando o usuário seleciona um evento, atualizamos as equipes disponíveis
  useEffect(() => {
    if (formData.evento_id) {
      const ev = eventos.find(e => e.id === formData.evento_id);
      setEquipesDisponiveis(ev?.equipes || []);

      // Remove equipes do formData se não existirem mais no evento selecionado
      setFormData(prev => ({
        ...prev,
        titular_equipe: (prev.titular_equipe || []).filter(eq => (ev?.equipes || []).includes(eq)),
        conjuge_equipe: (prev.conjuge_equipe || []).filter(eq => (ev?.equipes || []).includes(eq))
      }));
    } else {
      setEquipesDisponiveis([]);
      setFormData(prev => ({ ...prev, titular_equipe: [], conjuge_equipe: [] }));
    }
  }, [formData.evento_id, eventos]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePessoaChange = (e) => {
    const pId = e.target.value;
    const pessoa = pessoas.find(p => p.id === pId);
    setFormData(prev => ({
      ...prev,
      pessoa_id: pId,
      titular_inscrito: true,
      conjuge_pessoa_id: pessoa?.conjuge_id || '',
      conjuge_inscrito: !!pessoa?.conjuge_id
    }));
  };

  const handleCheckboxChange = (equipeName, isConjuge = false) => {
    setFormData(prev => {
      const field = isConjuge ? 'conjuge_equipe' : 'titular_equipe';
      const isSelected = prev[field].includes(equipeName);
      if (isSelected) {
        return { ...prev, [field]: prev[field].filter(eq => eq !== equipeName) };
      } else {
        return { ...prev, [field]: [...prev[field], equipeName] };
      }
    });
  };

  const handleEdit = (a) => {
    setFormData({
      evento_id: a.evento_id || evento_id,
      pessoa_id: a.apc_pessoa.id,

      titular_id: a.id,
      titular_equipe: a.equipe || [],
      titular_inscrito: true,

      conjuge_id: a.conjuge_inscricao?.id || null,
      conjuge_pessoa_id: a.apc_pessoa.conjuge_id || '',
      conjuge_equipe: a.conjuge_inscricao?.equipe || [],
      conjuge_inscrito: !!a.conjuge_inscricao,
    });
    setIsCreating(true);
    setSuccess('');
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const operations = [];

      // Titular
      if (formData.titular_inscrito) {
        const payloadTitular = {
          evento_id: formData.evento_id,
          pessoa_id: formData.pessoa_id,
          equipe: formData.titular_equipe
        };
        if (formData.titular_id) {
          operations.push(supabase.from('apc_acampamento').update(payloadTitular).eq('id', formData.titular_id));
        } else {
          operations.push(supabase.from('apc_acampamento').insert([payloadTitular]));
        }
      } else if (formData.titular_id) {
        operations.push(supabase.from('apc_acampamento').delete().eq('id', formData.titular_id));
      }

      // Conjuge
      if (formData.conjuge_pessoa_id) {
        if (formData.conjuge_inscrito) {
          const payloadConjuge = {
            evento_id: formData.evento_id,
            pessoa_id: formData.conjuge_pessoa_id,
            equipe: formData.conjuge_equipe
          };
          if (formData.conjuge_id) {
            operations.push(supabase.from('apc_acampamento').update(payloadConjuge).eq('id', formData.conjuge_id));
          } else {
            operations.push(supabase.from('apc_acampamento').insert([payloadConjuge]));
          }
        } else if (formData.conjuge_id) {
          operations.push(supabase.from('apc_acampamento').delete().eq('id', formData.conjuge_id));
        }
      }

      for (const promise of operations) {
        const { error: dbError } = await promise;
        if (dbError) throw dbError;
      }

      setSuccess('Inscrição familiar salva com sucesso!');
      fetchData(); // Refresh the list

      setTimeout(() => {
        setIsCreating(false);
        setSuccess('');
      }, 1500);

    } catch (err) {
      setError('Erro ao salvar inscrição: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (a) => {
    if (!window.confirm('Tem certeza que deseja remover esta inscrição e da sua família (se houver)?')) return;

    try {
      setError('');
      const idsToDelete = [a.id];
      if (a.conjuge_inscricao) {
        idsToDelete.push(a.conjuge_inscricao.id);
      }

      const { error } = await supabase.from('apc_acampamento').delete().in('id', idsToDelete);
      if (error) throw error;

      fetchData(); // Reload instead of filtering the complex group
      setSuccess('Inscrição removida com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Erro ao excluir: ' + err.message);
    }
  };

  if (userProfile?.perfil !== 'ADMIN' && userProfile?.perfil !== 'GESTOR') {
    return (
      <div className="main-content">
        <div className="alert alert-error">Acesso negado. Você não tem permissão para acessar esta página.</div>
      </div>
    );
  }

  const filteredAcampamentos = acampamentos.filter(a => {
    const nomePessoa = a.apc_pessoa?.nome?.toLowerCase() || '';
    const nomeConjuge = a.conjuge_inscricao?.apc_pessoa?.nome?.toLowerCase() || '';
    const matchesSearch = nomePessoa.includes(searchTerm.toLowerCase()) || nomeConjuge.includes(searchTerm.toLowerCase());

    let matchesVinculo = true;
    if (filterVinculo !== 'TODOS') {
      const pId = a.apc_pessoa?.id;
      const v = a.apc_pessoa?.vinculo;

      // Is this person the selected padrinho/madrinha?
      if (pId === filterVinculo) {
        matchesVinculo = true;
      }
      // Is this person an afilhado of the selected padrinho/madrinha?
      else if (v?.padrinho?.id === filterVinculo || v?.madrinha?.id === filterVinculo) {
        matchesVinculo = true;
      }
      // Is this person the partner (madrinha/padrinho) of the selected person for some afilhado in the list?
      else {
        const isPartner = acampamentos.some(other => {
          const otherV = other.apc_pessoa?.vinculo;
          if (otherV) {
            const hasSelected = otherV.padrinho?.id === filterVinculo || otherV.madrinha?.id === filterVinculo;
            const hasThis = otherV.padrinho?.id === pId || otherV.madrinha?.id === pId;
            return hasSelected && hasThis;
          }
          return false;
        });
        matchesVinculo = isPartner;
      }
    }

    const matchesEquipe = filterEquipe === 'TODOS' ||
      (a.equipe && a.equipe.includes(filterEquipe)) ||
      (a.conjuge_inscricao?.equipe && a.conjuge_inscricao.equipe.includes(filterEquipe));

    const matchesAno = filterAno === 'TODOS' || (a.apc_pessoa?.ano && a.apc_pessoa.ano.toString() === filterAno);

    return matchesSearch && matchesVinculo && matchesEquipe && matchesAno;
  }).sort((a, b) => (a.apc_pessoa?.nome || '').localeCompare(b.apc_pessoa?.nome || ''));

  const todasEquipes = Array.from(new Set(eventos.flatMap(e => e.equipes || []))).sort();
  const anosDisponiveis = Array.from(new Set(acampamentos.map(a => a.apc_pessoa?.ano).filter(Boolean))).sort((a, b) => b - a);

  // Métricas
  const countPadrinhos = filteredAcampamentos.reduce((acc, a) => {
    let count = 0;
    if (a.apc_pessoa?.tipo_pessoa === 'PADRINHO' || a.apc_pessoa?.tipo_pessoa === 'MADRINHA') count++;
    if (a.conjuge_inscricao && (a.conjuge_inscricao.apc_pessoa?.tipo_pessoa === 'PADRINHO' || a.conjuge_inscricao.apc_pessoa?.tipo_pessoa === 'MADRINHA')) count++;
    return acc + count;
  }, 0);

  const countAfilhados = filteredAcampamentos.reduce((acc, a) => {
    let count = 0;
    if (a.apc_pessoa?.tipo_pessoa === 'AFILHADO') count++;
    if (a.conjuge_inscricao && a.conjuge_inscricao.apc_pessoa?.tipo_pessoa === 'AFILHADO') count++;
    return acc + count;
  }, 0);

  const countVoluntarios = filteredAcampamentos.reduce((acc, a) => {
    let count = 0;
    if (a.apc_pessoa?.tipo_pessoa === 'VOLUNTARIO') count++;
    if (a.conjuge_inscricao && a.conjuge_inscricao.apc_pessoa?.tipo_pessoa === 'VOLUNTARIO') count++;
    return acc + count;
  }, 0);

  let countFilhos = 0;
  const filhosContados = new Set();
  filteredAcampamentos.forEach(a => {
    if (a.apc_pessoa?.dependentes_agrupados) {
      a.apc_pessoa.dependentes_agrupados.forEach(d => {
        if (d.mascote && !filhosContados.has(d.id)) {
          filhosContados.add(d.id);
          countFilhos++;
        }
      });
    }
  });

  const totalParticipantes = countPadrinhos + countAfilhados + countVoluntarios + countFilhos;

  const currentEvento = eventos.find(e => e.id === evento_id);

  return (
    <div className="main-content">
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* <Link to="/admin/eventos" className="btn btn-secondary" style={{ padding: '0.5rem' }}>
              <ArrowLeft size={20} />
            </Link> */}
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0, fontSize: '1.75rem', flexWrap: 'wrap' }}>
              <Tent size={32} color="var(--accent-primary)" />
              {isCreating ? (formData.id ? 'Editar Inscrição' : 'Nova Inscrição') : `${currentEvento?.descricao || 'Carregando...'}`}
            </h1>
          </div>
          <button
            onClick={() => {
              setIsCreating(!isCreating);
              setSuccess('');
              setError('');
              setFormData({
                evento_id: evento_id || '',
                pessoa_id: '',
                titular_id: null,
                titular_equipe: [],
                titular_inscrito: true,
                conjuge_id: null,
                conjuge_pessoa_id: '',
                conjuge_equipe: [],
                conjuge_inscrito: false
              });
            }}
            className={isCreating ? "btn btn-secondary" : "btn btn-primary"}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            {isCreating ? 'Voltar para Lista' : <><Plus size={20} /> Nova Inscrição</>}
          </button>
        </div>
        <p style={{ margin: 0, fontSize: '1rem', color: 'var(--text-secondary)' }}>
          {isCreating ? 'Vincule uma pessoa a este evento e selecione suas equipes.' : 'Gerencie as inscrições do acampamento.'}
        </p>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '2rem' }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: '2rem' }}>{success}</div>}

      {isCreating ? (
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Evento</label>
                <div className="form-input" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                  {currentEvento?.descricao || 'Carregando...'}
                </div>
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label" htmlFor="pessoa_id">Pessoa *</label>
                <select
                  id="pessoa_id"
                  name="pessoa_id"
                  className="form-input"
                  value={formData.pessoa_id}
                  onChange={handlePessoaChange}
                  required
                >
                  <option value="">-- Selecione a Pessoa --</option>
                  {pessoas.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nome} ({p.tipo_pessoa})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {formData.evento_id && formData.pessoa_id && equipesDisponiveis.length > 0 && (
              <div className="form-grid" style={{ marginTop: '1.5rem' }}>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.titular_inscrito}
                      onChange={(e) => setFormData(prev => ({ ...prev, titular_inscrito: e.target.checked }))}
                      style={{ width: '1.2rem', height: '1.2rem', accentColor: 'var(--accent-primary)' }}
                    />
                    Confirmação de<span style={{ color: 'var(--accent-primary)', textDecoration: 'underline', marginLeft: '0.2rem' }}>{pessoas.find(p => p.id === formData.pessoa_id)?.nome}</span>
                  </label>
                  {formData.titular_inscrito && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '1rem', paddingLeft: '2rem' }}>
                      {equipesDisponiveis.map(equipeName => (
                        <label key={equipeName} style={{
                          fontSize: '0.7rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.5rem 1rem',
                          background: 'var(--bg-secondary)',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          border: formData.titular_equipe.includes(equipeName) ? '1px solid var(--accent-primary)' : '1px solid transparent'
                        }}>
                          <input
                            type="checkbox"
                            checked={formData.titular_equipe.includes(equipeName)}
                            onChange={() => handleCheckboxChange(equipeName, false)}
                            style={{ width: '1rem', height: '1rem', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                          />
                          <span style={{ fontWeight: '600' }}>{equipeName}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {formData.conjuge_pessoa_id && (
                  <div className="form-group" style={{ gridColumn: '1 / -1', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                    <label className="form-label" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={formData.conjuge_inscrito}
                        onChange={(e) => setFormData(prev => ({ ...prev, conjuge_inscrito: e.target.checked }))}
                        style={{ width: '1.2rem', height: '1.2rem', accentColor: 'var(--accent-primary)' }}
                      />
                      Confirmação de <span style={{ color: 'var(--accent-primary)', textDecoration: 'underline', marginLeft: '0.2rem' }}>{pessoas.find(p => p.id === formData.conjuge_pessoa_id)?.nome}</span> (Cônjuge):
                    </label>
                    {formData.conjuge_inscrito && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '1rem', paddingLeft: '2rem' }}>
                        {equipesDisponiveis.map(equipeName => (
                          <label key={`conjuge-${equipeName}`} style={{
                            fontSize: '0.7rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.5rem 1rem',
                            background: 'var(--bg-secondary)',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            border: formData.conjuge_equipe.includes(equipeName) ? '1px solid var(--accent-primary)' : '1px solid transparent'
                          }}>
                            <input
                              type="checkbox"
                              checked={formData.conjuge_equipe.includes(equipeName)}
                              onChange={() => handleCheckboxChange(equipeName, true)}
                              style={{ width: '1rem', height: '1rem', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                            />
                            <span style={{ fontWeight: '600' }}>{equipeName}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {formData.evento_id && equipesDisponiveis.length === 0 && (
              <div className="alert alert-warning" style={{ marginTop: '1rem', background: 'rgba(245, 158, 11, 0.1)', color: '#d97706', padding: '1rem', borderRadius: '8px' }}>
                Este evento não possui equipes cadastradas. Você pode salvá-lo sem equipes ou editar o evento primeiro.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Salvando...' : 'Salvar Inscrição'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '2rem' }}>

          {/* Cards de Métricas */}
          {!loadingData && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ background: 'var(--bg-secondary)', padding: '0.2rem', borderRadius: '8px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Padrinhos</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>{countPadrinhos}</div>
              </div>
              <div style={{ background: 'var(--bg-secondary)', padding: '0.2rem', borderRadius: '8px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Filhos</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>{countFilhos}</div>
              </div>
              <div style={{ background: 'var(--bg-secondary)', padding: '0.2rem', borderRadius: '8px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Afilhados</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>{countAfilhados}</div>
              </div>
              <div style={{ background: 'var(--bg-secondary)', padding: '0.2rem', borderRadius: '8px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Voluntários</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>{countVoluntarios}</div>
              </div>
              <div style={{ background: 'var(--bg-primary)', padding: '0.2rem', borderRadius: '8px', textAlign: 'center', border: '2px solid var(--accent-primary)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 'bold' }}>Total Geral</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>{totalParticipantes}</div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '1rem', flex: '1 1 400px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
                <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                <input
                  type="text"
                  placeholder="Buscar pessoa..."
                  className="form-input"
                  style={{ paddingLeft: '2.5rem', margin: 0 }}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div style={{ position: 'relative', minWidth: '150px' }}>
                <Filter size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                <select
                  className="form-input"
                  style={{ paddingLeft: '2.5rem', margin: 0 }}
                  value={filterAno}
                  onChange={(e) => setFilterAno(e.target.value)}
                >
                  <option value="TODOS">Filtro por Ano</option>
                  {anosDisponiveis.map(ano => (
                    <option key={ano} value={ano}>{ano}</option>
                  ))}
                </select>
              </div>

              <div style={{ position: 'relative', minWidth: '200px' }}>
                <Filter size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                <select
                  className="form-input"
                  style={{ paddingLeft: '2.5rem', margin: 0 }}
                  value={filterVinculo}
                  onChange={(e) => setFilterVinculo(e.target.value)}
                >
                  <option value="TODOS">Filtro por Padrinhos</option>
                  {pessoas
                    .filter(p => p.tipo_pessoa === 'PADRINHO' || p.tipo_pessoa === 'MADRINHA')
                    .map(p => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                </select>
              </div>

              <div style={{ position: 'relative', minWidth: '200px' }}>
                <Filter size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                <select
                  className="form-input"
                  style={{ paddingLeft: '2.5rem', margin: 0 }}
                  value={filterEquipe}
                  onChange={(e) => setFilterEquipe(e.target.value)}
                >
                  <option value="TODOS">Filtro por Equipes</option>
                  {todasEquipes.map(eq => (
                    <option key={eq} value={eq}>{eq}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {loadingData ? (
            <p>Carregando inscrições...</p>
          ) : filteredAcampamentos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
              <p>Nenhuma inscrição encontrada.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table-compact">
                <thead>
                  <tr>
                    <th>Ano</th>
                    <th style={{ width: '30%', minWidth: '250px' }}>Nome</th>
                    <th>Equipe</th>
                    <th>Padrinhos</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAcampamentos.map((a) => (
                    <tr key={a.id}>
                      <td>{a.apc_pessoa?.ano}</td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem' }}>
                            <span style={{ fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'help' }} title="Sim, vai para o Acampamento">
                              {a.apc_pessoa?.nome} <CheckCircle2 size={14} color="var(--success)" />
                            </span>
                            {a.apc_pessoa?.conjuge && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'help' }} title={a.conjuge_inscricao ? "Sim, vai para o Acampamento" : "Não vai para o Acampamento"}>
                                {' e '} {a.apc_pessoa.conjuge.nome}
                                {a.conjuge_inscricao ? (
                                  <CheckCircle2 size={14} color="var(--success)" />
                                ) : (
                                  <X size={14} color="var(--error)" />
                                )}
                              </span>
                            )}
                          </div>
                          <DependentesAccordion dependentes={a.apc_pessoa?.dependentes_agrupados} />
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                          {(() => {
                            const combined = Array.from(new Set([...(a.equipe || []), ...(a.conjuge_inscricao?.equipe || [])]));
                            if (combined.length === 0) {
                              return <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Nenhuma</span>;
                            }
                            return combined.map(eq => (
                              <span key={eq} style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-primary)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '500' }}>{eq}</span>
                            ));
                          })()}
                        </div>
                      </td>

                      <td style={{ fontWeight: '500' }}>
                        {a.apc_pessoa?.vinculo ? (
                          <div>
                            {a.apc_pessoa.vinculo.padrinho?.nome || '-'} e {a.apc_pessoa.vinculo.madrinha?.nome || '-'}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)' }}>-</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', height: '100%', alignItems: 'center' }}>
                          <Link to={`/admin/pagamentos/${a.id}`} state={{ from: `/admin/acampamentos/${evento_id}` }} className="btn btn-secondary" style={{ padding: '0.4rem 0.5rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.25rem' }} title="Pagamentos da Família">
                            <DollarSign size={16} />
                          </Link>
                          <button onClick={() => handleEdit(a)} className="btn btn-primary" style={{ padding: '0.4rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }} title="Editar Família">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => handleDelete(a)} className="btn btn-danger" style={{ padding: '0.4rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }} title="Excluir Inscrição da Família">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
