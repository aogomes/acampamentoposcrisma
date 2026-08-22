import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Users, Edit2, ArrowLeft, DollarSign, Plus } from 'lucide-react';

export const MeusAfilhados = () => {
  const { pessoaProfile } = useAuth();
  const navigate = useNavigate();

  const [afilhados, setAfilhados] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [eventoAtivo, setEventoAtivo] = useState(null);

  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    data_nascimento: '',
    sexo: '',
    inscreverEvento: true
  });

  useEffect(() => {
    if (pessoaProfile?.tipo_pessoa === 'PADRINHO' || pessoaProfile?.tipo_pessoa === 'MADRINHA') {
      fetchAfilhados();
      fetchEventoAtivo();
    } else {
      setLoading(false);
    }
  }, [pessoaProfile]);

  const fetchEventoAtivo = async () => {
    try {
      const { data } = await supabase
        .from('apc_evento')
        .select('id, descricao, equipes')
        .eq('status', 'ATIVO')
        .order('data_inicio', { ascending: false })
        .limit(1)
        .single();

      setEventoAtivo(data);
    } catch (err) {
      console.error('Erro ao buscar evento ativo:', err.message);
    }
  };

  const fetchAfilhados = async () => {
    try {
      setLoading(true);
      const isPadrinho = pessoaProfile.tipo_pessoa === 'PADRINHO';
      const matchColumn = isPadrinho ? 'padrinho_id' : 'madrinha_id';

      const { data: vinculos, error: errV } = await supabase
        .from('apc_vinculo')
        .select('id, afilhado_id, ano')
        .eq(matchColumn, pessoaProfile.id);

      if (errV) throw errV;

      if (!vinculos || vinculos.length === 0) {
        setAfilhados([]);
        return;
      }

      const idsAfilhados = vinculos.map(v => v.afilhado_id);

      const { data: perfis, error: errP } = await supabase
        .from('apc_pessoa')
        .select('*')
        .in('id', idsAfilhados);

      if (errP) throw errP;

      // Buscar inscrições (acampamentos) dos afilhados, mas apenas para o evento ATIVO
      const { data: acampamentos, error: errA } = await supabase
        .from('apc_acampamento')
        .select('id, pessoa_id, apc_evento!inner(id, descricao, status)')
        .in('pessoa_id', idsAfilhados)
        .eq('apc_evento.status', 'ATIVO');

      if (errA) throw errA;

      const afilhadosMapeados = vinculos.map(v => {
        const perfil = perfis.find(p => p.id === v.afilhado_id);
        const acampamentosAfilhado = acampamentos?.filter(a => a.pessoa_id === v.afilhado_id) || [];
        return {
          id: v.id,
          ano: v.ano,
          afilhado: perfil || null,
          acampamentos: acampamentosAfilhado
        };
      });

      setAfilhados(afilhadosMapeados);
    } catch (err) {
      console.error('Erro ao carregar afilhados:', err.message);
      setAfilhados([]);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      if (!formData.nome) {
        throw new Error('O nome do afilhado é obrigatório.');
      }

      const anoAtual = new Date().getFullYear();

      const { data, error: rpcError } = await supabase.rpc('criar_afilhado_padrinho', {
        p_nome: formData.nome,
        p_email: formData.email || null,
        p_telefone: formData.telefone || null,
        p_data_nascimento: formData.data_nascimento || null,
        p_evento_id: (eventoAtivo && formData.inscreverEvento) ? eventoAtivo.id : null,
        p_ano: anoAtual,
        p_sexo: formData.sexo || null
      });

      if (rpcError) throw rpcError;

      setSuccess('Afilhado cadastrado e vinculado com sucesso!');
      setFormData({ nome: '', email: '', telefone: '', data_nascimento: '', sexo: '', inscreverEvento: true });
      fetchAfilhados();

      setTimeout(() => {
        setIsCreating(false);
        setSuccess('');
      }, 2000);

    } catch (err) {
      setError(err.message || 'Erro ao cadastrar afilhado.');
    } finally {
      setSaving(false);
    }
  };

  if (pessoaProfile?.tipo_pessoa !== 'PADRINHO' && pessoaProfile?.tipo_pessoa !== 'MADRINHA') {
    return (
      <div className="main-content">
        <div className="alert alert-error">Acesso restrito. Apenas Padrinhos e Madrinhas podem acessar esta página.</div>
      </div>
    );
  }

  return (
    <div className="main-content">
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* <button onClick={() => navigate('/')} className="btn btn-secondary" style={{ padding: '0.5rem' }}>
            <ArrowLeft size={20} />
          </button> */}
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0, fontSize: '1.75rem', flexWrap: 'wrap' }}>
            <Users size={32} color="var(--accent-primary)" />
            Meus Afilhados
          </h1>
        </div>
        <p style={{ margin: 0, fontSize: '1rem', color: 'var(--text-secondary)' }}>
          Gerencie os dados dos afilhados vinculados a você.
        </p>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '2rem' }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: '2rem' }}>{success}</div>}

      {isCreating ? (
        <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <h4 style={{ fontWeight: 'bold', fontSize: '1.25rem', margin: 0 }}>Cadastrar Novo Afilhado</h4>
          </div>

          <form onSubmit={handleSubmit} className="form-grid">
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label" htmlFor="nome">Nome Completo *</label>
              <input
                type="text"
                id="nome"
                name="nome"
                className="form-input"
                value={formData.nome}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="email">E-mail</label>
              <input
                type="email"
                id="email"
                name="email"
                className="form-input"
                value={formData.email}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="telefone">Telefone (WhatsApp)</label>
              <input
                type="text"
                id="telefone"
                name="telefone"
                className="form-input"
                value={formData.telefone}
                onChange={handleChange}
                placeholder="(00) 00000-0000"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="data_nascimento">Data de Nascimento</label>
              <input
                type="date"
                id="data_nascimento"
                name="data_nascimento"
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

            <div className="form-group" style={{ gridColumn: '1 / -1', marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexDirection: 'row' }}>
              <button type="button" onClick={() => setIsCreating(false)} className="btn btn-secondary" style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.95rem' }}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving} style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.95rem' }}>
                {saving ? 'Salvando...' : 'Salvar Afilhado'}
              </button>
            </div>
          </form>

          {eventoAtivo && (
            <label style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                name="inscreverEvento"
                checked={formData.inscreverEvento}
                onChange={handleChange}
                style={{ width: '1.2rem', height: '1.2rem', accentColor: 'var(--accent-primary)' }}
              />
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Inscrever este afilhado automaticamente no evento <strong>{eventoAtivo.descricao}</strong>
              </span>
            </label>
          )}
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <h4 style={{ fontWeight: 'bold', fontSize: '1.125rem', margin: 0 }}>Lista de Afilhados</h4>
              <span style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-primary)', padding: '0.25rem 0.75rem', borderRadius: '99px', fontSize: '0.875rem', fontWeight: 'bold' }}>
                {afilhados.length} Total
              </span>
            </div>
            <button
              onClick={() => setIsCreating(true)}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}
            >
              <Plus size={18} /> Adicionar Afilhado
            </button>
          </div>

          {loading ? (
            <p>Carregando afilhados...</p>
          ) : afilhados.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
              <p>Você ainda não possui afilhados vinculados.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table-compact">
                <thead>
                  <tr>
                    <th>Nome do Afilhado</th>
                    {/* <th>E-mail</th> */}
                    <th>Telefone</th>
                    <th>Ano</th>
                    <th style={{ textAlign: 'center' }}>Eventos</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {afilhados.map((v) => (
                    <tr key={v.id}>
                      <td style={{ fontWeight: '500' }}>{v.afilhado?.nome || 'Desconhecido'}</td>
                      {/* <td>{v.afilhado?.email || '-'}</td> */}
                      <td>{v.afilhado?.telefone || '-'}</td>
                      <td>{v.ano}</td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
                          {v.acampamentos && v.acampamentos.length > 0 ? (
                            v.acampamentos.map(ac => (
                              <Link
                                key={ac.id}
                                to={`/admin/pagamentos/${ac.id}`}
                                state={{ from: '/meus-afilhados' }}
                                className="btn btn-secondary"
                                style={{ padding: '0.4rem 0.75rem', fontSize: '0.875rem', color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                                title={`Confirmado no ${ac.apc_evento.descricao}`}
                              >
                                <DollarSign size={16} /> <span>{ac.apc_evento.descricao}</span>
                              </Link>
                            ))
                          ) : (
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Não vai para o acampamento</span>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          {v.afilhado && (
                            <Link
                              to={`/editar-pessoa/${v.afilhado.id}`}
                              className="btn btn-secondary"
                              style={{ padding: '0.4rem 0.75rem', fontSize: '0.875rem', display: 'inline-flex' }}
                              title="Editar Dados do Afilhado"
                            >
                              <Edit2 size={16} />
                            </Link>
                          )}
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
