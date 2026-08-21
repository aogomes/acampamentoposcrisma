import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { Link as LinkIcon, ArrowLeft } from 'lucide-react';

export const AdminNovoVinculo = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  
  const [padrinhos, setPadrinhos] = useState([]);
  const [madrinhas, setMadrinhas] = useState([]);
  const [afilhados, setAfilhados] = useState([]);
  
  const [selectedPadrinho, setSelectedPadrinho] = useState('');
  const [selectedMadrinha, setSelectedMadrinha] = useState('');
  const [selectedAfilhado, setSelectedAfilhado] = useState('');
  const [ano, setAno] = useState(new Date().getFullYear());
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (userProfile?.perfil === 'ADMIN') {
      fetchPerfis();
    }
  }, [userProfile]);

  const fetchPerfis = async () => {
    try {
      setLoading(true);
      
      const { data: dataPadrinhos, error: errP } = await supabase
        .from('apc_perfil')
        .select('*')
        .eq('perfil', 'PADRINHO');
      if (errP) throw errP;

      const { data: dataMadrinhas, error: errM } = await supabase
        .from('apc_perfil')
        .select('*')
        .eq('perfil', 'MADRINHA');
      if (errM) throw errM;
      
      const { data: dataAfilhados, error: errA } = await supabase
        .from('apc_perfil')
        .select('*')
        .eq('perfil', 'AFILHADO');
      if (errA) throw errA;

      setPadrinhos(dataPadrinhos || []);
      setMadrinhas(dataMadrinhas || []);
      setAfilhados(dataAfilhados || []);
    } catch (err) {
      setError('Erro ao carregar dados: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVincular = async (e) => {
    e.preventDefault();
    if (!selectedPadrinho || !selectedMadrinha || !selectedAfilhado || !ano) return;
    
    try {
      setSaving(true);
      setError('');
      
      const { error: insertErr } = await supabase
        .from('apc_vinculo')
        .insert([{ 
          padrinho_id: selectedPadrinho, 
          madrinha_id: selectedMadrinha,
          afilhado_id: selectedAfilhado,
          ano: parseInt(ano)
        }]);
        
      if (insertErr) throw insertErr;
      
      // Volta para a tela de vínculos e recarrega
      navigate('/admin/vinculos', { state: { message: 'Vínculo criado com sucesso!' } });
    } catch (err) {
      setError('Erro ao vincular (verifique se o afilhado já possui vínculo): ' + err.message);
      setSaving(false);
    }
  };

  if (userProfile?.perfil !== 'ADMIN') {
    return (
      <div className="main-content">
        <div className="alert alert-error">Acesso negado.</div>
      </div>
    );
  }

  return (
    <div className="main-content">
      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <Link to="/admin/vinculos" className="btn btn-secondary" style={{ padding: '0.5rem' }}>
            <ArrowLeft size={20} />
          </Link>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0 }}>
            <LinkIcon size={32} color="var(--accent-primary)" />
            Novo Vínculo
          </h1>
        </div>
        <p style={{ marginTop: '0.5rem', fontSize: '1.1rem' }}>
          Vincule 1 Padrinho, 1 Madrinha e 1 Afilhado ao respectivo ano.
        </p>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '2rem' }}>{error}</div>}

      <div className="form-grid">
        <div className="glass-panel" style={{ padding: '2rem' }}>
          {loading ? (
            <p>Carregando perfis...</p>
          ) : (
            <form onSubmit={handleVincular}>
              <div className="form-group">
                <label className="form-label">Selecione o Padrinho</label>
                <select 
                  className="form-input" 
                  value={selectedPadrinho} 
                  onChange={e => setSelectedPadrinho(e.target.value)}
                  required
                >
                  <option value="">-- Escolha um padrinho --</option>
                  {padrinhos.map(p => (
                    <option key={p.user_id} value={p.user_id}>{p.nome}</option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label className="form-label">Selecione a Madrinha</label>
                <select 
                  className="form-input" 
                  value={selectedMadrinha} 
                  onChange={e => setSelectedMadrinha(e.target.value)}
                  required
                >
                  <option value="">-- Escolha uma madrinha --</option>
                  {madrinhas.map(m => (
                    <option key={m.user_id} value={m.user_id}>{m.nome}</option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label className="form-label">Selecione o Afilhado</label>
                <select 
                  className="form-input" 
                  value={selectedAfilhado} 
                  onChange={e => setSelectedAfilhado(e.target.value)}
                  required
                >
                  <option value="">-- Escolha um afilhado --</option>
                  {afilhados.map(a => (
                    <option key={a.user_id} value={a.user_id}>{a.nome}</option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label className="form-label">Ano do Acampamento</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={ano} 
                  onChange={e => setAno(e.target.value)}
                  required
                  min="2000"
                  max="2100"
                />
              </div>
              
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={saving}>
                {saving ? 'Criando Vínculo...' : 'Concluir Vínculo'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
