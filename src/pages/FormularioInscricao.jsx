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
  Check,
  Plus,
  Trash2,
  X,
  Edit3,
  Activity,
  FileText,
  Loader2,
  Search,
  RotateCcw,
  UserPlus
} from 'lucide-react';
import { validarCPF, formatarCPF } from '../utils/cpf';
import { ModalDependente } from '../components/ModalDependente';

export const FormularioInscricao = () => {
  const { user, userProfile, pessoaProfile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { id: paramId } = useParams();
  const [searchParams] = useSearchParams();
  const queryEventoId = searchParams.get('eventoId');
  const isAdminOrGestor = userProfile?.perfil === 'ADMIN' || userProfile?.perfil === 'GESTOR';

  const [pessoaCarregadaId, setPessoaCarregadaId] = useState(paramId || null);
  const [modoEdicao, setModoEdicao] = useState(Boolean(paramId));
  const [cpfVerificado, setCpfVerificado] = useState(Boolean(paramId));
  const [cpfBusca, setCpfBusca] = useState('');
  const [cpfBuscando, setCpfBuscando] = useState(false);
  const [cpfErro, setCpfErro] = useState('');

  const targetId = pessoaCarregadaId || paramId || null;

  const getInitialFormData = (anoPadrao = new Date().getFullYear().toString(), cpfInicial = '') => ({
    nome: '',
    email: '',
    telefone: '',
    sexo: '',
    data_nascimento: '',
    idade: '',
    tipo_pessoa: 'AFILHADO',
    padrinhos_catequistas: '',
    ano: anoPadrao,
    rg: '',
    cpf: cpfInicial ? formatarCPF(cpfInicial) : '',
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

  const [formData, setFormData] = useState(getInitialFormData());

  const isPropriaPessoa = Boolean(
    (pessoaProfile?.id && targetId === pessoaProfile.id) ||
    (pessoaProfile?.cpf && formData.cpf && pessoaProfile.cpf.replace(/\D/g, '') === formData.cpf.replace(/\D/g, ''))
  );

  const [padrinhos, setPadrinhos] = useState([]);
  const [madrinhas, setMadrinhas] = useState([]);
  const [eventosAtivos, setEventosAtivos] = useState([]);
  const [eventoSelecionado, setEventoSelecionado] = useState(null);
  const [jaInscritoEvento, setJaInscritoEvento] = useState(false);
  const [confirmarInscricaoEvento, setConfirmarInscricaoEvento] = useState(true);
  const [buscandoDependentesConjuge, setBuscandoDependentesConjuge] = useState(false);
  const [avisoDependentesConjuge, setAvisoDependentesConjuge] = useState('');

  const potenciaisConjuges = (formData.tipo_pessoa === 'PADRINHO' ? madrinhas : padrinhos)
    .filter(p => !targetId || p.id !== targetId);

  const [dependentes, setDependentes] = useState([]);
  const [deletedDependentes, setDeletedDependentes] = useState([]);
  const [modalDependenteOpen, setModalDependenteOpen] = useState(false);
  const [dependenteEmEdicao, setDependenteEmEdicao] = useState(null);
  const [dependenteEdicaoIndex, setDependenteEdicaoIndex] = useState(null);

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [sqlMissingError, setSqlMissingError] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [buscandoCpf, setBuscandoCpf] = useState(false);
  const [cpfAviso, setCpfAviso] = useState('');

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
      const { data: inscList } = await supabase
        .from('apc_acampamento')
        .select('id')
        .eq('pessoa_id', targetId)
        .eq('evento_id', novoEvento.id)
        .limit(1);
      setJaInscritoEvento(Boolean(inscList && inscList.length > 0));
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
  ADD COLUMN IF NOT EXISTS aceite_termo_imagem BOOLEAN DEFAULT false;

-- Ficha Médica e Cuidados de Saúde para Dependentes (Filhos/Mascotes):
ALTER TABLE public.apc_dependente
  ADD COLUMN IF NOT EXISTS acampamento BOOLEAN DEFAULT false,
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
  ADD COLUMN IF NOT EXISTS cuidado_especial BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS cuidado_especial_qual TEXT,
  ADD COLUMN IF NOT EXISTS medicacao_sintomas TEXT;

-- Vínculo de quem cadastrou/inscreveu no Acampamento (Pai/Mãe/Responsável):
ALTER TABLE public.apc_acampamento
  ADD COLUMN IF NOT EXISTS criador_id UUID REFERENCES public.apc_pessoa(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_apc_acampamento_criador_id ON public.apc_acampamento(criador_id);`;

  useEffect(() => {
    fetchInitialData();
  }, [paramId, queryEventoId]);

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

  const normalizarDependente = (d) => {
    const vaiAcampamento = d?.acampamento !== undefined ? Boolean(d.acampamento) : Boolean(d?.mascote);
    const ehMascote = vaiAcampamento && Boolean(d?.mascote);
    return {
      ...d,
      data_nascimento: d.data_nascimento ? d.data_nascimento.split('T')[0] : '',
      acampamento: vaiAcampamento,
      mascote: ehMascote,
      tipo_sanguineo: d.tipo_sanguineo || '',
      problema_saude: d.problema_saude ? 'SIM' : 'NAO',
      problema_saude_qual: d.problema_saude_qual || '',
      historico_convulsao: d.historico_convulsao ? 'SIM' : 'NAO',
      historico_convulsao_tempo: d.historico_convulsao_tempo || '',
      tratamento_medico: d.tratamento_medico ? 'SIM' : 'NAO',
      tratamento_medico_qual: d.tratamento_medico_qual || '',
      medicamento_continuo: d.medicamento_continuo ? 'SIM' : 'NAO',
      medicamento_continuo_qual: d.medicamento_continuo_qual || '',
      medicamento_continuo_dosagem: d.medicamento_continuo_dosagem || '',
      lesao_contusao: d.lesao_contusao ? 'SIM' : 'NAO',
      lesao_contusao_qual: d.lesao_contusao_qual || '',
      restricao_alimentar: d.restricao_alimentar ? 'SIM' : 'NAO',
      restricao_alimentar_qual: d.restricao_alimentar_qual || '',
      doenca_respiratoria: d.doenca_respiratoria ? 'SIM' : 'NAO',
      usa_bombinha: d.usa_bombinha ? 'SIM' : 'NAO',
      alergia_medicamento: d.alergia_medicamento ? 'SIM' : 'NAO',
      alergia_medicamento_qual: d.alergia_medicamento_qual || '',
      alergia_alimento: d.alergia_alimento ? 'SIM' : 'NAO',
      alergia_alimento_qual: d.alergia_alimento_qual || '',
      cuidado_especial: d.cuidado_especial ? 'SIM' : 'NAO',
      cuidado_especial_qual: d.cuidado_especial_qual || '',
      medicacao_sintomas: d.medicacao_sintomas || ''
    };
  };

  const carregarDadosPessoa = async (p, eventoAtual) => {
    if (!p) return;
    const dataNasc = p.data_nascimento ? p.data_nascimento.split('T')[0] : '';
    const idadeAuto = p.idade !== null && p.idade !== undefined ? p.idade.toString() : calcularIdade(dataNasc);
    const anoPadrao = eventoAtual?.data_inicio
      ? new Date(eventoAtual.data_inicio).getFullYear().toString()
      : new Date().getFullYear().toString();

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
      cpf: formatarCPF(p.cpf || ''),
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
      const { data: inscList } = await supabase
        .from('apc_acampamento')
        .select('id')
        .eq('pessoa_id', p.id)
        .eq('evento_id', eventoAtual.id)
        .limit(1);

      setJaInscritoEvento(Boolean(inscList && inscList.length > 0));
    }

    // Buscar vinculo se afilhado
    if (p.tipo_pessoa === 'AFILHADO') {
      const { data: vincList } = await supabase
        .from('apc_vinculo')
        .select('*')
        .eq('afilhado_id', p.id)
        .limit(1);

      if (vincList && vincList.length > 0) {
        const vinc = vincList[0];
        setFormData(prev => ({
          ...prev,
          vinculo_id: vinc.id,
          vinculo_padrinho_id: vinc.padrinho_id || '',
          vinculo_madrinha_id: vinc.madrinha_id || ''
        }));
      }
    }

    // Buscar dependentes (caso Padrinho, Madrinha ou possua dependentes vinculados)
    let orQuery = `pessoa_id.eq.${p.id}`;
    if (p.conjuge_id) {
      orQuery += `,pessoa_id.eq.${p.conjuge_id}`;
    }
    const { data: deps } = await supabase
      .from('apc_dependente')
      .select('*')
      .or(orQuery);

    if (deps && deps.length > 0) {
      setDependentes(deps.map(normalizarDependente));
      if (p.conjuge_id) {
        const depsDoConjuge = deps.filter(d => d.pessoa_id === p.conjuge_id);
        if (depsDoConjuge.length > 0) {
          setAvisoDependentesConjuge(`${depsDoConjuge.length} dependente(s) já cadastrado(s) pelo cônjuge foram carregados.`);
        } else {
          setAvisoDependentesConjuge('');
        }
      } else {
        setAvisoDependentesConjuge('');
      }
    } else {
      setDependentes([]);
      setAvisoDependentesConjuge('');
    }
  };

  const fetchInitialData = async () => {
    try {
      setLoadingData(true);
      setError('');

      // Buscar Padrinhos e Madrinhas para vínculos de afilhado e cônjuges
      const { data: pData } = await supabase
        .from('apc_pessoa')
        .select('id, nome, ano, conjuge_id')
        .eq('tipo_pessoa', 'PADRINHO')
        .order('nome');
      const { data: mData } = await supabase
        .from('apc_pessoa')
        .select('id, nome, ano, conjuge_id')
        .eq('tipo_pessoa', 'MADRINHA')
        .order('nome');
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

      // Se passou ID na rota (:id), carrega diretamente aquele participante em modo edição
      if (paramId) {
        const { data: p, error: pError } = await supabase
          .from('apc_pessoa')
          .select('*')
          .eq('id', paramId)
          .single();

        if (pError) throw pError;

        if (p) {
          setPessoaCarregadaId(p.id);
          setModoEdicao(true);
          setCpfVerificado(true);
          await carregarDadosPessoa(p, eventoAtual);
        }
      } else {
        // Sem ID na rota: o usuário precisa informar o CPF primeiramente
        setCpfVerificado(false);
        setPessoaCarregadaId(null);
        setModoEdicao(false);
        setFormData(getInitialFormData(anoPadrao));
        setDependentes([]);
        setJaInscritoEvento(false);
      }
    } catch (err) {
      setError('Erro ao carregar dados: ' + err.message);
    } finally {
      setLoadingData(false);
    }
  };

  const handleConsultarCpf = async (cpfCustomizado) => {
    const cpfAlvo = (cpfCustomizado !== undefined ? cpfCustomizado : cpfBusca).trim();
    setCpfErro('');
    setCpfAviso('');

    if (!cpfAlvo) {
      setCpfErro('Por favor, informe o CPF do participante para continuar.');
      return;
    }

    if (!validarCPF(cpfAlvo)) {
      setCpfErro('CPF inválido. Por favor, verifique os dígitos digitados.');
      return;
    }

    try {
      setCpfBuscando(true);
      const cpfLimpo = cpfAlvo.replace(/\D/g, '');
      const cpfFormatado = formatarCPF(cpfAlvo);

      const { data: pessoasEncontradas, error: errCpf } = await supabase
        .from('apc_pessoa')
        .select('*')
        .or(`cpf.eq.${cpfFormatado},cpf.eq.${cpfLimpo}`)
        .limit(5);

      if (errCpf) throw errCpf;

      const pessoaExistente = pessoasEncontradas && pessoasEncontradas.length > 0
        ? (pessoasEncontradas.find(p => p.user_id) || pessoasEncontradas[0])
        : null;

      const eventoAlvo = eventoSelecionado || (eventosAtivos.length > 0 ? eventosAtivos[0] : null);
      const anoPadrao = eventoAlvo?.data_inicio
        ? new Date(eventoAlvo.data_inicio).getFullYear().toString()
        : new Date().getFullYear().toString();

      if (pessoaExistente) {
        // Participante cadastrado localizado -> Modo Edição com dados preenchidos
        setPessoaCarregadaId(pessoaExistente.id);
        setModoEdicao(true);
        await carregarDadosPessoa(pessoaExistente, eventoAlvo);
        setCpfVerificado(true);
        setCpfAviso(`Participante encontrado: "${pessoaExistente.nome}". Modo edição ativado.`);
      } else {
        // CPF não cadastrado -> Formulário em branco com CPF preenchido
        setPessoaCarregadaId(null);
        setModoEdicao(false);
        setFormData(getInitialFormData(anoPadrao, cpfFormatado));
        setDependentes([]);
        setJaInscritoEvento(false);
        setCpfVerificado(true);
        setCpfAviso(`CPF ${cpfFormatado} não cadastrado. Formulário aberto para novo cadastro.`);
      }
    } catch (err) {
      console.error('Erro ao consultar CPF:', err);
      setCpfErro('Erro ao consultar CPF: ' + (err.message || 'Tente novamente.'));
    } finally {
      setCpfBuscando(false);
    }
  };

  const handleTrocarCpf = () => {
    setCpfVerificado(false);
    setCpfBusca('');
    setCpfErro('');
    setCpfAviso('');
    setPessoaCarregadaId(null);
    setModoEdicao(false);
    setJaInscritoEvento(false);
  };

  const handleConjugeChange = async (novoConjugeId) => {
    setFormData(prev => ({ ...prev, conjuge_id: novoConjugeId }));
    setAvisoDependentesConjuge('');

    if (!novoConjugeId) {
      // Se desmarcou o cônjuge, mantemos apenas dependentes próprios (pessoa_id === targetId ou novos)
      setDependentes(prev => prev.filter(d => !d.pessoa_id || (targetId && d.pessoa_id === targetId)));
      return;
    }

    try {
      setBuscandoDependentesConjuge(true);
      let orQuery = `pessoa_id.eq.${novoConjugeId}`;
      if (targetId) {
        orQuery += `,pessoa_id.eq.${targetId}`;
      }

      const { data: depsData, error: depsErr } = await supabase
        .from('apc_dependente')
        .select('*')
        .or(orQuery);

      if (depsErr) throw depsErr;

      if (depsData && depsData.length > 0) {
        const normalizedList = depsData.map(normalizarDependente);

        setDependentes(prev => {
          const naoSalvos = prev.filter(d => !d.id);
          const idsExistentes = new Set(normalizedList.map(d => d.id));
          const outrosJaSalvos = prev.filter(d => d.id && !idsExistentes.has(d.id) && targetId && d.pessoa_id === targetId);
          return [...normalizedList, ...outrosJaSalvos, ...naoSalvos];
        });

        const depsDoConjuge = depsData.filter(d => d.pessoa_id === novoConjugeId);
        if (depsDoConjuge.length > 0) {
          const conjugeObj = (formData.tipo_pessoa === 'PADRINHO' ? madrinhas : padrinhos).find(c => c.id === novoConjugeId);
          setAvisoDependentesConjuge(
            `${depsDoConjuge.length} dependente(s) já cadastrado(s) por ${conjugeObj?.nome || 'cônjuge'} foram carregados para você!`
          );
        } else {
          setAvisoDependentesConjuge('');
        }
      } else {
        setDependentes(prev => prev.filter(d => !d.pessoa_id || (targetId && d.pessoa_id === targetId)));
        setAvisoDependentesConjuge('');
      }
    } catch (err) {
      console.warn('Erro ao carregar dependentes do cônjuge:', err);
    } finally {
      setBuscandoDependentesConjuge(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const rawVal = type === 'checkbox' ? checked : value;
    const val = name === 'cpf' ? formatarCPF(rawVal) : rawVal;

    if (name === 'conjuge_id') {
      handleConjugeChange(val);
      return;
    }

    setFormData(prev => {
      const updated = {
        ...prev,
        [name]: val,
        ...(name === 'tipo_pessoa' && val !== 'PADRINHO' && val !== 'MADRINHA' ? { conjuge_id: '' } : {})
      };

      if (name === 'tipo_pessoa' && val !== 'PADRINHO' && val !== 'MADRINHA') {
        setDependentes([]);
        setAvisoDependentesConjuge('');
      }

      // Se mudou a data de nascimento, recalcula a idade automaticamente
      if (name === 'data_nascimento') {
        updated.idade = calcularIdade(val);
      }

      return updated;
    });
  };

  const handleCpfBlur = async () => {
    if (!formData.cpf || !validarCPF(formData.cpf)) {
      return;
    }

    // Se estiver editando um participante já existente carregado por targetId, não substitui
    if (targetId) return;

    try {
      setBuscandoCpf(true);
      setCpfAviso('');
      const cpfLimpo = formData.cpf.replace(/\D/g, '');

      const { data: pessoasEncontradas, error: errCpf } = await supabase
        .from('apc_pessoa')
        .select('*')
        .or(`cpf.eq.${formData.cpf},cpf.eq.${cpfLimpo}`)
        .limit(5);

      if (errCpf) throw errCpf;

      const pessoaExistente = pessoasEncontradas && pessoasEncontradas.length > 0
        ? (pessoasEncontradas.find(p => p.user_id) || pessoasEncontradas[0])
        : null;

      if (pessoaExistente) {
        const dataNasc = pessoaExistente.data_nascimento ? pessoaExistente.data_nascimento.split('T')[0] : '';
        const idadeAuto = pessoaExistente.idade !== null && pessoaExistente.idade !== undefined
          ? pessoaExistente.idade.toString()
          : calcularIdade(dataNasc);

        setFormData(prev => ({
          ...prev,
          nome: pessoaExistente.nome || prev.nome,
          email: pessoaExistente.email || prev.email,
          telefone: pessoaExistente.telefone || prev.telefone,
          sexo: pessoaExistente.sexo || prev.sexo,
          data_nascimento: dataNasc || prev.data_nascimento,
          idade: idadeAuto || prev.idade,
          tipo_pessoa: pessoaExistente.tipo_pessoa || prev.tipo_pessoa,
          rg: pessoaExistente.rg || prev.rg,
          contato_emergencia: pessoaExistente.contato_emergencia || prev.contato_emergencia,
          nome_responsavel: pessoaExistente.nome_responsavel || (pessoaExistente.nome_pai || pessoaExistente.nome_mae || prev.nome_responsavel),
          nome_pai: pessoaExistente.nome_pai || prev.nome_pai,
          nome_mae: pessoaExistente.nome_mae || prev.nome_mae,
          fone_responsavel: pessoaExistente.fone_responsavel || prev.fone_responsavel,
          tipo_sanguineo: pessoaExistente.tipo_sanguineo || prev.tipo_sanguineo,
          problema_saude: pessoaExistente.problema_saude ? 'SIM' : 'NAO',
          problema_saude_qual: pessoaExistente.problema_saude_qual || '',
          historico_convulsao: pessoaExistente.historico_convulsao ? 'SIM' : 'NAO',
          historico_convulsao_tempo: pessoaExistente.historico_convulsao_tempo || '',
          tratamento_medico: pessoaExistente.tratamento_medico ? 'SIM' : 'NAO',
          tratamento_medico_qual: pessoaExistente.tratamento_medico_qual || '',
          medicamento_continuo: pessoaExistente.medicamento_continuo ? 'SIM' : 'NAO',
          medicamento_continuo_qual: pessoaExistente.medicamento_continuo_qual || '',
          medicamento_continuo_dosagem: pessoaExistente.medicamento_continuo_dosagem || '',
          lesao_contusao: pessoaExistente.lesao_contusao ? 'SIM' : 'NAO',
          lesao_contusao_qual: pessoaExistente.lesao_contusao_qual || '',
          restricao_alimentar: pessoaExistente.restricao_alimentar ? 'SIM' : 'NAO',
          restricao_alimentar_qual: pessoaExistente.restricao_alimentar_qual || '',
          doenca_respiratoria: pessoaExistente.doenca_respiratoria ? 'SIM' : 'NAO',
          usa_bombinha: pessoaExistente.usa_bombinha ? 'SIM' : 'NAO',
          alergia_medicamento: pessoaExistente.alergia_medicamento ? 'SIM' : 'NAO',
          alergia_medicamento_qual: pessoaExistente.alergia_medicamento_qual || '',
          alergia_alimento: pessoaExistente.alergia_alimento ? 'SIM' : 'NAO',
          alergia_alimento_qual: pessoaExistente.alergia_alimento_qual || '',
          medicacao_sintomas: pessoaExistente.medicacao_sintomas || '',
          cuidado_especial: pessoaExistente.cuidado_especial ? 'SIM' : 'NAO',
          cuidado_especial_qual: pessoaExistente.cuidado_especial_qual || '',
          camiseta: pessoaExistente.camiseta || prev.camiseta,
          camiseta_infantil: pessoaExistente.camiseta_infantil || prev.camiseta_infantil,
          outras_informacoes: pessoaExistente.outras_informacoes || (pessoaExistente.necessidade_medica || prev.outras_informacoes),
          aceite_termos_dados: !!pessoaExistente.aceite_termos_dados,
          aceite_termo_imagem: !!pessoaExistente.aceite_termo_imagem,
          user_id: pessoaExistente.user_id || ''
        }));

        // Verificar se essa pessoa já tem inscrição no evento selecionado
        const eventoParaChecar = eventoSelecionado || (eventosAtivos.length > 0 ? eventosAtivos[0] : null);
        if (eventoParaChecar) {
          const { data: inscList } = await supabase
            .from('apc_acampamento')
            .select('id')
            .eq('pessoa_id', pessoaExistente.id)
            .eq('evento_id', eventoParaChecar.id)
            .limit(1);

          const temInscricao = Boolean(inscList && inscList.length > 0);
          setJaInscritoEvento(temInscricao);
          if (temInscricao) {
            setCpfAviso(`Participante encontrado: "${pessoaExistente.nome}". Atenção: já possui inscrição neste evento!`);
          } else {
            setCpfAviso(`Participante encontrado no sistema: "${pessoaExistente.nome}". Os dados foram carregados automaticamente.`);
          }
        } else {
          setCpfAviso(`Participante encontrado no sistema: "${pessoaExistente.nome}". Os dados foram carregados.`);
        }
      } else {
        setCpfAviso('CPF novo: será criado um novo participante ao salvar.');
      }
    } catch (findErr) {
      console.warn('Erro ao consultar CPF:', findErr.message);
    } finally {
      setBuscandoCpf(false);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlMigrationCode);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
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

  const handleRemoveDependente = async (index) => {
    const depToRemove = dependentes[index];
    if (depToRemove?.id) {
      if (targetId) {
        try {
          await supabase.from('apc_dependente').delete().eq('id', depToRemove.id);
        } catch (err) {
          console.error('Erro ao excluir dependente do banco:', err);
        }
      }
      setDeletedDependentes(prev => [...prev, depToRemove.id]);
    }
    setDependentes(prev => prev.filter((_, i) => i !== index));
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
    if (!formData.cpf || !formData.cpf.trim()) {
      pendencias.push('CPF do Participante');
    } else if (!validarCPF(formData.cpf)) {
      pendencias.push('CPF do Participante (informe um CPF válido)');
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
    if (formData.tipo_pessoa === 'PADRINHO' || formData.tipo_pessoa === 'MADRINHA') {
      const depSemNome = dependentes.some(d => !d.nome || !d.nome.trim());
      if (depSemNome) {
        pendencias.push('Nome do Dependente (informe o nome ou remova a linha)');
      }
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
        const { data: existingByUserList } = await supabase
          .from('apc_pessoa')
          .select('id')
          .eq('user_id', finalUserId)
          .limit(1);
        if (existingByUserList && existingByUserList.length > 0) {
          pessoaIdSalva = existingByUserList[0].id;
        }
      }

      // Se ainda não temos pessoaIdSalva (ex: cadastrando um dependente/terceiro), verifica se já existe pelo CPF
      if (!pessoaIdSalva && formData.cpf) {
        const cpfLimpo = formData.cpf.replace(/\D/g, '');
        const { data: existingByCpfList } = await supabase
          .from('apc_pessoa')
          .select('id, cpf, user_id')
          .or(`cpf.eq.${formData.cpf},cpf.eq.${cpfLimpo}`)
          .limit(5);
        if (existingByCpfList && existingByCpfList.length > 0) {
          pessoaIdSalva = (existingByCpfList.find(p => p.user_id) || existingByCpfList[0]).id;
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

      // Atualização recíproca do cônjuge (Padrinho <-> Madrinha)
      if (formData.conjuge_id && pessoaIdSalva) {
        try {
          await supabase
            .from('apc_pessoa')
            .update({ conjuge_id: pessoaIdSalva })
            .eq('id', formData.conjuge_id);
        } catch (conjErr) {
          console.warn('Erro ao atualizar cônjuge recíproco:', conjErr);
        }
      }

      // Dependentes caso seja Padrinho ou Madrinha
      if ((formData.tipo_pessoa === 'PADRINHO' || formData.tipo_pessoa === 'MADRINHA') && pessoaIdSalva) {
        if (deletedDependentes.length > 0) {
          await supabase.from('apc_dependente').delete().in('id', deletedDependentes);
          setDeletedDependentes([]);
        }

        if (dependentes.length > 0) {
          const depsToInsert = [];
          const depsToUpdate = [];

          dependentes
            .filter(d => d.nome && d.nome.trim() !== '')
            .forEach(d => {
              const vaiAcampamento = Boolean(d.acampamento);
              const ehMascote = vaiAcampamento && Boolean(d.mascote);
              const dep = {
                pessoa_id: d.pessoa_id || pessoaIdSalva,
                nome: d.nome.trim(),
                data_nascimento: d.data_nascimento || null,
                acampamento: vaiAcampamento,
                mascote: ehMascote,
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
                depsToUpdate.push(dep);
              } else {
                depsToInsert.push(dep);
              }
            });

          try {
            if (depsToInsert.length > 0) {
              const { data: insertedDeps, error: insDepErr } = await supabase.from('apc_dependente').insert(depsToInsert).select();
              if (insDepErr) throw insDepErr;
              if (insertedDeps) {
                setDependentes(prev => {
                  let insIdx = 0;
                  return prev.map(d => {
                    if (!d.id && insertedDeps[insIdx]) {
                      const item = { ...d, id: insertedDeps[insIdx].id };
                      insIdx++;
                      return item;
                    }
                    return d;
                  });
                });
              }
            }
            if (depsToUpdate.length > 0) {
              const { error: upsDepErr } = await supabase.from('apc_dependente').upsert(depsToUpdate);
              if (upsDepErr) throw upsDepErr;
            }
          } catch (depErr) {
            console.warn('Erro ao salvar dependentes com novos campos, tentando fallback básico:', depErr);
            const isDepColumnErr = depErr.code === '42703' || (depErr.message && depErr.message.toLowerCase().includes('column'));
            if (isDepColumnErr) {
              setSqlMissingError(true);
              const fallbackInsert = depsToInsert.map(d => ({
                pessoa_id: d.pessoa_id,
                nome: d.nome,
                data_nascimento: d.data_nascimento,
                acampamento: d.acampamento,
                mascote: d.mascote
              }));
              const fallbackUpdate = depsToUpdate.map(d => ({
                id: d.id,
                pessoa_id: d.pessoa_id,
                nome: d.nome,
                data_nascimento: d.data_nascimento,
                acampamento: d.acampamento,
                mascote: d.mascote
              }));
              if (fallbackInsert.length > 0) {
                await supabase.from('apc_dependente').insert(fallbackInsert);
              }
              if (fallbackUpdate.length > 0) {
                await supabase.from('apc_dependente').upsert(fallbackUpdate);
              }
            } else {
              throw depErr;
            }
          }
        }
      }

      // Inscrição no evento ativo selecionado
      const eventoParaInscrever = eventoSelecionado || (eventosAtivos.length > 0 ? eventosAtivos[0] : null);
      if (confirmarInscricaoEvento && !jaInscritoEvento && eventoParaInscrever && pessoaIdSalva) {
        try {
          const criadorId = pessoaProfile?.id || null;
          const payloadInscricao = {
            evento_id: eventoParaInscrever.id,
            pessoa_id: pessoaIdSalva,
            equipe: []
          };
          if (criadorId) {
            payloadInscricao.criador_id = criadorId;
          }

          const { error: insAcampErr } = await supabase.from('apc_acampamento').insert([payloadInscricao]);
          if (insAcampErr) {
            // Se falhar por causa da coluna criador_id ainda não adicionada no DB, tenta sem ela
            if (insAcampErr.message && insAcampErr.message.includes('criador_id')) {
              await supabase.from('apc_acampamento').insert([{
                evento_id: eventoParaInscrever.id,
                pessoa_id: pessoaIdSalva,
                equipe: []
              }]);
            } else {
              throw insAcampErr;
            }
          }
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

      // Se foi criação de nova pessoa de terceiro ou se o usuário veio de Acampamento, redireciona
      if (!isPropriaPessoa) {
        setTimeout(() => navigate('/minhas-inscricoes'), 1800);
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
      <div className="glass-panel form-section-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', padding: '0.65rem 1.25rem', marginBottom: '0.85rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => navigate(-1)} className="btn btn-secondary" style={{ padding: '0.45rem' }}>
            <ArrowLeft size={18} />
          </button>
          <span
            style={{
              display: 'inline-block',
              background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
              color: 'white',
              padding: '0.2rem 0.65rem',
              borderRadius: '999px',
              fontSize: '1.25rem',
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
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
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

      {!cpfVerificado ? (
        <div
          className="glass-panel form-section-card"
          style={{
            padding: '1.25rem 1.5rem',
            margin: '0 auto 1.5rem',
            borderRadius: '16px',
            border: '1px solid rgba(37, 99, 235, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem'
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleConsultarCpf();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexWrap: 'wrap',
              gap: '0.85rem',
              width: '100%'
            }}
          >
            <label
              htmlFor="cpfBusca"
              style={{
                margin: 0,
                fontSize: '0.95rem',
                fontWeight: '600',
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap'
              }}
            >
              Informe o CPF:
            </label>

            <input
              id="cpfBusca"
              type="text"
              className="form-input"
              placeholder="000.000.000-00"
              value={cpfBusca}
              onChange={(e) => {
                setCpfBusca(formatarCPF(e.target.value));
                if (cpfErro) setCpfErro('');
              }}
              maxLength={14}
              autoFocus
              style={{
                maxWidth: '220px',
                fontSize: '1.05rem',
                letterSpacing: '0.04em',
                fontWeight: '600',
                padding: '0.55rem 0.85rem',
                textAlign: 'center'
              }}
            />

            <button
              type="submit"
              className="btn btn-primary"
              disabled={cpfBuscando}
              style={{
                padding: '0.55rem 1.25rem',
                fontSize: '0.95rem',
                fontWeight: '600',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                whiteSpace: 'nowrap'
              }}
            >
              {cpfBuscando ? (
                <>
                  <Loader2 size={16} className="spin" />
                  <span>Consultando...</span>
                </>
              ) : (
                <>
                  <Search size={16} />
                  <span>Consultar</span>
                </>
              )}
            </button>
          </form>

          {cpfErro && (
            <div style={{ color: '#dc2626', fontSize: '0.85rem', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.25rem' }}>
              <AlertCircle size={15} />
              {cpfErro}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Barra de Status do Participante */}
          <div
            className="glass-panel"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
              padding: '0.85rem 1.25rem',
              marginBottom: '1rem',
              borderRadius: '12px',
              border: modoEdicao ? '1px solid #86efac' : '1px solid #93c5fd',
              background: modoEdicao
                ? 'linear-gradient(135deg, rgba(240, 253, 244, 0.95), rgba(220, 252, 231, 0.95))'
                : 'linear-gradient(135deg, rgba(239, 246, 255, 0.95), rgba(219, 234, 254, 0.95))'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: modoEdicao ? '#16a34a' : '#2563eb',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                {modoEdicao ? <Edit3 size={18} /> : <UserPlus size={18} />}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: '800',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '999px',
                      background: modoEdicao ? '#15803d' : '#1d4ed8',
                      color: 'white'
                    }}
                  >
                    {modoEdicao ? 'Modo Edição' : 'Novo Cadastro'}
                  </span>
                  <strong style={{ fontSize: '0.95rem', color: modoEdicao ? '#14532d' : '#1e3a8a' }}>
                    {modoEdicao ? (formData.nome || 'Participante Cadastrado') : 'Participante Não Cadastrado'}
                  </strong>
                </div>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.825rem', color: modoEdicao ? '#166534' : '#1e40af' }}>
                  CPF: <strong>{formData.cpf}</strong>
                  {modoEdicao
                    ? ' — Dados do participante carregados do sistema para edição.'
                    : ' — Formulário com todos os dados vazios pronto para novo preenchimento.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleTrocarCpf}
              className="btn btn-secondary"
              style={{
                fontSize: '0.825rem',
                padding: '0.45rem 0.85rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
              title="Trocar CPF e pesquisar outro participante"
            >
              <RotateCcw size={14} />
              <span>Trocar CPF</span>
            </button>
          </div>

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
                    <option value="AFILHADO">Afilhado(a)</option>
                    <option value="PADRINHO">Padrinho</option>
                    <option value="MADRINHA">Madrinha</option>
                    <option value="VOLUNTARIO">Voluntário(a)</option>
                  </select>
                </div>

                {(formData.tipo_pessoa === 'PADRINHO' || formData.tipo_pessoa === 'MADRINHA') ? (
                  <div className="form-group">
                    <label className="form-label" htmlFor="conjuge_id" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>Cônjuge (opcional)</span>
                      {buscandoDependentesConjuge && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Loader2 size={12} className="spin" /> Buscando dependentes...
                        </span>
                      )}
                    </label>
                    <select
                      id="conjuge_id"
                      name="conjuge_id"
                      className="form-input"
                      value={formData.conjuge_id}
                      onChange={handleChange}
                    >
                      <option value="">-- Selecione o cônjuge (se houver) --</option>
                      {potenciaisConjuges.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.nome} {c.ano ? `(Turma ${c.ano})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
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
                )}
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
                  <label className="form-label" htmlFor="cpf" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>CPF do Participante *</span>
                    <button
                      type="button"
                      onClick={handleTrocarCpf}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--accent-primary)',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        padding: 0,
                        fontWeight: '600'
                      }}
                    >
                      Trocar CPF
                    </button>
                  </label>
                  <input
                    id="cpf"
                    name="cpf"
                    type="text"
                    className="form-input"
                    placeholder="000.000.000-00"
                    value={formData.cpf}
                    readOnly
                    style={{ backgroundColor: 'rgba(0, 0, 0, 0.03)', cursor: 'not-allowed', fontWeight: '600' }}
                    required
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem', display: 'block' }}>
                    CPF validado na identificação inicial. Para alterar, clique em &ldquo;Trocar CPF&rdquo;.
                  </span>
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
            {/* DEPENDENTES (FILHOS) - Visível quando Padrinho ou Madrinha */}
            {/* ========================================================================= */}
            {(formData.tipo_pessoa === 'PADRINHO' || formData.tipo_pessoa === 'MADRINHA') && (
              <div className="glass-panel form-section-card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
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
                    onClick={handleAbrirModalNovoDependente}
                    className="btn btn-primary"
                    style={{ padding: '0.45rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem', fontWeight: 600 }}
                  >
                    <Plus size={16} /> Adicionar Dependente
                  </button>
                </div>

                {avisoDependentesConjuge && (
                  <div style={{
                    background: 'rgba(59, 130, 246, 0.08)',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                    borderRadius: '8px',
                    padding: '0.65rem 0.85rem',
                    marginBottom: '0.85rem',
                    color: '#1d4ed8',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <CheckCircle2 size={18} color="#2563eb" />
                    <span>{avisoDependentesConjuge}</span>
                  </div>
                )}

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
                      onClick={handleAbrirModalNovoDependente}
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
                                    background: dep.acampamento
                                      ? (dep.mascote ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)')
                                      : 'rgba(148, 163, 184, 0.15)',
                                    color: dep.acampamento
                                      ? (dep.mascote ? '#d97706' : '#10b981')
                                      : 'var(--text-secondary)',
                                    border: dep.acampamento
                                      ? (dep.mascote ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)')
                                      : '1px solid rgba(148, 163, 184, 0.3)'
                                  }}
                                >
                                  {dep.acampamento
                                    ? (dep.mascote ? '✓ Vai para o Acampamento (Mascote)' : '✓ Vai para o Acampamento')
                                    : 'Não vai para o Acampamento'}
                                </span>
                                {dep.pessoa_id && formData.conjuge_id && dep.pessoa_id === formData.conjuge_id && (
                                  <span
                                    style={{
                                      fontSize: '0.725rem',
                                      padding: '0.15rem 0.5rem',
                                      borderRadius: '999px',
                                      fontWeight: 600,
                                      background: 'rgba(59, 130, 246, 0.12)',
                                      color: '#2563eb',
                                      border: '1px solid rgba(59, 130, 246, 0.25)'
                                    }}
                                  >
                                    Vindo do cônjuge
                                  </span>
                                )}
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
                                onClick={() => handleAbrirModalEditarDependente(index)}
                                className="btn btn-secondary"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.75rem', fontSize: '0.825rem' }}
                                title="Editar Dados e Ficha Médica"
                              >
                                <Edit3 size={15} /> Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveDependente(index)}
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
            )}

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
                  padding: '0.85rem 1rem',
                  borderRadius: '8px',
                  marginTop: '0.75rem'
                }}
              >
                <h4 style={{ margin: '0 0 0.65rem 0', fontSize: '0.95rem', fontWeight: 'bold', color: isMenorDeIdade ? '#b45309' : 'var(--text-primary)' }}>
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
              <div style={{ marginBottom: '0.75rem' }}>
                <label className="form-label" style={{ marginBottom: '0.25rem' }}>
                  Tem ou já teve: convulsão, epilepsia, sangramentos constantes?
                </label>
                <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '0.35rem' }}>
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
              <div style={{ marginBottom: '0.75rem' }}>
                <label className="form-label" style={{ marginBottom: '0.25rem' }}>
                  Está fazendo algum tratamento médico? (Ex: Psicológico, Cardíaco, outros)
                </label>
                <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '0.35rem' }}>
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
              <div style={{ marginBottom: '0.75rem' }}>
                <label className="form-label" style={{ marginBottom: '0.25rem' }}>
                  Faz uso de medicamento contínuo?
                </label>
                <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '0.35rem' }}>
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
                  <div className="form-grid" style={{ gap: '0.75rem' }}>
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
              <div style={{ marginBottom: '0.75rem' }}>
                <label className="form-label" style={{ marginBottom: '0.25rem' }}>
                  Possui atualmente alguma lesão ou contusão?
                </label>
                <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '0.35rem' }}>
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
              <div style={{ marginBottom: '0.75rem' }}>
                <label className="form-label" style={{ marginBottom: '0.25rem' }}>
                  Possui restrição alimentar? (Ex: Glúten, Lactose, outros)
                </label>
                <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '0.35rem' }}>
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
              <div style={{ marginBottom: '0.75rem' }}>
                <label className="form-label" style={{ marginBottom: '0.25rem' }}>
                  Tem doença respiratória? (Ex: Asma, Bronquite)
                </label>
                <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '0.35rem' }}>
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
                  <div style={{ background: 'var(--bg-secondary)', padding: '0.5rem 0.75rem', borderRadius: '8px', marginTop: '0.35rem', border: '1px solid var(--border-color)' }}>
                    <label className="form-label" style={{ marginBottom: '0.25rem' }}>
                      Faz uso de bombinha?
                    </label>
                    <div style={{ display: 'flex', gap: '1.25rem' }}>
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
              <div style={{ marginBottom: '0.75rem' }}>
                <label className="form-label" style={{ marginBottom: '0.25rem' }}>
                  Tem alergia à algum tipo de medicação?
                </label>
                <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '0.35rem' }}>
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
              <div style={{ marginBottom: '0.75rem' }}>
                <label className="form-label" style={{ marginBottom: '0.25rem' }}>
                  Tem alergia à algum tipo de alimento?
                </label>
                <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '0.35rem' }}>
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
                <label className="form-label" style={{ marginBottom: '0.25rem' }}>
                  Demanda algum tipo de cuidado especial?
                </label>
                <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '0.35rem' }}>
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
              <div className="form-group" style={{ marginTop: '0.85rem' }}>
                <label className="form-label" htmlFor="medicacao_sintomas" style={{ marginBottom: '0.25rem' }}>
                  Em caso de Febre, Dor de Cabeça, Dor Muscular ou Desconforto Gastrointestinal, qual o tipo de medicação costuma tomar e qual a dosagem?
                </label>
                <textarea
                  id="medicacao_sintomas"
                  name="medicacao_sintomas"
                  className="form-input"
                  rows="2"
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
                <label className="form-label" htmlFor="outras_informacoes" style={{ marginBottom: '0.25rem' }}>
                  Outras observações, cuidados ou informações relevantes para a equipe:
                </label>
                <textarea
                  id="outras_informacoes"
                  name="outras_informacoes"
                  className="form-input"
                  rows="2"
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

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                <span style={{ color: 'var(--text-primary)', marginTop: '0', marginBottom: '0.5rem', fontSize: '0.8rem', fontWeight: '700' }}>5.1. Tratamento de Dados Pessoais – LGPD</span>
                <div className="form-group">
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
                    <label htmlFor="aceite_termos_dados" style={{ cursor: 'pointer', fontSize: '0.9rem', lineHeight: 1.5, textAlign: 'justify' }}>
                      <strong>PAIS OU RESPONSÁVEIS: </strong> Declaro estar ciente de que meus dados pessoais e os dados do menor sob minha responsabilidade serão tratados para fins de inscrição, organização e segurança do <strong>{eventoSelecionado?.descricao || 'Acampamento do Pós-Crisma'}</strong>, podendo ser compartilhados, quando necessário, com o <strong>{eventoSelecionado?.local || ''} </strong>  e a empresa de transporte contratada, exclusivamente para viabilizar a realização do evento.
                      As informações da Ficha de Saúde serão utilizadas para atender às necessidades de cuidado e segurança dos participantes, com acesso restrito às pessoas autorizadas.
                    </label>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                <span style={{ color: 'var(--text-primary)', marginTop: '0', marginBottom: '0.5rem', fontSize: '0.8rem', fontWeight: '700' }}>5.2. Autorização de Uso de Imagem</span>
                <div className="form-group">
                  {/* Termo 2: Autorização de uso de imagem */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <input
                      type="checkbox"
                      id="aceite_termo_imagem"
                      name="aceite_termo_imagem"
                      checked={formData.aceite_termo_imagem}
                      onChange={handleChange}
                      required
                      style={{ width: '1.3rem', height: '1.3rem', marginTop: '0.2rem', cursor: 'pointer' }}
                    />
                    <label htmlFor="aceite_termo_imagem" style={{ cursor: 'pointer', fontSize: '0.9rem', lineHeight: 1.5, textAlign: 'justify' }}>
                      <strong>PAIS OU RESPONSÁVEIS: </strong> Autorizo, de forma livre e específica, o uso da minha imagem e/ou da imagem do menor sob minha responsabilidade em fotografias e filmagens realizadas durante o <strong>{eventoSelecionado?.descricao || 'Acampamento do Pós-Crisma'}</strong>, para divulgação das atividades da Paróquia Santa Maria dos Pobres em seus sites e redes sociais.
                      Estou ciente de que esta autorização é independente da inscrição e da participação no evento.
                    </label>
                  </div>
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
        </>
      )}

      {/* ========================================================================= */}
      {/* MODAL / POPUP: ADICIONAR / EDITAR DEPENDENTE */}
      {/* ========================================================================= */}
      <ModalDependente
        isOpen={modalDependenteOpen}
        onClose={handleFecharModalDependente}
        onSave={handleSalvarDependenteModal}
        initialData={dependenteEmEdicao}
        edicaoIndex={dependenteEdicaoIndex}
        pessoaId={targetId}
      />
    </div>
  );
};
