import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Edit, ArrowLeft, Trash2 } from 'lucide-react';

export const EditarEvento = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();

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

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (userProfile?.perfil === 'ADMIN' || userProfile?.perfil === 'GESTOR') {
      fetchEvento();
    }
  }, [id, userProfile]);

  const fetchEvento = async () => {
    try {
      setLoadingData(true);
      const { data, error } = await supabase
        .from('apc_evento')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (data) {
        setFormData({
          descricao: data.descricao || '',
          local: data.local || '',
          tema: data.tema || '',
          data_inicio: data.data_inicio || '',
          data_fim: data.data_fim || '',
          valor: data.valor || '',
          status: data.status || 'ATIVO',
          equipes: data.equipes || []
        });
      }
    } catch (err) {
      setError('Erro ao carregar os dados do evento: ' + err.message);
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
      const updateData = {
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
        .update(updateData)
        .eq('id', id);

      if (dbError) throw dbError;

      setSuccess('Evento atualizado com sucesso!');
      setTimeout(() => navigate('/admin/eventos'), 1500);
    } catch (err) {
      setError('Erro ao atualizar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (userProfile?.perfil !== 'ADMIN' && userProfile?.perfil !== 'GESTOR') {
    return (
      <div className="main-content">
        <div className="alert alert-error">Acesso negado. Você não tem permissão para acessar esta página.</div>
      </div>
    );
  }

  if (loadingData) {
    return <div className="main-content"><p>Carregando dados...</p></div>;
  }

  return (
    <div className="main-content">
      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => navigate('/admin/eventos')} className="btn btn-secondary" style={{ padding: '0.5rem' }}>
            <ArrowLeft size={20} />
          </button>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0 }}>
            <Edit size={32} color="var(--accent-primary)" />
            Editar Evento
          </h1>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '2rem' }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: '2rem' }}>{success}</div>}

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
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
