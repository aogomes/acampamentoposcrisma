import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { UserPlus, ArrowLeft } from 'lucide-react';

export const CadastroPessoa = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    data_nascimento: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
        .from('apc_pessoa')
        .insert([
          {
            user_id: user.id,
            nome: formData.nome,
            email: formData.email || null,
            telefone: formData.telefone || null,
            data_nascimento: formData.data_nascimento || null
          }
        ]);

      if (dbError) throw dbError;
      
      setSuccess('Pessoa cadastrada com sucesso!');
      setFormData({ nome: '', email: '', telefone: '', data_nascimento: '' });
      
      setTimeout(() => navigate('/'), 2000);
    } catch (err) {
      setError('Erro ao cadastrar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

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
          <UserPlus size={28} color="var(--accent-secondary)" />
          Cadastro de Pessoa
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
            {loading ? 'Salvando...' : 'Salvar Cadastro'}
          </button>
        </form>
      </div>
    </div>
  );
};
