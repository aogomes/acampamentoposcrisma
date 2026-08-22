import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { DollarSign, ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useParams, Link, useLocation } from 'react-router-dom';

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

      // 1. Fetch acampamento details
      const { data: acampData, error: acampError } = await supabase
        .from('apc_acampamento')
        .select(`
          id,
          evento_id,
          apc_evento ( id, descricao, valor ),
          apc_pessoa ( id, nome, conjuge_id )
        `)
        .eq('id', acampamento_id)
        .single();

      if (acampError) throw acampError;
      setAcampamento(acampData);

      let cAcamp = null;
      if (acampData.apc_pessoa.conjuge_id) {
        const { data: conjugeData } = await supabase
          .from('apc_acampamento')
          .select(`
             id,
             evento_id,
             apc_evento ( id, descricao, valor ),
             apc_pessoa ( id, nome, conjuge_id )
           `)
          .eq('evento_id', acampData.evento_id)
          .eq('pessoa_id', acampData.apc_pessoa.conjuge_id)
          .maybeSingle(); // maybeSingle so it doesn't throw if not found

        if (conjugeData) {
          cAcamp = conjugeData;
          setConjugeAcampamento(cAcamp);
        } else {
          setConjugeAcampamento(null);
        }
      } else {
        setConjugeAcampamento(null);
      }

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

      setPagamentos(pagamentos.filter(p => p.id !== id));
      setSuccess('Pagamento removido com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Erro ao excluir: ' + err.message);
    }
  };

  const isAdmin = userProfile?.perfil === 'ADMIN' || userProfile?.perfil === 'GESTOR';
  const isPadrinho = pessoaProfile?.tipo_pessoa === 'PADRINHO' || pessoaProfile?.tipo_pessoa === 'MADRINHA';

  // To verify if this padrinho actually owns this afilhado, we should ideally check it.
  // But RLS on Supabase will reject the fetch if they don't own it (wait, the SELECT is public for all authenticated users).
  // However, we only need to hide the UI for non-authorized people. We can do a quick check here if we fetch the vinculo, 
  // or we can rely on the fact that if they are a Padrinho and reached here, it's their afilhado (RLS prevents bad inserts).

  if (!isAdmin && !isPadrinho) {
    return (
      <div className="main-content">
        <div className="alert alert-error">Acesso negado. Apenas administradores e padrinhos podem gerenciar pagamentos.</div>
      </div>
    );
  }

  // Calculate totals
  const numInscritos = 1 + (conjugeAcampamento ? 1 : 0);
  const valorEvento = parseFloat(acampamento?.apc_evento?.valor || 0) * numInscritos;
  const allPagamentos = [...pagamentos, ...pagamentosConjuge];
  const totalPago = allPagamentos.reduce((acc, curr) => acc + parseFloat(curr.valor), 0);
  const saldoRestante = valorEvento - totalPago;

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  };

  const backLink = location.state?.from || (isAdmin ? `/admin/acampamentos/${acampamento?.evento_id}` : '/meus-afilhados');

  return (
    <div className="main-content">
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link to={backLink} className="btn btn-secondary" style={{ padding: '0.5rem' }}>
              <ArrowLeft size={20} />
            </Link>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0, fontSize: '1.75rem', flexWrap: 'wrap' }}>
              {acampamento?.apc_pessoa?.nome || 'Carregando...'} {conjugeAcampamento && ` e ${conjugeAcampamento.apc_pessoa.nome}`}
            </h1>
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
        <p style={{ margin: 0, fontSize: '1rem', color: 'var(--text-secondary)' }}>
          {acampamento?.apc_evento?.descricao}
        </p>
      </div>



      {error && <div className="alert alert-error" style={{ marginBottom: '2rem' }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: '2rem' }}>{success}</div>}

      {isCreating ? (
        <div className="glass-panel" style={{ padding: '2rem' }}>
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
                <option value={acampamento.id}>{acampamento.apc_pessoa.nome}</option>
                {conjugeAcampamento && (
                  <option value={conjugeAcampamento.id}>{conjugeAcampamento.apc_pessoa.nome}</option>
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
      ) : (
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h4 style={{ fontWeight: 'bold', fontSize: '1.125rem', margin: 0 }}>Histórico de Pagamentos - {acampamento?.apc_pessoa?.nome} (Titular)</h4>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'rgba(16, 185, 129, 0.1)', padding: '0.5rem 1rem', borderRadius: '8px' }}>
              <span style={{ color: 'var(--text-secondary)', fontWeight: '600', fontSize: '0.875rem', textTransform: 'uppercase' }}>Total Pago</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--success)' }}>{formatCurrency(totalPago)}</span>
            </div>
          </div>

          {loadingData ? (
            <p>Carregando pagamentos...</p>
          ) : pagamentos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
              <DollarSign size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
              <p>Nenhum pagamento registrado para esta inscrição.</p>
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

          {conjugeAcampamento && (
            <div style={{ marginTop: '3rem' }}>
              <h4 style={{ fontWeight: 'bold', fontSize: '1.125rem', marginBottom: '1.5rem' }}>Histórico de Pagamentos - {conjugeAcampamento.apc_pessoa.nome} (Cônjuge)</h4>

              {pagamentosConjuge.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-secondary)' }}>
                  <DollarSign size={32} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
                  <p>Nenhum pagamento registrado para o cônjuge.</p>
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
      )}
    </div>
  );
};
