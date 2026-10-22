import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { DollarSign, ArrowLeft, Plus, Trash2, Check, Users, AlertCircle } from 'lucide-react';
import { useParams, Link, useLocation } from 'react-router-dom';

const calcularIdade = (dataNascimento) => {
  if (!dataNascimento) return null;
  const hoje = new Date();
  const nasc = new Date(dataNascimento);
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) {
    idade--;
  }
  return idade;
};

const formatCurrency = (val) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year}`;
};

const calcularValorTotal = (acampamento, evento) => {
  if (!evento) return { total: 0, itens: [] };

  const valorPadrao = parseFloat(evento.valor || 0);
  const valorDif = evento.valor_diferenciado !== null && evento.valor_diferenciado !== undefined && evento.valor_diferenciado !== ''
    ? parseFloat(evento.valor_diferenciado)
    : null;
  const idadeMin = evento.idade_min_diferenciada !== null && evento.idade_min_diferenciada !== undefined && evento.idade_min_diferenciada !== ''
    ? parseInt(evento.idade_min_diferenciada, 10)
    : null;
  const idadeMax = evento.idade_max_diferenciada !== null && evento.idade_max_diferenciada !== undefined && evento.idade_max_diferenciada !== ''
    ? parseInt(evento.idade_max_diferenciada, 10)
    : null;

  const tipo = acampamento?.apc_pessoa?.tipo_pessoa;
  const itens = [];

  // Se for AFILHADO (inscrição individual do afilhado)
  if (tipo === 'AFILHADO') {
    itens.push({
      descricao: `${acampamento.apc_pessoa?.nome || 'Afilhado'}`,
      valor: valorPadrao
    });
    return {
      total: valorPadrao,
      itens
    };
  }

  // Se for PADRINHO, MADRINHA, VOLUNTÁRIO ou outro tipo familiar
  // 1. Titular
  if (acampamento?.apc_pessoa) {
    itens.push({
      descricao: `${acampamento.apc_pessoa.nome}`,
      valor: valorPadrao
    });
  }

  // 2. Cônjuge (inscrito no acampamento via apc_acampamento OU para PADRINHO/MADRINHA com cônjuge cadastrado)
  const isPadrinhoOuMadrinha = tipo === 'PADRINHO' || tipo === 'MADRINHA';
  const conjugeInscrito = Boolean(acampamento?.conjuge_inscricao);
  const temConjuge = Boolean(acampamento?.apc_pessoa?.conjuge);

  if (temConjuge && (conjugeInscrito || isPadrinhoOuMadrinha)) {
    itens.push({
      descricao: `${acampamento.apc_pessoa.conjuge.nome}`,
      valor: valorPadrao
    });
  }

  // 3. Dependentes (apenas os que vão para o acampamento: acampamento === true ou mascote === true)
  const dependentes = acampamento?.apc_pessoa?.dependentes_agrupados || [];
  dependentes.forEach(dep => {
    if (!(dep.acampamento ?? dep.mascote)) return;

    const idade = calcularIdade(dep.data_nascimento);
    let valorDep = 0;

    if (valorDif !== null && idadeMin !== null && idadeMax !== null) {
      if (idade !== null) {
        if (idade >= idadeMin && idade <= idadeMax) {
          valorDep = valorDif;
        } else if (idade < idadeMin) {
          valorDep = 0;
        } else {
          valorDep = valorPadrao;
        }
      } else {
        // Sem data de nascimento informada
        valorDep = valorDif;
      }
    } else {
      valorDep = valorPadrao;
    }

    itens.push({
      descricao: `${dep.nome}${idade !== null ? ` (${idade} anos)` : ''}`,
      valor: valorDep
    });
  });

  const total = itens.reduce((acc, item) => acc + item.valor, 0);
  return { total, itens };
};

export const AdminPagamentos = () => {
  const { userProfile, pessoaProfile } = useAuth();
  const { acampamento_id } = useParams();
  const location = useLocation();

  const [acampamento, setAcampamento] = useState(null);
  const [conjugeAcampamento, setConjugeAcampamento] = useState(null);
  const [pagamentos, setPagamentos] = useState([]);
  const [pagamentosConjuge, setPagamentosConjuge] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    target_acampamento_id: acampamento_id,
    descricao: '',
    valor: '',
    data_recebimento: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (acampamento_id) {
      fetchData();
    }
  }, [userProfile, pessoaProfile, acampamento_id]);

  const fetchData = async () => {
    try {
      setLoadingData(true);

      // 1. Fetch acampamento details with full person and event info
      let { data: acampData, error: acampError } = await supabase
        .from('apc_acampamento')
        .select(`
          id,
          evento_id,
          apc_evento ( id, descricao, valor, valor_diferenciado, descricao_valor_diferenciado, idade_min_diferenciada, idade_max_diferenciada ),
          apc_pessoa!apc_acampamento_pessoa_id_fkey (
            id, nome, tipo_pessoa, conjuge_id,
            apc_dependente ( id, pessoa_id, nome, data_nascimento, mascote, acampamento )
          )
        `)
        .eq('id', acampamento_id)
        .single();

      if (acampError) {
        const { data: acampFb, error: fbError } = await supabase
          .from('apc_acampamento')
          .select(`
            id,
            evento_id,
            apc_evento ( id, descricao, valor, valor_diferenciado, descricao_valor_diferenciado, idade_min_diferenciada, idade_max_diferenciada ),
            apc_pessoa!pessoa_id (
              id, nome, tipo_pessoa, conjuge_id,
              apc_dependente ( id, pessoa_id, nome, data_nascimento, mascote, acampamento )
            )
          `)
          .eq('id', acampamento_id)
          .single();
        if (fbError) throw fbError;
        acampData = acampFb;
      }

      let cAcamp = null;
      let conjugePessoa = null;
      let conjugePessoaId = acampData?.apc_pessoa?.conjuge_id;

      // Se não encontrou conjuge_id direto no titular, verifica busca reversa
      if (!conjugePessoaId && acampData?.apc_pessoa?.id) {
        const { data: pReversa } = await supabase
          .from('apc_pessoa')
          .select('id, nome, tipo_pessoa, conjuge_id')
          .eq('conjuge_id', acampData.apc_pessoa.id)
          .maybeSingle();
        if (pReversa) {
          conjugePessoaId = pReversa.id;
          if (acampData.apc_pessoa) {
            acampData.apc_pessoa.conjuge_id = pReversa.id;
          }
        }
      }

      if (conjugePessoaId) {
        // Busca pessoa do cônjuge e seus dependentes
        const { data: cPessoa } = await supabase
          .from('apc_pessoa')
          .select(`
            id, nome, tipo_pessoa, conjuge_id,
            apc_dependente ( id, pessoa_id, nome, data_nascimento, mascote, acampamento )
          `)
          .eq('id', conjugePessoaId)
          .maybeSingle();

        conjugePessoa = cPessoa;

        // Busca se o cônjuge possui inscrição no acampamento deste evento (sem joins arriscados)
        const { data: cAcampDirect } = await supabase
          .from('apc_acampamento')
          .select('id, evento_id, equipe, pessoa_id')
          .eq('evento_id', acampData.evento_id)
          .eq('pessoa_id', conjugePessoaId)
          .maybeSingle();

        if (cAcampDirect) {
          cAcamp = {
            ...cAcampDirect,
            apc_evento: acampData.apc_evento,
            apc_pessoa: conjugePessoa
          };
          setConjugeAcampamento(cAcamp);
        } else {
          setConjugeAcampamento(null);
        }
      } else {
        setConjugeAcampamento(null);
      }

      // Agrupa dependentes do titular e cônjuge sem duplicação
      let todosDependentes = [...(acampData?.apc_pessoa?.apc_dependente || [])];
      if (conjugePessoa) {
        acampData.apc_pessoa.conjuge = conjugePessoa;
        const conjugeDeps = conjugePessoa.apc_dependente || [];
        conjugeDeps.forEach(cd => {
          if (!todosDependentes.find(d => d.id === cd.id)) {
            todosDependentes.push(cd);
          }
        });
      }
      if (acampData?.apc_pessoa) {
        acampData.apc_pessoa.dependentes_agrupados = todosDependentes;
      }
      acampData.conjuge_inscricao = cAcamp;
      setAcampamento(acampData);

      // 2. Fetch payments
      const { data: pagData, error: pagError } = await supabase
        .from('apc_pagamento')
        .select('*')
        .eq('acampamento_id', acampamento_id)
        .order('data_recebimento', { ascending: false });

      if (pagError) throw pagError;
      setPagamentos(pagData || []);

      if (cAcamp) {
        const { data: pagConjugeData } = await supabase
          .from('apc_pagamento')
          .select('*')
          .eq('acampamento_id', cAcamp.id)
          .order('data_recebimento', { ascending: false });
        setPagamentosConjuge(pagConjugeData || []);
      } else {
        setPagamentosConjuge([]);
      }

    } catch (err) {
      setError('Erro ao carregar dados: ' + err.message);
    } finally {
      setLoadingData(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        acampamento_id: formData.target_acampamento_id,
        descricao: formData.descricao,
        valor: parseFloat(formData.valor),
        data_recebimento: formData.data_recebimento
      };

      const { error: dbError } = await supabase
        .from('apc_pagamento')
        .insert([payload]);

      if (dbError) throw dbError;

      setSuccess('Pagamento registrado com sucesso!');
      setFormData({ target_acampamento_id: acampamento_id, descricao: '', valor: '', data_recebimento: '' });
      setIsCreating(false);
      fetchData();
    } catch (err) {
      setError('Erro ao salvar pagamento: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja remover este pagamento?')) return;

    try {
      setError('');
      const { error } = await supabase.from('apc_pagamento').delete().eq('id', id);
      if (error) throw error;

      setPagamentos(prev => prev.filter(p => p.id !== id));
      setPagamentosConjuge(prev => prev.filter(p => p.id !== id));
      setSuccess('Pagamento removido com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Erro ao excluir: ' + err.message);
    }
  };

  const isAdmin = userProfile?.perfil === 'ADMIN' || userProfile?.perfil === 'GESTOR';
  const isPadrinho = pessoaProfile?.tipo_pessoa === 'PADRINHO' || pessoaProfile?.tipo_pessoa === 'MADRINHA';

  const { total: valorTotal, itens: itensValor } = useMemo(() => {
    return calcularValorTotal(acampamento, acampamento?.apc_evento);
  }, [acampamento]);

  const allPagamentos = useMemo(() => {
    return [...pagamentos, ...pagamentosConjuge].sort((a, b) => {
      return (b.data_recebimento || '').localeCompare(a.data_recebimento || '');
    });
  }, [pagamentos, pagamentosConjuge]);

  const totalPago = useMemo(() => {
    return allPagamentos.reduce((acc, curr) => acc + parseFloat(curr.valor || 0), 0);
  }, [allPagamentos]);

  const saldoRestante = valorTotal - totalPago;
  const isQuitado = valorTotal > 0 && totalPago >= valorTotal;
  const isParcial = valorTotal > 0 && totalPago > 0 && !isQuitado;
  const isPendente = valorTotal > 0 && totalPago <= 0;
  const isIsento = valorTotal <= 0;

  if (!isAdmin && !isPadrinho) {
    return (
      <div className="main-content">
        <div className="alert alert-error">Acesso negado. Apenas administradores e padrinhos podem gerenciar pagamentos.</div>
      </div>
    );
  }

  const nomeConjugeGeral = acampamento?.apc_pessoa?.conjuge?.nome || conjugeAcampamento?.apc_pessoa?.nome;
  const backLink = location.state?.from || (isAdmin ? `/admin/acampamentos/${acampamento?.evento_id}` : '/meus-afilhados');

  return (
    <div className="main-content">
      {/* Cabeçalho Superior */}
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link to={backLink} className="btn btn-secondary" style={{ padding: '0.5rem' }}>
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0, fontSize: '1.6rem', flexWrap: 'wrap' }}>
                {acampamento?.apc_pessoa?.nome || 'Carregando...'} {nomeConjugeGeral && ` e ${nomeConjugeGeral}`}
              </h1>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                {acampamento?.apc_evento?.descricao}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setIsCreating(!isCreating);
              setSuccess('');
              setError('');
            }}
            className={isCreating ? "btn btn-secondary" : "btn btn-primary"}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: isCreating ? '' : 'var(--success)', borderColor: isCreating ? '' : 'var(--success)' }}
          >
            {isCreating ? 'Cancelar' : <><Plus size={20} /> Registrar Pagamento</>}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: '1.5rem' }}>{success}</div>}

      {/* Card de Detalhamento Financeiro (idêntico às informações da tela de Admin Acampamento) */}
      <div
        className="glass-panel"
        style={{
          padding: '1.5rem',
          marginBottom: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem'
        }}
      >
        {/* Topo do Detalhamento com Status */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              background: 'rgba(59, 130, 246, 0.15)',
              color: 'var(--accent, #3b82f6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <DollarSign size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                  Detalhamento Financeiro
                </h3>
                {isQuitado && (
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: '700',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '999px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    border: '1px solid rgba(16, 185, 129, 0.3)'
                  }}>
                    Quitado ✓
                  </span>
                )}
                {isParcial && (
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: '700',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '999px',
                    background: 'rgba(245, 158, 11, 0.15)',
                    color: '#d97706',
                    border: '1px solid rgba(245, 158, 11, 0.3)'
                  }}>
                    Parcial
                  </span>
                )}
                {isPendente && (
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: '700',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '999px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.25)'
                  }}>
                    Pendente
                  </span>
                )}
                {isIsento && (
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: '600',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '999px',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-color)'
                  }}>
                    Isento
                  </span>
                )}
              </div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {acampamento?.apc_pessoa?.nome}{nomeConjugeGeral ? ` e ${nomeConjugeGeral}` : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Grid: Coluna de Valores Previstos e Coluna de Pagamentos Recebidos */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '1.25rem'
        }}>
          {/* Seção 1: Valores Previstos */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{
              fontSize: '0.75rem',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span>Valores a receber</span>
              <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                {itensValor.length} {itensValor.length === 1 ? 'item' : 'itens'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {itensValor && itensValor.length > 0 ? (
                itensValor.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '0.5rem 0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.75rem'
                    }}
                  >
                    <span style={{ fontSize: '0.825rem', color: 'var(--text-primary)', fontWeight: '500' }}>
                      {item.descricao}
                    </span>
                    <span style={{
                      fontSize: '0.85rem',
                      fontWeight: '700',
                      color: item.valor > 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
                      whiteSpace: 'nowrap'
                    }}>
                      {item.valor > 0 ? formatCurrency(item.valor) : 'Isento'}
                    </span>
                  </div>
                ))
              ) : (
                <div style={{
                  padding: '0.75rem',
                  textAlign: 'center',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  fontStyle: 'italic',
                  background: 'var(--bg-secondary)',
                  borderRadius: '8px'
                }}>
                  Sem cobrança cadastrada / isento.
                </div>
              )}
            </div>

            {/* {acampamento?.apc_evento?.valor_diferenciado !== null && acampamento?.apc_evento?.valor_diferenciado !== undefined && (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '0.2rem' }}>
                * Regra do evento: {formatCurrency(acampamento.apc_evento.valor_diferenciado)} ({acampamento.apc_evento.descricao_valor_diferenciado || `Dependentes de ${acampamento.apc_evento.idade_min_diferenciada || 0} a ${acampamento.apc_evento.idade_max_diferenciada || 0} anos`})
              </div>
            )} */}
          </div>

          {/* Seção 2: Pagamentos Recebidos e Card Consolidado */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{
                fontSize: '0.75rem',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                {/* <span>Pagamentos Recebidos</span> */}
                <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#10b981' }}>
                  {allPagamentos.length} {allPagamentos.length === 1 ? 'recebimento' : 'recebimentos'}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '180px', overflowY: 'auto' }}>
                {allPagamentos && allPagamentos.length > 0 ? (
                  allPagamentos.map((pg, idx) => (
                    <div
                      key={pg.id || idx}
                      style={{
                        background: 'rgba(16, 185, 129, 0.08)',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        borderRadius: '8px',
                        padding: '0.5rem 0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.825rem', color: 'var(--text-primary)', fontWeight: '500' }}>
                          {pg.descricao || 'Recebimento de inscrição'}
                        </span>
                        {pg.data_recebimento && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                            {formatDate(pg.data_recebimento)}
                            {conjugeAcampamento && pg.acampamento_id === conjugeAcampamento.id && (
                              <span style={{ marginLeft: '0.4rem', color: 'var(--accent, #3b82f6)', fontWeight: '600' }}>
                                ({nomeConjugeGeral})
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                      <span style={{
                        fontSize: '0.875rem',
                        fontWeight: '700',
                        color: '#10b981',
                        whiteSpace: 'nowrap'
                      }}>
                        {formatCurrency(pg.valor)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div style={{
                    padding: '0.75rem',
                    textAlign: 'center',
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)',
                    fontStyle: 'italic',
                    background: 'var(--bg-secondary)',
                    borderRadius: '8px'
                  }}>
                    Nenhum pagamento registrado.
                  </div>
                )}
              </div>
            </div>

            {/* Card Consolidado: Previsto, Pago, Saldo */}
            <div style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              padding: '0.75rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '0.5rem',
              textAlign: 'center',
              marginTop: 'auto'
            }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase' }}>Previsto</div>
                <div style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-primary)', marginTop: '0.15rem' }}>
                  {formatCurrency(valorTotal)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: '600', textTransform: 'uppercase' }}>Pago</div>
                <div style={{ fontSize: '1rem', fontWeight: '800', color: '#10b981', marginTop: '0.15rem' }}>
                  {formatCurrency(totalPago)}
                </div>
              </div>
              <div>
                <div style={{
                  fontSize: '0.7rem',
                  color: saldoRestante > 0 ? '#f59e0b' : '#10b981',
                  fontWeight: '600',
                  textTransform: 'uppercase'
                }}>
                  Saldo
                </div>
                <div style={{
                  fontSize: '1rem',
                  fontWeight: '800',
                  color: saldoRestante > 0 ? '#f59e0b' : '#10b981',
                  marginTop: '0.15rem'
                }}>
                  {valorTotal > 0
                    ? (saldoRestante > 0
                      ? formatCurrency(saldoRestante)
                      : 'Quitado ✓')
                    : 'R$ 0,00'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Formulário de Registro de Pagamento */}
      {isCreating && (
        <div className="glass-panel" style={{ padding: '2rem', marginBottom: '1.5rem' }}>
          <h2 style={{ marginBottom: '1.5rem', fontSize: '1.25rem' }}>Registrar Novo Pagamento</h2>

          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label" htmlFor="target_acampamento_id">Registrar pagamento em nome de:</label>
              <select
                id="target_acampamento_id"
                name="target_acampamento_id"
                className="form-input"
                value={formData.target_acampamento_id}
                onChange={handleChange}
                required
              >
                <option value={acampamento?.id}>{acampamento?.apc_pessoa?.nome} (Titular)</option>
                {conjugeAcampamento && (
                  <option value={conjugeAcampamento.id}>{nomeConjugeGeral} (Cônjuge)</option>
                )}
              </select>
            </div>

            <div className="form-grid">
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label" htmlFor="descricao">Descrição (Ex: Dinheiro, Pix, Cartão, Parcela 1)</label>
                <input
                  id="descricao"
                  name="descricao"
                  type="text"
                  className="form-input"
                  value={formData.descricao}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="valor">Valor Pago (R$)</label>
                <input
                  id="valor"
                  name="valor"
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-input"
                  value={formData.valor}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="data_recebimento">Data do Recebimento</label>
                <input
                  id="data_recebimento"
                  name="data_recebimento"
                  type="date"
                  className="form-input"
                  value={formData.data_recebimento}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ background: 'var(--success)', borderColor: 'var(--success)' }}>
                {loading ? 'Salvando...' : 'Confirmar Pagamento'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Histórico Completo de Pagamentos */}
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h4 style={{ fontWeight: 'bold', fontSize: '1.125rem', margin: 0 }}>Histórico de Pagamentos - {acampamento?.apc_pessoa?.nome} (Titular)</h4>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'rgba(16, 185, 129, 0.1)', padding: '0.5rem 1rem', borderRadius: '8px' }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: '600', fontSize: '0.875rem', textTransform: 'uppercase' }}>Total Titular</span>
            <span style={{ fontSize: '1.15rem', fontWeight: 'bold', color: 'var(--success)' }}>
              {formatCurrency(pagamentos.reduce((acc, curr) => acc + parseFloat(curr.valor || 0), 0))}
            </span>
          </div>
        </div>

        {loadingData ? (
          <p>Carregando pagamentos...</p>
        ) : pagamentos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-secondary)' }}>
            <DollarSign size={32} style={{ opacity: 0.2, margin: '0 auto 0.75rem' }} />
            <p>Nenhum pagamento registrado.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table-compact">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Valor</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {pagamentos.map((p) => (
                  <tr key={p.id}>
                    <td>{formatDate(p.data_recebimento)}</td>
                    <td style={{ fontWeight: '500' }}>{p.descricao}</td>
                    <td style={{ color: 'var(--success)', fontWeight: 'bold' }}>{formatCurrency(p.valor)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="btn btn-secondary"
                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.875rem', color: 'var(--error)' }}
                        title="Remover Pagamento"
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

        {(conjugeAcampamento || acampamento?.apc_pessoa?.conjuge) && (
          <div style={{ marginTop: '2.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h4 style={{ fontWeight: 'bold', fontSize: '1.125rem', margin: 0 }}>Histórico de Pagamentos - {nomeConjugeGeral} (Cônjuge)</h4>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'rgba(16, 185, 129, 0.1)', padding: '0.5rem 1rem', borderRadius: '8px' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: '600', fontSize: '0.875rem', textTransform: 'uppercase' }}>Total Cônjuge</span>
                <span style={{ fontSize: '1.15rem', fontWeight: 'bold', color: 'var(--success)' }}>
                  {formatCurrency(pagamentosConjuge.reduce((acc, curr) => acc + parseFloat(curr.valor || 0), 0))}
                </span>
              </div>
            </div>

            {pagamentosConjuge.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-secondary)' }}>
                <DollarSign size={32} style={{ opacity: 0.2, margin: '0 auto 0.75rem' }} />
                <p>Nenhum pagamento registrado.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table-compact">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Descrição</th>
                      <th>Valor</th>
                      <th style={{ textAlign: 'right' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagamentosConjuge.map((p) => (
                      <tr key={p.id}>
                        <td>{formatDate(p.data_recebimento)}</td>
                        <td style={{ fontWeight: '500' }}>{p.descricao}</td>
                        <td style={{ color: 'var(--success)', fontWeight: 'bold' }}>{formatCurrency(p.valor)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="btn btn-secondary"
                            style={{ padding: '0.4rem 0.75rem', fontSize: '0.875rem', color: 'var(--error)' }}
                            title="Remover Pagamento"
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
        )}
      </div>
    </div>
  );
};
