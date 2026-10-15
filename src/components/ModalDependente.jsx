import React, { useState, useEffect } from 'react';
import {
  Users,
  User,
  HeartPulse,
  AlertCircle,
  X,
  Check,
  Plus,
  Edit3,
  Trash2
} from 'lucide-react';

export const dependenteVazio = {
  nome: '',
  data_nascimento: '',
  mascote: false,
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
  cuidado_especial: 'NAO',
  cuidado_especial_qual: '',
  medicacao_sintomas: ''
};

export const formatarDataBR = (dataStr) => {
  if (!dataStr) return '';
  const apenasData = dataStr.split('T')[0];
  const partes = apenasData.split('-');
  if (partes.length === 3) {
    const [ano, mes, dia] = partes;
    return `${dia}/${mes}/${ano}`;
  }
  return dataStr;
};

export const calcularIdade = (dataNasc) => {
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

export const normalizarDependente = (d) => ({
  ...d,
  data_nascimento: d?.data_nascimento ? d.data_nascimento.split('T')[0] : '',
  mascote: Boolean(d?.mascote),
  tipo_sanguineo: d?.tipo_sanguineo || '',
  problema_saude: d?.problema_saude === true || d?.problema_saude === 'SIM' ? 'SIM' : 'NAO',
  problema_saude_qual: d?.problema_saude_qual || '',
  historico_convulsao: d?.historico_convulsao === true || d?.historico_convulsao === 'SIM' ? 'SIM' : 'NAO',
  historico_convulsao_tempo: d?.historico_convulsao_tempo || '',
  tratamento_medico: d?.tratamento_medico === true || d?.tratamento_medico === 'SIM' ? 'SIM' : 'NAO',
  tratamento_medico_qual: d?.tratamento_medico_qual || '',
  medicamento_continuo: d?.medicamento_continuo === true || d?.medicamento_continuo === 'SIM' ? 'SIM' : 'NAO',
  medicamento_continuo_qual: d?.medicamento_continuo_qual || '',
  medicamento_continuo_dosagem: d?.medicamento_continuo_dosagem || '',
  lesao_contusao: d?.lesao_contusao === true || d?.lesao_contusao === 'SIM' ? 'SIM' : 'NAO',
  lesao_contusao_qual: d?.lesao_contusao_qual || '',
  restricao_alimentar: d?.restricao_alimentar === true || d?.restricao_alimentar === 'SIM' ? 'SIM' : 'NAO',
  restricao_alimentar_qual: d?.restricao_alimentar_qual || '',
  doenca_respiratoria: d?.doenca_respiratoria === true || d?.doenca_respiratoria === 'SIM' ? 'SIM' : 'NAO',
  usa_bombinha: d?.usa_bombinha === true || d?.usa_bombinha === 'SIM' ? 'SIM' : 'NAO',
  alergia_medicamento: d?.alergia_medicamento === true || d?.alergia_medicamento === 'SIM' ? 'SIM' : 'NAO',
  alergia_medicamento_qual: d?.alergia_medicamento_qual || '',
  alergia_alimento: d?.alergia_alimento === true || d?.alergia_alimento === 'SIM' ? 'SIM' : 'NAO',
  alergia_alimento_qual: d?.alergia_alimento_qual || '',
  cuidado_especial: d?.cuidado_especial === true || d?.cuidado_especial === 'SIM' ? 'SIM' : 'NAO',
  cuidado_especial_qual: d?.cuidado_especial_qual || '',
  medicacao_sintomas: d?.medicacao_sintomas || ''
});

export const prepararPayloadDependente = (d, pessoaId) => {
  const dep = {
    pessoa_id: d.pessoa_id || pessoaId,
    nome: (d.nome || '').trim(),
    data_nascimento: d.data_nascimento || null,
    mascote: Boolean(d.mascote),
    tipo_sanguineo: d.tipo_sanguineo || null,
    problema_saude: d.problema_saude === 'SIM',
    problema_saude_qual: d.problema_saude === 'SIM' ? (d.problema_saude_qual || null) : null,
    historico_convulsao: d.historico_convulsao === 'SIM',
    historico_convulsao_tempo: d.historico_convulsao === 'SIM' ? (d.historico_convulsao_tempo || null) : null,
    tratamento_medico: d.tratamento_medico === 'SIM',
    tratamento_medico_qual: d.tratamento_medico === 'SIM' ? (d.tratamento_medico_qual || null) : null,
    medicamento_continuo: d.medicamento_continuo === 'SIM',
    medicamento_continuo_qual: d.medicamento_continuo === 'SIM' ? (d.medicamento_continuo_qual || null) : null,
    medicamento_continuo_dosagem: d.medicamento_continuo === 'SIM' ? (d.medicamento_continuo_dosagem || null) : null,
    lesao_contusao: d.lesao_contusao === 'SIM',
    lesao_contusao_qual: d.lesao_contusao === 'SIM' ? (d.lesao_contusao_qual || null) : null,
    restricao_alimentar: d.restricao_alimentar === 'SIM',
    restricao_alimentar_qual: d.restricao_alimentar === 'SIM' ? (d.restricao_alimentar_qual || null) : null,
    doenca_respiratoria: d.doenca_respiratoria === 'SIM',
    usa_bombinha: d.doenca_respiratoria === 'SIM' ? (d.usa_bombinha === 'SIM') : false,
    alergia_medicamento: d.alergia_medicamento === 'SIM',
    alergia_medicamento_qual: d.alergia_medicamento === 'SIM' ? (d.alergia_medicamento_qual || null) : null,
    alergia_alimento: d.alergia_alimento === 'SIM',
    alergia_alimento_qual: d.alergia_alimento === 'SIM' ? (d.alergia_alimento_qual || null) : null,
    cuidado_especial: d.cuidado_especial === 'SIM',
    cuidado_especial_qual: d.cuidado_especial === 'SIM' ? (d.cuidado_especial_qual || null) : null,
    medicacao_sintomas: d.medicacao_sintomas || null
  };
  if (d.id) {
    dep.id = d.id;
  }
  return dep;
};

export const ModalDependente = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  edicaoIndex
}) => {
  const [form, setForm] = useState(dependenteVazio);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (isOpen) {
      setForm(initialData ? normalizarDependente(initialData) : { ...dependenteVazio });
      setErro('');
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSalvar = (e) => {
    if (e) e.preventDefault();
    if (!form.nome || !form.nome.trim()) {
      setErro('Por favor, informe o nome do dependente.');
      return;
    }

    const normalizado = {
      ...form,
      nome: form.nome.trim()
    };

    onSave(normalizado, edicaoIndex);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(5px)',
        WebkitBackdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '0.75rem'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '850px',
          maxHeight: '92vh',
          overflowY: 'auto',
          background: 'var(--bg-primary, #0f172a)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          padding: '1.25rem 1.5rem',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}
      >
        {/* Cabeçalho */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              background: 'rgba(16, 185, 129, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary)'
            }}>
              <Users size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)', fontWeight: 'bold' }}>
                {edicaoIndex !== null && edicaoIndex >= 0 ? 'Editar Dependente' : 'Adicionar Dependente'}
              </h3>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                Preencha os dados e a ficha médica completa do dependente
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '0.4rem',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Alerta de Erro */}
        {erro && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid var(--danger)',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              color: 'var(--danger)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.9rem'
            }}
          >
            <AlertCircle size={18} />
            <span>{erro}</span>
          </div>
        )}

        {/* 1. DADOS BÁSICOS */}
        <div style={{ background: 'var(--bg-secondary)', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <User size={17} /> 1. Dados Pessoais do Dependente
          </h4>

          <div className="form-grid" style={{ gap: '0.85rem' }}>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label" style={{ marginBottom: '0.25rem' }}>
                Nome Completo do Dependente *
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="Nome completo do filho / dependente"
                value={form.nome || ''}
                onChange={(e) => handleChange('nome', e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ marginBottom: '0.25rem' }}>
                Data de Nascimento
              </label>
              <input
                type="date"
                className="form-input"
                value={form.data_nascimento || ''}
                onChange={(e) => handleChange('data_nascimento', e.target.value)}
              />
              {form.data_nascimento && (
                <small style={{ color: 'var(--text-secondary)', marginTop: '0.2rem', display: 'block', fontSize: '0.75rem' }}>
                  Idade calculada: {calcularIdade(form.data_nascimento)} anos
                </small>
              )}
            </div>

            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  cursor: 'pointer',
                  background: form.mascote ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                  border: form.mascote ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '8px',
                  transition: 'all 0.2s ease',
                  marginTop: '0.5rem'
                }}
              >
                <input
                  type="checkbox"
                  checked={Boolean(form.mascote)}
                  onChange={(e) => handleChange('mascote', e.target.checked)}
                  style={{ width: '1.15rem', height: '1.15rem', cursor: 'pointer' }}
                />
                <div>
                  <strong style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                    Vai para o acampamento? (Mascote)
                  </strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Marque se participará do acampamento
                  </span>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* 2. FICHA MÉDICA E CUIDADOS DE SAÚDE */}
        <div style={{ background: 'var(--bg-secondary)', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <HeartPulse size={18} color="var(--accent-primary)" />
            <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--accent-primary)' }}>
              2. Ficha Médica e Cuidados de Saúde
            </h4>
          </div>

          {/* Tipo Sanguíneo */}
          <div className="form-group" style={{ maxWidth: '300px', marginBottom: '0.75rem' }}>
            <label className="form-label" style={{ marginBottom: '0.25rem' }}>
              Tipo Sanguíneo / Fator RH
            </label>
            <select
              className="form-input"
              value={form.tipo_sanguineo || ''}
              onChange={(e) => handleChange('tipo_sanguineo', e.target.value)}
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

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '0.75rem 0' }} />

          {/* 1. Problema Crônico */}
          <div style={{ marginBottom: '0.75rem' }}>
            <label className="form-label" style={{ marginBottom: '0.25rem' }}>
              Tem algum problema crônico de saúde?
            </label>
            <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '0.35rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="modal_problema_saude"
                  value="NAO"
                  checked={form.problema_saude === 'NAO'}
                  onChange={() => handleChange('problema_saude', 'NAO')}
                />
                Não
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="modal_problema_saude"
                  value="SIM"
                  checked={form.problema_saude === 'SIM'}
                  onChange={() => handleChange('problema_saude', 'SIM')}
                />
                Sim
              </label>
            </div>
            {form.problema_saude === 'SIM' && (
              <input
                type="text"
                className="form-input"
                placeholder="Qual o problema crônico de saúde?"
                value={form.problema_saude_qual || ''}
                onChange={(e) => handleChange('problema_saude_qual', e.target.value)}
              />
            )}
          </div>

          {/* 2. Convulsão / Epilepsia */}
          <div style={{ marginBottom: '0.75rem' }}>
            <label className="form-label" style={{ marginBottom: '0.25rem' }}>
              Tem ou já teve: convulsão, epilepsia, sangramentos constantes?
            </label>
            <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '0.35rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="modal_historico_convulsao"
                  value="NAO"
                  checked={form.historico_convulsao === 'NAO'}
                  onChange={() => handleChange('historico_convulsao', 'NAO')}
                />
                Não
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="modal_historico_convulsao"
                  value="SIM"
                  checked={form.historico_convulsao === 'SIM'}
                  onChange={() => handleChange('historico_convulsao', 'SIM')}
                />
                Sim
              </label>
            </div>
            {form.historico_convulsao === 'SIM' && (
              <input
                type="text"
                className="form-input"
                placeholder="Há quanto tempo? Como foi tratado?"
                value={form.historico_convulsao_tempo || ''}
                onChange={(e) => handleChange('historico_convulsao_tempo', e.target.value)}
              />
            )}
          </div>

          {/* 3. Tratamento Médico */}
          <div style={{ marginBottom: '0.75rem' }}>
            <label className="form-label" style={{ marginBottom: '0.25rem' }}>
              Está fazendo algum tratamento médico? (Ex: Psicológico, Pediátrico, outros)
            </label>
            <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '0.35rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="modal_tratamento_medico"
                  value="NAO"
                  checked={form.tratamento_medico === 'NAO'}
                  onChange={() => handleChange('tratamento_medico', 'NAO')}
                />
                Não
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="modal_tratamento_medico"
                  value="SIM"
                  checked={form.tratamento_medico === 'SIM'}
                  onChange={() => handleChange('tratamento_medico', 'SIM')}
                />
                Sim
              </label>
            </div>
            {form.tratamento_medico === 'SIM' && (
              <input
                type="text"
                className="form-input"
                placeholder="Qual tratamento médico?"
                value={form.tratamento_medico_qual || ''}
                onChange={(e) => handleChange('tratamento_medico_qual', e.target.value)}
              />
            )}
          </div>

          {/* 4. Medicamento Contínuo */}
          <div style={{ marginBottom: '0.75rem' }}>
            <label className="form-label" style={{ marginBottom: '0.25rem' }}>
              Faz uso de medicamento contínuo?
            </label>
            <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '0.35rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="modal_medicamento_continuo"
                  value="NAO"
                  checked={form.medicamento_continuo === 'NAO'}
                  onChange={() => handleChange('medicamento_continuo', 'NAO')}
                />
                Não
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="modal_medicamento_continuo"
                  value="SIM"
                  checked={form.medicamento_continuo === 'SIM'}
                  onChange={() => handleChange('medicamento_continuo', 'SIM')}
                />
                Sim
              </label>
            </div>
            {form.medicamento_continuo === 'SIM' && (
              <div className="form-grid" style={{ gap: '0.75rem' }}>
                <div className="form-group">
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Qual medicamento?"
                    value={form.medicamento_continuo_qual || ''}
                    onChange={(e) => handleChange('medicamento_continuo_qual', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Qual a dosagem e horários?"
                    value={form.medicamento_continuo_dosagem || ''}
                    onChange={(e) => handleChange('medicamento_continuo_dosagem', e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 5. Lesão ou Contusão */}
          <div style={{ marginBottom: '0.75rem' }}>
            <label className="form-label" style={{ marginBottom: '0.25rem' }}>
              Possui atualmente alguma lesão ou contusão?
            </label>
            <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '0.35rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="modal_lesao_contusao"
                  value="NAO"
                  checked={form.lesao_contusao === 'NAO'}
                  onChange={() => handleChange('lesao_contusao', 'NAO')}
                />
                Não
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="modal_lesao_contusao"
                  value="SIM"
                  checked={form.lesao_contusao === 'SIM'}
                  onChange={() => handleChange('lesao_contusao', 'SIM')}
                />
                Sim
              </label>
            </div>
            {form.lesao_contusao === 'SIM' && (
              <input
                type="text"
                className="form-input"
                placeholder="Qual lesão ou contusão?"
                value={form.lesao_contusao_qual || ''}
                onChange={(e) => handleChange('lesao_contusao_qual', e.target.value)}
              />
            )}
          </div>

          {/* 6. Restrição Alimentar */}
          <div style={{ marginBottom: '0.75rem' }}>
            <label className="form-label" style={{ marginBottom: '0.25rem' }}>
              Possui restrição alimentar? (Ex: Glúten, Lactose, Corantes, outros)
            </label>
            <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '0.35rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="modal_restricao_alimentar"
                  value="NAO"
                  checked={form.restricao_alimentar === 'NAO'}
                  onChange={() => handleChange('restricao_alimentar', 'NAO')}
                />
                Não
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="modal_restricao_alimentar"
                  value="SIM"
                  checked={form.restricao_alimentar === 'SIM'}
                  onChange={() => handleChange('restricao_alimentar', 'SIM')}
                />
                Sim
              </label>
            </div>
            {form.restricao_alimentar === 'SIM' && (
              <input
                type="text"
                className="form-input"
                placeholder="Qual restrição alimentar?"
                value={form.restricao_alimentar_qual || ''}
                onChange={(e) => handleChange('restricao_alimentar_qual', e.target.value)}
              />
            )}
          </div>

          {/* 7. Doença Respiratória e Bombinha */}
          <div style={{ marginBottom: '0.75rem' }}>
            <label className="form-label" style={{ marginBottom: '0.25rem' }}>
              Tem doença respiratória? (Ex: Asma, Bronquite)
            </label>
            <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '0.35rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="modal_doenca_respiratoria"
                  value="NAO"
                  checked={form.doenca_respiratoria === 'NAO'}
                  onChange={() => handleChange('doenca_respiratoria', 'NAO')}
                />
                Não
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="modal_doenca_respiratoria"
                  value="SIM"
                  checked={form.doenca_respiratoria === 'SIM'}
                  onChange={() => handleChange('doenca_respiratoria', 'SIM')}
                />
                Sim
              </label>
            </div>
            {form.doenca_respiratoria === 'SIM' && (
              <div style={{ background: 'var(--bg-primary)', padding: '0.5rem 0.75rem', borderRadius: '8px', marginTop: '0.35rem', border: '1px solid var(--border-color)' }}>
                <label className="form-label" style={{ marginBottom: '0.25rem' }}>
                  Faz uso de bombinha?
                </label>
                <div style={{ display: 'flex', gap: '1.25rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="modal_usa_bombinha"
                      value="NAO"
                      checked={form.usa_bombinha === 'NAO'}
                      onChange={() => handleChange('usa_bombinha', 'NAO')}
                    />
                    Não
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="modal_usa_bombinha"
                      value="SIM"
                      checked={form.usa_bombinha === 'SIM'}
                      onChange={() => handleChange('usa_bombinha', 'SIM')}
                    />
                    Sim
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* 8. Alergia a Medicação */}
          <div style={{ marginBottom: '0.75rem' }}>
            <label className="form-label" style={{ marginBottom: '0.25rem' }}>
              Tem alergia à algum tipo de medicação?
            </label>
            <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '0.35rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="modal_alergia_medicamento"
                  value="NAO"
                  checked={form.alergia_medicamento === 'NAO'}
                  onChange={() => handleChange('alergia_medicamento', 'NAO')}
                />
                Não
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="modal_alergia_medicamento"
                  value="SIM"
                  checked={form.alergia_medicamento === 'SIM'}
                  onChange={() => handleChange('alergia_medicamento', 'SIM')}
                />
                Sim
              </label>
            </div>
            {form.alergia_medicamento === 'SIM' && (
              <input
                type="text"
                className="form-input"
                placeholder="Qual medicamento que causa alergia?"
                value={form.alergia_medicamento_qual || ''}
                onChange={(e) => handleChange('alergia_medicamento_qual', e.target.value)}
              />
            )}
          </div>

          {/* 9. Alergia a Alimento */}
          <div style={{ marginBottom: '0.75rem' }}>
            <label className="form-label" style={{ marginBottom: '0.25rem' }}>
              Tem alergia à algum tipo de alimento?
            </label>
            <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '0.35rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="modal_alergia_alimento"
                  value="NAO"
                  checked={form.alergia_alimento === 'NAO'}
                  onChange={() => handleChange('alergia_alimento', 'NAO')}
                />
                Não
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="modal_alergia_alimento"
                  value="SIM"
                  checked={form.alergia_alimento === 'SIM'}
                  onChange={() => handleChange('alergia_alimento', 'SIM')}
                />
                Sim
              </label>
            </div>
            {form.alergia_alimento === 'SIM' && (
              <input
                type="text"
                className="form-input"
                placeholder="Qual alimento que causa alergia?"
                value={form.alergia_alimento_qual || ''}
                onChange={(e) => handleChange('alergia_alimento_qual', e.target.value)}
              />
            )}
          </div>

          {/* 10. Cuidados Especiais */}
          <div style={{ marginBottom: '0.75rem' }}>
            <label className="form-label" style={{ marginBottom: '0.25rem' }}>
              Demanda algum tipo de cuidado especial?
            </label>
            <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '0.35rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="modal_cuidado_especial"
                  value="NAO"
                  checked={form.cuidado_especial === 'NAO'}
                  onChange={() => handleChange('cuidado_especial', 'NAO')}
                />
                Não
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="modal_cuidado_especial"
                  value="SIM"
                  checked={form.cuidado_especial === 'SIM'}
                  onChange={() => handleChange('cuidado_especial', 'SIM')}
                />
                Sim
              </label>
            </div>
            {form.cuidado_especial === 'SIM' && (
              <input
                type="text"
                className="form-input"
                placeholder="Descreva o cuidado especial necessário"
                value={form.cuidado_especial_qual || ''}
                onChange={(e) => handleChange('cuidado_especial_qual', e.target.value)}
              />
            )}
          </div>

          {/* 11. Medicação para Febre / Sintomas Comuns */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ marginBottom: '0.25rem' }}>
              Em caso de Febre, Dor de Cabeça ou Mal-estar, qual tipo de medicação costuma tomar e dosagem?
            </label>
            <textarea
              className="form-input"
              rows="2"
              placeholder="Ex: Paracetamol infantil em gotas, Dipirona, etc."
              value={form.medicacao_sintomas || ''}
              onChange={(e) => handleChange('medicacao_sintomas', e.target.value)}
            />
          </div>
        </div>

        {/* Rodapé */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '0.75rem',
          borderTop: '1px solid var(--border-color)',
          paddingTop: '0.85rem'
        }}>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: '0.5rem 1.25rem' }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSalvar}
            className="btn btn-primary"
            style={{
              padding: '0.5rem 1.4rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontWeight: 600
            }}
          >
            <Check size={18} />
            {edicaoIndex !== null && edicaoIndex >= 0 ? 'Salvar Alterações' : 'Confirmar e Adicionar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export const ListaDependentes = ({
  dependentes = [],
  onAdicionar,
  onEditar,
  onRemover
}) => {
  return (
    <div className="glass-panel form-section-card" style={{ marginTop: '1rem', padding: '1.25rem', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div className="section-header" style={{ marginBottom: 0 }}>
          <Users size={20} color="var(--accent-primary)" />
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 'bold' }}>Dependentes (Filhos / Mascotes)</h3>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
              Cadastre os filhos com os respectivos dados cadastrais e ficha médica completa.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onAdicionar}
          className="btn btn-primary"
          style={{ padding: '0.45rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem', fontWeight: 600 }}
        >
          <Plus size={16} /> Adicionar Dependente
        </button>
      </div>

      {dependentes.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '1.5rem 1rem',
          background: 'var(--bg-secondary)',
          borderRadius: '8px',
          border: '1px dashed var(--border-color)'
        }}>
          <Users size={32} color="var(--text-secondary)" style={{ opacity: 0.5, marginBottom: '0.5rem' }} />
          <p style={{ color: 'var(--text-primary)', margin: '0 0 0.35rem', fontWeight: 500, fontSize: '0.9rem' }}>
            Nenhum dependente cadastrado até o momento.
          </p>
          <p style={{ color: 'var(--text-secondary)', margin: '0 0 0.75rem', fontSize: '0.85rem' }}>
            Clique no botão acima para adicionar um dependente com seus dados e ficha médica.
          </p>
          <button
            type="button"
            onClick={onAdicionar}
            className="btn btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', padding: '0.4rem 0.85rem' }}
          >
            <Plus size={15} /> Adicionar Primeiro Dependente
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {dependentes.map((dep, index) => {
            const idadeDep = calcularIdade(dep.data_nascimento);
            const temRestricoes = dep.restricao_alimentar === 'SIM';
            const temAlergias = dep.alergia_medicamento === 'SIM' || dep.alergia_alimento === 'SIM';
            const temMedicamento = dep.medicamento_continuo === 'SIM';
            const temProblema = dep.problema_saude === 'SIM';
            const temRespiratoria = dep.doenca_respiratoria === 'SIM';

            return (
              <div
                key={index}
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '0.85rem 1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.65rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                      <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)', fontWeight: 'bold' }}>
                        {dep.nome || 'Dependente sem nome'}
                      </h4>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '999px',
                          fontWeight: 600,
                          background: dep.mascote ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                          color: dep.mascote ? '#10b981' : 'var(--text-secondary)',
                          border: dep.mascote ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(148, 163, 184, 0.3)'
                        }}
                      >
                        {dep.mascote ? '✓ Vai para o Acampamento (Mascote)' : 'Não vai para o Acampamento'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginTop: '0.3rem', color: 'var(--text-secondary)', fontSize: '0.825rem', flexWrap: 'wrap' }}>
                      <span>
                        <strong>Nascimento:</strong> {dep.data_nascimento ? formatarDataBR(dep.data_nascimento) : 'Não informado'}
                        {idadeDep && ` (${idadeDep} anos)`}
                      </span>
                      {dep.tipo_sanguineo && (
                        <span>
                          <strong>Tipo Sanguíneo:</strong> {dep.tipo_sanguineo}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      type="button"
                      onClick={() => onEditar(index)}
                      className="btn btn-secondary"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.75rem', fontSize: '0.825rem' }}
                      title="Editar Dados e Ficha Médica"
                    >
                      <Edit3 size={15} /> Editar Ficha
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemover(index)}
                      className="btn btn-secondary"
                      style={{ color: 'var(--danger)', padding: '0.35rem 0.65rem' }}
                      title="Remover Dependente"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Resumo da Ficha Médica */}
                <div style={{
                  paddingTop: '0.45rem',
                  borderTop: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.4rem',
                  fontSize: '0.775rem'
                }}>
                  <span style={{ color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
                    <HeartPulse size={14} color="var(--accent-primary)" /> Ficha Médica:
                  </span>

                  {temProblema && (
                    <span style={{ padding: '0.15rem 0.5rem', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                      Problema crônico: {dep.problema_saude_qual || 'Sim'}
                    </span>
                  )}
                  {temMedicamento && (
                    <span style={{ padding: '0.15rem 0.5rem', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.25)' }}>
                      Medicamento: {dep.medicamento_continuo_qual || 'Sim'}
                    </span>
                  )}
                  {temRestricoes && (
                    <span style={{ padding: '0.15rem 0.5rem', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                      Restrição alimentar: {dep.restricao_alimentar_qual || 'Sim'}
                    </span>
                  )}
                  {temAlergias && (
                    <span style={{ padding: '0.15rem 0.5rem', borderRadius: '4px', background: 'rgba(236, 72, 153, 0.1)', color: '#ec4899', border: '1px solid rgba(236, 72, 153, 0.25)' }}>
                      Alergia: {[dep.alergia_medicamento === 'SIM' ? dep.alergia_medicamento_qual : null, dep.alergia_alimento === 'SIM' ? dep.alergia_alimento_qual : null].filter(Boolean).join(', ') || 'Sim'}
                    </span>
                  )}
                  {temRespiratoria && (
                    <span style={{ padding: '0.15rem 0.5rem', borderRadius: '4px', background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', border: '1px solid rgba(139, 92, 246, 0.25)' }}>
                      Doença respiratória {dep.usa_bombinha === 'SIM' ? '(Usa bombinha)' : ''}
                    </span>
                  )}
                  {!temProblema && !temMedicamento && !temRestricoes && !temAlergias && !temRespiratoria && (
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Sem restrições relatadas
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
