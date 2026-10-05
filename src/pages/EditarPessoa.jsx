import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
  Edit,
  ArrowLeft,
  Trash2,
  Plus,
  Calendar,
  Phone,
  AlertCircle,
  HeartPulse,
  Shirt,
  ShieldCheck,
  User,
  Info,
  FileText
} from 'lucide-react';

export const EditarPessoa = () => {
  const { userProfile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();

  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    sexo: '',
    data_nascimento: '',
    idade: '',
    tipo_pessoa: 'AFILHADO',
    padrinhos_catequistas: '',
    ano: '',
    conjuge_id: '',
    user_id: '',
    vinculo_id: '',
    vinculo_padrinho_id: '',
    vinculo_madrinha_id: '',
    rg: '',
    cpf: '',
    contato_emergencia: '',
    nome_responsavel: '',
    nome_pai: '',
    nome_mae: '',
    fone_responsavel: '',
    tipo_sanguineo: '',
    problema_saude: 'NAO',
    problema_saude_qual: '',
    historico_convulsao: 'NAO',
    historico_convulsao_tempo: '',
    tratamento_medico: 'NAO',
    tratamento_medico_qual: '',
    medicamento_continuo: 'NAO',
    medicamento_continuo_qual: '',
    medicamento_continuo_dosagem: '',
    lesao_contusao: 'NAO',
    lesao_contusao_qual: '',
    restricao_alimentar: 'NAO',
    restricao_alimentar_qual: '',
    doenca_respiratoria: 'NAO',
    usa_bombinha: 'NAO',
    alergia_medicamento: 'NAO',
    alergia_medicamento_qual: '',
    alergia_alimento: 'NAO',
    alergia_alimento_qual: '',
    medicacao_sintomas: '',
    cuidado_especial: 'NAO',
    cuidado_especial_qual: '',
    camiseta: '',
    camiseta_infantil: '',
    necessidade_medica: '',
    outras_informacoes: '',
    aceite_termos_dados: false,
    aceite_termo_imagem: false
  });

  const [dependentes, setDependentes] = useState([]);
  const [deletedDependentes, setDeletedDependentes] = useState([]);

  const [potenciaisConjuges, setPotenciaisConjuges] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [padrinhos, setPadrinhos] = useState([]);
  const [madrinhas, setMadrinhas] = useState([]);

  // Inscrição / Confirmação
  const [eventosAtivos, setEventosAtivos] = useState([]);
  const [inscricoesAtivas, setInscricoesAtivas] = useState([]); // ids dos eventos que já tá inscrito
  const [eventosAConfirmar, setEventosAConfirmar] = useState([]); // ids dos eventos a confirmar

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const calcularIdade = (dataNasc) => {
    if (!dataNasc) return '';
    const hoje = new Date();
    const nasc = new Date(dataNasc);
    let idadeCalc = hoje.getFullYear() - nasc.getFullYear();
    const m = hoje.getMonth() - nasc.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) {
      idadeCalc--;
    }
    return idadeCalc >= 0 ? idadeCalc.toString() : '';
  };

  useEffect(() => {
    fetchPessoa();
    fetchUsuarios();
    fetchPadrinhosEMadrinhas();
    fetchEventoAtivo();
  }, [id]);

  const fetchEventoAtivo = async () => {
    const { data: eventos } = await supabase.from('apc_evento').select('id, descricao').eq('status', 'ATIVO');
    if (eventos && eventos.length > 0) {
      setEventosAtivos(eventos);
      const { data: inscricoes } = await supabase
        .from('apc_acampamento')
        .select('evento_id')
        .in('evento_id', eventos.map(e => e.id))
        .eq('pessoa_id', id);

      if (inscricoes) {
        setInscricoesAtivas(inscricoes.map(i => i.evento_id));
      }
    }
  };

  const handleRemoveInscricao = async (eventoId) => {
    if (!window.confirm('Tem certeza que deseja cancelar a inscrição deste afilhado neste evento? Isso removerá a inscrição e quaisquer pagamentos vinculados a ela.')) return;

    try {
      setLoading(true);
      setError('');

      const { error: delError } = await supabase
        .from('apc_acampamento')
        .delete()
        .eq('evento_id', eventoId)
        .eq('pessoa_id', id);

      if (delError) throw delError;

      setInscricoesAtivas(prev => prev.filter(eId => eId !== eventoId));
      setSuccess('Inscrição cancelada com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Erro ao cancelar inscrição: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

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

  const fetchPessoa = async () => {
    try {
      setLoadingData(true);
      const { data, error } = await supabase
        .from('apc_pessoa')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (data) {
        const dataNasc = data.data_nascimento ? data.data_nascimento.split('T')[0] : '';
        const idadeAuto = data.idade !== null && data.idade !== undefined ? data.idade.toString() : calcularIdade(dataNasc);

        setFormData({
          nome: data.nome || '',
          email: data.email || '',
          telefone: data.telefone || '',
          sexo: data.sexo || '',
          data_nascimento: dataNasc,
          idade: idadeAuto,
          tipo_pessoa: data.tipo_pessoa || 'AFILHADO',
          padrinhos_catequistas: data.padrinhos_catequistas || '',
          ano: data.ano ? data.ano.toString() : '',
          conjuge_id: data.conjuge_id || '',
          user_id: data.user_id || '',
          vinculo_id: '',
          vinculo_padrinho_id: '',
          vinculo_madrinha_id: '',
          rg: data.rg || '',
          cpf: data.cpf || '',
          contato_emergencia: data.contato_emergencia || '',
          nome_responsavel: data.nome_responsavel || (data.nome_pai || data.nome_mae || ''),
          nome_pai: data.nome_pai || '',
          nome_mae: data.nome_mae || '',
          fone_responsavel: data.fone_responsavel || '',
          tipo_sanguineo: data.tipo_sanguineo || '',
          problema_saude: data.problema_saude ? 'SIM' : 'NAO',
          problema_saude_qual: data.problema_saude_qual || '',
          historico_convulsao: data.historico_convulsao ? 'SIM' : 'NAO',
          historico_convulsao_tempo: data.historico_convulsao_tempo || '',
          tratamento_medico: data.tratamento_medico ? 'SIM' : 'NAO',
          tratamento_medico_qual: data.tratamento_medico_qual || '',
          medicamento_continuo: data.medicamento_continuo ? 'SIM' : 'NAO',
          medicamento_continuo_qual: data.medicamento_continuo_qual || '',
          medicamento_continuo_dosagem: data.medicamento_continuo_dosagem || '',
          lesao_contusao: data.lesao_contusao ? 'SIM' : 'NAO',
          lesao_contusao_qual: data.lesao_contusao_qual || '',
          restricao_alimentar: data.restricao_alimentar ? 'SIM' : 'NAO',
          restricao_alimentar_qual: data.restricao_alimentar_qual || '',
          doenca_respiratoria: data.doenca_respiratoria ? 'SIM' : 'NAO',
          usa_bombinha: data.usa_bombinha ? 'SIM' : 'NAO',
          alergia_medicamento: data.alergia_medicamento ? 'SIM' : 'NAO',
          alergia_medicamento_qual: data.alergia_medicamento_qual || '',
          alergia_alimento: data.alergia_alimento ? 'SIM' : 'NAO',
          alergia_alimento_qual: data.alergia_alimento_qual || '',
          medicacao_sintomas: data.medicacao_sintomas || '',
          cuidado_especial: data.cuidado_especial ? 'SIM' : 'NAO',
          cuidado_especial_qual: data.cuidado_especial_qual || '',
          camiseta: data.camiseta || '',
          camiseta_infantil: data.camiseta_infantil || '',
          necessidade_medica: data.necessidade_medica || '',
          outras_informacoes: data.outras_informacoes || (data.necessidade_medica || ''),
          aceite_termos_dados: !!data.aceite_termos_dados,
          aceite_termo_imagem: !!data.aceite_termo_imagem
        });

        if (data.tipo_pessoa === 'AFILHADO') {
          const { data: vinculo } = await supabase
            .from('apc_vinculo')
            .select('id, ano, padrinho_id, madrinha_id')
            .eq('afilhado_id', id)
            .maybeSingle();

          if (vinculo) {
            setFormData(prev => ({
              ...prev,
              vinculo_id: vinculo.id,
              vinculo_padrinho_id: vinculo.padrinho_id || '',
              vinculo_madrinha_id: vinculo.madrinha_id || ''
            }));
          }
        }

        // Dependentes
        let orQuery = `pessoa_id.eq.${id}`;
        if (data.conjuge_id) {
          orQuery += `,pessoa_id.eq.${data.conjuge_id}`;
        }
        const { data: deps } = await supabase
          .from('apc_dependente')
          .select('*')
          .or(orQuery);

        if (deps) {
          const formattedDeps = deps.map(d => ({
            ...d,
            data_nascimento: d.data_nascimento ? d.data_nascimento.split('T')[0] : ''
          }));
          setDependentes(formattedDeps);
        }
      }
    } catch (err) {
      setError('Erro ao carregar os dados da pessoa: ' + err.message);
    } finally {
      setLoadingData(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === 'checkbox' ? checked : value;

    setFormData(prev => {
      const updated = {
        ...prev,
        [name]: val,
        ...(name === 'tipo_pessoa' ? { conjuge_id: '' } : {})
      };

      if (name === 'data_nascimento') {
        updated.idade = calcularIdade(val);
      }

      return updated;
    });
  };

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
          if (padrinho.ano) newState.ano = padrinho.ano.toString();
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
          if (madrinha.ano) newState.ano = madrinha.ano.toString();
        }
      }
      return newState;
    });
  };

  const handleAddDependente = () => {
    setDependentes([...dependentes, { nome: '', data_nascimento: '', mascote: false }]);
  };

  const handleRemoveDependente = (index) => {
    const depToRemove = dependentes[index];
    if (depToRemove.id) {
      setDeletedDependentes([...deletedDependentes, depToRemove.id]);
    }
    setDependentes(dependentes.filter((_, i) => i !== index));
  };

  const handleDependenteChange = (index, field, value) => {
    const newDeps = [...dependentes];
    newDeps[index][field] = value;
    setDependentes(newDeps);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.nome || !formData.nome.trim()) {
      setError('Por favor, informe o Nome Completo.');
      window.scrollTo({ top: 300, behavior: 'smooth' });
      return;
    }

    setLoading(true);

    try {
      const payloadCompleto = {
        nome: formData.nome,
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
        necessidade_medica: formData.outras_informacoes || formData.necessidade_medica || null,
        camiseta: formData.camiseta || null,

        // Novos campos
        padrinhos_catequistas: formData.padrinhos_catequistas || null,
        rg: formData.rg || null,
        cpf: formData.cpf || null,
        idade: formData.idade ? parseInt(formData.idade) : null,
        contato_emergencia: formData.contato_emergencia || null,
        nome_responsavel: formData.nome_responsavel || null,
        tipo_sanguineo: formData.tipo_sanguineo || null,
        problema_saude: formData.problema_saude === 'SIM',
        problema_saude_qual: formData.problema_saude === 'SIM' ? formData.problema_saude_qual : null,
        historico_convulsao: formData.historico_convulsao === 'SIM',
        historico_convulsao_tempo: formData.historico_convulsao === 'SIM' ? formData.historico_convulsao_tempo : null,
        tratamento_medico: formData.tratamento_medico === 'SIM',
        tratamento_medico_qual: formData.tratamento_medico === 'SIM' ? formData.tratamento_medico_qual : null,
        medicamento_continuo: formData.medicamento_continuo === 'SIM',
        medicamento_continuo_qual: formData.medicamento_continuo === 'SIM' ? formData.medicamento_continuo_qual : null,
        medicamento_continuo_dosagem: formData.medicamento_continuo === 'SIM' ? formData.medicamento_continuo_dosagem : null,
        lesao_contusao: formData.lesao_contusao === 'SIM',
        lesao_contusao_qual: formData.lesao_contusao === 'SIM' ? formData.lesao_contusao_qual : null,
        restricao_alimentar: formData.restricao_alimentar === 'SIM',
        restricao_alimentar_qual: formData.restricao_alimentar === 'SIM' ? formData.restricao_alimentar_qual : null,
        doenca_respiratoria: formData.doenca_respiratoria === 'SIM',
        usa_bombinha: formData.doenca_respiratoria === 'SIM' ? (formData.usa_bombinha === 'SIM') : false,
        alergia_medicamento: formData.alergia_medicamento === 'SIM',
        alergia_medicamento_qual: formData.alergia_medicamento === 'SIM' ? formData.alergia_medicamento_qual : null,
        alergia_alimento: formData.alergia_alimento === 'SIM',
        alergia_alimento_qual: formData.alergia_alimento === 'SIM' ? formData.alergia_alimento_qual : null,
        medicacao_sintomas: formData.medicacao_sintomas || null,
        cuidado_especial: formData.cuidado_especial === 'SIM',
        cuidado_especial_qual: formData.cuidado_especial === 'SIM' ? formData.cuidado_especial_qual : null,
        camiseta_infantil: formData.camiseta_infantil || null,
        outras_informacoes: formData.outras_informacoes || null,
        aceite_termos_dados: !!formData.aceite_termos_dados,
        aceite_termo_imagem: !!formData.aceite_termo_imagem
      };

      const { error: dbError } = await supabase
        .from('apc_pessoa')
        .update(payloadCompleto)
        .eq('id', id);

      if (dbError) {
        // Fallback caso colunas novas ainda não existam no Supabase
        if (dbError.message && (dbError.message.includes('column') && dbError.message.includes('does not exist'))) {
          console.warn('Banco precisa de migração SQL. Salvando dados compatíveis...');
          const { error: fallbackErr } = await supabase
            .from('apc_pessoa')
            .update({
              nome: formData.nome,
              email: formData.email || null,
              telefone: formData.telefone || null,
              sexo: formData.sexo || null,
              data_nascimento: formData.data_nascimento || null,
              tipo_pessoa: formData.tipo_pessoa,
              ano: formData.ano ? parseInt(formData.ano) : null,
              conjuge_id: formData.conjuge_id || null,
              user_id: formData.user_id || null,
              nome_pai: formData.nome_pai || formData.nome_responsavel || null,
              nome_mae: formData.nome_mae || null,
              fone_responsavel: formData.fone_responsavel || null,
              necessidade_medica: formData.outras_informacoes || formData.necessidade_medica || null,
              camiseta: formData.camiseta || null
            })
            .eq('id', id);

          if (fallbackErr) throw fallbackErr;
        } else {
          throw dbError;
        }
      }

      // Se selecionou um cônjuge, atualizar bidirecionalmente
      if (formData.conjuge_id) {
        await supabase
          .from('apc_pessoa')
          .update({ conjuge_id: id })
          .eq('id', formData.conjuge_id);
      }

      // VINCULO: Salvar/Atualizar
      if (formData.tipo_pessoa === 'AFILHADO' && formData.vinculo_padrinho_id && formData.vinculo_madrinha_id && formData.ano) {
        if (formData.vinculo_id) {
          await supabase.from('apc_vinculo').update({
            padrinho_id: formData.vinculo_padrinho_id,
            madrinha_id: formData.vinculo_madrinha_id,
            ano: parseInt(formData.ano)
          }).eq('id', formData.vinculo_id);
        } else {
          await supabase.from('apc_vinculo').insert([{
            padrinho_id: formData.vinculo_padrinho_id,
            madrinha_id: formData.vinculo_madrinha_id,
            afilhado_id: id,
            ano: parseInt(formData.ano)
          }]);
        }
      }

      // VINCULO DEPENDENTES
      if (deletedDependentes.length > 0) {
        await supabase.from('apc_dependente').delete().in('id', deletedDependentes);
      }

      if (dependentes.length > 0) {
        const depsToInsert = [];
        const depsToUpdate = [];

        dependentes
          .filter(d => d.nome.trim() !== '')
          .forEach(d => {
            const dep = {
              pessoa_id: d.pessoa_id || id,
              nome: d.nome,
              data_nascimento: d.data_nascimento || null,
              mascote: d.mascote
            };
            if (d.id) {
              dep.id = d.id;
              depsToUpdate.push(dep);
            } else {
              depsToInsert.push(dep);
            }
          });

        if (depsToInsert.length > 0) {
          await supabase.from('apc_dependente').insert(depsToInsert);
        }
        if (depsToUpdate.length > 0) {
          await supabase.from('apc_dependente').upsert(depsToUpdate);
        }
      }

      // CONFIRMAR NOS EVENTOS ATIVOS
      if (eventosAConfirmar.length > 0) {
        const inscricoesParaInserir = eventosAConfirmar.map(eventoId => ({
          evento_id: eventoId,
          pessoa_id: id,
          equipe: []
        }));

        const { error: errorInscricao } = await supabase.from('apc_acampamento').insert(inscricoesParaInserir);
        if (errorInscricao) {
          throw new Error('Erro ao confirmar inscrição: ' + errorInscricao.message);
        }
        setInscricoesAtivas(prev => [...prev, ...eventosAConfirmar]);
        setEventosAConfirmar([]);
      }

      setSuccess('Dados da pessoa atualizados com sucesso!');

      if (refreshProfile) {
        await refreshProfile();
      }

      setTimeout(() => navigate(-1), 2000);
    } catch (err) {
      setError('Erro ao atualizar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return <div className="main-content"><p>Carregando dados...</p></div>;
  }

  const isMenorDeIdade = formData.idade !== '' && parseInt(formData.idade) < 18;

  return (
    <div className="main-content" style={{ maxWidth: '960px', margin: '0 auto', paddingBottom: '4rem' }}>
      
      {/* Barra Superior */}
      <div className="glass-panel form-section-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => navigate(-1)} className="btn btn-secondary" style={{ padding: '0.5rem' }}>
            <ArrowLeft size={20} />
          </button>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0, flexWrap: 'wrap' }}>
            <Edit size={26} color="var(--accent-primary)" />
            Editar Participante / Inscrição
          </h1>
        </div>

        <Link
          to={`/inscricao/${id}`}
          className="btn btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', padding: '0.5rem 1rem' }}
        >
          <FileText size={18} color="var(--accent-primary)" />
          Ver Ficha Oficial de Inscrição
        </Link>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: '1.5rem' }}>{success}</div>}

      <form onSubmit={handleSubmit} noValidate>
        {/* Padrinhos do Sistema (Se Afilhado) */}
        {formData.tipo_pessoa === 'AFILHADO' && (
          <div style={{ background: 'rgba(59, 130, 246, 0.05)', padding: '1.25rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: 'var(--accent-primary)' }}>
              {userProfile?.perfil === 'ADMIN' || userProfile?.perfil === 'GESTOR' ? 'Padrinhos no Sistema' : 'Meus Padrinhos'}
            </h4>

            {userProfile?.perfil === 'ADMIN' || userProfile?.perfil === 'GESTOR' ? (
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
            ) : (
              <>
                {(!formData.vinculo_padrinho_id && !formData.vinculo_madrinha_id) ? (
                  <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)' }}>
                    <p>Você ainda não foi vinculado a nenhum Padrinho/Madrinha.</p>
                  </div>
                ) : (
                  <div className="form-grid">
                    {(() => {
                      const padrinhoObj = padrinhos.find(p => p.id === formData.vinculo_padrinho_id);
                      return padrinhoObj && (
                        <div style={{ background: 'var(--bg-secondary)', borderRadius: '8px', padding: '0.75rem' }}>
                          <p style={{ margin: 0, fontWeight: 'bold' }}>Padrinho: {padrinhoObj.nome}</p>
                        </div>
                      );
                    })()}
                    {(() => {
                      const madrinhaObj = madrinhas.find(m => m.id === formData.vinculo_madrinha_id);
                      return madrinhaObj && (
                        <div style={{ background: 'var(--bg-secondary)', borderRadius: '8px', padding: '0.75rem' }}>
                          <p style={{ margin: 0, fontWeight: 'bold' }}>Madrinha: {madrinhaObj.nome}</p>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Inscrição em Eventos Ativos */}
        {eventosAtivos.length > 0 && (
          <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
            <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', fontWeight: 'bold' }}>Inscrição no Acampamento</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {eventosAtivos.map(evento => {
                const isInscrito = inscricoesAtivas.includes(evento.id);
                const isToConfirm = eventosAConfirmar.includes(evento.id);

                return (
                  <div key={evento.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-secondary)', padding: '0.75rem 1rem', borderRadius: '8px' }}>
                    {isInscrito ? (
                      <span style={{ color: '#16a34a', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        Inscrito(a) no {evento.descricao}
                      </span>
                    ) : (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={isToConfirm}
                          onChange={(e) => {
                            if (e.target.checked) setEventosAConfirmar(prev => [...prev, evento.id]);
                            else setEventosAConfirmar(prev => prev.filter(eid => eid !== evento.id));
                          }}
                        />
                        <span>Confirmar Inscrição no <strong>{evento.descricao}</strong></span>
                      </label>
                    )}

                    {isInscrito && (
                      <button
                        type="button"
                        onClick={() => handleRemoveInscricao(evento.id)}
                        className="btn btn-secondary"
                        style={{ padding: '0.25rem 0.5rem', color: 'var(--error)' }}
                        title="Cancelar Inscrição"
                        disabled={loading}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SEÇÃO 1: DADOS PESSOAIS */}
        {/* ========================================================================= */}
        <div className="glass-panel form-section-card">
          <div className="section-header">
            <User size={22} color="var(--accent-primary)" />
            <h3>1. Dados do Participante</h3>
          </div>

          <div className="form-grid">
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label" htmlFor="nome">Nome Completo do Participante *</label>
              <input
                id="nome"
                name="nome"
                type="text"
                className="form-input"
                placeholder="Nome Completo"
                value={formData.nome}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="tipo_pessoa">De que forma irá participar no acampamento (Como?) *</label>
              <select
                id="tipo_pessoa"
                name="tipo_pessoa"
                className="form-input"
                value={formData.tipo_pessoa}
                disabled={userProfile?.perfil !== 'ADMIN' && userProfile?.perfil !== 'GESTOR'}
                onChange={handleChange}
                required
              >
                <option value="AFILHADO">Afilhado</option>
                <option value="CATEQUISTA">Catequista</option>
                <option value="CRISMADO">Crismado</option>
                <option value="FILHO">Filho</option>
                <option value="PADRE">Padre</option>
                <option value="PADRINHO">Padrinho</option>
                <option value="MADRINHA">Madrinha</option>
                <option value="VOLUNTARIO">Voluntário</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="padrinhos_catequistas">Nome dos Padrinhos ou Catequistas</label>
              <input
                id="padrinhos_catequistas"
                name="padrinhos_catequistas"
                type="text"
                className="form-input"
                placeholder="Ex: Padrinhos João e Maria ou Catequista André"
                value={formData.padrinhos_catequistas}
                onChange={handleChange}
              />
            </div>
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
              <label className="form-label" htmlFor="idade">Idade do Participante</label>
              <input
                id="idade"
                name="idade"
                type="number"
                min="0"
                max="120"
                className="form-input"
                placeholder="Calculada automaticamente"
                value={formData.idade}
                onChange={handleChange}
              />
              {isMenorDeIdade && (
                <span style={{ fontSize: '0.75rem', color: '#d97706', fontWeight: 'bold' }}>
                  ⚠️ Menor de idade (preencha responsáveis e termos)
                </span>
              )}
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="rg">RG do Participante</label>
              <input
                id="rg"
                name="rg"
                type="text"
                className="form-input"
                placeholder="RG / Órgão Emissor"
                value={formData.rg}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="cpf">CPF do Participante</label>
              <input
                id="cpf"
                name="cpf"
                type="text"
                className="form-input"
                placeholder="000.000.000-00"
                value={formData.cpf}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="telefone">Telefone do Participante</label>
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
          </div>

          <div className="form-grid">
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

            <div className="form-group">
              <label className="form-label" htmlFor="ano">Ano (Turma)</label>
              <input
                id="ano"
                name="ano"
                type="number"
                className="form-input"
                placeholder="Ex: 2026"
                disabled={userProfile?.perfil !== 'ADMIN' && userProfile?.perfil !== 'GESTOR'}
                value={formData.ano}
                onChange={handleChange}
              />
            </div>
          </div>

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
                <option value="">-- Não vincular nenhuma conta --</option>
                {usuarios.map(u => (
                  <option key={u.user_id} value={u.user_id}>
                    {u.nome} {u.email ? `(${u.email})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* SEÇÃO 2: CONTATOS DE EMERGÊNCIA E RESPONSÁVEIS */}
        {/* ========================================================================= */}
        <div className="glass-panel form-section-card">
          <div className="section-header">
            <Phone size={22} color="var(--accent-primary)" />
            <h3>2. Contatos de Emergência e Responsáveis</h3>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="contato_emergencia">
              Em caso de Emergência ligar para quem? Nome e Telefone
            </label>
            <input
              id="contato_emergencia"
              name="contato_emergencia"
              type="text"
              className="form-input"
              placeholder="Ex: Nome do contato - (61) 98888-8888"
              value={formData.contato_emergencia}
              onChange={handleChange}
            />
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="nome_responsavel">Nome Completo dos pais ou responsáveis (para menores)</label>
              <input
                id="nome_responsavel"
                name="nome_responsavel"
                type="text"
                className="form-input"
                placeholder="Nome do Responsável Legal"
                value={formData.nome_responsavel}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="fone_responsavel">Telefone pais ou responsáveis (para menores)</label>
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
        </div>

        {/* ========================================================================= */}
        {/* SEÇÃO 3: FICHA DE SAÚDE */}
        {/* ========================================================================= */}
        <div className="glass-panel form-section-card">
          <div className="section-header">
            <HeartPulse size={22} color="#e11d48" />
            <h3>3. Ficha Médica e Cuidados de Saúde</h3>
          </div>

          <div className="form-group" style={{ maxWidth: '300px' }}>
            <label className="form-label" htmlFor="tipo_sanguineo">Tipo Sanguíneo / Fator RH</label>
            <select
              id="tipo_sanguineo"
              name="tipo_sanguineo"
              className="form-input"
              value={formData.tipo_sanguineo}
              onChange={handleChange}
            >
              <option value="">-- Não Informado / Não sei --</option>
              <option value="A+">A+</option>
              <option value="A-">A-</option>
              <option value="B+">B+</option>
              <option value="B-">B-</option>
              <option value="AB+">AB+</option>
              <option value="AB-">AB-</option>
              <option value="O+">O+</option>
              <option value="O-">O-</option>
            </select>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '1.25rem 0' }} />

          {/* Problema Crônico */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label className="form-label">Tem algum problema crônico de saúde?</label>
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.5rem' }}>
              <label style={{ cursor: 'pointer' }}>
                <input type="radio" name="problema_saude" value="NAO" checked={formData.problema_saude === 'NAO'} onChange={handleChange} /> Não
              </label>
              <label style={{ cursor: 'pointer' }}>
                <input type="radio" name="problema_saude" value="SIM" checked={formData.problema_saude === 'SIM'} onChange={handleChange} /> Sim
              </label>
            </div>
            {formData.problema_saude === 'SIM' && (
              <input
                type="text"
                name="problema_saude_qual"
                className="form-input"
                placeholder="Qual o problema crônico?"
                value={formData.problema_saude_qual}
                onChange={handleChange}
              />
            )}
          </div>

          {/* Convulsão / Epilepsia */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label className="form-label">Tem ou já teve: convulsão, epilepsia, sangramentos constantes?</label>
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.5rem' }}>
              <label style={{ cursor: 'pointer' }}>
                <input type="radio" name="historico_convulsao" value="NAO" checked={formData.historico_convulsao === 'NAO'} onChange={handleChange} /> Não
              </label>
              <label style={{ cursor: 'pointer' }}>
                <input type="radio" name="historico_convulsao" value="SIM" checked={formData.historico_convulsao === 'SIM'} onChange={handleChange} /> Sim
              </label>
            </div>
            {formData.historico_convulsao === 'SIM' && (
              <input
                type="text"
                name="historico_convulsao_tempo"
                className="form-input"
                placeholder="Há quanto tempo?"
                value={formData.historico_convulsao_tempo}
                onChange={handleChange}
              />
            )}
          </div>

          {/* Tratamento Médico */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label className="form-label">Está fazendo algum tratamento médico? (Ex: Psicológico, Cardíaco, outros)</label>
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.5rem' }}>
              <label style={{ cursor: 'pointer' }}>
                <input type="radio" name="tratamento_medico" value="NAO" checked={formData.tratamento_medico === 'NAO'} onChange={handleChange} /> Não
              </label>
              <label style={{ cursor: 'pointer' }}>
                <input type="radio" name="tratamento_medico" value="SIM" checked={formData.tratamento_medico === 'SIM'} onChange={handleChange} /> Sim
              </label>
            </div>
            {formData.tratamento_medico === 'SIM' && (
              <input
                type="text"
                name="tratamento_medico_qual"
                className="form-input"
                placeholder="Qual tratamento médico?"
                value={formData.tratamento_medico_qual}
                onChange={handleChange}
              />
            )}
          </div>

          {/* Medicamento Contínuo */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label className="form-label">Faz uso de medicamento contínuo?</label>
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.5rem' }}>
              <label style={{ cursor: 'pointer' }}>
                <input type="radio" name="medicamento_continuo" value="NAO" checked={formData.medicamento_continuo === 'NAO'} onChange={handleChange} /> Não
              </label>
              <label style={{ cursor: 'pointer' }}>
                <input type="radio" name="medicamento_continuo" value="SIM" checked={formData.medicamento_continuo === 'SIM'} onChange={handleChange} /> Sim
              </label>
            </div>
            {formData.medicamento_continuo === 'SIM' && (
              <div className="form-grid">
                <input
                  type="text"
                  name="medicamento_continuo_qual"
                  className="form-input"
                  placeholder="Qual medicamento?"
                  value={formData.medicamento_continuo_qual}
                  onChange={handleChange}
                />
                <input
                  type="text"
                  name="medicamento_continuo_dosagem"
                  className="form-input"
                  placeholder="Qual a dosagem?"
                  value={formData.medicamento_continuo_dosagem}
                  onChange={handleChange}
                />
              </div>
            )}
          </div>

          {/* Lesão ou Contusão */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label className="form-label">Possui atualmente alguma lesão ou contusão?</label>
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.5rem' }}>
              <label style={{ cursor: 'pointer' }}>
                <input type="radio" name="lesao_contusao" value="NAO" checked={formData.lesao_contusao === 'NAO'} onChange={handleChange} /> Não
              </label>
              <label style={{ cursor: 'pointer' }}>
                <input type="radio" name="lesao_contusao" value="SIM" checked={formData.lesao_contusao === 'SIM'} onChange={handleChange} /> Sim
              </label>
            </div>
            {formData.lesao_contusao === 'SIM' && (
              <input
                type="text"
                name="lesao_contusao_qual"
                className="form-input"
                placeholder="Qual lesão ou contusão?"
                value={formData.lesao_contusao_qual}
                onChange={handleChange}
              />
            )}
          </div>

          {/* Restrição Alimentar */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label className="form-label">Possui restrição alimentar? (Ex: Glúten, Lactose, outros)</label>
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.5rem' }}>
              <label style={{ cursor: 'pointer' }}>
                <input type="radio" name="restricao_alimentar" value="NAO" checked={formData.restricao_alimentar === 'NAO'} onChange={handleChange} /> Não
              </label>
              <label style={{ cursor: 'pointer' }}>
                <input type="radio" name="restricao_alimentar" value="SIM" checked={formData.restricao_alimentar === 'SIM'} onChange={handleChange} /> Sim
              </label>
            </div>
            {formData.restricao_alimentar === 'SIM' && (
              <input
                type="text"
                name="restricao_alimentar_qual"
                className="form-input"
                placeholder="Qual restrição alimentar?"
                value={formData.restricao_alimentar_qual}
                onChange={handleChange}
              />
            )}
          </div>

          {/* Doença Respiratória e Bombinha */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label className="form-label">Tem doença respiratória?</label>
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.5rem' }}>
              <label style={{ cursor: 'pointer' }}>
                <input type="radio" name="doenca_respiratoria" value="NAO" checked={formData.doenca_respiratoria === 'NAO'} onChange={handleChange} /> Não
              </label>
              <label style={{ cursor: 'pointer' }}>
                <input type="radio" name="doenca_respiratoria" value="SIM" checked={formData.doenca_respiratoria === 'SIM'} onChange={handleChange} /> Sim
              </label>
            </div>
            {formData.doenca_respiratoria === 'SIM' && (
              <div style={{ background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: '8px' }}>
                <label className="form-label">Faz uso de bombinha?</label>
                <div style={{ display: 'flex', gap: '1.5rem' }}>
                  <label style={{ cursor: 'pointer' }}>
                    <input type="radio" name="usa_bombinha" value="NAO" checked={formData.usa_bombinha === 'NAO'} onChange={handleChange} /> Não
                  </label>
                  <label style={{ cursor: 'pointer' }}>
                    <input type="radio" name="usa_bombinha" value="SIM" checked={formData.usa_bombinha === 'SIM'} onChange={handleChange} /> Sim
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Alergias */}
          <div className="form-grid">
            <div>
              <label className="form-label">Tem alergia à algum medicamento?</label>
              <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.5rem' }}>
                <label style={{ cursor: 'pointer' }}>
                  <input type="radio" name="alergia_medicamento" value="NAO" checked={formData.alergia_medicamento === 'NAO'} onChange={handleChange} /> Não
                </label>
                <label style={{ cursor: 'pointer' }}>
                  <input type="radio" name="alergia_medicamento" value="SIM" checked={formData.alergia_medicamento === 'SIM'} onChange={handleChange} /> Sim
                </label>
              </div>
              {formData.alergia_medicamento === 'SIM' && (
                <input
                  type="text"
                  name="alergia_medicamento_qual"
                  className="form-input"
                  placeholder="Qual medicamento?"
                  value={formData.alergia_medicamento_qual}
                  onChange={handleChange}
                />
              )}
            </div>

            <div>
              <label className="form-label">Tem alergia à algum alimento?</label>
              <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.5rem' }}>
                <label style={{ cursor: 'pointer' }}>
                  <input type="radio" name="alergia_alimento" value="NAO" checked={formData.alergia_alimento === 'NAO'} onChange={handleChange} /> Não
                </label>
                <label style={{ cursor: 'pointer' }}>
                  <input type="radio" name="alergia_alimento" value="SIM" checked={formData.alergia_alimento === 'SIM'} onChange={handleChange} /> Sim
                </label>
              </div>
              {formData.alergia_alimento === 'SIM' && (
                <input
                  type="text"
                  name="alergia_alimento_qual"
                  className="form-input"
                  placeholder="Qual alimento?"
                  value={formData.alergia_alimento_qual}
                  onChange={handleChange}
                />
              )}
            </div>
          </div>

          {/* Medicação para Febre / Sintomas */}
          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label className="form-label" htmlFor="medicacao_sintomas">
              Em caso de Febre, Dor de Cabeça, Dor Muscular ou Desconforto Gastrointestinal, qual o tipo de medicação costuma tomar e qual a dosagem?
            </label>
            <textarea
              id="medicacao_sintomas"
              name="medicacao_sintomas"
              className="form-input"
              placeholder="Ex: Paracetamol 750mg para dor de cabeça, Dipirona 500mg para febre..."
              value={formData.medicacao_sintomas}
              onChange={handleChange}
              rows="3"
            />
          </div>

          {/* Cuidados Especiais */}
          <div style={{ marginTop: '1rem' }}>
            <label className="form-label">Demanda algum tipo de cuidado especial?</label>
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.5rem' }}>
              <label style={{ cursor: 'pointer' }}>
                <input type="radio" name="cuidado_especial" value="NAO" checked={formData.cuidado_especial === 'NAO'} onChange={handleChange} /> Não
              </label>
              <label style={{ cursor: 'pointer' }}>
                <input type="radio" name="cuidado_especial" value="SIM" checked={formData.cuidado_especial === 'SIM'} onChange={handleChange} /> Sim
              </label>
            </div>
            {formData.cuidado_especial === 'SIM' && (
              <input
                type="text"
                name="cuidado_especial_qual"
                className="form-input"
                placeholder="Qual cuidado especial?"
                value={formData.cuidado_especial_qual}
                onChange={handleChange}
              />
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SEÇÃO 4: CAMISETAS */}
        {/* ========================================================================= */}
        <div className="glass-panel form-section-card">
          <div className="section-header">
            <Shirt size={22} color="var(--accent-primary)" />
            <h3>4. Tamanho da Camiseta</h3>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="camiseta">Tamanho da Camiseta (Adulto)</label>
              <select
                id="camiseta"
                name="camiseta"
                className="form-input"
                value={formData.camiseta}
                onChange={handleChange}
              >
                <option value="">-- Selecione --</option>
                <option value="PP">PP</option>
                <option value="P">P</option>
                <option value="M">M</option>
                <option value="G">G</option>
                <option value="GG">GG</option>
                <option value="XGG">XGG</option>
                <option value="XXGG">XXGG</option>
                <option value="G1">G1 - Tamanho Especial</option>
                <option value="G2">G2 - Tamanho Especial</option>
                <option value="G3">G3 - Tamanho Especial</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="camiseta_infantil">Tamanho da Camiseta Infantil (0 a 15 anos)</label>
              <select
                id="camiseta_infantil"
                name="camiseta_infantil"
                className="form-input"
                value={formData.camiseta_infantil}
                onChange={handleChange}
              >
                <option value="">-- Não se aplica (Adulto) --</option>
                <option value="0 a 1 ano">0 a 1 ano</option>
                <option value="2 anos">2 anos</option>
                <option value="4 anos">4 anos</option>
                <option value="6 anos">6 anos</option>
                <option value="8 anos">8 anos</option>
                <option value="10 anos">10 anos</option>
                <option value="12 anos">12 anos</option>
                <option value="14 anos">14 anos</option>
                <option value="16 anos">16 anos</option>
              </select>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SEÇÃO 5: OUTRAS OBSERVAÇÕES */}
        {/* ========================================================================= */}
        <div className="glass-panel form-section-card">
          <div className="section-header">
            <Info size={22} color="var(--accent-primary)" />
            <h3>5. Outras Informações Importantes</h3>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="outras_informacoes">Outras informações ou orientações importantes:</label>
            <textarea
              id="outras_informacoes"
              name="outras_informacoes"
              className="form-input"
              placeholder="Digite outras informações importantes sobre o participante..."
              value={formData.outras_informacoes}
              onChange={handleChange}
              rows="3"
            />
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SEÇÃO 6: TERMOS DE ACEITE */}
        {/* ========================================================================= */}
        <div className="glass-panel form-section-card" style={{ background: 'rgba(59, 130, 246, 0.03)' }}>
          <div className="section-header">
            <ShieldCheck size={22} color="var(--accent-primary)" />
            <h3>6. Termos e Autorizações</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <input
                type="checkbox"
                id="aceite_termos_dados"
                name="aceite_termos_dados"
                checked={formData.aceite_termos_dados}
                onChange={handleChange}
                style={{ width: '1.3rem', height: '1.3rem', marginTop: '0.2rem', cursor: 'pointer' }}
              />
              <label htmlFor="aceite_termos_dados" style={{ cursor: 'pointer', fontSize: '0.9rem' }}>
                <strong>PAIS OU RESPONSÁVEIS:</strong> Concordo com o tratamento de meus dados pessoais e os dados do menor sob os meus cuidados para as finalidades a seguir determinadas: registro no <strong>VIII Acampamento do Pós-Crisma</strong>, possível apresentação no El Rancho e à empresa de transporte.
              </label>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <input
                type="checkbox"
                id="aceite_termo_imagem"
                name="aceite_termo_imagem"
                checked={formData.aceite_termo_imagem}
                onChange={handleChange}
                style={{ width: '1.3rem', height: '1.3rem', marginTop: '0.2rem', cursor: 'pointer' }}
              />
              <label htmlFor="aceite_termo_imagem" style={{ cursor: 'pointer', fontSize: '0.9rem' }}>
                <strong>PAIS OU RESPONSÁVEIS:</strong> Autorizo o uso da imagem de meu/minha filho(a) para uso em campanhas de divulgação do evento em sites e redes sociais da Paróquia Santa Maria dos Pobres.
              </label>
            </div>
          </div>
        </div>

        {/* Cônjuge (Se Padrinho/Madrinha) */}
        {(formData.tipo_pessoa === 'PADRINHO' || formData.tipo_pessoa === 'MADRINHA') && (
          <div className="glass-panel form-section-card">
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

            {/* Dependentes */}
            <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
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
          </div>
        )}

        {error && (
          <div
            className="alert alert-error"
            style={{
              marginBottom: '1rem',
              whiteSpace: 'pre-line',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid var(--error)',
              padding: '1rem',
              borderRadius: '8px',
              color: '#b91c1c'
            }}
          >
            {error}
          </div>
        )}

        {success && (
          <div
            className="alert alert-success"
            style={{
              marginBottom: '1rem',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid var(--success)',
              padding: '1rem',
              borderRadius: '8px',
              color: '#047857'
            }}
          >
            {success}
          </div>
        )}

        <div className="form-actions-footer">
          <button type="button" onClick={() => navigate(-1)} className="btn btn-secondary">
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ padding: '0.75rem 2rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            {loading ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </form>
    </div>
  );
};
