import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { UserPlus, ArrowLeft, Users, Edit2, Trash2, Plus, ArrowUpDown, Phone, Mail, Heart } from 'lucide-react';
import { ModalDependente, ListaDependentes, prepararPayloadDependente } from '../components/ModalDependente';
import { validarCPF, formatarCPF } from '../utils/cpf';

export const CadastroPessoa = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  const [pessoas, setPessoas] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState('TODOS');
  const [filterAno, setFilterAno] = useState('TODOS');
  const [sortOrder, setSortOrder] = useState('nome-asc');

  const [isCreating, setIsCreating] = useState(false);

  const [formData, setFormData] = useState({
    nome: '',
    cpf: '',
    email: '',
    telefone: '',
    sexo: '',
    data_nascimento: '',
    tipo_pessoa: 'AFILHADO',
    ano: '',
    conjuge_id: '',
    user_id: '',
    vinculo_padrinho_id: '',
    vinculo_madrinha_id: '',
    nome_pai: '',
    nome_mae: '',
    fone_responsavel: '',
    necessidade_medica: '',
    camiseta: ''
  });
  const [dependentes, setDependentes] = useState([]);
  const [modalDependenteOpen, setModalDependenteOpen] = useState(false);
  const [dependenteEmEdicao, setDependenteEmEdicao] = useState(null);
  const [dependenteEdicaoIndex, setDependenteEdicaoIndex] = useState(null);

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
            mapped.nomePadrinhos = `${padrinho?.nome || 'N/D'}\n e ${madrinha?.nome || 'N/D'}`;
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
    const finalValue = name === 'cpf' ? formatarCPF(value) : value;
    setFormData(prev => ({
      ...prev,
      [name]: finalValue,
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

  const handleAbrirModalNovoDependente = () => {
    setDependenteEmEdicao(null);
    setDependenteEdicaoIndex(null);
    setModalDependenteOpen(true);
  };

  const handleAbrirModalEditarDependente = (index) => {
    setDependenteEmEdicao(dependentes[index]);
    setDependenteEdicaoIndex(index);
    setModalDependenteOpen(true);
  };

  const handleFecharModalDependente = () => {
    setModalDependenteOpen(false);
    setDependenteEmEdicao(null);
    setDependenteEdicaoIndex(null);
  };

  const handleSalvarDependenteModal = (dependenteNormalizado, index) => {
    if (index !== null && index >= 0) {
      setDependentes(prev => {
        const novos = [...prev];
        novos[index] = dependenteNormalizado;
        return novos;
      });
    } else {
      setDependentes(prev => [...prev, dependenteNormalizado]);
    }
  };

  const handleRemoveDependente = (index) => {
    setDependentes(dependentes.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.nome || !formData.nome.trim()) {
      setError('Por favor, informe o Nome Completo.');
      return;
    }

    if (!formData.cpf || !formData.cpf.trim()) {
      setError('Por favor, informe o CPF.');
      return;
    }

    if (!validarCPF(formData.cpf)) {
      setError('Por favor, informe um CPF válido.');
      return;
    }

    setLoading(true);

    try {
      const insertData = {
        nome: formData.nome.trim(),
        cpf: formData.cpf.trim(),
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
          .map(d => prepararPayloadDependente(d, newPessoa.id));

        if (depsToInsert.length > 0) {
          try {
            await supabase.from('apc_dependente').insert(depsToInsert);
          } catch (depErr) {
            console.warn('Erro ao inserir dependentes com ficha médica completa, tentando fallback:', depErr);
            const fallback = depsToInsert.map(d => ({
              pessoa_id: d.pessoa_id,
              nome: d.nome,
              data_nascimento: d.data_nascimento,
              acampamento: d.acampamento,
              mascote: d.mascote
            }));
            await supabase.from('apc_dependente').insert(fallback);
          }
        }
      }

      setSuccess('Pessoa cadastrada com sucesso!');
      setFormData({ nome: '', cpf: '', email: '', telefone: '', sexo: '', data_nascimento: '', tipo_pessoa: 'AFILHADO', ano: '', conjuge_id: '', user_id: '', vinculo_padrinho_id: '', vinculo_madrinha_id: '', nome_pai: '', nome_mae: '', fone_responsavel: '', necessidade_medica: '', camiseta: '' });
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

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
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
                <label className="form-label" htmlFor="cpf">CPF *</label>
                <input
                  id="cpf"
                  name="cpf"
                  type="text"
                  className="form-input"
                  placeholder="000.000.000-00"
                  value={formData.cpf}
                  onChange={handleChange}
                  maxLength={14}
                  required
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
            </div>

            <div className="form-group" style={{ width: '100%' }}>
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
              <div className="form-group">
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
              </div>
            )}

            {/* Dependentes */}
            {(formData.tipo_pessoa === 'PADRINHO' || formData.tipo_pessoa === 'MADRINHA') && (
              <ListaDependentes
                dependentes={dependentes}
                onAdicionar={handleAbrirModalNovoDependente}
                onEditar={handleAbrirModalEditarDependente}
                onRemover={handleRemoveDependente}
              />
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Salvando...' : 'Salvar Cadastro'}
              </button>
            </div>
          </form>

          {/* Modal / Popup de Dependente */}
          <ModalDependente
            isOpen={modalDependenteOpen}
            onClose={handleFecharModalDependente}
            onSave={handleSalvarDependenteModal}
            initialData={dependenteEmEdicao}
            edicaoIndex={dependenteEdicaoIndex}
          />
        </div>
      </div>
    );
  }

  const getTipoBadgeInfo = (tipo) => {
    if (tipo === 'PADRINHO' || tipo === 'MADRINHA') {
      return {
        label: tipo === 'PADRINHO' ? 'Padrinho' : 'Madrinha',
        bg: 'rgba(16, 185, 129, 0.12)',
        color: '#059669',
        border: '1px solid rgba(16, 185, 129, 0.25)',
        accent: '#10b981'
      };
    }
    if (tipo === 'AFILHADO') {
      return {
        label: 'Afilhado(a)',
        bg: 'rgba(245, 158, 11, 0.12)',
        color: '#d97706',
        border: '1px solid rgba(245, 158, 11, 0.25)',
        accent: '#f59e0b'
      };
    }
    if (tipo === 'VOLUNTARIO') {
      return {
        label: 'Voluntário(a)',
        bg: 'rgba(59, 130, 246, 0.12)',
        color: '#2563eb',
        border: '1px solid rgba(59, 130, 246, 0.25)',
        accent: '#3b82f6'
      };
    }
    return {
      label: tipo || '-',
      bg: 'var(--bg-secondary)',
      color: 'var(--text-secondary)',
      border: '1px solid var(--border-color)',
      accent: 'var(--accent-primary)'
    };
  };

  const anosDisponiveis = useMemo(() => {
    return Array.from(new Set(pessoas.map(p => p.ano).filter(Boolean))).sort((a, b) => Number(b) - Number(a));
  }, [pessoas]);

  const filteredPessoas = pessoas.filter(p => {
    const matchesSearch = p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.email && p.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.cpf && p.cpf.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesTipo = filterTipo === 'TODOS' || p.tipo_pessoa === filterTipo;
    const matchesAno = filterAno === 'TODOS' || (p.ano && p.ano.toString() === filterAno.toString());
    return matchesSearch && matchesTipo && matchesAno;
  }).sort((a, b) => {
    if (sortOrder === 'nome-desc') {
      return (b.nome || '').localeCompare(a.nome || '', 'pt-BR');
    }
    if (sortOrder === 'ano-desc') {
      const diff = (parseInt(b.ano, 10) || 0) - (parseInt(a.ano, 10) || 0);
      return diff !== 0 ? diff : (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
    }
    if (sortOrder === 'ano-asc') {
      const diff = (parseInt(a.ano, 10) || 0) - (parseInt(b.ano, 10) || 0);
      return diff !== 0 ? diff : (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
    }
    if (sortOrder === 'tipo-asc') {
      const diff = (a.tipo_pessoa || '').localeCompare(b.tipo_pessoa || '', 'pt-BR');
      return diff !== 0 ? diff : (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
    }
    return (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
  });

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
              <option value="VOLUNTARIO">Voluntários</option>
            </select>
          </div>
          <div className="form-group" style={{ width: '160px', marginBottom: 0 }}>
            <select
              className="form-input"
              value={filterAno}
              onChange={(e) => setFilterAno(e.target.value)}
            >
              <option value="TODOS">Todos os Anos</option>
              {anosDisponiveis.map(ano => (
                <option key={ano} value={ano}>{ano}</option>
              ))}
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
          <>
            {/* Controles para Mobile: Contador e Ordenação Rápida */}
            <div className="pessoas-mobile-controls">
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>{filteredPessoas.length}</strong> {filteredPessoas.length === 1 ? 'pessoa' : 'pessoas'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <label htmlFor="mobile-sort-select" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  <ArrowUpDown size={13} />
                  <span>Ordenar:</span>
                </label>
                <select
                  id="mobile-sort-select"
                  className="form-input"
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.775rem', width: 'auto', minWidth: '135px', margin: 0, height: 'auto', borderRadius: '6px' }}
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                >
                  <option value="nome-asc">Nome (A-Z)</option>
                  <option value="nome-desc">Nome (Z-A)</option>
                  <option value="ano-desc">Ano (Mais recente)</option>
                  <option value="ano-asc">Ano (Mais antigo)</option>
                  <option value="tipo-asc">Tipo</option>
                </select>
              </div>
            </div>

            {/* Visualização Mobile: Cards Organizados */}
            <div className="pessoas-mobile-list">
              {filteredPessoas.map((p) => {
                const badge = getTipoBadgeInfo(p.tipo_pessoa);

                return (
                  <div
                    key={`mobile-${p.id}`}
                    className="pessoa-card-mobile"
                    style={{ borderLeft: `4px solid ${badge.accent}` }}
                  >
                    {/* Cabeçalho do Card */}
                    <div className="pessoa-card-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '0.725rem',
                          fontWeight: '700',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '6px',
                          background: badge.bg,
                          color: badge.color,
                          border: badge.border
                        }}>
                          {badge.label}
                        </span>

                        {p.ano && (
                          <span style={{
                            fontSize: '0.7rem',
                            color: 'var(--text-secondary)',
                            background: 'var(--bg-secondary)',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            fontWeight: '600'
                          }}>
                            {p.ano}
                          </span>
                        )}
                      </div>

                      {p.telefone && (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          fontSize: '0.725rem',
                          color: 'var(--text-secondary)',
                          background: 'var(--bg-secondary)',
                          padding: '0.15rem 0.45rem',
                          borderRadius: '4px',
                          border: '1px solid var(--border-color)'
                        }}>
                          <Phone size={11} />
                          <span>{p.telefone}</span>
                        </span>
                      )}
                    </div>

                    {/* Corpo do Card */}
                    <div className="pessoa-card-body">
                      <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                        {p.nome}
                      </div>

                      {p.nomeConjuge && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                          <span>Cônjuge:</span>
                          <strong style={{ color: 'var(--text-primary)', fontWeight: '600' }}>
                            {p.nomeConjuge}
                          </strong>
                        </div>
                      )}

                      {p.nomePadrinhos && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                          <Users size={13} color="#d97706" />
                          <span>Padrinhos:</span>
                          <strong style={{ color: 'var(--text-primary)', fontWeight: '600' }}>
                            {p.nomePadrinhos}
                          </strong>
                        </div>
                      )}
                    </div>

                    {/* Rodapé / Ações */}
                    <div className="pessoa-card-actions" style={{ justifyContent: 'flex-end', gap: '0.85rem', paddingTop: '0.1rem', borderTop: '1px solid var(--border-color)' }}>
                      <Link
                        to={`/editar-pessoa/${p.id}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 0,
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          transition: 'color 0.15s ease'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-primary)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
                        title="Editar Pessoa"
                      >
                        <Edit2 size={16} />
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(p.id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 0,
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          transition: 'color 0.15s ease'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--error)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
                        title="Remover Pessoa"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Visualização Desktop: Tabela Tradicional */}
            <div className="pessoas-desktop-table">
              <table className="table-compact">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Cônjuge</th>
                    <th>Tipo</th>
                    <th>Padrinhos</th>
                    <th style={{ minWidth: '130px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
                        <span>Ano</span>
                        <select
                          value={filterAno}
                          onChange={(e) => setFilterAno(e.target.value)}
                          style={{
                            padding: '0.15rem 0.35rem',
                            fontSize: '0.75rem',
                            borderRadius: '4px',
                            border: '1px solid var(--border-color)',
                            background: filterAno !== 'TODOS' ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-secondary)',
                            color: filterAno !== 'TODOS' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontWeight: filterAno !== 'TODOS' ? 'bold' : 'normal'
                          }}
                          title="Filtrar por Ano"
                        >
                          <option value="TODOS">Todos</option>
                          {anosDisponiveis.map(ano => (
                            <option key={ano} value={ano}>{ano}</option>
                          ))}
                        </select>
                      </div>
                    </th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPessoas.map((p) => {
                    const badge = getTipoBadgeInfo(p.tipo_pessoa);
                    return (
                      <tr key={p.id}>
                        <td style={{ fontSize: '0.9rem', fontWeight: '500', color: 'var(--text-primary)' }}>{p.nome}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>
                          {p.nomeConjuge ? (
                            <span style={{ fontSize: '0.75rem' }}>{p.nomeConjuge}</span>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)' }}>-</span>
                          )}
                        </td>
                        <td>
                          <span style={{
                            background: badge.bg,
                            color: badge.color,
                            border: badge.border,
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            fontSize: '0.725rem',
                            fontWeight: '600',
                            whiteSpace: 'nowrap'
                          }}>
                            {badge.label}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'pre-line' }}>{p.nomePadrinhos || '-'}</td>
                        <td>{p.ano || '-'}</td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '0.2rem', justifyContent: 'flex-end' }}>
                            <Link
                              to={`/editar-pessoa/${p.id}`}
                              className="btn btn-secondary"
                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                              title="Editar Pessoa"
                            >
                              <Edit2 size={14} />
                            </Link>
                            <button
                              onClick={() => handleDelete(p.id)}
                              className="btn btn-secondary"
                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', color: 'var(--error)' }}
                              title="Remover Pessoa"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
