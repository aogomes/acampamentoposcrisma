import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Calendar, Plus, Trash2, Edit2, Search, Filter } from 'lucide-react';
import { Link } from 'react-router-dom';

export const AdminEventos = () => {
  const { userProfile } = useAuth();

  const [eventos, setEventos] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('TODOS');

  const [formData, setFormData] = useState({
    descricao: '',
    local: '',
    tema: '',
    data_inicio: '',
    data_fim: '',
    valor: '',
    status: 'ATIVO',
    equipes: []
  });

  const [equipeInput, setEquipeInput] = useState('');

  const handleAddEquipe = () => {
    if (equipeInput.trim() && !formData.equipes.includes(equipeInput.trim())) {
      setFormData(prev => ({ ...prev, equipes: [...prev.equipes, equipeInput.trim()] }));
      setEquipeInput('');
    }
  };

  const handleRemoveEquipe = (equipe) => {
    setFormData(prev => ({ ...prev, equipes: prev.equipes.filter(e => e !== equipe) }));
  };

  useEffect(() => {
    if ((userProfile?.perfil === 'ADMIN' || userProfile?.perfil === 'GESTOR') && !isCreating) {
      fetchEventos();
    }
  }, [userProfile, isCreating]);

  const fetchEventos = async () => {
    try {
      setLoadingData(true);
      const { data, error } = await supabase
        .from('apc_evento')
        .select('*')
        .order('data_inicio', { ascending: false });

      if (error) throw error;
      setEventos(data || []);
    } catch (err) {
      setError('Erro ao carregar eventos: ' + err.message);
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
      const insertData = {
        descricao: formData.descricao,
        local: formData.local || null,
        tema: formData.tema || null,
        data_inicio: formData.data_inicio || null,
        data_fim: formData.data_fim || null,
        valor: formData.valor ? parseFloat(formData.valor) : null,
        status: formData.status,
        equipes: formData.equipes
      };

      const { error: dbError } = await supabase
        .from('apc_evento')
        .insert([insertData]);

      if (dbError) throw dbError;

      setSuccess('Evento criado com sucesso!');
      setFormData({ descricao: '', local: '', tema: '', data_inicio: '', data_fim: '', valor: '', status: 'ATIVO', equipes: [] });

      setTimeout(() => {
        setIsCreating(false);
        setSuccess('');
      }, 1500);

    } catch (err) {
      setError('Erro ao criar evento: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este evento?')) return;

    try {
      setError('');
      const { error } = await supabase.from('apc_evento').delete().eq('id', id);
      if (error) throw error;

      setEventos(eventos.filter(e => e.id !== id));
      setSuccess('Evento excluído com sucesso!');
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

  const filteredEventos = eventos.filter(e => {
    const matchesSearch = e.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.tema && e.tema.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = filterStatus === 'TODOS' || e.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // Função para formatar data
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const parts = dateString.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateString;
  };

  // Função para formatar valor (moeda)
  const formatCurrency = (value) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <div className="main-content">
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0, fontSize: '1.75rem', flexWrap: 'wrap' }}>
            <Calendar size={32} color="var(--accent-primary)" />
            {isCreating ? 'Novo Evento' : 'Eventos'}
          </h1>
          <button
            onClick={() => {
              setIsCreating(!isCreating);
              setSuccess('');
              setError('');
            }}
            className={isCreating ? "btn btn-secondary" : "btn btn-primary"}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            {isCreating ? 'Voltar para Lista' : <><Plus size={20} /> Novo Evento</>}
          </button>
        </div>
        <p style={{ margin: 0, fontSize: '1rem', color: 'var(--text-secondary)' }}>
          {isCreating ? 'Preencha os dados abaixo para criar um novo evento.' : 'Gerencie os eventos do acampamento.'}
        </p>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '2rem' }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: '2rem' }}>{success}</div>}

      {isCreating ? (
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label" htmlFor="descricao">Descrição / Nome do Evento *</label>
                <input
                  id="descricao"
                  name="descricao"
                  type="text"
                  className="form-input"
                  placeholder="Ex: Acampamento Pós-Crisma 2026"
                  value={formData.descricao}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="tema">Tema</label>
                <input
                  id="tema"
                  name="tema"
                  type="text"
                  className="form-input"
                  placeholder="Ex: Jovens na fé"
                  value={formData.tema}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="local">Local</label>
                <input
                  id="local"
                  name="local"
                  type="text"
                  className="form-input"
                  placeholder="Ex: Sítio São José"
                  value={formData.local}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label" htmlFor="data_inicio">Data de Início</label>
                <input
                  id="data_inicio"
                  name="data_inicio"
                  type="date"
                  className="form-input"
                  value={formData.data_inicio}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="data_fim">Data de Término</label>
                <input
                  id="data_fim"
                  name="data_fim"
                  type="date"
                  className="form-input"
                  value={formData.data_fim}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label" htmlFor="valor">Valor Inscrição (R$)</label>
                <input
                  id="valor"
                  name="valor"
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-input"
                  placeholder="Ex: 150.00"
                  value={formData.valor}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '2rem' }}>
                <label className="form-label" htmlFor="status">Status *</label>
                <select
                  id="status"
                  name="status"
                  className="form-input"
                  value={formData.status}
                  onChange={handleChange}
                  required
                >
                  <option value="ATIVO">Ativo</option>
                  <option value="ENCERRADO">Encerrado</option>
                </select>
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group" style={{ gridColumn: '1 / -1', marginBottom: '1.5rem' }}>
                <label className="form-label">Equipes do Evento</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ex: Jovem, Limpeza, Som"
                    value={equipeInput}
                    onChange={(e) => setEquipeInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddEquipe();
                      }
                    }}
                  />
                  <button type="button" onClick={handleAddEquipe} className="btn btn-secondary" style={{ padding: '0 1rem' }}>
                    Adicionar
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                  {formData.equipes.map(eq => (
                    <span key={eq} style={{
                      background: 'rgba(59, 130, 246, 0.1)',
                      color: 'var(--accent-primary)',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.875rem'
                    }}>
                      {eq}
                      <button type="button" onClick={() => handleRemoveEquipe(eq)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex' }}>
                        <Trash2 size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Salvando...' : 'Salvar Evento'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '2rem' }}>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '1rem', flex: '1 1 300px' }}>
              <div style={{ position: 'relative', flex: '1' }}>
                <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                <input
                  type="text"
                  placeholder="Buscar evento..."
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
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="TODOS">Todos os Status</option>
                  <option value="ATIVO">Ativos</option>
                  <option value="ENCERRADO">Encerrados</option>
                </select>
              </div>
            </div>

            <div style={{ background: 'var(--bg-secondary)', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: '500' }}>
              Total: <span style={{ color: 'var(--accent-primary)' }}>{filteredEventos.length}</span>
            </div>
          </div>

          {loadingData ? (
            <p>Carregando eventos...</p>
          ) : filteredEventos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
              <p>Nenhum evento encontrado.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table-compact">
                <thead>
                  <tr>
                    <th>Descrição</th>
                    {/* <th>Tema</th> */}
                    <th>Data Início</th>
                    <th>Data Fim</th>
                    {/* <th>Valor</th> */}
                    <th>Local</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEventos.map((e) => (
                    <tr key={e.id}>
                      <td style={{ fontWeight: '500' }}>
                        <Link
                          to={`/admin/acampamentos/${e.id}`}
                          style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}
                          title="Ver inscrições do acampamento"
                        >
                          {e.descricao}
                        </Link>
                      </td>
                      {/* <td>{e.tema || '-'}</td> */}
                      <td>{formatDate(e.data_inicio)}</td>
                      <td>{formatDate(e.data_fim)}</td>
                      {/* <td>{formatCurrency(e.valor)}</td> */}
                      <td>{e.local || '-'}</td>
                      <td>
                        <span style={{
                          background: e.status === 'ATIVO' ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-secondary)',
                          color: e.status === 'ATIVO' ? '#10b981' : 'inherit',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: '500'
                        }}>
                          {e.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <Link
                            to={`/admin/eventos/${e.id}`}
                            className="btn btn-secondary"
                            style={{ padding: '0.4rem 0.75rem', fontSize: '0.875rem' }}
                            title="Editar Evento"
                          >
                            <Edit2 size={16} />
                          </Link>
                          <button
                            onClick={() => handleDelete(e.id)}
                            className="btn btn-secondary"
                            style={{ padding: '0.4rem 0.75rem', fontSize: '0.875rem', color: 'var(--error)' }}
                            title="Remover Evento"
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
      )}
    </div>
  );
};
