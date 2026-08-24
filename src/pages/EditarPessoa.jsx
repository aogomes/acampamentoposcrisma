import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Edit, ArrowLeft, Trash2, Plus } from 'lucide-react';

export const EditarPessoa = () => {
  const { user, userProfile, pessoaProfile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();

  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    sexo: '',
    data_nascimento: '',
    tipo_pessoa: 'AFILHADO',
    ano: '',
    conjuge_id: '',
    user_id: '',
    vinculo_id: '',
    vinculo_padrinho_id: '',
    vinculo_madrinha_id: '',
    nome_pai: '',
    nome_mae: '',
    fone_responsavel: '',
    necessidade_medica: '',
    camiseta: ''
  });

  const [dependentes, setDependentes] = useState([]);
  const [deletedDependentes, setDeletedDependentes] = useState([]);

  const [potenciaisConjuges, setPotenciaisConjuges] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [padrinhos, setPadrinhos] = useState([]);
  const [madrinhas, setMadrinhas] = useState([]);

  // Inscrição / Confirmação
  const [eventosAtivos, setEventosAtivos] = useState([]);
  const [inscricoesAtivas, setInscricoesAtivas] = useState([]); // ids dos eventos que já tá inscrito
  const [eventosAConfirmar, setEventosAConfirmar] = useState([]); // ids dos eventos a confirmar

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchPessoa();
    fetchUsuarios();
    fetchPadrinhosEMadrinhas();
    fetchEventoAtivo();
  }, [id]);

  const fetchEventoAtivo = async () => {
    const { data: eventos } = await supabase.from('apc_evento').select('id, descricao').eq('status', 'ATIVO');
    if (eventos && eventos.length > 0) {
      setEventosAtivos(eventos);
      // check if user is enrolled
      const { data: inscricoes } = await supabase
        .from('apc_acampamento')
        .select('evento_id')
        .in('evento_id', eventos.map(e => e.id))
        .eq('pessoa_id', id);

      if (inscricoes) {
        setInscricoesAtivas(inscricoes.map(i => i.evento_id));
      }
    }
  };

  const handleRemoveInscricao = async (eventoId) => {
    if (!window.confirm('Tem certeza que deseja cancelar a inscrição deste afilhado neste evento? Isso removerá a inscrição e quaisquer pagamentos vinculados a ela.')) return;

    try {
      setLoading(true);
      setError('');

      const { error: delError } = await supabase
        .from('apc_acampamento')
        .delete()
        .eq('evento_id', eventoId)
        .eq('pessoa_id', id);

      if (delError) throw delError;

      setInscricoesAtivas(prev => prev.filter(eId => eId !== eventoId));
      setSuccess('Inscrição cancelada com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Erro ao cancelar inscrição: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPadrinhosEMadrinhas = async () => {
    const { data: pData } = await supabase.from('apc_pessoa').select('id, nome, ano, conjuge_id').eq('tipo_pessoa', 'PADRINHO');
    const { data: mData } = await supabase.from('apc_pessoa').select('id, nome, ano, conjuge_id').eq('tipo_pessoa', 'MADRINHA');
    if (pData) setPadrinhos(pData);
    if (mData) setMadrinhas(mData);
  };

  const fetchUsuarios = async () => {
    const { data } = await supabase.from('apc_perfil').select('user_id, nome, email').order('nome');
    if (data) setUsuarios(data);
  };

  const fetchPessoa = async () => {
    try {
      setLoadingData(true);
      const { data, error } = await supabase
        .from('apc_pessoa')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (data) {
        setFormData({
          nome: data.nome || '',
          email: data.email || '',
          telefone: data.telefone || '',
          sexo: data.sexo || '',
          data_nascimento: data.data_nascimento ? data.data_nascimento.split('T')[0] : '', // Format date for input
          tipo_pessoa: data.tipo_pessoa || 'AFILHADO',
          ano: data.ano || '',
          conjuge_id: data.conjuge_id || '',
          user_id: data.user_id || '',
          nome_pai: data.nome_pai || '',
          nome_mae: data.nome_mae || '',
          fone_responsavel: data.fone_responsavel || '',
          necessidade_medica: data.necessidade_medica || '',
          camiseta: data.camiseta || ''
        });

        if (data.tipo_pessoa === 'AFILHADO') {
          const { data: vinculo } = await supabase
            .from('apc_vinculo')
            .select('id, ano, padrinho_id, madrinha_id')
            .eq('afilhado_id', id)
            .single();

          if (vinculo) {
            setFormData(prev => ({
              ...prev,
              vinculo_id: vinculo.id,
              vinculo_padrinho_id: vinculo.padrinho_id,
              vinculo_madrinha_id: vinculo.madrinha_id
            }));
          }
        }

        // Busca dependentes vinculados a esta pessoa ou ao seu cônjuge
        let orQuery = `pessoa_id.eq.${id}`;
        if (data.conjuge_id) {
          orQuery += `,pessoa_id.eq.${data.conjuge_id}`;
        }
        const { data: deps } = await supabase
          .from('apc_dependente')
          .select('*')
          .or(orQuery);

        if (deps) {
          // Normaliza as datas para o input
          const formattedDeps = deps.map(d => ({
            ...d,
            data_nascimento: d.data_nascimento ? d.data_nascimento.split('T')[0] : ''
          }));
          setDependentes(formattedDeps);
        }
      }
    } catch (err) {
      setError('Erro ao carregar os dados da pessoa: ' + err.message);
    } finally {
      setLoadingData(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
      // Se mudar o tipo de pessoa, limpa o conjuge selecionado
      ...(name === 'tipo_pessoa' ? { conjuge_id: '' } : {})
    }));
  };

  useEffect(() => {
    if (formData.tipo_pessoa === 'PADRINHO' || formData.tipo_pessoa === 'MADRINHA') {
      const fetchConjuges = async () => {
        const tipoBuscado = formData.tipo_pessoa === 'PADRINHO' ? 'MADRINHA' : 'PADRINHO';
        const { data } = await supabase
          .from('apc_pessoa')
          .select('id, nome')
          .eq('tipo_pessoa', tipoBuscado);
        if (data) setPotenciaisConjuges(data);
      };
      fetchConjuges();
    } else {
      setPotenciaisConjuges([]);
    }
  }, [formData.tipo_pessoa]);

  const handlePadrinhoChange = (e) => {
    const padrinhoId = e.target.value;
    setFormData(prev => {
      let newState = { ...prev, vinculo_padrinho_id: padrinhoId };
      if (padrinhoId) {
        const padrinho = padrinhos.find(p => p.id === padrinhoId);
        if (padrinho) {
          if (padrinho.conjuge_id) newState.vinculo_madrinha_id = padrinho.conjuge_id;
          if (padrinho.ano) newState.ano = padrinho.ano;
        }
      }
      return newState;
    });
  };

  const handleMadrinhaChange = (e) => {
    const madrinhaId = e.target.value;
    setFormData(prev => {
      let newState = { ...prev, vinculo_madrinha_id: madrinhaId };
      if (madrinhaId) {
        const madrinha = madrinhas.find(m => m.id === madrinhaId);
        if (madrinha) {
          if (madrinha.conjuge_id) newState.vinculo_padrinho_id = madrinha.conjuge_id;
          if (madrinha.ano) newState.ano = madrinha.ano;
        }
      }
      return newState;
    });
  };

  const handleAddDependente = () => {
    setDependentes([...dependentes, { nome: '', data_nascimento: '', mascote: false }]);
  };

  const handleRemoveDependente = (index) => {
    const depToRemove = dependentes[index];
    if (depToRemove.id) {
      setDeletedDependentes([...deletedDependentes, depToRemove.id]);
    }
    setDependentes(dependentes.filter((_, i) => i !== index));
  };

  const handleDependenteChange = (index, field, value) => {
    const newDeps = [...dependentes];
    newDeps[index][field] = value;
    setDependentes(newDeps);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const { error: dbError } = await supabase
        .from('apc_pessoa')
        .update({
          nome: formData.nome,
          email: formData.email || null,
          telefone: formData.telefone || null,
          sexo: formData.sexo || null,
          data_nascimento: formData.data_nascimento || null,
          tipo_pessoa: formData.tipo_pessoa,
          ano: formData.ano ? parseInt(formData.ano) : null,
          conjuge_id: formData.conjuge_id || null,
          user_id: formData.user_id || null,
          nome_pai: formData.nome_pai || null,
          nome_mae: formData.nome_mae || null,
          fone_responsavel: formData.fone_responsavel || null,
          necessidade_medica: formData.necessidade_medica || null,
          camiseta: formData.camiseta || null
        })
        .eq('id', id);

      if (dbError) throw dbError;

      // Se selecionou um cônjuge, precisamos atualizar o cônjuge também para apontar para esta pessoa (bidirecional)
      if (formData.conjuge_id) {
        await supabase
          .from('apc_pessoa')
          .update({ conjuge_id: id })
          .eq('id', formData.conjuge_id);
      }

      // VINCULO: Salvar/Atualizar
      if (formData.tipo_pessoa === 'AFILHADO' && formData.vinculo_padrinho_id && formData.vinculo_madrinha_id && formData.ano) {
        if (formData.vinculo_id) {
          await supabase.from('apc_vinculo').update({
            padrinho_id: formData.vinculo_padrinho_id,
            madrinha_id: formData.vinculo_madrinha_id,
            ano: parseInt(formData.ano)
          }).eq('id', formData.vinculo_id);
        } else {
          await supabase.from('apc_vinculo').insert([{
            padrinho_id: formData.vinculo_padrinho_id,
            madrinha_id: formData.vinculo_madrinha_id,
            afilhado_id: id,
            ano: parseInt(formData.ano)
          }]);
        }
      }

      // VINCULO DEPENDENTES
      if (deletedDependentes.length > 0) {
        await supabase.from('apc_dependente').delete().in('id', deletedDependentes);
      }

      if (dependentes.length > 0) {
        const depsToInsert = [];
        const depsToUpdate = [];

        dependentes
          .filter(d => d.nome.trim() !== '')
          .forEach(d => {
            const dep = {
              pessoa_id: d.pessoa_id || id,
              nome: d.nome,
              data_nascimento: d.data_nascimento || null,
              mascote: d.mascote
            };
            if (d.id) {
              dep.id = d.id;
              depsToUpdate.push(dep);
            } else {
              depsToInsert.push(dep);
            }
          });

        if (depsToInsert.length > 0) {
          await supabase.from('apc_dependente').insert(depsToInsert);
        }
        if (depsToUpdate.length > 0) {
          await supabase.from('apc_dependente').upsert(depsToUpdate);
        }
      }

      // CONFIRMAR NOS EVENTOS ATIVOS
      if (eventosAConfirmar.length > 0) {
        const inscricoesParaInserir = eventosAConfirmar.map(eventoId => ({
          evento_id: eventoId,
          pessoa_id: id,
          equipe: []
        }));

        const { error: errorInscricao } = await supabase.from('apc_acampamento').insert(inscricoesParaInserir);
        if (errorInscricao) {
          throw new Error('Erro ao confirmar inscrição: ' + errorInscricao.message);
        }
        setInscricoesAtivas(prev => [...prev, ...eventosAConfirmar]);
        setEventosAConfirmar([]);
      }

      setSuccess('Dados da pessoa atualizados com sucesso!');

      if (refreshProfile) {
        await refreshProfile();
      }

      setTimeout(() => navigate(-1), 2000);
    } catch (err) {
      setError('Erro ao atualizar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return <div className="main-content"><p>Carregando dados...</p></div>;
  }

  return (
    <div className="main-content">
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => navigate(-1)} className="btn btn-secondary" style={{ padding: '0.5rem' }}>
            <ArrowLeft size={20} />
          </button>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0, fontSize: '1.75rem', flexWrap: 'wrap' }}>
            <Edit size={32} color="var(--accent-primary)" />
            Editar Pessoa
          </h1>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '2rem' }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: '2rem' }}>{success}</div>}

      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <form onSubmit={handleSubmit}>
          {formData.tipo_pessoa === 'AFILHADO' && (
            <div style={{ background: 'rgba(59, 130, 246, 0.05)', padding: '1.25rem', borderRadius: '8px', marginBottom: '2rem', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
              <h4 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: 'var(--accent-primary)' }}>
                {userProfile?.perfil === 'ADMIN' || userProfile?.perfil === 'GESTOR' ? 'Padrinhos' : 'Meus Padrinhos'}
              </h4>

              {userProfile?.perfil === 'ADMIN' || userProfile?.perfil === 'GESTOR' ? (
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Selecione o Padrinho</label>
                    <select
                      className="form-input"
                      value={formData.vinculo_padrinho_id}
                      onChange={handlePadrinhoChange}
                    >
                      <option value="">-- Escolha um padrinho --</option>
                      {padrinhos.map(p => (
                        <option key={p.id} value={p.id}>{p.nome}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Selecione a Madrinha</label>
                    <select
                      className="form-input"
                      value={formData.vinculo_madrinha_id}
                      onChange={handleMadrinhaChange}
                    >
                      <option value="">-- Escolha uma madrinha --</option>
                      {madrinhas.map(m => (
                        <option key={m.id} value={m.id}>{m.nome}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <>

                  {(!formData.vinculo_padrinho_id && !formData.vinculo_madrinha_id) ? (
                    <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)' }}>
                      <p>Você ainda não foi vinculado a nenhum Padrinho/Madrinha.</p>
                    </div>
                  ) : (
                    <div className="form-grid">
                      {(() => {
                        const padrinhoObj = padrinhos.find(p => p.id === formData.vinculo_padrinho_id);
                        return padrinhoObj && (
                          <div style={{ background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                              <div style={{ width: '22px', height: '22px', borderRadius: '16px', background: 'var(--accent-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 'bold' }}>
                                {padrinhoObj.nome.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <h3 style={{ margin: 0, fontSize: '1rem' }}>{padrinhoObj.nome}</h3>
                                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{padrinhoObj.email || ''}</p>
                              </div>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.75rem' }}><strong>Telefone:</strong> {padrinhoObj.telefone || 'Não informado'}</p>
                          </div>
                        );
                      })()}

                      {(() => {
                        const madrinhaObj = madrinhas.find(m => m.id === formData.vinculo_madrinha_id);
                        return madrinhaObj && (
                          <div style={{ background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                            <h5 style={{ marginTop: 0, marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Madrinha</h5>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                              <div style={{ width: '22px', height: '22px', borderRadius: '16px', background: 'var(--accent-secondary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 'bold' }}>
                                {madrinhaObj.nome.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <h3 style={{ margin: 0, fontSize: '1rem' }}>{madrinhaObj.nome}</h3>
                                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{madrinhaObj.email || ''}</p>
                              </div>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.75rem' }}><strong>Telefone:</strong> {madrinhaObj.telefone || 'Não informado'}</p>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </>
              )}

              {/* Checkboxes de Confirmação para Padrinhos/Madrinhas */}
              {formData.tipo_pessoa === 'AFILHADO' && eventosAtivos.length > 0 && pessoaProfile &&
                (pessoaProfile.id === formData.vinculo_padrinho_id || pessoaProfile.id === formData.vinculo_madrinha_id) && (
                  <div className="glass-panel" style={{ padding: '1.5rem', marginTop: '1rem', borderLeft: '4px solid var(--success)' }}>
                    <h4 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: 'bold' }}>Confirmação em Eventos</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {eventosAtivos.map(evento => {
                        const isEnrolled = inscricoesAtivas.includes(evento.id);
                        const isToConfirm = eventosAConfirmar.includes(evento.id);

                        return (
                          <div key={evento.id}>
                            {isEnrolled ? (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(16, 185, 129, 0.1)', padding: '0.5rem', borderRadius: '4px' }}>
                                <p style={{ color: 'var(--success)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                                  ✓ Afilhado foi confirmado no {evento.descricao}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveInscricao(evento.id)}
                                  className="btn btn-secondary"
                                  style={{ padding: '0.25rem 0.5rem', color: 'var(--error)' }}
                                  title="Cancelar Inscrição"
                                  disabled={loading}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <input
                                  type="checkbox"
                                  id={`confirmarInscricao_${evento.id}`}
                                  checked={isToConfirm}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setEventosAConfirmar(prev => [...prev, evento.id]);
                                    } else {
                                      setEventosAConfirmar(prev => prev.filter(id => id !== evento.id));
                                    }
                                  }}
                                  style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
                                />
                                <label htmlFor={`confirmarInscricao_${evento.id}`} style={{ cursor: 'pointer', fontWeight: '500' }}>
                                  Confirmar Inscrição no <span style={{ color: 'var(--accent-primary)' }}>{evento.descricao}</span>
                                </label>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
            </div>
          )}

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="nome">Nome Completo *</label>
              <input
                id="nome"
                name="nome"
                type="text"
                className="form-input"
                placeholder="Digite o nome completo"
                value={formData.nome}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="email">E-mail</label>
              <input
                id="email"
                name="email"
                type="email"
                className="form-input"
                placeholder="email@exemplo.com"
                value={formData.email}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="data_nascimento">Data de Nascimento</label>
              <input
                id="data_nascimento"
                name="data_nascimento"
                type="date"
                className="form-input"
                value={formData.data_nascimento}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="telefone">Telefone</label>
              <input
                id="telefone"
                name="telefone"
                type="text"
                className="form-input"
                placeholder="(00) 00000-0000"
                value={formData.telefone}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="sexo">Sexo</label>
              <select
                id="sexo"
                name="sexo"
                className="form-input"
                value={formData.sexo}
                onChange={handleChange}
              >
                <option value="">-- Selecione --</option>
                <option value="M">Masculino</option>
                <option value="F">Feminino</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="camiseta">Camiseta</label>
              <select
                id="camiseta"
                name="camiseta"
                className="form-input"
                value={formData.camiseta}
                onChange={handleChange}
              >
                <option value="">-- Tamanho --</option>
                <option value="PP">PP</option>
                <option value="P">P</option>
                <option value="M">M</option>
                <option value="G">G</option>
                <option value="GG">GG</option>
                <option value="EGG">EGG</option>
              </select>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="nome_pai">Nome do Pai</label>
              <input
                id="nome_pai"
                name="nome_pai"
                type="text"
                className="form-input"
                placeholder="Nome do Pai"
                value={formData.nome_pai}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="nome_mae">Nome da Mãe</label>
              <input
                id="nome_mae"
                name="nome_mae"
                type="text"
                className="form-input"
                placeholder="Nome da Mãe"
                value={formData.nome_mae}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="fone_responsavel">Telefone do Responsável</label>
              <input
                id="fone_responsavel"
                name="fone_responsavel"
                type="text"
                className="form-input"
                placeholder="(00) 00000-0000"
                value={formData.fone_responsavel}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="ano">Ano (Turma)</label>
              <input
                id="ano"
                name="ano"
                type="number"
                className="form-input"
                placeholder="Ex: 2025"
                disabled={userProfile?.perfil !== 'ADMIN' && userProfile?.perfil !== 'GESTOR'}
                value={formData.ano}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="tipo_pessoa">Tipo *</label>
              <select
                id="tipo_pessoa"
                name="tipo_pessoa"
                className="form-input"
                value={formData.tipo_pessoa}
                disabled={userProfile?.perfil !== 'ADMIN' && userProfile?.perfil !== 'GESTOR'}
                onChange={handleChange}
                required
              >
                <option value="AFILHADO">Afilhado(a)</option>
                <option value="PADRINHO">Padrinho</option>
                <option value="MADRINHA">Madrinha</option>
                <option value="VOLUNTARIO">Voluntário(a)</option>
              </select>
            </div>

            {userProfile?.perfil === 'ADMIN' && (
              <div className="form-group">
                <label className="form-label" htmlFor="user_id">Conta de Usuário (App) Vinculada</label>
                <select
                  id="user_id"
                  name="user_id"
                  className="form-input"
                  value={formData.user_id}
                  onChange={handleChange}
                >
                  <option value="">-- Não vincular nenhuma conta --</option>
                  {usuarios.map(u => (
                    <option key={u.user_id} value={u.user_id}>
                      {u.nome} {u.email ? `(${u.email})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="necessidade_medica">Necessidade Médica / Restrição Alimentar</label>
            <textarea
              id="necessidade_medica"
              name="necessidade_medica"
              className="form-input"
              placeholder="Descreva se houver alguma necessidade médica ou restrição alimentar"
              value={formData.necessidade_medica}
              onChange={handleChange}
              rows="4"
            />
          </div>

          {(formData.tipo_pessoa === 'PADRINHO' || formData.tipo_pessoa === 'MADRINHA') && (

            <div className="form-group">
              <label className="form-label" htmlFor="conjuge_id">Cônjuge (opcional)</label>
              <select
                id="conjuge_id"
                name="conjuge_id"
                className="form-input"
                value={formData.conjuge_id}
                onChange={handleChange}
              >
                <option value="">-- Selecione o cônjuge --</option>
                {potenciaisConjuges.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
          )}


          {/* Dependentes */}
          {(formData.tipo_pessoa === 'PADRINHO' || formData.tipo_pessoa === 'MADRINHA') && (
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 'bold' }}>Dependentes (Filhos)</h3>
                <button type="button" onClick={handleAddDependente} className="btn btn-secondary" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Plus size={16} /> Adicionar
                </button>
              </div>

              {dependentes.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)' }}>Nenhum dependente adicionado.</p>
              ) : (
                <div style={{ overflowX: 'auto', background: 'var(--bg-secondary)', borderRadius: '8px', padding: '1rem' }}>
                  <table className="table-compact" style={{ minWidth: '600px', margin: 0 }}>
                    <thead>
                      <tr>
                        <th style={{ width: '40%' }}>Nome do Dependente *</th>
                        <th style={{ width: '30%' }}>Data de Nascimento</th>
                        <th style={{ width: '20%', textAlign: 'center' }}>Vai para o acampamento?</th>
                        <th style={{ width: '10%', textAlign: 'center' }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dependentes.map((dep, index) => (
                        <tr key={index}>
                          <td style={{ padding: '0.5rem' }}>
                            <input
                              type="text"
                              className="form-input"
                              value={dep.nome}
                              onChange={(e) => handleDependenteChange(index, 'nome', e.target.value)}
                              required
                              placeholder="Nome"
                              style={{ marginBottom: 0 }}
                            />
                          </td>
                          <td style={{ padding: '0.5rem' }}>
                            <input
                              type="date"
                              className="form-input"
                              value={dep.data_nascimento}
                              onChange={(e) => handleDependenteChange(index, 'data_nascimento', e.target.value)}
                              style={{ marginBottom: 0 }}
                            />
                          </td>
                          <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              id={`mascote-${index}`}
                              checked={dep.mascote}
                              onChange={(e) => handleDependenteChange(index, 'mascote', e.target.checked)}
                              style={{ width: '1.25rem', height: '1.25rem', cursor: 'pointer' }}
                              title="Vai para o acampamento?"
                            />
                          </td>
                          <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleRemoveDependente(index)}
                              className="btn btn-secondary"
                              style={{ color: 'var(--danger)', padding: '0.4rem' }}
                              title="Remover"
                            >
                              <Trash2 size={20} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
