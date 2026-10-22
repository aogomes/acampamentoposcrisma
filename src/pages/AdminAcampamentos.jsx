import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Tent, Plus, Trash2, Edit2, Search, Filter, ArrowLeft, DollarSign, CheckCircle2, Users, X, Check, ArrowUpDown, ArrowUp, ArrowDown, ArrowRight, FileSpreadsheet } from 'lucide-react';
import { useParams, Link } from 'react-router-dom';
import { registrarAuditoria } from '../services/auditoriaService';
import { exportarRelatorioExcelEvento } from '../utils/relatorioExcel';

const calcularIdade = (dataNascimento) => {
  if (!dataNascimento) return null;
  const hoje = new Date();
  const nasc = new Date(dataNascimento);
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) {
    idade--;
  }
  return idade;
};

const formatCurrency = (val) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
};

const getTipoLabel = (a) => {
  const tipo = a?.apc_pessoa?.tipo_pessoa;
  if (tipo === 'PADRINHO' || tipo === 'MADRINHA') return 'Padrinhos';
  if (tipo === 'AFILHADO') return 'Afilhado(a)';
  if (tipo === 'VOLUNTARIO') return 'Voluntário(a)';
  return tipo || '';
};

const getPadrinhosTexto = (a) => {
  const p = a?.apc_pessoa;
  if (!p || p.tipo_pessoa !== 'AFILHADO') return '-';

  const padrinhoNome = p.vinculo?.padrinho?.nome;
  const madrinhaNome = p.vinculo?.madrinha?.nome;

  if (padrinhoNome && madrinhaNome) {
    return `${padrinhoNome} e ${madrinhaNome}`;
  }
  if (padrinhoNome) return padrinhoNome;
  if (madrinhaNome) return madrinhaNome;
  if (p.padrinhos_catequistas) return p.padrinhos_catequistas;
  return 'Não vinculado';
};

const calcularValorTotal = (acampamento, evento) => {
  if (!evento) return { total: 0, itens: [] };

  const valorPadrao = parseFloat(evento.valor || 0);
  const valorDif = evento.valor_diferenciado !== null && evento.valor_diferenciado !== undefined && evento.valor_diferenciado !== ''
    ? parseFloat(evento.valor_diferenciado)
    : null;
  const idadeMin = evento.idade_min_diferenciada !== null && evento.idade_min_diferenciada !== undefined && evento.idade_min_diferenciada !== ''
    ? parseInt(evento.idade_min_diferenciada, 10)
    : null;
  const idadeMax = evento.idade_max_diferenciada !== null && evento.idade_max_diferenciada !== undefined && evento.idade_max_diferenciada !== ''
    ? parseInt(evento.idade_max_diferenciada, 10)
    : null;

  const tipo = acampamento.apc_pessoa?.tipo_pessoa;
  const itens = [];

  // Se for AFILHADO (inscrição individual do afilhado)
  if (tipo === 'AFILHADO') {
    itens.push({
      descricao: `Afilhado(a): ${acampamento.apc_pessoa?.nome || 'Afilhado'}`,
      valor: valorPadrao
    });
    return {
      total: valorPadrao,
      itens
    };
  }

  // Se for PADRINHO, MADRINHA, VOLUNTÁRIO ou outro tipo familiar
  // 1. Titular
  if (acampamento.apc_pessoa) {
    itens.push({
      descricao: `${acampamento.apc_pessoa.nome}`,
      valor: valorPadrao
    });
  }

  // 2. Cônjuge (apenas se inscrito no acampamento via apc_acampamento)
  if (acampamento.conjuge_inscricao && acampamento.apc_pessoa?.conjuge) {
    itens.push({
      descricao: `${acampamento.apc_pessoa.conjuge.nome}`,
      valor: valorPadrao
    });
  }

  // 3. Dependentes (apenas os que vão para o acampamento: acampamento === true ou mascote === true)
  const dependentes = acampamento.apc_pessoa?.dependentes_agrupados || [];
  dependentes.forEach(dep => {
    if (!(dep.acampamento ?? dep.mascote)) return;

    const idade = calcularIdade(dep.data_nascimento);
    let valorDep = 0;

    if (valorDif !== null && idadeMin !== null && idadeMax !== null) {
      if (idade !== null) {
        if (idade >= idadeMin && idade <= idadeMax) {
          valorDep = valorDif;
        } else if (idade < idadeMin) {
          valorDep = 0;
        } else {
          valorDep = valorPadrao;
        }
      } else {
        // Sem data de nascimento informada
        valorDep = valorDif;
      }
    } else {
      valorDep = valorPadrao;
    }

    itens.push({
      descricao: `${dep.nome}${idade !== null ? ` (${idade} anos)` : ''}`,
      valor: valorDep
    });
  });

  const total = itens.reduce((acc, item) => acc + item.valor, 0);
  return { total, itens };
};

export const AdminAcampamentos = () => {
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.perfil === 'ADMIN';
  const { evento_id } = useParams();

  const [acampamentos, setAcampamentos] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [pessoas, setPessoas] = useState([]);

  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [exportingExcel, setExportingExcel] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterVinculo, setFilterVinculo] = useState('TODOS');
  const [filterTipo, setFilterTipo] = useState('TODOS');
  const [filterAno, setFilterAno] = useState('TODOS');
  const [sortField, setSortField] = useState('tipo');
  const [sortDirection, setSortDirection] = useState('asc');

  const [formData, setFormData] = useState({
    evento_id: evento_id || '',
    pessoa_id: '',
    titular_id: null,
    titular_equipe: [],
    titular_inscrito: true,
    conjuge_id: null,
    conjuge_pessoa_id: '',
    conjuge_equipe: [],
    conjuge_inscrito: false
  });

  const [equipesDisponiveis, setEquipesDisponiveis] = useState([]);
  const [modalFilhos, setModalFilhos] = useState({
    isOpen: false,
    inscricaoId: null,
    titularNome: '',
    conjugeNome: '',
    dependentes: [],
    pos: null
  });
  const popoverFilhosRef = useRef(null);

  useEffect(() => {
    if (!modalFilhos.isOpen) return;

    const handleClickOutside = (e) => {
      if (popoverFilhosRef.current && !popoverFilhosRef.current.contains(e.target)) {
        setModalFilhos(prev => ({ ...prev, isOpen: false, inscricaoId: null }));
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setModalFilhos(prev => ({ ...prev, isOpen: false, inscricaoId: null }));
      }
    };

    const handleScroll = (e) => {
      if (popoverFilhosRef.current && !popoverFilhosRef.current.contains(e.target)) {
        setModalFilhos(prev => ({ ...prev, isOpen: false, inscricaoId: null }));
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [modalFilhos.isOpen]);

  const [caixaPadrinhos, setCaixaPadrinhos] = useState(null);
  const [caixaValor, setCaixaValor] = useState(null);
  const popoverPadrinhosRef = useRef(null);
  const popoverValorRef = useRef(null);
  const padrinhosTimeoutRef = useRef(null);

  useEffect(() => {
    if (!caixaPadrinhos?.isOpen) return;

    const handleScroll = () => {
      setCaixaPadrinhos(null);
    };

    window.addEventListener('scroll', handleScroll, true);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [caixaPadrinhos?.isOpen]);

  useEffect(() => {
    if (!caixaValor?.isOpen) return;

    const handleClickOutside = (e) => {
      if (popoverValorRef.current && !popoverValorRef.current.contains(e.target)) {
        setCaixaValor(null);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setCaixaValor(null);
      }
    };

    const handleScroll = (e) => {
      if (popoverValorRef.current && !popoverValorRef.current.contains(e.target)) {
        setCaixaValor(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [caixaValor?.isOpen]);

  const handleMouseEnterPadrinhos = (e, pessoa) => {
    if (padrinhosTimeoutRef.current) {
      clearTimeout(padrinhosTimeoutRef.current);
      padrinhosTimeoutRef.current = null;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const popoverWidth = 300;

    const buttonCenter = rect.left + (rect.width / 2);
    let left = buttonCenter - (popoverWidth / 2);
    if (left + popoverWidth > window.innerWidth - 16) {
      left = window.innerWidth - popoverWidth - 16;
    }
    if (left < 16) left = 16;

    const espacoAbaixo = window.innerHeight - rect.bottom;
    const espacoAcima = rect.top;
    let top = 'auto';
    let bottom = 'auto';

    if (espacoAbaixo >= 180 || espacoAbaixo >= espacoAcima) {
      top = rect.bottom + 8;
    } else {
      bottom = window.innerHeight - rect.top + 8;
    }

    setCaixaPadrinhos({
      isOpen: true,
      pessoaId: pessoa?.id,
      afilhadoNome: pessoa?.nome,
      padrinho: pessoa?.vinculo?.padrinho,
      madrinha: pessoa?.vinculo?.madrinha,
      padrinhosTexto: pessoa?.padrinhos_catequistas,
      pos: { top, bottom, left }
    });
  };

  const handleMouseLeavePadrinhos = () => {
    padrinhosTimeoutRef.current = setTimeout(() => {
      setCaixaPadrinhos(null);
    }, 120);
  };

  const handleTogglePadrinhos = (e, pessoa) => {
    e.stopPropagation();
    if (caixaPadrinhos?.isOpen && caixaPadrinhos?.pessoaId === pessoa?.id) {
      setCaixaPadrinhos(null);
    } else {
      handleMouseEnterPadrinhos(e, pessoa);
    }
  };

  const handleOpenFilhos = (e, a) => {
    e.stopPropagation();
    if (modalFilhos.isOpen && modalFilhos.inscricaoId === a.id) {
      setModalFilhos({ isOpen: false, inscricaoId: null, titularNome: '', conjugeNome: '', dependentes: [], pos: null });
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const popoverWidth = 380;

    // Centraliza horizontalmente em relação ao botão clicado
    const buttonCenter = rect.left + (rect.width / 2);
    let left = buttonCenter - (popoverWidth / 2);
    if (left + popoverWidth > window.innerWidth - 16) {
      left = window.innerWidth - popoverWidth - 16;
    }
    if (left < 16) left = 16;

    // Cálculo vertical inteligente:
    // Se abrir para baixo: top = rect.bottom + 8
    // Se abrir para cima: bottom = window.innerHeight - rect.top + 8 (ancorando a base logo acima do botão!)
    const espacoAbaixo = window.innerHeight - rect.bottom;
    const espacoAcima = rect.top;
    let top = 'auto';
    let bottom = 'auto';
    let maxHeight = 450;

    if (espacoAbaixo >= 220 || espacoAbaixo >= espacoAcima) {
      top = rect.bottom + 8;
      maxHeight = Math.max(150, Math.min(espacoAbaixo - 20, 480));
    } else {
      bottom = window.innerHeight - rect.top + 8;
      maxHeight = Math.max(150, Math.min(espacoAcima - 20, 480));
    }

    setModalFilhos({
      isOpen: true,
      inscricaoId: a.id,
      titularNome: a.apc_pessoa?.nome,
      conjugeNome: a.apc_pessoa?.conjuge?.nome,
      dependentes: a.apc_pessoa?.dependentes_agrupados || [],
      pos: { top, bottom, left, maxHeight }
    });
  };

  const handleOpenValor = (e, a, valorTotal, itensValor) => {
    e.stopPropagation();
    if (caixaValor?.isOpen && caixaValor?.acampamentoId === a.id) {
      setCaixaValor(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const popoverWidth = 370;

    // Centraliza horizontalmente em relação ao elemento clicado
    const buttonCenter = rect.left + (rect.width / 2);
    let left = buttonCenter - (popoverWidth / 2);
    if (left + popoverWidth > window.innerWidth - 16) {
      left = window.innerWidth - popoverWidth - 16;
    }
    if (left < 16) left = 16;

    // Cálculo vertical inteligente:
    // Se abrir para baixo: top = rect.bottom + 8
    // Se abrir para cima: bottom = window.innerHeight - rect.top + 8
    const espacoAbaixo = window.innerHeight - rect.bottom;
    const espacoAcima = rect.top;
    let top = 'auto';
    let bottom = 'auto';
    let maxHeight = 500;

    if (espacoAbaixo >= 250 || espacoAbaixo >= espacoAcima) {
      top = rect.bottom + 8;
      maxHeight = Math.max(180, Math.min(espacoAbaixo - 20, 520));
    } else {
      bottom = window.innerHeight - rect.top + 8;
      maxHeight = Math.max(180, Math.min(espacoAcima - 20, 520));
    }

    setCaixaValor({
      isOpen: true,
      titularNome: a.apc_pessoa?.nome,
      conjugeNome: a.apc_pessoa?.conjuge?.nome,
      valorTotal,
      itensValor: itensValor || [],
      totalPago: a.totalPago || 0,
      itensPago: a.itensPago || [],
      acampamentoId: a.id,
      pos: { top, bottom, left, maxHeight }
    });
  };

  const fetchData = useCallback(async () => {
    try {
      setLoadingData(true);

      // 1, 2 e 3: Dispara buscas em paralelo para eliminar o waterfall de rede
      const [eventosRes, pessoasRes, acampRes] = await Promise.all([
        supabase
          .from('apc_evento')
          .select('id, descricao, data_inicio, data_fim, local, valor, valor_diferenciado, descricao_valor_diferenciado, idade_min_diferenciada, idade_max_diferenciada, equipes, status')
          .order('data_inicio', { ascending: false }),

        supabase
          .from('apc_pessoa')
          .select(`
            id, nome, tipo_pessoa, conjuge_id, ano, telefone, email, padrinhos_catequistas,
            apc_dependente ( id, pessoa_id, nome, data_nascimento, mascote, acampamento )
          `)
          .order('nome', { ascending: true }),

        supabase
          .from('apc_acampamento')
          .select(`
            id,
            evento_id,
            equipe,
            created_at,
            apc_pessoa!apc_acampamento_pessoa_id_fkey (
              id, nome, tipo_pessoa, conjuge_id, ano, telefone, email, padrinhos_catequistas,
              apc_dependente ( id, pessoa_id, nome, data_nascimento, mascote, acampamento )
            )
          `)
          .eq('evento_id', evento_id)
          .order('created_at', { ascending: false })
      ]);

      const eventosData = eventosRes.data || [];
      const pessoasData = pessoasRes.data || [];
      setEventos(eventosData);
      setPessoas(pessoasData);

      let acampData = null;
      const acampErrorFk = acampRes.error;

      if (acampErrorFk) {
        // Fallback caso a constraint tenha o nome de coluna ou padrão
        const { data: acampDataFb, error: acampErrorFb } = await supabase
          .from('apc_acampamento')
          .select(`
            id,
            evento_id,
            equipe,
            created_at,
            apc_pessoa!pessoa_id (
              id, nome, tipo_pessoa, conjuge_id, ano, telefone, email, padrinhos_catequistas,
              apc_dependente ( id, pessoa_id, nome, data_nascimento, mascote, acampamento )
            )
          `)
          .eq('evento_id', evento_id)
          .order('created_at', { ascending: false });

        if (acampErrorFb) throw acampErrorFb;
        acampData = acampDataFb;
      } else {
        acampData = acampRes.data;
      }

      const eventosMap = {};
      eventosData.forEach(e => {
        eventosMap[e.id] = e;
      });

      const pessoasMap = {};
      pessoasData.forEach(p => {
        pessoasMap[p.id] = p;
      });

      // 4. Busca vínculos e pagamentos para todos os inscritos em paralelo
      const todosPessoaIds = (acampData || []).flatMap(a => [
        a.apc_pessoa?.id,
        a.apc_pessoa?.conjuge_id
      ]).filter(Boolean);

      const todosAcampamentoIds = (acampData || []).map(a => a.id).filter(Boolean);

      const [vinculosRes, pagamentosRes] = await Promise.all([
        todosPessoaIds.length > 0
          ? supabase
            .from('apc_vinculo')
            .select('afilhado_id, padrinho_id, madrinha_id, ano')
            .in('afilhado_id', todosPessoaIds)
            .order('ano', { ascending: false })
          : Promise.resolve({ data: [] }),
        todosAcampamentoIds.length > 0
          ? supabase
            .from('apc_pagamento')
            .select('id, acampamento_id, valor, data_recebimento, descricao')
            .in('acampamento_id', todosAcampamentoIds)
            .order('data_recebimento', { ascending: false })
          : Promise.resolve({ data: [] })
      ]);

      const vinculosData = vinculosRes.data || [];
      const pagamentosData = pagamentosRes.data || [];

      const vinculosMap = {};
      vinculosData.forEach(v => {
        if (!vinculosMap[v.afilhado_id]) {
          const padrinho = pessoasMap[v.padrinho_id];
          const madrinha = pessoasMap[v.madrinha_id];
          vinculosMap[v.afilhado_id] = {
            padrinho,
            madrinha,
            padrinho_id: v.padrinho_id,
            madrinha_id: v.madrinha_id
          };
        }
      });

      const pagamentosMap = {};
      const pagamentosItensMap = {};
      pagamentosData.forEach(pg => {
        const val = parseFloat(pg.valor || 0);
        pagamentosMap[pg.acampamento_id] = (pagamentosMap[pg.acampamento_id] || 0) + val;
        if (!pagamentosItensMap[pg.acampamento_id]) pagamentosItensMap[pg.acampamento_id] = [];
        pagamentosItensMap[pg.acampamento_id].push(pg);
      });

      acampData.forEach(a => {
        if (a.apc_pessoa && vinculosMap[a.apc_pessoa.id]) {
          a.apc_pessoa.vinculo = vinculosMap[a.apc_pessoa.id];
        }
      });

      // Mapeia o cônjuge, evento e agrupa os dependentes
      acampData.forEach(a => {
        if (a.apc_pessoa) {
          a.apc_evento = eventosMap[a.evento_id] || null;

          let todosDependentes = [...(a.apc_pessoa.apc_dependente || [])];

          if (a.apc_pessoa.conjuge_id) {
            const conjuge = pessoasMap[a.apc_pessoa.conjuge_id];
            if (conjuge) {
              a.apc_pessoa.conjuge = conjuge;
              // Adiciona os dependentes do cônjuge, evitando duplicação
              const conjugeDeps = conjuge.apc_dependente || [];
              conjugeDeps.forEach(cd => {
                if (!todosDependentes.find(d => d.id === cd.id)) {
                  todosDependentes.push(cd);
                }
              });
            }
          }

          a.apc_pessoa.dependentes_agrupados = todosDependentes;
        }
      });

      const groupedAcampamentos = [];
      const processedIds = new Set();

      (acampData || []).forEach(a => {
        if (!a.apc_pessoa) return;
        if (processedIds.has(a.apc_pessoa.id)) return;

        processedIds.add(a.apc_pessoa.id);
        if (a.apc_pessoa.conjuge_id) {
          processedIds.add(a.apc_pessoa.conjuge_id);
        }

        const conjugeAcamp = acampData.find(c => c.apc_pessoa?.id === a.apc_pessoa.conjuge_id);
        a.conjuge_inscricao = conjugeAcamp || null;

        // Pagamentos do titular e cônjuge
        const pagoTitular = pagamentosMap[a.id] || 0;
        const pagoConjuge = conjugeAcamp?.id ? (pagamentosMap[conjugeAcamp.id] || 0) : 0;
        a.totalPago = pagoTitular + pagoConjuge;

        const itensTitular = pagamentosItensMap[a.id] || [];
        const itensConjuge = conjugeAcamp?.id ? (pagamentosItensMap[conjugeAcamp.id] || []) : [];
        a.itensPago = [...itensTitular, ...itensConjuge];

        groupedAcampamentos.push(a);
      });

      setAcampamentos(groupedAcampamentos);

    } catch (err) {
      setError('Erro ao carregar dados: ' + err.message);
    } finally {
      setLoadingData(false);
    }
  }, [evento_id]);

  useEffect(() => {
    if (userProfile?.perfil === 'ADMIN' || userProfile?.perfil === 'GESTOR') {
      fetchData();
    }
  }, [userProfile?.perfil, fetchData]);

  // Quando o usuário seleciona um evento, atualizamos as equipes disponíveis
  useEffect(() => {
    if (formData.evento_id) {
      const ev = eventos.find(e => e.id === formData.evento_id);
      setEquipesDisponiveis(ev?.equipes || []);

      // Remove equipes do formData se não existirem mais no evento selecionado
      setFormData(prev => ({
        ...prev,
        titular_equipe: (prev.titular_equipe || []).filter(eq => (ev?.equipes || []).includes(eq)),
        conjuge_equipe: (prev.conjuge_equipe || []).filter(eq => (ev?.equipes || []).includes(eq))
      }));
    } else {
      setEquipesDisponiveis([]);
      setFormData(prev => ({ ...prev, titular_equipe: [], conjuge_equipe: [] }));
    }
  }, [formData.evento_id, eventos]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePessoaChange = (e) => {
    const pId = e.target.value;
    const pessoa = pessoas.find(p => p.id === pId);
    setFormData(prev => ({
      ...prev,
      pessoa_id: pId,
      titular_inscrito: true,
      conjuge_pessoa_id: pessoa?.conjuge_id || '',
      conjuge_inscrito: !!pessoa?.conjuge_id
    }));
  };

  const handleCheckboxChange = (equipeName, isConjuge = false) => {
    setFormData(prev => {
      const field = isConjuge ? 'conjuge_equipe' : 'titular_equipe';
      const isSelected = prev[field].includes(equipeName);
      if (isSelected) {
        return { ...prev, [field]: prev[field].filter(eq => eq !== equipeName) };
      } else {
        return { ...prev, [field]: [...prev[field], equipeName] };
      }
    });
  };

  const handleEdit = (a) => {
    setFormData({
      evento_id: a.evento_id || evento_id,
      pessoa_id: a.apc_pessoa.id,

      titular_id: a.id,
      titular_equipe: a.equipe || [],
      titular_inscrito: true,

      conjuge_id: a.conjuge_inscricao?.id || null,
      conjuge_pessoa_id: a.apc_pessoa.conjuge_id || '',
      conjuge_equipe: a.conjuge_inscricao?.equipe || [],
      conjuge_inscrito: !!a.conjuge_inscricao,
    });
    setIsCreating(true);
    setSuccess('');
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const operations = [];

      // Titular
      if (formData.titular_inscrito) {
        const payloadTitular = {
          evento_id: formData.evento_id,
          pessoa_id: formData.pessoa_id,
          equipe: formData.titular_equipe
        };
        if (formData.titular_id) {
          operations.push(supabase.from('apc_acampamento').update(payloadTitular).eq('id', formData.titular_id));
        } else {
          operations.push(supabase.from('apc_acampamento').insert([payloadTitular]));
        }
      } else if (formData.titular_id) {
        operations.push(supabase.from('apc_acampamento').delete().eq('id', formData.titular_id));
      }

      // Conjuge
      if (formData.conjuge_pessoa_id) {
        if (formData.conjuge_inscrito) {
          const payloadConjuge = {
            evento_id: formData.evento_id,
            pessoa_id: formData.conjuge_pessoa_id,
            equipe: formData.conjuge_equipe
          };
          if (formData.conjuge_id) {
            operations.push(supabase.from('apc_acampamento').update(payloadConjuge).eq('id', formData.conjuge_id));
          } else {
            operations.push(supabase.from('apc_acampamento').insert([payloadConjuge]));
          }
        } else if (formData.conjuge_id) {
          operations.push(supabase.from('apc_acampamento').delete().eq('id', formData.conjuge_id));
        }
      }

      for (const promise of operations) {
        const { error: dbError } = await promise;
        if (dbError) throw dbError;
      }

      // Se desmarcou titular ou cônjuge existente, registra a remoção na auditoria
      if (!formData.titular_inscrito && formData.titular_id) {
        const titularPessoa = pessoas.find(p => p.id === formData.pessoa_id);
        registrarAuditoria({
          acao: 'EXCLUIR_INSCRICAO_ACAMPAMENTO',
          categoria: 'INSCRICAO',
          nivel: 'WARNING',
          descricao: `Inscrição do titular removida no evento: ${titularPessoa?.nome || 'Inscrito'} (${currentEvento?.descricao || 'Acampamento'})`,
          detalhes: {
            evento_id: formData.evento_id,
            inscricao_id: formData.titular_id,
            pessoa_id: formData.pessoa_id,
            pessoa_nome: titularPessoa?.nome
          }
        });
      }

      if (formData.conjuge_pessoa_id && !formData.conjuge_inscrito && formData.conjuge_id) {
        const conjugePessoa = pessoas.find(p => p.id === formData.conjuge_pessoa_id);
        registrarAuditoria({
          acao: 'EXCLUIR_INSCRICAO_ACAMPAMENTO',
          categoria: 'INSCRICAO',
          nivel: 'WARNING',
          descricao: `Inscrição do cônjuge removida no evento: ${conjugePessoa?.nome || 'Inscrito'} (${currentEvento?.descricao || 'Acampamento'})`,
          detalhes: {
            evento_id: formData.evento_id,
            inscricao_id: formData.conjuge_id,
            pessoa_id: formData.conjuge_pessoa_id,
            pessoa_nome: conjugePessoa?.nome
          }
        });
      }

      setSuccess('Inscrição familiar salva com sucesso!');
      fetchData(); // Refresh the list

      setTimeout(() => {
        setIsCreating(false);
        setSuccess('');
      }, 1500);

    } catch (err) {
      setError('Erro ao salvar inscrição: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (a) => {
    if (!window.confirm('Tem certeza que deseja remover esta inscrição e da sua família (se houver)?')) return;

    try {
      setError('');
      const idsToDelete = [a.id];
      if (a.conjuge_inscricao) {
        idsToDelete.push(a.conjuge_inscricao.id);
      }

      const { error } = await supabase.from('apc_acampamento').delete().in('id', idsToDelete);
      if (error) throw error;

      // Registrar auditoria da exclusão
      const nomeTitular = a.apc_pessoa?.nome || 'Inscrito';
      const nomeConjuge = a.conjuge_inscricao?.apc_pessoa?.nome;
      const nomeEvento = a.apc_evento?.descricao || currentEvento?.descricao || 'Acampamento';

      registrarAuditoria({
        acao: 'EXCLUIR_INSCRICAO_ACAMPAMENTO',
        categoria: 'INSCRICAO',
        nivel: 'WARNING',
        descricao: `Inscrição excluída do evento ${nomeEvento}: ${nomeTitular}${nomeConjuge ? ` e ${nomeConjuge}` : ''}`,
        detalhes: {
          evento_id: a.evento_id || evento_id,
          evento_nome: nomeEvento,
          inscricao_id: a.id,
          pessoa_id: a.apc_pessoa?.id,
          pessoa_nome: nomeTitular,
          tipo_pessoa: a.apc_pessoa?.tipo_pessoa,
          conjuge_inscricao_id: a.conjuge_inscricao?.id || null,
          conjuge_pessoa_id: a.conjuge_inscricao?.apc_pessoa?.id || null,
          conjuge_nome: nomeConjuge || null,
          ids_excluidos: idsToDelete
        }
      });

      fetchData(); // Reload instead of filtering the complex group
      setSuccess('Inscrição removida com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Erro ao excluir inscrição:', err);
      registrarAuditoria({
        acao: 'EXCLUIR_INSCRICAO_ACAMPAMENTO_ERRO',
        categoria: 'ERRO',
        nivel: 'ERROR',
        descricao: `Erro ao excluir inscrição do evento: ${err.message}`,
        detalhes: {
          erro: err.message,
          inscricao_id: a?.id,
          pessoa_nome: a?.apc_pessoa?.nome
        }
      });
      setError('Erro ao excluir: ' + err.message);
    }
  };

  // 1. Filtragem global (Busca, Vínculo Padrinho, Ano) que se aplica a todas as abas
  const baseAcampamentos = useMemo(() => {
    const termo = searchTerm.trim().toLowerCase();
    const mapPessoas = new Map(pessoas.map(p => [p.id, p]));

    return acampamentos.filter(a => {
      const nomePessoa = a.apc_pessoa?.nome?.toLowerCase() || '';
      const nomeConjuge = a.conjuge_inscricao?.apc_pessoa?.nome?.toLowerCase() || a.apc_pessoa?.conjuge?.nome?.toLowerCase() || '';
      const matchesSearch = !termo || nomePessoa.includes(termo) || nomeConjuge.includes(termo);

      if (!matchesSearch) return false;

      let matchesVinculo = true;
      if (filterVinculo !== 'TODOS') {
        const selectedPessoa = mapPessoas.get(filterVinculo);
        const spouse = selectedPessoa?.conjuge_id
          ? mapPessoas.get(selectedPessoa.conjuge_id)
          : pessoas.find(p => p.conjuge_id && p.conjuge_id === selectedPessoa?.id);

        const targetPadrinhoIds = new Set([
          filterVinculo,
          selectedPessoa?.conjuge_id,
          spouse?.id
        ].filter(Boolean));

        const targetNames = [selectedPessoa?.nome, spouse?.nome]
          .filter(Boolean)
          .map(n => n.trim().toLowerCase());

        // 1. É a própria inscrição do Padrinho/Madrinha ou seu cônjuge (titular ou cônjuge no acampamento)
        const rowPersonIds = [
          a.apc_pessoa?.id,
          a.apc_pessoa?.conjuge_id,
          a.apc_pessoa?.conjuge?.id,
          a.conjuge_inscricao?.apc_pessoa?.id,
          a.conjuge_inscricao?.pessoa_id
        ].filter(Boolean);

        const isSelfOrSpouse = rowPersonIds.some(id => targetPadrinhoIds.has(id));

        if (isSelfOrSpouse) {
          matchesVinculo = true;
        } else {
          // 2. É um afilhado com vínculo formal (apc_vinculo) no titular ou no cônjuge
          const vTitular = a.apc_pessoa?.vinculo;
          const vConjuge = a.conjuge_inscricao?.apc_pessoa?.vinculo;
          const hasVinculoFormal = [
            vTitular?.padrinho_id,
            vTitular?.madrinha_id,
            vTitular?.padrinho?.id,
            vTitular?.madrinha?.id,
            vConjuge?.padrinho_id,
            vConjuge?.madrinha_id,
            vConjuge?.padrinho?.id,
            vConjuge?.madrinha?.id
          ].some(id => id && targetPadrinhoIds.has(id));

          if (hasVinculoFormal) {
            matchesVinculo = true;
          } else {
            // 3. É um afilhado com nome dos padrinhos informado em texto (padrinhos_catequistas)
            const textTitular = (a.apc_pessoa?.padrinhos_catequistas || '').toLowerCase();
            const textConjuge = (a.conjuge_inscricao?.apc_pessoa?.padrinhos_catequistas || '').toLowerCase();
            const combinedText = `${textTitular} ${textConjuge}`.trim();

            const firstName = selectedPessoa?.nome ? selectedPessoa.nome.trim().split(' ')[0].toLowerCase() : '';
            const spouseFirstName = spouse?.nome ? spouse.nome.trim().split(' ')[0].toLowerCase() : '';

            const matchesTexto = combinedText && (
              targetNames.some(fullName => fullName && fullName.length >= 3 && combinedText.includes(fullName)) ||
              (firstName && firstName.length >= 3 && spouseFirstName && spouseFirstName.length >= 3 &&
                combinedText.includes(firstName) && combinedText.includes(spouseFirstName)) ||
              (!spouseFirstName && firstName && firstName.length >= 3 && combinedText.includes(firstName))
            );

            matchesVinculo = Boolean(matchesTexto);
          }
        }
      }

      if (!matchesVinculo) return false;

      const matchesAno = filterAno === 'TODOS' || (a.apc_pessoa?.ano && a.apc_pessoa.ano.toString() === filterAno);
      return matchesAno;
    });
  }, [acampamentos, searchTerm, filterVinculo, filterAno, pessoas]);

  // 2. Filtragem pela aba ativa (filterTipo) e ordenação memoizada
  const filteredAcampamentos = useMemo(() => {
    return baseAcampamentos.filter(a => {
      if (filterTipo === 'TODOS') return true;
      const tipoTitular = (a.apc_pessoa?.tipo_pessoa || '').toUpperCase();
      const tipoConjuge = (a.conjuge_inscricao?.apc_pessoa?.tipo_pessoa || a.apc_pessoa?.conjuge?.tipo_pessoa || '').toUpperCase();

      if (filterTipo === 'PADRINHOS') {
        return tipoTitular === 'PADRINHO' || tipoTitular === 'MADRINHA' ||
          tipoConjuge === 'PADRINHO' || tipoConjuge === 'MADRINHA';
      } else if (filterTipo === 'AFILHADO') {
        return tipoTitular === 'AFILHADO' || tipoConjuge === 'AFILHADO';
      } else if (filterTipo === 'VOLUNTARIO') {
        return tipoTitular === 'VOLUNTARIO' || tipoConjuge === 'VOLUNTARIO';
      }
      return true;
    }).sort((a, b) => {
      let comparison = 0;
      if (sortField === 'tipo') {
        const tipoA = getTipoLabel(a);
        const tipoB = getTipoLabel(b);
        comparison = tipoA.localeCompare(tipoB, 'pt-BR');
      } else if (sortField === 'nome') {
        const nomeA = a.apc_pessoa?.nome || '';
        const nomeB = b.apc_pessoa?.nome || '';
        comparison = nomeA.localeCompare(nomeB, 'pt-BR');
      } else if (sortField === 'ano') {
        const anoA = parseInt(a.apc_pessoa?.ano || 0, 10);
        const anoB = parseInt(b.apc_pessoa?.ano || 0, 10);
        comparison = anoA - anoB;
      } else if (sortField === 'filhos') {
        const countA = (a.apc_pessoa?.dependentes_agrupados || []).filter(d => Boolean(d.acampamento !== undefined ? d.acampamento : d.mascote)).length;
        const countB = (b.apc_pessoa?.dependentes_agrupados || []).filter(d => Boolean(d.acampamento !== undefined ? d.acampamento : d.mascote)).length;
        comparison = countA - countB;
      } else if (sortField === 'padrinhos') {
        const textA = getPadrinhosTexto(a);
        const textB = getPadrinhosTexto(b);
        comparison = textA.localeCompare(textB, 'pt-BR');
      }

      if (comparison !== 0) {
        return sortDirection === 'asc' ? comparison : -comparison;
      }

      return (a.apc_pessoa?.nome || '').localeCompare(b.apc_pessoa?.nome || '', 'pt-BR');
    });
  }, [baseAcampamentos, filterTipo, sortField, sortDirection]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (field) => {
    if (sortField !== field) {
      return <ArrowUpDown size={12} style={{ opacity: 0.35 }} />;
    }
    return sortDirection === 'asc'
      ? <ArrowUp size={12} color="var(--accent-primary)" />
      : <ArrowDown size={12} color="var(--accent-primary)" />;
  };

  const anosDisponiveis = useMemo(() => {
    return Array.from(new Set(acampamentos.map(a => a.apc_pessoa?.ano).filter(Boolean))).sort((a, b) => b - a);
  }, [acampamentos]);

  const currentEvento = useMemo(() => {
    return eventos.find(e => e.id === evento_id);
  }, [eventos, evento_id]);

  // Métricas calculadas em uma única passagem memoizada
  const {
    countPadrinhos,
    countAfilhados,
    countVoluntarios,
    countFilhos,
    totalParticipantes,
    totalPrevisto,
    totalRecebido,
    saldoDevedor
  } = useMemo(() => {
    let padrinhos = 0;
    let afilhados = 0;
    let voluntarios = 0;
    let filhos = 0;
    const filhosContados = new Set();
    let previsto = 0;
    let recebido = 0;

    filteredAcampamentos.forEach(a => {
      // Padrinhos
      if (a.apc_pessoa?.tipo_pessoa === 'PADRINHO' || a.apc_pessoa?.tipo_pessoa === 'MADRINHA') padrinhos++;
      if (a.conjuge_inscricao && (a.conjuge_inscricao.apc_pessoa?.tipo_pessoa === 'PADRINHO' || a.conjuge_inscricao.apc_pessoa?.tipo_pessoa === 'MADRINHA')) padrinhos++;

      // Afilhados
      if (a.apc_pessoa?.tipo_pessoa === 'AFILHADO') afilhados++;
      if (a.conjuge_inscricao && a.conjuge_inscricao.apc_pessoa?.tipo_pessoa === 'AFILHADO') afilhados++;

      // Voluntários
      if (a.apc_pessoa?.tipo_pessoa === 'VOLUNTARIO') voluntarios++;
      if (a.conjuge_inscricao && a.conjuge_inscricao.apc_pessoa?.tipo_pessoa === 'VOLUNTARIO') voluntarios++;

      // Filhos
      if (a.apc_pessoa?.dependentes_agrupados) {
        a.apc_pessoa.dependentes_agrupados.forEach(d => {
          if ((d.acampamento ?? d.mascote) && !filhosContados.has(d.id)) {
            filhosContados.add(d.id);
            filhos++;
          }
        });
      }

      // Previsto
      const { total } = calcularValorTotal(a, currentEvento || a.apc_evento);
      previsto += total;

      // Recebido
      recebido += (a.totalPago || 0);
    });

    return {
      countPadrinhos: padrinhos,
      countAfilhados: afilhados,
      countVoluntarios: voluntarios,
      countFilhos: filhos,
      totalParticipantes: padrinhos + afilhados + voluntarios + filhos,
      totalPrevisto: previsto,
      totalRecebido: recebido,
      saldoDevedor: Math.max(0, previsto - recebido)
    };
  }, [filteredAcampamentos, currentEvento]);

  const handleExportarExcel = async () => {
    if (!currentEvento) return;
    try {
      setExportingExcel(true);
      setError('');
      setSuccess('');
      const resultado = await exportarRelatorioExcelEvento(currentEvento);
      if (resultado.count === 0) {
        setError(resultado.message);
      } else {
        setSuccess(`Relatório Excel exportado com sucesso! (${resultado.fileName})`);
        setTimeout(() => setSuccess(''), 5000);
      }
    } catch (err) {
      setError('Erro ao exportar relatório Excel: ' + (err.message || err));
    } finally {
      setExportingExcel(false);
    }
  };

  if (userProfile?.perfil !== 'ADMIN' && userProfile?.perfil !== 'GESTOR') {
    return (
      <div className="main-content">
        <div className="alert alert-error">Acesso negado. Você não tem permissão para acessar esta página.</div>
      </div>
    );
  }

  return (
    <div className="main-content">
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link to="/admin/eventos" className="btn btn-secondary" style={{ padding: '0.5rem' }}>
              <ArrowLeft size={20} />
            </Link>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0, fontSize: '1.75rem', flexWrap: 'wrap' }}>
              <Tent size={32} color="var(--accent-primary)" />
              {isCreating ? (formData.id ? 'Editar Inscrição' : 'Nova Inscrição') : `${currentEvento?.descricao || 'Carregando...'}`}
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            {!isCreating && currentEvento && (
              <button
                type="button"
                onClick={handleExportarExcel}
                disabled={exportingExcel}
                className="btn btn-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  color: '#16a34a',
                  fontWeight: '600'
                }}
                title="Gerar e Baixar Planilha Excel com Informações e Resumo Financeiro"
              >
                <FileSpreadsheet size={18} />
                {exportingExcel ? 'Gerando...' : 'Exportar Excel'}
              </button>
            )}
            <button
              onClick={() => {
                setIsCreating(!isCreating);
                setSuccess('');
                setError('');
                setFormData({
                  evento_id: evento_id || '',
                  pessoa_id: '',
                  titular_id: null,
                  titular_equipe: [],
                  titular_inscrito: true,
                  conjuge_id: null,
                  conjuge_pessoa_id: '',
                  conjuge_equipe: [],
                  conjuge_inscrito: false
                });
              }}
              className={isCreating ? "btn btn-secondary" : "btn btn-primary"}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              {isCreating ? 'Voltar para Lista' : <><Plus size={20} /> Nova Inscrição</>}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <p style={{ margin: 0, fontSize: '1rem', color: 'var(--text-secondary)' }}>
            {isCreating ? 'Vincule uma pessoa a este evento e selecione suas equipes.' : 'Gerencie as inscrições do acampamento.'}
          </p>

          {!isCreating && currentEvento && currentEvento.valor && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '0.35rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
              <span><strong>Valor padrão:</strong> {formatCurrency(currentEvento.valor)}</span>
              {currentEvento.valor_diferenciado && (
                <>
                  <span>•</span>
                  <span><strong>Diferenciado ({currentEvento.descricao_valor_diferenciado || `${currentEvento.idade_min_diferenciada || 0} a ${currentEvento.idade_max_diferenciada || 0} anos`}):</strong> {formatCurrency(currentEvento.valor_diferenciado)}</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '2rem' }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: '2rem' }}>{success}</div>}

      {isCreating ? (
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Evento</label>
                <div className="form-input" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                  {currentEvento?.descricao || 'Carregando...'}
                </div>
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label" htmlFor="pessoa_id">Pessoa *</label>
                <select
                  id="pessoa_id"
                  name="pessoa_id"
                  className="form-input"
                  value={formData.pessoa_id}
                  onChange={handlePessoaChange}
                  required
                >
                  <option value="">-- Selecione a Pessoa --</option>
                  {pessoas.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nome} ({p.tipo_pessoa})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {formData.evento_id && formData.pessoa_id && equipesDisponiveis.length > 0 && (
              <div className="form-grid" style={{ marginTop: '1.5rem' }}>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.titular_inscrito}
                      onChange={(e) => setFormData(prev => ({ ...prev, titular_inscrito: e.target.checked }))}
                      style={{ width: '1.2rem', height: '1.2rem', accentColor: 'var(--accent-primary)' }}
                    />
                    Confirmação de<span style={{ color: 'var(--accent-primary)', textDecoration: 'underline', marginLeft: '0.2rem' }}>{pessoas.find(p => p.id === formData.pessoa_id)?.nome}</span>
                  </label>
                  {formData.titular_inscrito && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '1rem', paddingLeft: '2rem' }}>
                      {equipesDisponiveis.map(equipeName => (
                        <label key={equipeName} style={{
                          fontSize: '0.7rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.5rem 1rem',
                          background: 'var(--bg-secondary)',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          border: formData.titular_equipe.includes(equipeName) ? '1px solid var(--accent-primary)' : '1px solid transparent'
                        }}>
                          <input
                            type="checkbox"
                            checked={formData.titular_equipe.includes(equipeName)}
                            onChange={() => handleCheckboxChange(equipeName, false)}
                            style={{ width: '1rem', height: '1rem', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                          />
                          <span style={{ fontWeight: '600' }}>{equipeName}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {formData.conjuge_pessoa_id && (
                  <div className="form-group" style={{ gridColumn: '1 / -1', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                    <label className="form-label" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={formData.conjuge_inscrito}
                        onChange={(e) => setFormData(prev => ({ ...prev, conjuge_inscrito: e.target.checked }))}
                        style={{ width: '1.2rem', height: '1.2rem', accentColor: 'var(--accent-primary)' }}
                      />
                      Confirmação de <span style={{ color: 'var(--accent-primary)', textDecoration: 'underline', marginLeft: '0.2rem' }}>{pessoas.find(p => p.id === formData.conjuge_pessoa_id)?.nome}</span> (Cônjuge):
                    </label>
                    {formData.conjuge_inscrito && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '1rem', paddingLeft: '2rem' }}>
                        {equipesDisponiveis.map(equipeName => (
                          <label key={`conjuge-${equipeName}`} style={{
                            fontSize: '0.7rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.5rem 1rem',
                            background: 'var(--bg-secondary)',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            border: formData.conjuge_equipe.includes(equipeName) ? '1px solid var(--accent-primary)' : '1px solid transparent'
                          }}>
                            <input
                              type="checkbox"
                              checked={formData.conjuge_equipe.includes(equipeName)}
                              onChange={() => handleCheckboxChange(equipeName, true)}
                              style={{ width: '1rem', height: '1rem', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                            />
                            <span style={{ fontWeight: '600' }}>{equipeName}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {formData.evento_id && equipesDisponiveis.length === 0 && (
              <div className="alert alert-warning" style={{ marginTop: '1rem', background: 'rgba(245, 158, 11, 0.1)', color: '#d97706', padding: '1rem', borderRadius: '8px' }}>
                Este evento não possui equipes cadastradas. Você pode salvá-lo sem equipes ou editar o evento primeiro.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Salvando...' : 'Salvar Inscrição'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '2rem' }}>

          {/* Cards de Métricas */}
          {!loadingData && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ background: 'var(--bg-secondary)', padding: '0.5rem', borderRadius: '8px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Padrinhos</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>{countPadrinhos}</div>
              </div>
              <div style={{ background: 'var(--bg-secondary)', padding: '0.5rem', borderRadius: '8px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Filhos (Mascotes)</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>{countFilhos}</div>
              </div>
              <div style={{ background: 'var(--bg-secondary)', padding: '0.5rem', borderRadius: '8px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Afilhados</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>{countAfilhados}</div>
              </div>
              <div style={{ background: 'var(--bg-secondary)', padding: '0.5rem', borderRadius: '8px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Voluntários</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>{countVoluntarios}</div>
              </div>
              <div style={{ background: 'var(--bg-primary)', padding: '0.5rem', borderRadius: '8px', textAlign: 'center', border: '2px solid var(--accent-primary)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Total Pessoas</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>{totalParticipantes}</div>
              </div>
              {/* Card Único e Consolidado de Resumo Financeiro */}
              {/* <div style={{
                background: 'var(--bg-secondary)',
                padding: '0.55rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                minWidth: '270px',
                gridColumn: 'span 2'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>
                    Resumo Financeiro
                  </span>
                  {totalPrevisto > 0 && (
                    <span style={{
                      fontSize: '0.675rem',
                      fontWeight: '700',
                      padding: '0.1rem 0.45rem',
                      borderRadius: '999px',
                      background: totalRecebido >= totalPrevisto ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                      color: totalRecebido >= totalPrevisto ? '#10b981' : 'var(--accent-primary)'
                    }}>
                      {Math.min(100, Math.round((totalRecebido / totalPrevisto) * 100))}% pago
                    </span>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem', textAlign: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Previsto</div>
                    <div style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                      {formatCurrency(totalPrevisto)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: '#10b981' }}>Recebido</div>
                    <div style={{ fontSize: '1rem', fontWeight: '800', color: '#10b981' }}>
                      {formatCurrency(totalRecebido)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: saldoDevedor > 0 ? '#f59e0b' : 'var(--text-secondary)' }}>Saldo Devedor</div>
                    <div style={{ fontSize: '1rem', fontWeight: '800', color: saldoDevedor > 0 ? '#f59e0b' : '#10b981' }}>
                      {saldoDevedor > 0 ? formatCurrency(saldoDevedor) : 'Quitado ✓'}
                    </div>
                  </div>
                </div>
              </div> */}
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '1rem', flex: '1 1 400px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
                <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                <input
                  type="text"
                  placeholder="Buscar pessoa..."
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
                  value={filterAno}
                  onChange={(e) => setFilterAno(e.target.value)}
                >
                  <option value="TODOS">Filtro por Ano</option>
                  {anosDisponiveis.map(ano => (
                    <option key={ano} value={ano}>{ano}</option>
                  ))}
                </select>
              </div>

              <div style={{ position: 'relative', minWidth: '200px' }}>
                <Filter size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                <select
                  className="form-input"
                  style={{ paddingLeft: '2.5rem', margin: 0 }}
                  value={filterVinculo}
                  onChange={(e) => setFilterVinculo(e.target.value)}
                >
                  <option value="TODOS">Filtro por Padrinhos</option>
                  {pessoas
                    .filter(p => {
                      const t = (p.tipo_pessoa || '').toUpperCase();
                      return t === 'PADRINHO' || t === 'MADRINHA';
                    })
                    .map(p => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                </select>
              </div>
            </div>
          </div>

          {/* Navegação por Abas (Tabs) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '1.25rem',
            borderBottom: '2px solid var(--border-color)',
            paddingBottom: '0.65rem',
            overflowX: 'auto'
          }}>
            <button
              type="button"
              onClick={() => setFilterTipo('TODOS')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.55rem 1rem',
                borderRadius: '8px',
                border: filterTipo === 'TODOS' ? '1px solid var(--accent-primary)' : '1px solid transparent',
                background: filterTipo === 'TODOS' ? 'rgba(37, 99, 235, 0.12)' : 'transparent',
                color: filterTipo === 'TODOS' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                fontWeight: filterTipo === 'TODOS' ? '700' : '500',
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap'
              }}
            >
              <Users size={16} />
              <span>Todos</span>
              <span style={{
                fontSize: '0.725rem',
                padding: '0.1rem 0.45rem',
                borderRadius: '999px',
                background: filterTipo === 'TODOS' ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                color: filterTipo === 'TODOS' ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: '700'
              }}>
                {totalParticipantes}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilterTipo('PADRINHOS')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.55rem 1rem',
                borderRadius: '8px',
                border: filterTipo === 'PADRINHOS' ? '1px solid #10b981' : '1px solid transparent',
                background: filterTipo === 'PADRINHOS' ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                color: filterTipo === 'PADRINHOS' ? '#059669' : 'var(--text-secondary)',
                fontWeight: filterTipo === 'PADRINHOS' ? '700' : '500',
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap'
              }}
            >
              <Users size={16} />
              <span>Padrinhos</span>
              <span style={{
                fontSize: '0.725rem',
                padding: '0.1rem 0.45rem',
                borderRadius: '999px',
                background: filterTipo === 'PADRINHOS' ? '#10b981' : 'var(--bg-secondary)',
                color: filterTipo === 'PADRINHOS' ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: '700'
              }}>
                {countPadrinhos}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilterTipo('AFILHADO')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.55rem 1rem',
                borderRadius: '8px',
                border: filterTipo === 'AFILHADO' ? '1px solid #f59e0b' : '1px solid transparent',
                background: filterTipo === 'AFILHADO' ? 'rgba(245, 158, 11, 0.12)' : 'transparent',
                color: filterTipo === 'AFILHADO' ? '#d97706' : 'var(--text-secondary)',
                fontWeight: filterTipo === 'AFILHADO' ? '700' : '500',
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap'
              }}
            >
              <Users size={16} />
              <span>Afilhados</span>
              <span style={{
                fontSize: '0.725rem',
                padding: '0.1rem 0.45rem',
                borderRadius: '999px',
                background: filterTipo === 'AFILHADO' ? '#f59e0b' : 'var(--bg-secondary)',
                color: filterTipo === 'AFILHADO' ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: '700'
              }}>
                {countAfilhados}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilterTipo('VOLUNTARIO')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.55rem 1rem',
                borderRadius: '8px',
                border: filterTipo === 'VOLUNTARIO' ? '1px solid #3b82f6' : '1px solid transparent',
                background: filterTipo === 'VOLUNTARIO' ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                color: filterTipo === 'VOLUNTARIO' ? '#2563eb' : 'var(--text-secondary)',
                fontWeight: filterTipo === 'VOLUNTARIO' ? '700' : '500',
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap'
              }}
            >
              <Users size={16} />
              <span>Voluntários</span>
              <span style={{
                fontSize: '0.725rem',
                padding: '0.1rem 0.45rem',
                borderRadius: '999px',
                background: filterTipo === 'VOLUNTARIO' ? '#3b82f6' : 'var(--bg-secondary)',
                color: filterTipo === 'VOLUNTARIO' ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: '700'
              }}>
                {countVoluntarios}
              </span>
            </button>
          </div>

          {loadingData ? (
            <p>Carregando inscrições...</p>
          ) : filteredAcampamentos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
              <p>Nenhuma inscrição encontrada.</p>
            </div>
          ) : (
            <>
              {/* Controles para Mobile: Contador e Ordenação Rápida */}
              <div className="participantes-mobile-controls">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <label htmlFor="mobile-sort-select" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    <ArrowUpDown size={13} />
                    <span>Ordenar:</span>
                  </label>
                  <select
                    id="mobile-sort-select"
                    className="form-input"
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.775rem', width: 'auto', minWidth: '135px', margin: 0, height: 'auto', borderRadius: '6px' }}
                    value={`${sortField}-${sortDirection}`}
                    onChange={(e) => {
                      const [field, direction] = e.target.value.split('-');
                      setSortField(field);
                      setSortDirection(direction);
                    }}
                  >
                    <option value="nome-asc">Nome (A-Z)</option>
                    <option value="nome-desc">Nome (Z-A)</option>
                    <option value="ano-desc">Ano (Mais recente)</option>
                    <option value="ano-asc">Ano (Mais antigo)</option>
                    <option value="filhos-desc">Mais Filhos</option>
                    <option value="filhos-asc">Menos Filhos</option>
                    <option value="tipo-asc">Tipo</option>
                    <option value="padrinhos-asc">Padrinhos (A-Z)</option>
                    <option value="padrinhos-desc">Padrinhos (Z-A)</option>
                  </select>
                </div>
              </div>

              {/* Visualização Mobile: Cards Modernos e Organizados */}
              <div className="participantes-mobile-list">
                {filteredAcampamentos.map((a) => {
                  const dependentes = a.apc_pessoa?.dependentes_agrupados || [];
                  const vaiAcampamentoCount = dependentes.filter(d => Boolean(d.acampamento !== undefined ? d.acampamento : d.mascote)).length;

                  const tipo = a.apc_pessoa?.tipo_pessoa;
                  let tipoLabel = tipo || '-';
                  let tipoBg = 'var(--bg-secondary)';
                  let tipoColor = 'var(--text-secondary)';
                  let tipoBorder = '1px solid var(--border-color)';
                  let cardAccentColor = 'var(--accent-primary)';

                  if (tipo === 'PADRINHO' || tipo === 'MADRINHA') {
                    tipoLabel = 'Padrinhos';
                    tipoBg = 'rgba(16, 185, 129, 0.12)';
                    tipoColor = '#059669';
                    tipoBorder = '1px solid rgba(16, 185, 129, 0.25)';
                    cardAccentColor = '#10b981';
                  } else if (tipo === 'AFILHADO') {
                    tipoLabel = 'Afilhado(a)';
                    tipoBg = 'rgba(245, 158, 11, 0.12)';
                    tipoColor = '#d97706';
                    tipoBorder = '1px solid rgba(245, 158, 11, 0.25)';
                    cardAccentColor = '#f59e0b';
                  } else if (tipo === 'VOLUNTARIO') {
                    tipoLabel = 'Voluntário(a)';
                    tipoBg = 'rgba(59, 130, 246, 0.12)';
                    tipoColor = '#2563eb';
                    tipoBorder = '1px solid rgba(59, 130, 246, 0.25)';
                    cardAccentColor = '#3b82f6';
                  }

                  return (
                    <div
                      key={`mobile-${a.id}`}
                      className="participante-card-mobile"
                      style={{ borderLeft: `4px solid ${cardAccentColor}` }}
                    >
                      {/* Topo do Card: Tipo, Ano e Ações com Ícones na mesma linha */}
                      <div
                        className="participante-card-header"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'nowrap',
                          width: '100%'

                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'nowrap', minWidth: 0 }}>
                          <span style={{
                            fontSize: '0.725rem',
                            fontWeight: '700',
                            padding: '0.1rem 0.2rem',
                            borderRadius: '6px',
                            background: tipoBg,
                            color: tipoColor,
                            border: tipoBorder,
                            display: 'inline-flex',
                            alignItems: 'center',
                            whiteSpace: 'nowrap',
                            flexShrink: 0
                          }}>
                            {tipoLabel}
                          </span>

                          {a.apc_pessoa?.ano && (
                            <span style={{
                              fontSize: '0.7rem',
                              color: 'var(--text-secondary)',
                              background: 'var(--bg-secondary)',
                              borderRadius: '6px',
                              border: '1px solid var(--border-color)',
                              fontWeight: '600',
                              whiteSpace: 'nowrap',
                              flexShrink: 0
                            }}>
                              Ano {a.apc_pessoa.ano}
                            </span>
                          )}
                        </div>

                        {/* Ações Rápidas (Apenas Ícones na mesma linha) */}
                        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, marginLeft: 'auto' }}>
                          <Link
                            to={`/admin/pagamentos/${a.id}`}
                            state={{ from: `/admin/acampamentos/${evento_id}` }}
                            className="btn btn-secondary"
                            style={{
                              padding: '0.35rem 0.45rem',
                              borderRadius: '6px',
                              color: 'var(--success)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            title="Informações de Pagamentos"
                          >
                            <DollarSign size={13} />
                          </Link>

                          {isAdmin && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleEdit(a)}
                                className="btn btn-primary"
                                style={{
                                  padding: '0.35rem 0.45rem',
                                  borderRadius: '6px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                                title="Editar Inscrição"
                              >
                                <Edit2 size={13} />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDelete(a)}
                                className="btn btn-danger"
                                style={{
                                  padding: '0.35rem 0.45rem',
                                  borderRadius: '6px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                                title="Excluir Inscrição"
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Corpo do Card: Nomes e Filhos */}
                      <div className="participante-card-body">
                        {/* Titular */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                            {a.apc_pessoa?.nome}
                          </span>
                          <span title="Inscrito(a) no acampamento" style={{ display: 'inline-flex', alignItems: 'center' }}>
                            <Check size={14} color="var(--success)" strokeWidth={3} />
                          </span>
                        </div>

                        {/* Cônjuge se cadastrado */}
                        {a.apc_pessoa?.conjuge && (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            fontSize: '0.825rem',
                            color: 'var(--text-secondary)',
                            paddingLeft: '0.25rem',
                            flexWrap: 'wrap'
                          }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Cônjuge:</span>
                            <strong style={{ color: 'var(--text-primary)', fontWeight: '600' }}>
                              {a.apc_pessoa.conjuge.nome}
                            </strong>
                            {a.conjuge_inscricao ? (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.2rem',
                                fontSize: '0.7rem',
                                color: '#059669',
                                fontWeight: '600',
                                background: 'rgba(16, 185, 129, 0.1)',
                                padding: '0.1rem 0.4rem',
                                borderRadius: '4px'
                              }}>
                                <Check size={12} strokeWidth={3} />
                              </span>
                            ) : (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.2rem',
                                fontSize: '0.7rem',
                                color: 'var(--text-secondary)',
                                background: 'var(--bg-secondary)',
                                padding: '0.1rem 0.4rem',
                                borderRadius: '4px'
                              }}>
                                <X size={12} />
                              </span>
                            )}
                          </div>
                        )}

                        {/* Filhos / Dependentes */}
                        {dependentes.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.1rem' }}>
                            <button
                              type="button"
                              onClick={(e) => handleOpenFilhos(e, a)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                padding: '0.25rem 0.6rem',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: '600',
                                background: vaiAcampamentoCount > 0 ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-secondary)',
                                color: vaiAcampamentoCount > 0 ? '#059669' : 'var(--text-secondary)',
                                border: vaiAcampamentoCount > 0 ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid var(--border-color)',
                                cursor: 'pointer'
                              }}
                              title="Clique para ver detalhes dos filhos/dependentes"
                            >
                              <Users size={13} />
                              <span>
                                {vaiAcampamentoCount} {vaiAcampamentoCount === 1 ? 'filho no acampamento' : 'filhos no acampamento'}
                              </span>
                            </button>
                          </div>
                        )}

                        {/* Padrinhos em texto (se for afilhado) */}
                        {tipo === 'AFILHADO' && (
                          <div style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '0.4rem',
                            fontSize: '0.75rem',
                            padding: '0.35rem 0.55rem',
                            background: 'var(--bg-secondary)',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            marginTop: '0.15rem'
                          }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: '600', textTransform: 'uppercase' }}>
                              Padrinhos:
                            </span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', fontSize: '0.75rem' }}>
                              {(() => {
                                const p = a.apc_pessoa;
                                const padrinho = p.vinculo?.padrinho;
                                const madrinha = p.vinculo?.madrinha;
                                const textoFicha = p.padrinhos_catequistas;

                                if (padrinho || madrinha) {
                                  return (
                                    <>
                                      {padrinho && (
                                        <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
                                          {padrinho.nome}
                                        </span>
                                      )}
                                      {madrinha && (
                                        <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
                                          {madrinha.nome}
                                        </span>
                                      )}
                                    </>
                                  );
                                }

                                if (textoFicha) {
                                  return (
                                    <span style={{ color: 'var(--text-primary)' }}>
                                      {textoFicha}
                                    </span>
                                  );
                                }

                                return <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Não vinculado</span>;
                              })()}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Visualização Desktop: Tabela Tradicional Completa */}
              <div className="participantes-desktop-table">
                <table className="table-compact">
                  <thead>
                    <tr>
                      <th onClick={() => handleSort('ano')} style={{ cursor: 'pointer', userSelect: 'none' }} title="Clique para alternar ordenação por Ano">
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span>Ano</span>
                          {renderSortIcon('ano')}
                        </div>
                      </th>
                      <th onClick={() => handleSort('nome')} style={{ cursor: 'pointer', userSelect: 'none' }} title="Clique para alternar ordenação por Nome">
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span>Nome</span>
                          {renderSortIcon('nome')}
                        </div>
                      </th>
                      <th onClick={() => handleSort('filhos')} style={{ textAlign: 'center', cursor: 'pointer', userSelect: 'none' }} title="Clique para alternar ordenação por Filhos">
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                          <span>Filhos</span>
                          {renderSortIcon('filhos')}
                        </div>
                      </th>
                      <th onClick={() => handleSort('tipo')} style={{ cursor: 'pointer', userSelect: 'none' }} title="Clique para alternar ordenação por Tipo">
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span>Tipo</span>
                          {renderSortIcon('tipo')}
                        </div>
                      </th>
                      <th onClick={() => handleSort('padrinhos')} style={{ cursor: 'pointer', userSelect: 'none' }} title="Clique para alternar ordenação por Padrinhos">
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span>Padrinhos</span>
                          {renderSortIcon('padrinhos')}
                        </div>
                      </th>
                      <th style={{ textAlign: 'right' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAcampamentos.map((a) => {
                      const { total: valorTotal, itens: itensValor } = calcularValorTotal(a, currentEvento || a.apc_evento);
                      const tooltipTexto = itensValor.length > 0
                        ? itensValor.map(item => `${item.descricao}: ${formatCurrency(item.valor)}`).join('\n') + (itensValor.length > 1 ? `\n-------------------------\nTotal: ${formatCurrency(valorTotal)}` : '')
                        : 'Sem cobrança';

                      return (
                        <tr key={a.id}>
                          <td>{a.apc_pessoa?.ano}</td>
                          <td>
                            <div style={{ alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem' }}>
                              <span style={{ fontWeight: '500', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'help' }} title="Sim, vai para o Acampamento">
                                {a.apc_pessoa?.nome} <Check size={12} color="var(--success)" />
                              </span>
                              {a.apc_pessoa?.conjuge && (
                                <span style={{ fontWeight: '500', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'help' }} title={a.conjuge_inscricao ? "Sim, vai para o Acampamento" : "Não vai para o Acampamento"}>
                                  {a.apc_pessoa.conjuge.nome}
                                  {a.conjuge_inscricao ? (
                                    <Check size={12} color="var(--success)" />
                                  ) : (
                                    <X size={12} color="var(--error)" />
                                  )}
                                </span>
                              )}
                            </div>
                          </td>

                          <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                            {(() => {
                              const dependentes = a.apc_pessoa?.dependentes_agrupados || [];
                              if (dependentes.length === 0) {
                                return <span style={{ color: 'var(--text-secondary)' }}>-</span>;
                              }
                              const vaiAcampamentoCount = dependentes.filter(d => Boolean(d.acampamento !== undefined ? d.acampamento : d.mascote)).length;

                              return (
                                <button
                                  type="button"
                                  onClick={(e) => handleOpenFilhos(e, a)}
                                  title={`Filhos no acampamento: ${vaiAcampamentoCount}. Clique para detalhar.`}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    padding: '0.2rem 0.55rem',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontWeight: '600',
                                    background: vaiAcampamentoCount > 0 ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-secondary)',
                                    color: vaiAcampamentoCount > 0 ? '#059669' : 'var(--text-secondary)',
                                    border: vaiAcampamentoCount > 0 ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-color)',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                  }}
                                >
                                  <Users size={13} />
                                  <span>{vaiAcampamentoCount}</span>
                                </button>
                              );
                            })()}
                          </td>
                          <td>
                            {(() => {
                              const tipo = a.apc_pessoa?.tipo_pessoa;
                              let label = tipo || '-';
                              let bg = 'var(--bg-secondary)';
                              let color = 'var(--text-secondary)';
                              let border = '1px solid var(--border-color)';

                              if (tipo === 'PADRINHO' || tipo === 'MADRINHA') {
                                label = 'Padrinhos';
                                bg = 'rgba(16, 185, 129, 0.1)';
                                color = '#059669';
                                border = '1px solid rgba(16, 185, 129, 0.25)';
                              } else if (tipo === 'AFILHADO') {
                                label = 'Afilhado(a)';
                                bg = 'rgba(245, 158, 11, 0.1)';
                                color = '#d97706';
                                border = '1px solid rgba(245, 158, 11, 0.25)';
                              } else if (tipo === 'VOLUNTARIO') {
                                label = 'Voluntário(a)';
                                bg = 'rgba(59, 130, 246, 0.1)';
                                color = '#2563eb';
                                border = '1px solid rgba(59, 130, 246, 0.25)';
                              }

                              return (
                                <span style={{
                                  fontSize: '0.75rem',
                                  fontWeight: '600',
                                  padding: '0.15rem 0.5rem',
                                  borderRadius: '5px',
                                  background: bg,
                                  color: color,
                                  border: border,
                                  whiteSpace: 'nowrap'
                                }}>
                                  {label}
                                </span>
                              );
                            })()}
                          </td>

                          <td style={{ verticalAlign: 'middle', fontSize: '0.75rem' }}>
                            {(() => {
                              const p = a.apc_pessoa;
                              if (p?.tipo_pessoa !== 'AFILHADO') {
                                return <span style={{ color: 'var(--text-secondary)' }}></span>;
                              }

                              const padrinho = p.vinculo?.padrinho;
                              const madrinha = p.vinculo?.madrinha;
                              const textoFicha = p.padrinhos_catequistas;

                              if (padrinho || madrinha) {
                                return (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                                    {padrinho && (
                                      <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
                                        {padrinho.nome}
                                      </span>
                                    )}
                                    {madrinha && (
                                      <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
                                        {madrinha.nome}
                                      </span>
                                    )}
                                  </div>
                                );
                              }

                              if (textoFicha) {
                                return (
                                  <span style={{ color: 'var(--text-primary)', fontSize: '0.75rem' }}>
                                    {textoFicha}
                                  </span>
                                );
                              }

                              return <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.75rem' }}>Não vinculado</span>;
                            })()}
                          </td>

                          <td style={{ textAlign: 'right', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                              <Link to={`/admin/pagamentos/${a.id}`} state={{ from: `/admin/acampamentos/${evento_id}` }} className="btn btn-secondary" style={{ padding: '0.4rem 0.5rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.25rem' }} title="Informações de Pagamentos">
                                <DollarSign size={12} />
                              </Link>
                              {isAdmin && (
                                <>
                                  <button onClick={() => handleEdit(a)} className="btn btn-primary" style={{ padding: '0.4rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }} title="Editar Família">
                                    <Edit2 size={12} />
                                  </button>
                                  <button onClick={() => handleDelete(a)} className="btn btn-danger" style={{ padding: '0.4rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }} title="Excluir Inscrição da Família">
                                    <Trash2 size={12} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Popover / Caixinha suspensa de Padrinhos para Afilhados (Não modal / Hover) */}
      {caixaPadrinhos?.isOpen && (
        <div
          ref={popoverPadrinhosRef}
          className="glass-panel"
          onMouseEnter={() => {
            if (padrinhosTimeoutRef.current) {
              clearTimeout(padrinhosTimeoutRef.current);
              padrinhosTimeoutRef.current = null;
            }
          }}
          onMouseLeave={handleMouseLeavePadrinhos}
          style={{
            position: 'fixed',
            top: window.innerWidth <= 768 ? '50%' : (caixaPadrinhos.pos?.top !== 'auto' && caixaPadrinhos.pos?.top !== undefined ? `${caixaPadrinhos.pos.top}px` : 'auto'),
            bottom: window.innerWidth <= 768 ? 'auto' : (caixaPadrinhos.pos?.bottom !== 'auto' && caixaPadrinhos.pos?.bottom !== undefined ? `${caixaPadrinhos.pos.bottom}px` : 'auto'),
            left: window.innerWidth <= 768 ? '50%' : `${caixaPadrinhos.pos?.left || 100}px`,
            transform: window.innerWidth <= 768 ? 'translate(-50%, -50%)' : 'none',
            width: '320px',
            maxWidth: 'calc(100vw - 32px)',
            maxHeight: '85vh',
            overflowY: 'auto',
            zIndex: 9999,
            background: 'var(--bg-primary, #0f172a)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            borderRadius: '12px',
            boxShadow: '0 14px 32px -4px rgba(0, 0, 0, 0.55), 0 0 12px rgba(245, 158, 11, 0.15)',
            padding: '0.85rem 1rem',
            pointerEvents: 'auto'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.65rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '6px',
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#d97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Users size={14} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                  Afilhado(a)
                </h4>
                <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  {caixaPadrinhos.afilhadoNome}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCaixaPadrinhos(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '0.2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Fechar"
            >
              <X size={15} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', fontSize: '0.775rem' }}>
            {caixaPadrinhos.padrinho || caixaPadrinhos.madrinha ? (
              <>
                <div>
                  <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: '600', letterSpacing: '0.04em' }}>
                    Padrinho
                  </span>
                  <div style={{ fontWeight: '600', color: caixaPadrinhos.padrinho ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                    {caixaPadrinhos.padrinho?.nome || 'Não vinculado'}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: '600', letterSpacing: '0.04em' }}>
                    Madrinha
                  </span>
                  <div style={{ fontWeight: '600', color: caixaPadrinhos.madrinha ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                    {caixaPadrinhos.madrinha?.nome || 'Não vinculada'}
                  </div>
                </div>
              </>
            ) : caixaPadrinhos.padrinhosTexto ? (
              <div>
                <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: '600' }}>
                  Padrinhos Informados
                </span>
                <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                  {caixaPadrinhos.padrinhosTexto}
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic', padding: '0.25rem 0' }}>
                Nenhum padrinho vinculado no sistema.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Popover / Caixinha suspensa de Filhos / Dependentes (Não modal) */}
      {modalFilhos.isOpen && (
        <div
          ref={popoverFilhosRef}
          className="glass-panel"
          style={{
            position: 'fixed',
            top: window.innerWidth <= 768 ? '50%' : (modalFilhos.pos?.top !== 'auto' && modalFilhos.pos?.top !== undefined ? `${modalFilhos.pos.top}px` : 'auto'),
            bottom: window.innerWidth <= 768 ? 'auto' : (modalFilhos.pos?.bottom !== 'auto' && modalFilhos.pos?.bottom !== undefined ? `${modalFilhos.pos.bottom}px` : 'auto'),
            left: window.innerWidth <= 768 ? '50%' : `${modalFilhos.pos?.left || 100}px`,
            transform: window.innerWidth <= 768 ? 'translate(-50%, -50%)' : 'none',
            width: '380px',
            maxWidth: 'calc(100vw - 32px)',
            maxHeight: window.innerWidth <= 768 ? '85vh' : `${modalFilhos.pos?.maxHeight || 450}px`,
            overflowY: 'auto',
            zIndex: 9999,
            background: 'var(--bg-primary, #0f172a)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            borderRadius: '14px',
            boxShadow: '0 16px 36px -6px rgba(0, 0, 0, 0.55), 0 0 15px rgba(16, 185, 129, 0.15)',
            padding: '0.85rem 1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}
        >
          {/* Cabeçalho */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <div style={{
                width: '26px',
                height: '26px',
                borderRadius: '6px',
                background: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Users size={15} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                  Filhos / Dependentes
                </h4>
                <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  {modalFilhos.titularNome}{modalFilhos.conjugeNome ? ` e ${modalFilhos.conjugeNome}` : ''} • {modalFilhos.dependentes.filter(d => Boolean(d.acampamento !== undefined ? d.acampamento : d.mascote)).length} filho(s) no acampamento
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setModalFilhos({ isOpen: false, inscricaoId: null, titularNome: '', conjugeNome: '', dependentes: [], pos: null })}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '0.2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Fechar"
            >
              <X size={16} />
            </button>
          </div>

          {/* Lista dos Filhos */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {modalFilhos.dependentes.map(d => {
              const idade = calcularIdade(d.data_nascimento);
              const vaiAcampamento = Boolean(d.acampamento !== undefined ? d.acampamento : d.mascote);
              const ehMascote = vaiAcampamento && Boolean(d.mascote);

              return (
                <div
                  key={d.id}
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '0.25rem 0.1rem',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '0.825rem', color: 'var(--text-primary)' }}>
                        {d.nome}
                      </strong>
                      {idade !== null && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.06)', padding: '0.05rem 0.35rem', borderRadius: '4px' }}>
                          {idade} ano{idade === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                      {ehMascote && (
                        <span style={{
                          fontSize: '0.65rem',
                          fontWeight: '700',
                          background: '#fef3c7',
                          color: '#b45309',
                          border: '1px solid #fde68a',
                          padding: '0.1rem 0.4rem',
                          borderRadius: '999px'
                        }}>
                          Mascote
                        </span>
                      )}

                      <span
                        style={{
                          fontSize: '0.675rem',
                          fontWeight: '600',
                          padding: '0.1rem 0.4rem',
                          borderRadius: '999px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          background: vaiAcampamento ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.1)',
                          color: vaiAcampamento ? '#059669' : '#dc2626',
                          border: vaiAcampamento ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.25)'
                        }} title={vaiAcampamento ? 'Vai para o acampamento' : 'Não vai para o acampamento'}
                      >
                        {vaiAcampamento ? (
                          <>
                            <CheckCircle2 size={11} color="#059669" />
                          </>
                        ) : (
                          <>
                            <X size={11} color="#dc2626" />
                          </>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Detalhes Médicos se houver */}
                  {(d.problema_saude === 'SIM' || d.problema_saude === true || d.medicamento_continuo === 'SIM' || d.medicamento_continuo === true || d.restricao_alimentar === 'SIM' || d.restricao_alimentar === true || d.alergia_medicamento === 'SIM' || d.alergia_medicamento === true || d.alergia_alimento === 'SIM' || d.alergia_alimento === true || d.cuidado_especial === 'SIM' || d.cuidado_especial === true) && (
                    <div style={{
                      marginTop: '0.15rem',
                      paddingTop: '0.25rem',
                      borderTop: '1px solid var(--border-color)',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.25rem',
                      fontSize: '0.675rem'
                    }}>
                      {(d.problema_saude === 'SIM' || d.problema_saude === true) && (
                        <span style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.08)', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                          Problema: {d.problema_saude_qual || 'Sim'}
                        </span>
                      )}
                      {(d.medicamento_continuo === 'SIM' || d.medicamento_continuo === true) && (
                        <span style={{ color: '#2563eb', background: 'rgba(37, 99, 235, 0.08)', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                          Medicamento: {d.medicamento_continuo_qual || 'Sim'}
                        </span>
                      )}
                      {(d.restricao_alimentar === 'SIM' || d.restricao_alimentar === true) && (
                        <span style={{ color: '#d97706', background: 'rgba(217, 119, 6, 0.08)', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                          Restrição: {d.restricao_alimentar_qual || 'Sim'}
                        </span>
                      )}
                      {(d.alergia_medicamento === 'SIM' || d.alergia_medicamento === true || d.alergia_alimento === 'SIM' || d.alergia_alimento === true) && (
                        <span style={{ color: '#ec4899', background: 'rgba(236, 72, 153, 0.08)', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                          Alergia: {[d.alergia_medicamento_qual, d.alergia_alimento_qual].filter(Boolean).join(', ') || 'Sim'}
                        </span>
                      )}
                      {(d.cuidado_especial === 'SIM' || d.cuidado_especial === true) && (
                        <span style={{ color: '#8b5cf6', background: 'rgba(139, 92, 246, 0.08)', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                          Cuidado Especial: {d.cuidado_especial_qual || 'Sim'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Popover / Caixinha suspensa de Detalhamento do Valor e Pagamentos (Não modal) */}
      {caixaValor?.isOpen && (
        <div
          ref={popoverValorRef}
          className="glass-panel"
          style={{
            position: 'fixed',
            top: window.innerWidth <= 768 ? '50%' : (caixaValor.pos?.top !== 'auto' && caixaValor.pos?.top !== undefined ? `${caixaValor.pos.top}px` : 'auto'),
            bottom: window.innerWidth <= 768 ? 'auto' : (caixaValor.pos?.bottom !== 'auto' && caixaValor.pos?.bottom !== undefined ? `${caixaValor.pos.bottom}px` : 'auto'),
            left: window.innerWidth <= 768 ? '50%' : `${caixaValor.pos?.left || 100}px`,
            transform: window.innerWidth <= 768 ? 'translate(-50%, -50%)' : 'none',
            width: '370px',
            maxWidth: 'calc(100vw - 32px)',
            overflowY: 'auto',
            maxHeight: window.innerWidth <= 768 ? '85vh' : `${caixaValor.pos?.maxHeight || 500}px`,
            zIndex: 9999,
            background: 'var(--bg-primary, #0f172a)',
            border: '1px solid rgba(59, 130, 246, 0.4)',
            borderRadius: '14px',
            boxShadow: '0 16px 36px -6px rgba(0, 0, 0, 0.55), 0 0 15px rgba(59, 130, 246, 0.15)',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem'
          }}
        >
          {/* Cabeçalho */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                background: 'rgba(59, 130, 246, 0.15)',
                color: 'var(--accent, #3b82f6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <DollarSign size={16} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                  Detalhamento Financeiro
                </h4>
                <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                  {caixaValor.titularNome}{caixaValor.conjugeNome ? ` e ${caixaValor.conjugeNome}` : ''}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCaixaValor(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '0.2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Fechar"
            >
              <X size={16} />
            </button>
          </div>

          {/* Seção 1: Valores Previstos */}
          <div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {caixaValor.itensValor && caixaValor.itensValor.length > 0 ? (
                caixaValor.itensValor.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      padding: '0.3rem 0.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.5rem'
                    }}
                  >
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-primary)', fontWeight: '500' }}>
                      {item.descricao}
                    </span>
                    <span style={{
                      fontSize: '0.775rem',
                      fontWeight: '700',
                      color: item.valor > 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
                      whiteSpace: 'nowrap'
                    }}>
                      {item.valor > 0 ? formatCurrency(item.valor) : 'Isento'}
                    </span>
                  </div>
                ))
              ) : (
                <div style={{
                  padding: '0.5rem',
                  textAlign: 'center',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  fontStyle: 'italic',
                  background: 'var(--bg-secondary)',
                  borderRadius: '6px'
                }}>
                  Sem cobrança cadastrada / isento.
                </div>
              )}
            </div>
          </div>

          {/* Seção 2: Pagamentos Recebidos */}
          <div>
            <div style={{ fontSize: '0.6rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.02em', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
              Pagamentos Recebidos
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              {caixaValor.itensPago && caixaValor.itensPago.length > 0 ? (
                caixaValor.itensPago.map((pg, idx) => (
                  <div
                    key={pg.id || idx}
                    style={{
                      background: 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      borderRadius: '6px',
                      padding: '0.3rem 0.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.5rem'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-primary)', fontWeight: '500' }}>
                        {pg.descricao || 'Recebimento de inscrição'}
                      </span>
                      {pg.data_recebimento && (
                        <span style={{ fontSize: '0.675rem', color: 'var(--text-secondary)' }}>
                          {new Date(pg.data_recebimento + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>
                    <span style={{
                      fontSize: '0.8rem',
                      fontWeight: '700',
                      color: '#10b981',
                      whiteSpace: 'nowrap'
                    }}>
                      {formatCurrency(pg.valor)}
                    </span>
                  </div>
                ))
              ) : (
                <div style={{
                  padding: '0.5rem',
                  textAlign: 'center',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  fontStyle: 'italic',
                  background: 'var(--bg-secondary)',
                  borderRadius: '6px'
                }}>
                  Nenhum pagamento registrado até o momento.
                </div>
              )}
            </div>
          </div>

          {/* Card Consolidado no Rodapé */}
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '0.25rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '0.2rem',
            textAlign: 'center'
          }}>
            <div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Previsto</div>
              <div style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                {formatCurrency(caixaValor.valorTotal)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.65rem', color: '#10b981' }}>Pago</div>
              <div style={{ fontSize: '0.85rem', fontWeight: '800', color: '#10b981' }}>
                {formatCurrency(caixaValor.totalPago)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.65rem', color: (caixaValor.valorTotal - (caixaValor.totalPago || 0)) > 0 ? '#f59e0b' : '#10b981' }}>
                Saldo
              </div>
              <div style={{
                fontSize: '0.85rem',
                fontWeight: '800',
                color: (caixaValor.valorTotal - (caixaValor.totalPago || 0)) > 0 ? '#f59e0b' : '#10b981'
              }}>
                {caixaValor.valorTotal > 0
                  ? ((caixaValor.valorTotal - (caixaValor.totalPago || 0)) > 0
                    ? formatCurrency(caixaValor.valorTotal - (caixaValor.totalPago || 0))
                    : 'Quitado ✓')
                  : 'R$ 0,00'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
