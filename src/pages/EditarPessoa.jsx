import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Edit, ArrowLeft } from 'lucide-react';

export const EditarPessoa = () => {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    data_nascimento: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchPessoa();
  }, [id]);

  const fetchPessoa = async () => {
    try {
      setLoadingData(true);
      const { data, error } = await supabase
        .from('apc_perfil')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (data) {
        setFormData({
          nome: data.nome || '',
          email: data.email || '',
          telefone: data.telefone || '',
          data_nascimento: data.data_nascimento ? data.data_nascimento.split('T')[0] : '' // Format date for input
        });
      }
    } catch (err) {
      setError('Erro ao carregar os dados da pessoa: ' + err.message);
    } finally {
      setLoadingData(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const { error: dbError } = await supabase
        .from('apc_perfil')
        .update({
          nome: formData.nome,
          email: formData.email || null,
          telefone: formData.telefone || null,
          data_nascimento: formData.data_nascimento || null
        })
        .eq('id', id);

      if (dbError) throw dbError;
      
      setSuccess('Cadastro atualizado com sucesso!');
      
      if (refreshProfile) {
        await refreshProfile();
      }
      
      setTimeout(() => navigate('/'), 2000);
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
    <div className="main-content" style={{ maxWidth: '800px' }}>
      <button 
        onClick={() => navigate('/')} 
        className="btn btn-secondary" 
        style={{ marginBottom: '2rem', padding: '0.5rem 1rem' }}
      >
        <ArrowLeft size={18} />
        Voltar para Dashboard
      </button>

      <div className="glass-panel" style={{ padding: '2.5rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
          <Edit size={28} color="var(--accent-secondary)" />
          Editar Pessoa
        </h2>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

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
          </div>

          <div className="form-group" style={{ marginBottom: '2rem' }}>
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

          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '1rem' }} disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </form>
      </div>
    </div>
  );
};
