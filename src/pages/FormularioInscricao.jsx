import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { registrarAuditoria } from '../services/auditoriaService';
import {
  ClipboardCheck,
  ArrowLeft,
  Calendar,
  MapPin,
  DollarSign,
  Phone,
  AlertCircle,
  CheckCircle2,
  HeartPulse,
  Shirt,
  ShieldCheck,
  User,
  Users,
  Info,
  Save,
  HelpCircle,
  Copy,
  Check
} from 'lucide-react';

export const FormularioInscricao = () => {
  const { user, userProfile, pessoaProfile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { id: paramId } = useParams();
  const [searchParams] = useSearchParams();
  const queryEventoId = searchParams.get('eventoId');
  const isAdminOrGestor = userProfile?.perfil === 'ADMIN' || userProfile?.perfil === 'GESTOR';

  // Se passou ID na rota (:id), carrega aquela pessoa (ex: afilhado vindo da tela de meus-afilhados)
  // Se NÃO passou ID na rota, é a ficha da própria pessoa logada (seja admin, gestor, padrinho ou afilhado)
  const isPropriaPessoa = !paramId || Boolean(pessoaProfile?.id && paramId === pessoaProfile.id);
  const targetId = isPropriaPessoa ? (pessoaProfile?.id || null) : paramId;

  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    sexo: '',
    data_nascimento: '',
    idade: '',
    tipo_pessoa: 'AFILHADO',
    padrinhos_catequistas: '',
    ano: new Date().getFullYear().toString(),
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
    outras_informacoes: '',
    aceite_termos_dados: false,
    aceite_termo_imagem: false,
    // Vínculos existentes no sistema
    conjuge_id: '',
    user_id: '',
    vinculo_id: '',
    vinculo_padrinho_id: '',
    vinculo_madrinha_id: ''
  });

  const [padrinhos, setPadrinhos] = useState([]);
  const [madrinhas, setMadrinhas] = useState([]);
  const [eventosAtivos, setEventosAtivos] = useState([]);
  const [eventoSelecionado, setEventoSelecionado] = useState(null);
  const [jaInscritoEvento, setJaInscritoEvento] = useState(false);
  const [confirmarInscricaoEvento, setConfirmarInscricaoEvento] = useState(true);

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [sqlMissingError, setSqlMissingError] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const formatarDataBR = (dataStr) => {
    if (!dataStr) return '';
    const apenasData = dataStr.split('T')[0];
    const partes = apenasData.split('-');
    if (partes.length === 3) {
      const [ano, mes, dia] = partes;
      return `${dia}/${mes}/${ano}`;
    }
    return dataStr;
  };

  const formatarPeriodoEvento = (evento) => {
    if (!evento) return 'A definir';
    if (evento.data_inicio && evento.data_fim) {
      return `${formatarDataBR(evento.data_inicio)} a ${formatarDataBR(evento.data_fim)}`;
    }
    if (evento.data_inicio) {
      return formatarDataBR(evento.data_inicio);
    }
    return 'A definir';
  };

  const formatarValorEvento = (valor) => {
    if (valor === undefined || valor === null || valor === '') return 'A definir';
    const num = Number(valor);
    if (isNaN(num)) return valor;
    if (num <= 0) return 'Gratuito';
    return `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleSelecionarEvento = async (novoEvento) => {
    setEventoSelecionado(novoEvento);
    if (targetId && novoEvento?.id) {
      const { data: insc } = await supabase
        .from('apc_acampamento')
        .select('id')
        .eq('pessoa_id', targetId)
        .eq('evento_id', novoEvento.id)
        .maybeSingle();
      setJaInscritoEvento(Boolean(insc));
    }
  };

  const sqlMigrationCode = `-- Execute no Supabase SQL Editor:
ALTER TABLE public.apc_pessoa 
  ADD COLUMN IF NOT EXISTS padrinhos_catequistas TEXT,
  ADD COLUMN IF NOT EXISTS rg TEXT,
  ADD COLUMN IF NOT EXISTS cpf TEXT,
  ADD COLUMN IF NOT EXISTS idade INTEGER,
  ADD COLUMN IF NOT EXISTS contato_emergencia TEXT,
  ADD COLUMN IF NOT EXISTS nome_responsavel TEXT,
  ADD COLUMN IF NOT EXISTS tipo_sanguineo TEXT,
  ADD COLUMN IF NOT EXISTS problema_saude BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS problema_saude_qual TEXT,
  ADD COLUMN IF NOT EXISTS historico_convulsao BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS historico_convulsao_tempo TEXT,
  ADD COLUMN IF NOT EXISTS tratamento_medico BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS tratamento_medico_qual TEXT,
  ADD COLUMN IF NOT EXISTS medicamento_continuo BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS medicamento_continuo_qual TEXT,
  ADD COLUMN IF NOT EXISTS medicamento_continuo_dosagem TEXT,
  ADD COLUMN IF NOT EXISTS lesao_contusao BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS lesao_contusao_qual TEXT,
  ADD COLUMN IF NOT EXISTS restricao_alimentar BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS restricao_alimentar_qual TEXT,
  ADD COLUMN IF NOT EXISTS doenca_respiratoria BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS usa_bombinha BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS alergia_medicamento BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS alergia_medicamento_qual TEXT,
  ADD COLUMN IF NOT EXISTS alergia_alimento BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS alergia_alimento_qual TEXT,
  ADD COLUMN IF NOT EXISTS medicacao_sintomas TEXT,
  ADD COLUMN IF NOT EXISTS cuidado_especial BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS cuidado_especial_qual TEXT,
  ADD COLUMN IF NOT EXISTS camiseta_infantil TEXT,
  ADD COLUMN IF NOT EXISTS outras_informacoes TEXT,
  ADD COLUMN IF NOT EXISTS aceite_termos_dados BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS aceite_termo_imagem BOOLEAN DEFAULT false;`;

  useEffect(() => {
    fetchInitialData();
  }, [targetId, pessoaProfile?.id]);

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

  const fetchInitialData = async () => {
    try {
      setLoadingData(true);
      setError('');

      // Buscar Padrinhos e Madrinhas para vínculos de afilhado
      const { data: pData } = await supabase
        .from('apc_pessoa')
        .select('id, nome, ano, conjuge_id')
        .eq('tipo_pessoa', 'PADRINHO');
      const { data: mData } = await supabase
        .from('apc_pessoa')
        .select('id, nome, ano, conjuge_id')
        .eq('tipo_pessoa', 'MADRINHA');
      if (pData) setPadrinhos(pData);
      if (mData) setMadrinhas(mData);

      // Buscar Eventos Ativos com todas as informações
      const { data: eventos } = await supabase
        .from('apc_evento')
        .select('*')
        .eq('status', 'ATIVO')
        .order('data_inicio', { ascending: false });

      let eventoAtual = null;
      if (eventos && eventos.length > 0) {
        setEventosAtivos(eventos);
        eventoAtual = queryEventoId
          ? (eventos.find(e => e.id === queryEventoId) || eventos[0])
          : eventos[0];
        setEventoSelecionado(eventoAtual);
      } else if (queryEventoId) {
        const { data: evtEspecifico } = await supabase
          .from('apc_evento')
          .select('*')
          .eq('id', queryEventoId)
          .maybeSingle();
        if (evtEspecifico) {
          eventoAtual = evtEspecifico;
          setEventoSelecionado(evtEspecifico);
          setEventosAtivos([evtEspecifico]);
        }
      }

      const anoPadrao = eventoAtual?.data_inicio
        ? new Date(eventoAtual.data_inicio).getFullYear().toString()
        : new Date().getFullYear().toString();

      // Se temos um ID de pessoa para carregar
      if (targetId) {
        const { data: p, error: pError } = await supabase
          .from('apc_pessoa')
          .select('*')
          .eq('id', targetId)
          .single();

        if (pError) throw pError;

        if (p) {
          const dataNasc = p.data_nascimento ? p.data_nascimento.split('T')[0] : '';
          const idadeAuto = p.idade !== null && p.idade !== undefined ? p.idade.toString() : calcularIdade(dataNasc);

          setFormData({
            nome: p.nome || '',
            email: p.email || (isAdminOrGestor ? '' : (user?.email || '')),
            telefone: p.telefone || '',
            sexo: p.sexo || '',
            data_nascimento: dataNasc,
            idade: idadeAuto,
            tipo_pessoa: p.tipo_pessoa || 'AFILHADO',
            padrinhos_catequistas: p.padrinhos_catequistas || '',
            ano: p.ano ? p.ano.toString() : anoPadrao,
            rg: p.rg || '',
            cpf: p.cpf || '',
            contato_emergencia: p.contato_emergencia || '',
            nome_responsavel: p.nome_responsavel || (p.nome_pai || p.nome_mae || ''),
            nome_pai: p.nome_pai || '',
            nome_mae: p.nome_mae || '',
            fone_responsavel: p.fone_responsavel || '',
            tipo_sanguineo: p.tipo_sanguineo || '',
            problema_saude: p.problema_saude ? 'SIM' : 'NAO',
            problema_saude_qual: p.problema_saude_qual || '',
            historico_convulsao: p.historico_convulsao ? 'SIM' : 'NAO',
            historico_convulsao_tempo: p.historico_convulsao_tempo || '',
            tratamento_medico: p.tratamento_medico ? 'SIM' : 'NAO',
            tratamento_medico_qual: p.tratamento_medico_qual || '',
            medicamento_continuo: p.medicamento_continuo ? 'SIM' : 'NAO',
            medicamento_continuo_qual: p.medicamento_continuo_qual || '',
            medicamento_continuo_dosagem: p.medicamento_continuo_dosagem || '',
            lesao_contusao: p.lesao_contusao ? 'SIM' : 'NAO',
            lesao_contusao_qual: p.lesao_contusao_qual || '',
            restricao_alimentar: p.restricao_alimentar ? 'SIM' : 'NAO',
            restricao_alimentar_qual: p.restricao_alimentar_qual || '',
            doenca_respiratoria: p.doenca_respiratoria ? 'SIM' : 'NAO',
            usa_bombinha: p.usa_bombinha ? 'SIM' : 'NAO',
            alergia_medicamento: p.alergia_medicamento ? 'SIM' : 'NAO',
            alergia_medicamento_qual: p.alergia_medicamento_qual || '',
            alergia_alimento: p.alergia_alimento ? 'SIM' : 'NAO',
            alergia_alimento_qual: p.alergia_alimento_qual || '',
            medicacao_sintomas: p.medicacao_sintomas || '',
            cuidado_especial: p.cuidado_especial ? 'SIM' : 'NAO',
            cuidado_especial_qual: p.cuidado_especial_qual || '',
            camiseta: p.camiseta || '',
            camiseta_infantil: p.camiseta_infantil || '',
            outras_informacoes: p.outras_informacoes || (p.necessidade_medica || ''),
            aceite_termos_dados: !!p.aceite_termos_dados,
            aceite_termo_imagem: !!p.aceite_termo_imagem,
            conjuge_id: p.conjuge_id || '',
            user_id: p.user_id || '',
            vinculo_id: '',
            vinculo_padrinho_id: '',
            vinculo_madrinha_id: ''
          });

          // Verificar inscrição no evento ativo
          if (eventoAtual) {
            const { data: insc } = await supabase
              .from('apc_acampamento')
              .select('id')
              .eq('pessoa_id', targetId)
              .eq('evento_id', eventoAtual.id)
              .maybeSingle();

            if (insc) {
              setJaInscritoEvento(true);
            } else {
              setJaInscritoEvento(false);
            }
          }

          // Buscar vinculo se afilhado
          if (p.tipo_pessoa === 'AFILHADO') {
            const { data: vinc } = await supabase
              .from('apc_vinculo')
              .select('*')
              .eq('afilhado_id', targetId)
              .maybeSingle();

            if (vinc) {
              setFormData(prev => ({
                ...prev,
                vinculo_id: vinc.id,
                vinculo_padrinho_id: vinc.padrinho_id || '',
                vinculo_madrinha_id: vinc.madrinha_id || ''
              }));
            }
          }
        }
      } else {
        // Novo cadastro (preenche com dados do usuário logado se for a própria pessoa se auto-cadastrando pela 1ª vez)
        if (isPropriaPessoa && userProfile) {
          setFormData(prev => ({
            ...prev,
            nome: userProfile.nome || '',
            email: userProfile.email || (user?.email || ''),
            telefone: userProfile.telefone || '',
            data_nascimento: userProfile.data_nascimento || '',
            idade: calcularIdade(userProfile.data_nascimento),
            ano: anoPadrao,
            user_id: user?.id || ''
          }));
        }
      }
    } catch (err) {
      setError('Erro ao carregar dados: ' + err.message);
    } finally {
      setLoadingData(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === 'checkbox' ? checked : value;

    setFormData(prev => {
      const updated = { ...prev, [name]: val };

      // Se mudou a data de nascimento, recalcula a idade automaticamente
      if (name === 'data_nascimento') {
        updated.idade = calcularIdade(val);
      }

      return updated;
    });
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlMigrationCode);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setSuccess('');
    setSqlMissingError(false);

    // Validação explícita em Javascript (evita bloqueio silencioso do HTML5)
    const pendencias = [];
    if (!formData.nome || !formData.nome.trim()) {
      pendencias.push('Nome Completo do Participante');
    }
    if (!formData.telefone || !formData.telefone.trim()) {
      pendencias.push('Telefone do Participante');
    }
    if (!formData.data_nascimento) {
      pendencias.push('Data de Nascimento');
    }
    if (!formData.contato_emergencia || !formData.contato_emergencia.trim()) {
      pendencias.push('Em caso de Emergência ligar para quem (Nome e Telefone)');
    }
    // if (!formData.camiseta && !formData.camiseta_infantil) {
    //   pendencias.push('Tamanho da Camiseta (Adulto ou Infantil)');
    // }
    if (isMenorDeIdade) {
      if (!formData.nome_responsavel || !formData.nome_responsavel.trim()) {
        pendencias.push('Nome Completo dos pais ou responsáveis (obrigatório para menores)');
      }
      if (!formData.fone_responsavel || !formData.fone_responsavel.trim()) {
        pendencias.push('Telefone dos pais ou responsáveis (obrigatório para menores)');
      }
    }
    if (!formData.aceite_termos_dados) {
      pendencias.push('Termo de Aceite: Concordo com o tratamento de meus dados pessoais');
    }

    if (pendencias.length > 0) {
      const msg = `Por favor, preencha os seguintes campos obrigatórios antes de salvar:\n• ` + pendencias.join('\n• ');
      registrarAuditoria({
        acao: 'SALVAR_INSCRICAO_VALIDACAO_PENDENTE',
        categoria: 'INSCRICAO',
        nivel: 'WARNING',
        descricao: `Tentativa de salvar inscrição bloqueada por campos pendentes`,
        detalhes: { pendencias, nome: formData.nome }
      });
      setError(msg);
      window.scrollTo({ top: 300, behavior: 'smooth' });
      return;
    }

    setLoading(true);

    try {
      // Determinação segura do user_id:
      let finalUserId = null;
      if (isPropriaPessoa) {
        // É a própria pessoa logada: se já tinha user_id mantém, ou associa o user.id dela se ainda não tinha
        finalUserId = formData.user_id || user?.id || null;
      } else {
        // É outra pessoa (ex: afilhado): NUNCA atribui o user.id do usuário logado!
        // Só mantém o user_id se a pessoa já tiver o seu próprio user_id no banco
        finalUserId = (formData.user_id && formData.user_id !== user?.id) ? formData.user_id : null;
      }

      const payloadCompleto = {
        nome: formData.nome.trim(),
        email: formData.email ? formData.email.trim() : null,
        telefone: formData.telefone ? formData.telefone.trim() : null,
        sexo: formData.sexo || null,
        data_nascimento: formData.data_nascimento || null,
        tipo_pessoa: formData.tipo_pessoa || 'AFILHADO',
        ano: formData.ano ? parseInt(formData.ano) : 2026,
        conjuge_id: formData.conjuge_id || null,
        user_id: finalUserId,
        nome_pai: formData.nome_pai || null,
        nome_mae: formData.nome_mae || null,
        fone_responsavel: formData.fone_responsavel || null,
        necessidade_medica: formData.outras_informacoes || null,
        camiseta: formData.camiseta || null,

        // Novos campos do formulário
        padrinhos_catequistas: formData.padrinhos_catequistas || null,
        rg: formData.rg || null,
        cpf: formData.cpf || null,
        idade: formData.idade ? parseInt(formData.idade) : null,
        contato_emergencia: formData.contato_emergencia || null,
        nome_responsavel: formData.nome_responsavel || null,
        tipo_sanguineo: formData.tipo_sanguineo || null,
        problema_saude: formData.problema_saude === 'SIM',
        problema_saude_qual: formData.problema_saude === 'SIM' ? (formData.problema_saude_qual || null) : null,
        historico_convulsao: formData.historico_convulsao === 'SIM',
        historico_convulsao_tempo: formData.historico_convulsao === 'SIM' ? (formData.historico_convulsao_tempo || null) : null,
        tratamento_medico: formData.tratamento_medico === 'SIM',
        tratamento_medico_qual: formData.tratamento_medico === 'SIM' ? (formData.tratamento_medico_qual || null) : null,
        medicamento_continuo: formData.medicamento_continuo === 'SIM',
        medicamento_continuo_qual: formData.medicamento_continuo === 'SIM' ? (formData.medicamento_continuo_qual || null) : null,
        medicamento_continuo_dosagem: formData.medicamento_continuo === 'SIM' ? (formData.medicamento_continuo_dosagem || null) : null,
        lesao_contusao: formData.lesao_contusao === 'SIM',
        lesao_contusao_qual: formData.lesao_contusao === 'SIM' ? (formData.lesao_contusao_qual || null) : null,
        restricao_alimentar: formData.restricao_alimentar === 'SIM',
        restricao_alimentar_qual: formData.restricao_alimentar === 'SIM' ? (formData.restricao_alimentar_qual || null) : null,
        doenca_respiratoria: formData.doenca_respiratoria === 'SIM',
        usa_bombinha: formData.doenca_respiratoria === 'SIM' ? (formData.usa_bombinha === 'SIM') : false,
        alergia_medicamento: formData.alergia_medicamento === 'SIM',
        alergia_medicamento_qual: formData.alergia_medicamento === 'SIM' ? (formData.alergia_medicamento_qual || null) : null,
        alergia_alimento: formData.alergia_alimento === 'SIM',
        alergia_alimento_qual: formData.alergia_alimento === 'SIM' ? (formData.alergia_alimento_qual || null) : null,
        medicacao_sintomas: formData.medicacao_sintomas || null,
        cuidado_especial: formData.cuidado_especial === 'SIM',
        cuidado_especial_qual: formData.cuidado_especial === 'SIM' ? (formData.cuidado_especial_qual || null) : null,
        camiseta_infantil: formData.camiseta_infantil || null,
        outras_informacoes: formData.outras_informacoes || null,
        aceite_termos_dados: !!formData.aceite_termos_dados,
        aceite_termo_imagem: !!formData.aceite_termo_imagem
      };

      let pessoaIdSalva = targetId;

      // Se não temos targetId mas temos finalUserId, verifica se já existe registro com esse user_id para atualizar em vez de tentar insert duplicado
      if (!pessoaIdSalva && finalUserId) {
        const { data: existingByUser } = await supabase
          .from('apc_pessoa')
          .select('id')
          .eq('user_id', finalUserId)
          .maybeSingle();
        if (existingByUser) {
          pessoaIdSalva = existingByUser.id;
        }
      }

      // Tenta salvar com todos os campos novos
      let saveError = null;

      if (pessoaIdSalva) {
        const { error: updErr } = await supabase
          .from('apc_pessoa')
          .update(payloadCompleto)
          .eq('id', pessoaIdSalva);
        saveError = updErr;
      } else {
        const { data: newRow, error: insErr } = await supabase
          .from('apc_pessoa')
          .insert([payloadCompleto])
          .select('id')
          .single();
        saveError = insErr;
        if (newRow) pessoaIdSalva = newRow.id;
      }

      const isColumnError = saveError && (
        saveError.code === '42703' ||
        (saveError.message && (
          saveError.message.toLowerCase().includes('column') ||
          saveError.message.toLowerCase().includes('does not exist') ||
          saveError.message.toLowerCase().includes('schema cache')
        ))
      );

      // Se der erro de coluna inexistente no Postgres, salvamos os campos básicos compatíveis e alertamos
      if (isColumnError) {
        setSqlMissingError(true);
        console.warn('Banco precisa de migração SQL. Salvando dados básicos como fallback...', saveError?.message);

        // Fallback: salva apenas as colunas clássicas e concatena dados extras em necessidade_medica
        const resumoSaude = `[FICHA MÉDICA COMPLETA]:
• RG: ${formData.rg || '-'} | CPF: ${formData.cpf || '-'} | Idade: ${formData.idade || '-'}
• Emergência: ${formData.contato_emergencia || '-'}
• Responsável: ${formData.nome_responsavel || '-'} (${formData.fone_responsavel || '-'})
• Tipo Sanguíneo: ${formData.tipo_sanguineo || '-'}
• Problema Crônico: ${formData.problema_saude === 'SIM' ? formData.problema_saude_qual : 'Não'}
• Convulsão/Epilepsia: ${formData.historico_convulsao === 'SIM' ? formData.historico_convulsao_tempo : 'Não'}
• Tratamento: ${formData.tratamento_medico === 'SIM' ? formData.tratamento_medico_qual : 'Não'}
• Medicamento Contínuo: ${formData.medicamento_continuo === 'SIM' ? `${formData.medicamento_continuo_qual} (${formData.medicamento_continuo_dosagem})` : 'Não'}
• Lesão/Contusão: ${formData.lesao_contusao === 'SIM' ? formData.lesao_contusao_qual : 'Não'}
• Restrição Alimentar: ${formData.restricao_alimentar === 'SIM' ? formData.restricao_alimentar_qual : 'Não'}
• Respiração: ${formData.doenca_respiratoria === 'SIM' ? `Sim (Bombinha: ${formData.usa_bombinha})` : 'Não'}
• Alergia Medicamento: ${formData.alergia_medicamento === 'SIM' ? formData.alergia_medicamento_qual : 'Não'}
• Alergia Alimento: ${formData.alergia_alimento === 'SIM' ? formData.alergia_alimento_qual : 'Não'}
• Febre/Dor: ${formData.medicacao_sintomas || '-'}
• Cuidados Especiais: ${formData.cuidado_especial === 'SIM' ? formData.cuidado_especial_qual : 'Não'}
• Camiseta Adulto: ${formData.camiseta || '-'} | Infantil: ${formData.camiseta_infantil || '-'}
• Outras Informações: ${formData.outras_informacoes || '-'}`;

        const payloadBasico = {
          nome: formData.nome.trim(),
          email: formData.email ? formData.email.trim() : null,
          telefone: formData.telefone ? formData.telefone.trim() : null,
          sexo: formData.sexo || null,
          data_nascimento: formData.data_nascimento || null,
          tipo_pessoa: formData.tipo_pessoa || 'AFILHADO',
          ano: formData.ano ? parseInt(formData.ano) : 2026,
          conjuge_id: formData.conjuge_id || null,
          user_id: finalUserId,
          nome_pai: formData.nome_pai || formData.nome_responsavel || null,
          nome_mae: formData.nome_mae || null,
          fone_responsavel: formData.fone_responsavel || null,
          necessidade_medica: resumoSaude,
          camiseta: formData.camiseta || null
        };

        if (pessoaIdSalva) {
          const { error: updFallbackErr } = await supabase
            .from('apc_pessoa')
            .update(payloadBasico)
            .eq('id', pessoaIdSalva);
          if (updFallbackErr) throw updFallbackErr;
        } else {
          const { data: newRowFallback, error: insFallbackErr } = await supabase
            .from('apc_pessoa')
            .insert([payloadBasico])
            .select('id')
            .single();
          if (insFallbackErr) throw insFallbackErr;
          if (newRowFallback) pessoaIdSalva = newRowFallback.id;
        }
      } else if (saveError) {
        throw saveError;
      }

      // Vínculo Padrinho/Madrinha caso seja Afilhado e tenha selecionado
      const anoVinculo = parseInt(formData.ano) || (eventoSelecionado?.data_inicio ? new Date(eventoSelecionado.data_inicio).getFullYear() : 2026);
      if (formData.tipo_pessoa === 'AFILHADO' && formData.vinculo_padrinho_id && formData.vinculo_madrinha_id && pessoaIdSalva) {
        if (formData.vinculo_id) {
          await supabase.from('apc_vinculo').update({
            padrinho_id: formData.vinculo_padrinho_id,
            madrinha_id: formData.vinculo_madrinha_id,
            ano: anoVinculo
          }).eq('id', formData.vinculo_id);
        } else {
          await supabase.from('apc_vinculo').insert([{
            padrinho_id: formData.vinculo_padrinho_id,
            madrinha_id: formData.vinculo_madrinha_id,
            afilhado_id: pessoaIdSalva,
            ano: anoVinculo
          }]);
        }
      }

      // Inscrição no evento ativo selecionado
      const eventoParaInscrever = eventoSelecionado || (eventosAtivos.length > 0 ? eventosAtivos[0] : null);
      if (confirmarInscricaoEvento && !jaInscritoEvento && eventoParaInscrever && pessoaIdSalva) {
        try {
          await supabase.from('apc_acampamento').insert([{
            evento_id: eventoParaInscrever.id,
            pessoa_id: pessoaIdSalva,
            equipe: []
          }]);
          setJaInscritoEvento(true);
        } catch (evtErr) {
          console.warn('Inscrição no evento avisou:', evtErr);
        }
      }

      if (refreshProfile) {
        await refreshProfile();
      }

      registrarAuditoria({
        acao: 'SALVAR_INSCRICAO_SUCESSO',
        categoria: 'INSCRICAO',
        nivel: 'INFO',
        descricao: `Ficha de inscrição salva com sucesso (${formData.nome})`,
        detalhes: {
          pessoa_id: pessoaIdSalva,
          tipo_pessoa: formData.tipo_pessoa,
          ano: formData.ano
        }
      });

      setSuccess('Ficha de inscrição salva com sucesso!');
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Se foi criação direta de nova pessoa de terceiro, redireciona para edição
      if (!isPropriaPessoa && !targetId && pessoaIdSalva) {
        setTimeout(() => navigate(`/editar-pessoa/${pessoaIdSalva}`), 2000);
      }
    } catch (err) {
      console.error('Erro ao salvar inscrição:', err);
      registrarAuditoria({
        acao: 'SALVAR_INSCRICAO_ERRO',
        categoria: 'ERRO',
        nivel: 'ERROR',
        descricao: `Erro ao salvar ficha de inscrição (${formData.nome || 'Participante'}): ${err.message}`,
        detalhes: {
          erro: err.message,
          stack: err.stack,
          code: err.code,
          formData_resumo: {
            nome: formData.nome,
            tipo_pessoa: formData.tipo_pessoa,
            targetId: targetId || null
          }
        }
      });
      setError('Erro ao salvar formulário de inscrição: ' + (err.message || 'Verifique seus dados e tente novamente.'));
      window.scrollTo({ top: 300, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="main-content" style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Carregando dados da inscrição...</p>
      </div>
    );
  }

  const isMenorDeIdade = formData.idade !== '' && parseInt(formData.idade) < 18;

  return (
    <div className="main-content" style={{ maxWidth: '960px', margin: '0 auto' }}>
      {/* Barra Superior */}
      <div className="glass-panel form-section-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => navigate(-1)} className="btn btn-secondary" style={{ padding: '0.5rem' }}>
            <ArrowLeft size={20} />
          </button>
          <span
            style={{
              display: 'inline-block',
              background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
              color: 'white',
              padding: '0.25rem 0.75rem',
              borderRadius: '999px',
              fontSize: '1.5rem',
              fontWeight: '700',
              letterSpacing: '0.05em',
              textTransform: 'uppercase'
            }}
          >
            Formulário de Inscrição
          </span>
        </div>
      </div>

      {/* Banner Oficial do Evento */}
      <div className="glass-panel banner-acampamento">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <h1 className="banner-title">
              {eventoSelecionado?.descricao || 'Acampamento do Pós Crisma'}
            </h1>
            <span style={{ color: 'var(--accent-secondary)', fontWeight: 'bold', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
              {eventoSelecionado?.tema || ''}
            </span>
            <h3 className="banner-subtitle">
              {'Paróquia Santa Maria dos Pobres - Paranoá-DF'}
            </h3>
          </div>

          {eventosAtivos.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255, 255, 255, 0.85)', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Evento:</span>
              <select
                className="form-input"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                value={eventoSelecionado?.id || ''}
                onChange={(e) => {
                  const ev = eventosAtivos.find(item => item.id === e.target.value);
                  if (ev) handleSelecionarEvento(ev);
                }}
              >
                {eventosAtivos.map(ev => (
                  <option key={ev.id} value={ev.id}>{ev.descricao}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Grade de Detalhes do Evento */}
        <div className="banner-grid">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Calendar size={22} color="var(--accent-primary)" />
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', fontWeight: '600' }}>DATA DO EVENTO</span>
              <strong style={{ fontSize: '0.95rem' }}>{formatarPeriodoEvento(eventoSelecionado)}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <MapPin size={22} color="#dc2626" />
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', fontWeight: '600' }}>LOCAL</span>
              <strong style={{ fontSize: '0.95rem' }}>{eventoSelecionado?.local || 'A definir'}</strong>
            </div>
          </div>

          <div className="card-investimento">
            <div className="card-investimento-icon">
              <DollarSign size={22} color="#15803d" />
            </div>
            <div>
              <span style={{ fontSize: '0.7rem', color: '#166534', display: 'block', fontWeight: '700', letterSpacing: '0.05em' }}>
                INVESTIMENTO {eventoSelecionado?.inclui_camiseta ? '• C/ CAMISETA' : ''}
              </span>
              <strong style={{ fontSize: '1.15rem', color: '#15803d', fontWeight: '800' }}>
                {formatarValorEvento(eventoSelecionado?.valor)}
              </strong>
            </div>
          </div>
          {/* <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Phone size={22} color="#2563eb" />
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', fontWeight: '600' }}>COORDENADORES PSMP</span>
              <span style={{ fontSize: '0.85rem', display: 'block' }}>Ubiratã: <strong>(61) 98118-4624</strong></span>
              <span style={{ fontSize: '0.85rem', display: 'block' }}>Daniela: <strong>(16) 98181-2742</strong></span>
            </div>
          </div> */}
        </div>

        {/* Avisos Importantes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#1e40af' }}>
            <DollarSign size={16} />
            <span>O valor será usado exclusivamente para custear as despesas de <strong>hospedagem, transporte e alimentação{eventoSelecionado?.inclui_camiseta ? ' (inclui camiseta)' : ''}</strong> do participante.</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#b91c1c' }}>
            <AlertCircle size={16} />
            <span><strong>Atenção:</strong> Todos os participantes devem portar Documento de Identificação oficial no dia.</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <Info size={16} />
            <span>Novas orientações e cronograma detalhado serão passados aos pais e jovens em momento oportuno.</span>
          </div>
        </div>
      </div>

      {/* Alerta de erro de migração SQL caso as colunas ainda não existam no Supabase */}
      {sqlMissingError && (
        <div
          className="glass-panel"
          style={{
            padding: '1.5rem',
            marginBottom: '2rem',
            border: '2px solid #f59e0b',
            background: 'rgba(254, 243, 199, 0.9)',
            color: '#92400e'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
            <div>
              <h4 style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={20} color="#d97706" />
                Novas colunas no banco de dados necessárias
              </h4>
              <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem' }}>
                Os dados básicos foram salvos e a ficha médica foi registrada no campo geral. Para salvar todos os campos em colunas individuais nativas, execute o script SQL abaixo no <strong>SQL Editor do Supabase</strong>:
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopySql}
              className="btn btn-secondary"
              style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
            >
              {copiedSql ? <Check size={16} color="#16a34a" /> : <Copy size={16} />}
              {copiedSql ? 'Copiado!' : 'Copiar SQL'}
            </button>
          </div>
          <pre
            style={{
              background: '#1e293b',
              color: '#f8fafc',
              padding: '1rem',
              borderRadius: '8px',
              fontSize: '0.75rem',
              overflowX: 'auto',
              maxHeight: '160px',
              margin: 0
            }}
          >
            {sqlMigrationCode}
          </pre>
        </div>
      )}

      {error && <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: '1.5rem' }}>{success}</div>}

      <form onSubmit={handleSubmit} noValidate>

        {eventoSelecionado?.inclui_camiseta && (
          <div className="glass-panel form-section-card">
            <div className="section-header">
              <Shirt size={22} color="var(--accent-primary)" />
              <h3>Tamanho da Camiseta</h3>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label" htmlFor="camiseta">
                  Tamanho da Camiseta (Adulto)
                </label>
                <select
                  id="camiseta"
                  name="camiseta"
                  className="form-input"
                  value={formData.camiseta}
                  onChange={handleChange}
                  required={!formData.camiseta_infantil}
                >
                  <option value="">-- Selecione o tamanho --</option>
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
                <label className="form-label" htmlFor="camiseta_infantil">
                  Tamanho da Camiseta Infantil (IDADE CRIANÇA - 0 a 15 anos)
                </label>
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
        )}

        {/* ========================================================================= */}
        {/* SEÇÃO 1: DADOS DO PARTICIPANTE */}
        {/* ========================================================================= */}
        <div className="glass-panel form-section-card">
          <div className="section-header">
            <User size={22} color="var(--accent-primary)" />
            <h3>1. Dados do Participante</h3>
          </div>

          <div className="form-grid">
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label" htmlFor="nome">
                Nome Completo do Participante *
              </label>
              <input
                id="nome"
                name="nome"
                type="text"
                className="form-input"
                placeholder="Digite o nome completo do participante"
                value={formData.nome}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="tipo_pessoa">
                De que forma irá participar no acampamento (Como?) *
              </label>
              <select
                id="tipo_pessoa"
                name="tipo_pessoa"
                className="form-input"
                value={formData.tipo_pessoa}
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
              <label className="form-label" htmlFor="padrinhos_catequistas">
                Nome dos Padrinhos ou Catequistas
              </label>
              <input
                id="padrinhos_catequistas"
                name="padrinhos_catequistas"
                type="text"
                className="form-input"
                placeholder="Ex: João e Maria ou Catequista André"
                value={formData.padrinhos_catequistas}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="data_nascimento">
                Data de Nascimento *
              </label>
              <input
                id="data_nascimento"
                name="data_nascimento"
                type="date"
                className="form-input"
                value={formData.data_nascimento}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="idade">
                Idade do Participante
              </label>
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
                  ⚠️ Menor de idade (necessário preencher dados e autorizações dos pais/responsáveis)
                </span>
              )}
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="rg">
                RG do Participante
              </label>
              <input
                id="rg"
                name="rg"
                type="text"
                className="form-input"
                placeholder="Número do RG / Órgão Emissor"
                value={formData.rg}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="cpf">
                CPF do Participante
              </label>
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
              <label className="form-label" htmlFor="telefone">
                Telefone do Participante (WhatsApp) *
              </label>
              <input
                id="telefone"
                name="telefone"
                type="text"
                className="form-input"
                placeholder="(61) 90000-0000"
                value={formData.telefone}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="email">
                E-mail
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className="form-input"
                placeholder="seuemail@exemplo.com"
                value={formData.email}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="sexo">
                Sexo
              </label>
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
              <label className="form-label" htmlFor="ano">
                Ano (Turma)
              </label>
              <input
                id="ano"
                name="ano"
                type="number"
                className="form-input"
                placeholder="Ex: 2026"
                value={formData.ano}
                onChange={handleChange}
              />
            </div>
          </div>

          {formData.tipo_pessoa === 'AFILHADO' && padrinhos.length > 0 && (
            <div className="form-group" style={{ marginTop: '0.5rem' }}>
              <label className="form-label">Vincular o Padrinho</label>
              <select
                className="form-input"
                value={formData.vinculo_padrinho_id}
                onChange={(e) => {
                  const pid = e.target.value;
                  const p = padrinhos.find(item => item.id === pid);
                  setFormData(prev => ({
                    ...prev,
                    vinculo_padrinho_id: pid,
                    vinculo_madrinha_id: p?.conjuge_id || prev.vinculo_madrinha_id
                  }));
                }}
              >
                <option value="">-- Selecione --</option>
                {padrinhos.map(p => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
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
              Em caso de Emergência ligar para quem? Nome e Telefone *
            </label>
            <input
              id="contato_emergencia"
              name="contato_emergencia"
              type="text"
              className="form-input"
              placeholder="Ex: Maria (Mãe) - (61) 98888-7777 ou Carlos (Irmão) - (61) 99999-0000"
              value={formData.contato_emergencia}
              onChange={handleChange}
              required
            />
          </div>

          <div
            style={{
              background: isMenorDeIdade ? 'rgba(245, 158, 11, 0.08)' : 'var(--bg-secondary)',
              border: isMenorDeIdade ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid var(--border-color)',
              padding: '1.25rem',
              borderRadius: '8px',
              marginTop: '1rem'
            }}
          >
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', fontWeight: 'bold', color: isMenorDeIdade ? '#b45309' : 'var(--text-primary)' }}>
              Dados dos Pais ou Responsáveis (Obrigatório para menores de 18 anos)
            </h4>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label" htmlFor="nome_responsavel">
                  Nome Completo dos pais ou responsáveis {isMenorDeIdade ? '*' : ''}
                </label>
                <input
                  id="nome_responsavel"
                  name="nome_responsavel"
                  type="text"
                  className="form-input"
                  placeholder="Nome do Pai, Mãe ou Responsável Legal"
                  value={formData.nome_responsavel}
                  onChange={handleChange}
                  required={isMenorDeIdade}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="fone_responsavel">
                  Telefone pais ou responsáveis {isMenorDeIdade ? '*' : ''}
                </label>
                <input
                  id="fone_responsavel"
                  name="fone_responsavel"
                  type="text"
                  className="form-input"
                  placeholder="(61) 90000-0000"
                  value={formData.fone_responsavel}
                  onChange={handleChange}
                  required={isMenorDeIdade}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SEÇÃO 3: FICHA MÉDICA E DE SAÚDE */}
        {/* ========================================================================= */}
        <div className="glass-panel form-section-card">
          <div className="section-header">
            <HeartPulse size={22} color="#e11d48" />
            <h3>3. Ficha Médica e Cuidados de Saúde</h3>
          </div>

          {/* Tipo Sanguíneo */}
          <div className="form-group" style={{ maxWidth: '300px' }}>
            <label className="form-label" htmlFor="tipo_sanguineo">
              Tipo Sanguíneo / Fator RH
            </label>
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

          {/* 1. Problema Crônico */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label className="form-label" style={{ marginBottom: '0.4rem' }}>
              Tem algum problema crônico de saúde?
            </label>
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="problema_saude"
                  value="NAO"
                  checked={formData.problema_saude === 'NAO'}
                  onChange={handleChange}
                />
                Não
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="problema_saude"
                  value="SIM"
                  checked={formData.problema_saude === 'SIM'}
                  onChange={handleChange}
                />
                Sim
              </label>
            </div>
            {formData.problema_saude === 'SIM' && (
              <input
                type="text"
                name="problema_saude_qual"
                className="form-input"
                placeholder="Qual o problema crônico de saúde?"
                value={formData.problema_saude_qual}
                onChange={handleChange}
                required
              />
            )}
          </div>

          {/* 2. Convulsão / Epilepsia */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label className="form-label" style={{ marginBottom: '0.4rem' }}>
              Tem ou já teve: convulsão, epilepsia, sangramentos constantes?
            </label>
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="historico_convulsao"
                  value="NAO"
                  checked={formData.historico_convulsao === 'NAO'}
                  onChange={handleChange}
                />
                Não
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="historico_convulsao"
                  value="SIM"
                  checked={formData.historico_convulsao === 'SIM'}
                  onChange={handleChange}
                />
                Sim
              </label>
            </div>
            {formData.historico_convulsao === 'SIM' && (
              <input
                type="text"
                name="historico_convulsao_tempo"
                className="form-input"
                placeholder="Há quanto tempo? Como foi tratado?"
                value={formData.historico_convulsao_tempo}
                onChange={handleChange}
                required
              />
            )}
          </div>

          {/* 3. Tratamento Médico */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label className="form-label" style={{ marginBottom: '0.4rem' }}>
              Está fazendo algum tratamento médico? (Ex: Psicológico, Cardíaco, outros)
            </label>
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="tratamento_medico"
                  value="NAO"
                  checked={formData.tratamento_medico === 'NAO'}
                  onChange={handleChange}
                />
                Não
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="tratamento_medico"
                  value="SIM"
                  checked={formData.tratamento_medico === 'SIM'}
                  onChange={handleChange}
                />
                Sim
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
                required
              />
            )}
          </div>

          {/* 4. Medicamento Contínuo */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label className="form-label" style={{ marginBottom: '0.4rem' }}>
              Faz uso de medicamento contínuo?
            </label>
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="medicamento_continuo"
                  value="NAO"
                  checked={formData.medicamento_continuo === 'NAO'}
                  onChange={handleChange}
                />
                Não
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="medicamento_continuo"
                  value="SIM"
                  checked={formData.medicamento_continuo === 'SIM'}
                  onChange={handleChange}
                />
                Sim
              </label>
            </div>
            {formData.medicamento_continuo === 'SIM' && (
              <div className="form-grid">
                <div className="form-group">
                  <input
                    type="text"
                    name="medicamento_continuo_qual"
                    className="form-input"
                    placeholder="Qual medicamento?"
                    value={formData.medicamento_continuo_qual}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <input
                    type="text"
                    name="medicamento_continuo_dosagem"
                    className="form-input"
                    placeholder="Qual a dosagem e horários?"
                    value={formData.medicamento_continuo_dosagem}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            )}
          </div>

          {/* 5. Lesão ou Contusão */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label className="form-label" style={{ marginBottom: '0.4rem' }}>
              Possui atualmente alguma lesão ou contusão?
            </label>
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="lesao_contusao"
                  value="NAO"
                  checked={formData.lesao_contusao === 'NAO'}
                  onChange={handleChange}
                />
                Não
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="lesao_contusao"
                  value="SIM"
                  checked={formData.lesao_contusao === 'SIM'}
                  onChange={handleChange}
                />
                Sim
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
                required
              />
            )}
          </div>

          {/* 6. Restrição Alimentar */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label className="form-label" style={{ marginBottom: '0.4rem' }}>
              Possui restrição alimentar? (Ex: Glúten, Lactose, outros)
            </label>
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="restricao_alimentar"
                  value="NAO"
                  checked={formData.restricao_alimentar === 'NAO'}
                  onChange={handleChange}
                />
                Não
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="restricao_alimentar"
                  value="SIM"
                  checked={formData.restricao_alimentar === 'SIM'}
                  onChange={handleChange}
                />
                Sim
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
                required
              />
            )}
          </div>

          {/* 7. Doença Respiratória e Bombinha */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label className="form-label" style={{ marginBottom: '0.4rem' }}>
              Tem doença respiratória? (Ex: Asma, Bronquite)
            </label>
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="doenca_respiratoria"
                  value="NAO"
                  checked={formData.doenca_respiratoria === 'NAO'}
                  onChange={handleChange}
                />
                Não
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="doenca_respiratoria"
                  value="SIM"
                  checked={formData.doenca_respiratoria === 'SIM'}
                  onChange={handleChange}
                />
                Sim
              </label>
            </div>
            {formData.doenca_respiratoria === 'SIM' && (
              <div style={{ background: 'var(--bg-secondary)', padding: '0.75rem 1rem', borderRadius: '8px', marginTop: '0.5rem' }}>
                <label className="form-label" style={{ marginBottom: '0.4rem' }}>
                  Faz uso de bombinha?
                </label>
                <div style={{ display: 'flex', gap: '1.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="usa_bombinha"
                      value="NAO"
                      checked={formData.usa_bombinha === 'NAO'}
                      onChange={handleChange}
                    />
                    Não
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="usa_bombinha"
                      value="SIM"
                      checked={formData.usa_bombinha === 'SIM'}
                      onChange={handleChange}
                    />
                    Sim
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* 8. Alergia a Medicação */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label className="form-label" style={{ marginBottom: '0.4rem' }}>
              Tem alergia à algum tipo de medicação?
            </label>
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="alergia_medicamento"
                  value="NAO"
                  checked={formData.alergia_medicamento === 'NAO'}
                  onChange={handleChange}
                />
                Não
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="alergia_medicamento"
                  value="SIM"
                  checked={formData.alergia_medicamento === 'SIM'}
                  onChange={handleChange}
                />
                Sim
              </label>
            </div>
            {formData.alergia_medicamento === 'SIM' && (
              <input
                type="text"
                name="alergia_medicamento_qual"
                className="form-input"
                placeholder="Qual medicamento que causa alergia?"
                value={formData.alergia_medicamento_qual}
                onChange={handleChange}
                required
              />
            )}
          </div>

          {/* 9. Alergia a Alimento */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label className="form-label" style={{ marginBottom: '0.4rem' }}>
              Tem alergia à algum tipo de alimento?
            </label>
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="alergia_alimento"
                  value="NAO"
                  checked={formData.alergia_alimento === 'NAO'}
                  onChange={handleChange}
                />
                Não
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="alergia_alimento"
                  value="SIM"
                  checked={formData.alergia_alimento === 'SIM'}
                  onChange={handleChange}
                />
                Sim
              </label>
            </div>
            {formData.alergia_alimento === 'SIM' && (
              <input
                type="text"
                name="alergia_alimento_qual"
                className="form-input"
                placeholder="Qual alimento que causa alergia?"
                value={formData.alergia_alimento_qual}
                onChange={handleChange}
                required
              />
            )}
          </div>

          {/* 10. Cuidados Especiais */}
          <div style={{ marginBottom: '0.5rem' }}>
            <label className="form-label" style={{ marginBottom: '0.4rem' }}>
              Demanda algum tipo de cuidado especial?
            </label>
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="cuidado_especial"
                  value="NAO"
                  checked={formData.cuidado_especial === 'NAO'}
                  onChange={handleChange}
                />
                Não
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="cuidado_especial"
                  value="SIM"
                  checked={formData.cuidado_especial === 'SIM'}
                  onChange={handleChange}
                />
                Sim
              </label>
            </div>
            {formData.cuidado_especial === 'SIM' && (
              <input
                type="text"
                name="cuidado_especial_qual"
                className="form-input"
                placeholder="Descreva o cuidado especial necessário"
                value={formData.cuidado_especial_qual}
                onChange={handleChange}
                required
              />
            )}
          </div>


          {/* 11. Medicação para Febre / Sintomas Comuns */}
          <div className="form-group" style={{ marginTop: '1.5rem' }}>
            <label className="form-label" htmlFor="medicacao_sintomas">
              Em caso de Febre, Dor de Cabeça, Dor Muscular ou Desconforto Gastrointestinal, qual o tipo de medicação costuma tomar e qual a dosagem?
            </label>
            <textarea
              id="medicacao_sintomas"
              name="medicacao_sintomas"
              className="form-input"
              rows="3"
              placeholder="Ex: Paracetamol 750mg para dor de cabeça, Dipirona 500mg para febre, etc."
              value={formData.medicacao_sintomas}
              onChange={handleChange}
            />
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SEÇÃO 4: OUTRAS INFORMAÇÕES IMPORTANTES */}
        {/* ========================================================================= */}
        <div className="glass-panel form-section-card">
          <div className="section-header">
            <Info size={22} color="var(--accent-primary)" />
            <h3>4. Outras Informações Importantes</h3>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="outras_informacoes">
              Outras observações, cuidados ou informações relevantes para a equipe:
            </label>
            <textarea
              id="outras_informacoes"
              name="outras_informacoes"
              className="form-input"
              rows="4"
              placeholder="Digite aqui quaisquer outras orientações importantes sobre o participante..."
              value={formData.outras_informacoes}
              onChange={handleChange}
            />
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SEÇÃO 5: TAMANHO DE CAMISETA */}
        {/* ========================================================================= */}
        {/* <div className="glass-panel form-section-card">
          <div className="section-header">
            <Shirt size={22} color="var(--accent-primary)" />
            <h3>5. Tamanho da Camiseta</h3>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="camiseta">
                Tamanho da Camiseta (Adulto) *
              </label>
              <select
                id="camiseta"
                name="camiseta"
                className="form-input"
                value={formData.camiseta}
                onChange={handleChange}
                required={!formData.camiseta_infantil}
              >
                <option value="">-- Selecione o tamanho --</option>
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
              <label className="form-label" htmlFor="camiseta_infantil">
                Tamanho da Camiseta Infantil (IDADE CRIANÇA - 0 a 15 anos)
              </label>
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
        </div> */}

        {/* ========================================================================= */}
        {/* SEÇÃO 5: TERMOS DE ACEITE E AUTORIZAÇÕES (LGPD E IMAGEM) */}
        {/* ========================================================================= */}
        <div
          className="glass-panel form-section-card"
          style={{
            background: 'rgba(59, 130, 246, 0.03)',
            border: '1px solid rgba(59, 130, 246, 0.2)'
          }}
        >
          <div className="section-header">
            <ShieldCheck size={22} color="var(--accent-primary)" />
            <h3>5. Termos e Autorizações</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Termo 1: Tratamento de dados */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <input
                type="checkbox"
                id="aceite_termos_dados"
                name="aceite_termos_dados"
                checked={formData.aceite_termos_dados}
                onChange={handleChange}
                required
                style={{ width: '1.3rem', height: '1.3rem', marginTop: '0.2rem', cursor: 'pointer' }}
              />
              <label htmlFor="aceite_termos_dados" style={{ cursor: 'pointer', fontSize: '0.9rem', lineHeight: 1.5 }}>
                <strong>PAIS OU RESPONSÁVEIS:</strong> Concordo com o tratamento de meus dados pessoais e os dados do menor sob os meus cuidados para as finalidades a seguir determinadas: registro no <strong>{eventoSelecionado?.descricao || 'Acampamento do Pós-Crisma'}</strong>{eventoSelecionado?.local ? `, apresentação no ${eventoSelecionado.local}` : ''} e à empresa de transporte contratada. *
              </label>
            </div>

            {/* Termo 2: Uso de imagem */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <input
                type="checkbox"
                id="aceite_termo_imagem"
                name="aceite_termo_imagem"
                checked={formData.aceite_termo_imagem}
                onChange={handleChange}
                style={{ width: '1.3rem', height: '1.3rem', marginTop: '0.2rem', cursor: 'pointer' }}
              />
              <label htmlFor="aceite_termo_imagem" style={{ cursor: 'pointer', fontSize: '0.9rem', lineHeight: 1.5 }}>
                <strong>PAIS OU RESPONSÁVEIS:</strong> Autorizo o uso da imagem de meu/minha filho(a) (ou minha imagem) para uso em fotos, filmagens e campanhas de divulgação do evento em sites e redes sociais da Paróquia Santa Maria dos Pobres.
              </label>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SEÇÃO 6: CONFIRMAÇÃO DE INSCRIÇÃO NO EVENTO ATIVO */}
        {/* ========================================================================= */}
        {eventoSelecionado && (
          <div
            className="glass-panel form-section-card"
            style={{
              background: jaInscritoEvento ? 'rgba(16, 185, 129, 0.08)' : 'rgba(59, 130, 246, 0.05)',
              border: jaInscritoEvento ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(59, 130, 246, 0.2)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {jaInscritoEvento ? (
                  <CheckCircle2 size={24} color="#16a34a" />
                ) : (
                  <Calendar size={24} color="var(--accent-primary)" />
                )}
                <div>
                  <strong style={{ display: 'block', fontSize: '1rem' }}>
                    {jaInscritoEvento ? 'Participante já está inscrito no acampamento' : 'Confirmar Inscrição no Acampamento Oficial'}
                  </strong>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Evento: {eventoSelecionado.descricao}
                  </span>
                </div>
              </div>

              {!jaInscritoEvento && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 'bold' }}>
                  <input
                    type="checkbox"
                    checked={confirmarInscricaoEvento}
                    onChange={(e) => setConfirmarInscricaoEvento(e.target.checked)}
                    style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
                  />
                  <span>Confirmar vaga automaticamente ao salvar</span>
                </label>
              )}
            </div>
          </div>
        )}

        {/* Alerta de Erro ou Sucesso no rodapé (para visualização imediata) */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>
              <AlertCircle size={20} />
              <span>Atenção: Não foi possível salvar</span>
            </div>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
              <CheckCircle2 size={20} />
              <span>{success}</span>
            </div>
          </div>
        )}

        {/* Botão de Envio */}
        <div className="form-actions-footer">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn btn-secondary"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ padding: '0.85rem 2rem', fontSize: '1.05rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            disabled={loading}
          >
            <Save size={20} />
            {loading ? 'Salvando Inscrição...' : targetId ? 'Salvar Ficha de Inscrição' : `Enviar Inscrição${eventoSelecionado?.descricao ? ` - ${eventoSelecionado.descricao}` : ''}`}
          </button>
        </div>
      </form>
    </div>
  );
};
