import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { UserPlus, ArrowLeft, Users, Edit2, Trash2, Plus } from 'lucide-react';

export const CadastroPessoa = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  const [pessoas, setPessoas] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState('TODOS');

  const [isCreating, setIsCreating] = useState(false);

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
    vinculo_padrinho_id: '',
    vinculo_madrinha_id: ''
  });
  const [dependentes, setDependentes] = useState([]);

  const [potenciaisConjuges, setPotenciaisConjuges] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [padrinhos, setPadrinhos] = useState([]);
  const [madrinhas, setMadrinhas] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if ((userProfile?.perfil === 'ADMIN' || userProfile?.perfil === 'GESTOR') && !isCreating) {
      fetchPessoas();
    }
    if (isCreating) {
      fetchUsuarios();
      fetchPadrinhosEMadrinhas();
    }
  }, [userProfile, isCreating]);

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

  const fetchPessoas = async () => {
    try {
      setLoadingData(true);

      // Busca todas as pessoas
      const { data: pessoasData, error } = await supabase
        .from('apc_pessoa')
        .select('*')
        .order('nome', { ascending: true });

      if (error) throw error;

      // Busca todos os vínculos para mapear os padrinhos
      const { data: vinculosData } = await supabase
        .from('apc_vinculo')
        .select('*');

      const pessoasMapeadas = (pessoasData || []).map(p => {
        let mapped = { ...p };
        if (p.tipo_pessoa === 'AFILHADO' && vinculosData) {
          const vinculo = vinculosData.find(v => v.afilhado_id === p.id);
          if (vinculo) {
            const padrinho = pessoasData.find(p2 => p2.id === vinculo.padrinho_id);
            const madrinha = pessoasData.find(p2 => p2.id === vinculo.madrinha_id);
            mapped.ano = vinculo.ano;
            mapped.nomePadrinhos = `${padrinho?.nome || 'N/D'} e ${madrinha?.nome || 'N/D'}`;
          }
        } else if ((p.tipo_pessoa === 'PADRINHO' || p.tipo_pessoa === 'MADRINHA') && p.conjuge_id) {
          const conjuge = pessoasData.find(p2 => p2.id === p.conjuge_id);
          if (conjuge) {
            mapped.nomeConjuge = conjuge.nome;
          }
        }
        return mapped;
      });

      setPessoas(pessoasMapeadas);
    } catch (err) {
      setError('Erro ao carregar pessoas: ' + err.message);
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

  // Buscar potenciais cônjuges sempre que o tipo_pessoa mudar
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
      const insertData = {
        nome: formData.nome,
        email: formData.email || null,
        telefone: formData.telefone || null,
        sexo: formData.sexo || null,
        data_nascimento: formData.data_nascimento || null,
        tipo_pessoa: formData.tipo_pessoa,
        ano: formData.ano ? parseInt(formData.ano) : null,
        conjuge_id: formData.conjuge_id || null,
        user_id: formData.user_id || null
      };

      const { data: newPessoa, error: dbError } = await supabase
        .from('apc_pessoa')
        .insert([insertData])
        .select()
        .single();

      if (dbError) throw dbError;

      // Se selecionou um cônjuge, precisamos atualizar o cônjuge também para apontar para esta nova pessoa (relacionamento bidirecional)
      if (formData.conjuge_id && newPessoa) {
        await supabase
          .from('apc_pessoa')
          .update({ conjuge_id: newPessoa.id })
          .eq('id', formData.conjuge_id);
      }

      // Criar vínculo se for afilhado e padrinhos informados
      if (formData.tipo_pessoa === 'AFILHADO' && formData.vinculo_padrinho_id && formData.vinculo_madrinha_id && formData.ano && newPessoa) {
        await supabase.from('apc_vinculo').insert([{
          padrinho_id: formData.vinculo_padrinho_id,
          madrinha_id: formData.vinculo_madrinha_id,
          afilhado_id: newPessoa.id,
          ano: parseInt(formData.ano)
        }]);
      }

      if (dependentes.length > 0 && newPessoa) {
        const depsToInsert = dependentes
          .filter(d => d.nome.trim() !== '')
          .map(d => ({
            pessoa_id: newPessoa.id,
            nome: d.nome,
            data_nascimento: d.data_nascimento || null,
            mascote: d.mascote
          }));

        if (depsToInsert.length > 0) {
          await supabase.from('apc_dependente').insert(depsToInsert);
        }
      }

      setSuccess('Pessoa cadastrada com sucesso!');
      setFormData({ nome: '', email: '', telefone: '', sexo: '', data_nascimento: '', tipo_pessoa: 'AFILHADO', ano: '', conjuge_id: '', user_id: '', vinculo_padrinho_id: '', vinculo_madrinha_id: '' });
      setDependentes([]);

      setTimeout(() => {
        setIsCreating(false);
        setSuccess('');
      }, 2000);
    } catch (err) {
      setError('Erro ao cadastrar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir esta pessoa?')) return;
    try {
      const { error } = await supabase.from('apc_pessoa').delete().eq('id', id);
      if (error) throw error;
      fetchPessoas();
    } catch (err) {
      alert('Erro ao excluir: ' + err.message);
    }
  };

  if (userProfile?.perfil !== 'ADMIN' && userProfile?.perfil !== 'GESTOR') {
    return (
      <div className="main-content">
        <div className="alert alert-error">Acesso negado. Você não tem permissão para acessar esta página.</div>
      </div>
    );
  }

  if (isCreating) {
    return (
      <div className="main-content">
        <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button onClick={() => setIsCreating(false)} className="btn btn-secondary" style={{ padding: '0.5rem' }}>
              <ArrowLeft size={20} />
            </button>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0 }}>
              <UserPlus size={32} color="var(--accent-primary)" />
              Cadastro de Pessoa
            </h1>
          </div>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>{error}</div>}
        {success && <div className="alert alert-success" style={{ marginBottom: '2rem' }}>{success}</div>}

        <div className="glass-panel" style={{ padding: '2rem' }}>

          <form onSubmit={handleSubmit}>
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

            <div className="form-grid">
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
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
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

            <div className="form-grid" style={{ marginBottom: '2rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="tipo_pessoa">Tipo de Pessoa *</label>
                <select
                  id="tipo_pessoa"
                  name="tipo_pessoa"
                  className="form-input"
                  value={formData.tipo_pessoa}
                  onChange={handleChange}
                  required
                >
                  <option value="AFILHADO">Afilhado(a)</option>
                  <option value="PADRINHO">Padrinho</option>
                  <option value="MADRINHA">Madrinha</option>
                  <option value="VOLUNTARIO">Voluntário(a)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="ano">Ano (Turma)</label>
                <input
                  id="ano"
                  name="ano"
                  type="number"
                  className="form-input"
                  placeholder="Ex: 2025"
                  value={formData.ano}
                  onChange={handleChange}
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
            </div>

            {formData.tipo_pessoa === 'AFILHADO' && (
              <div style={{ background: 'rgba(59, 130, 246, 0.05)', padding: '1.25rem', borderRadius: '8px', marginBottom: '2rem', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                <h4 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: 'var(--accent-primary)' }}>
                  Padrinhos
                </h4>
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
              </div>
            )}

            {userProfile?.perfil === 'ADMIN' && (
              <div className="form-group" style={{ marginBottom: '2rem' }}>
                <label className="form-label" htmlFor="user_id">Conta de Usuário (App) Vinculada</label>
                <select
                  id="user_id"
                  name="user_id"
                  className="form-input"
                  value={formData.user_id}
                  onChange={handleChange}
                >
                  <option value="">-- Não vincular nenhuma conta (ou vincular depois) --</option>
                  {usuarios.map(u => (
                    <option key={u.user_id} value={u.user_id}>
                      {u.nome} {u.email ? `(${u.email})` : ''}
                    </option>
                  ))}
                </select>
                <small style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', display: 'block' }}>
                  Selecione a conta que esta pessoa usará para fazer login no sistema. Se ela ainda não criou conta, deixe em branco.
                </small>
              </div>
            )}

            {/* Dependentes */}
            {(formData.tipo_pessoa === 'PADRINHO' || formData.tipo_pessoa === 'MADRINHA') && (
              <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid var(--border-color)' }}>
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
                {loading ? 'Salvando...' : 'Salvar Cadastro'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const filteredPessoas = pessoas.filter(p => {
    const matchesSearch = p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.email && p.email.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesTipo = filterTipo === 'TODOS' || p.tipo_pessoa === filterTipo;
    return matchesSearch && matchesTipo;
  }).sort((a, b) => a.nome.localeCompare(b.nome));

  return (
    <div className="main-content">
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0, fontSize: '1.75rem', flexWrap: 'wrap' }}>
            <Users size={32} color="var(--accent-primary)" />
            Pessoas
          </h1>
          <button onClick={() => setIsCreating(true)} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={20} />
            Nova Pessoa
          </button>
        </div>
        <p style={{ margin: 0, fontSize: '1rem', color: 'var(--text-secondary)' }}>
          Gerencie as pessoas participantes do acampamento.
        </p>
      </div>

      <div className="glass-panel" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h4 style={{ fontWeight: 'bold', fontSize: '1.125rem', margin: 0 }}>Lista de Pessoas</h4>
          <span style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-primary)', padding: '0.25rem 0.75rem', borderRadius: '99px', fontSize: '0.875rem', fontWeight: 'bold' }}>
            {filteredPessoas.length} Total
          </span>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: '1', minWidth: '200px', marginBottom: 0 }}>
            <input
              type="text"
              className="form-input"
              placeholder="Buscar por nome ou e-mail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ width: '200px', marginBottom: 0 }}>
            <select
              className="form-input"
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
            >
              <option value="TODOS">Todos os Tipos</option>
              <option value="AFILHADO">Afilhados</option>
              <option value="PADRINHO">Padrinhos</option>
              <option value="MADRINHA">Madrinhas</option>
            </select>
          </div>
        </div>

        {loadingData ? (
          <p>Carregando pessoas...</p>
        ) : filteredPessoas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
            <p>Nenhuma pessoa encontrada com esses filtros.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table-compact">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Cônjuge</th>
                  <th>Tipo</th>
                  <th>Padrinhos</th>
                  <th>Ano</th>
                  <th>E-mail</th>
                  <th>Telefone</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredPessoas.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: '500' }}>{p.nome}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {p.nomeConjuge ? (
                        <span style={{ fontSize: '0.9rem' }}>{p.nomeConjuge}</span>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)' }}>-</span>
                      )}
                    </td>
                    <td>
                      <span style={{
                        background: 'var(--bg-secondary)',
                        padding: '0.1rem 0.25rem',
                        borderRadius: '4px',
                        fontSize: '0.7rem'
                      }}>
                        {p.tipo_pessoa}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{p.nomePadrinhos || '-'}</td>
                    <td>{p.ano || '-'}</td>
                    <td>{p.email || '-'}</td>
                    <td>{p.telefone || '-'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <Link
                          to={`/editar-pessoa/${p.id}`}
                          className="btn btn-secondary"
                          style={{ padding: '0.4rem 0.75rem', fontSize: '0.875rem' }}
                          title="Editar Pessoa"
                        >
                          <Edit2 size={16} />
                        </Link>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="btn btn-secondary"
                          style={{ padding: '0.4rem 0.75rem', fontSize: '0.875rem', color: 'var(--error)' }}
                          title="Remover Pessoa"
                        >
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
    </div>
  );
};
