import { useState, useEffect, useMemo, useCallback } from 'react';
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
    titularNome: '',
    conjugeNome: '',
    dependentes: []
  });
  const [caixaPadrinhos, setCaixaPadrinhos] = useState(null);
  const [caixaValor, setCaixaValor] = useState(null);

  const handleOpenPadrinhos = (e, pessoa) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const popoverWidth = 280;

    let left = rect.left;
    if (left + popoverWidth > window.innerWidth - 16) {
      left = window.innerWidth - popoverWidth - 16;
    }
    if (left < 16) left = 16;

    let top = rect.bottom + 6;
    if (top + 190 > window.innerHeight) {
      top = Math.max(16, rect.top - 190);
    }

    setCaixaPadrinhos({
      isOpen: true,
      afilhadoNome: pessoa?.nome,
      padrinho: pessoa?.vinculo?.padrinho,
      madrinha: pessoa?.vinculo?.madrinha,
      padrinhosTexto: pessoa?.padrinhos_catequistas,
      pos: { top, left }
    });
  };

  const handleOpenFilhos = (e, a) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const popoverWidth = 350;

    let left = rect.left;
    if (left + popoverWidth > window.innerWidth - 16) {
      left = window.innerWidth - popoverWidth - 16;
    }
    if (left < 16) left = 16;

    let top = rect.bottom + 6;
    if (top + 280 > window.innerHeight) {
      top = Math.max(16, rect.top - 280);
    }

    setModalFilhos({
      isOpen: true,
      titularNome: a.apc_pessoa?.nome,
      conjugeNome: a.apc_pessoa?.conjuge?.nome,
      dependentes: a.apc_pessoa?.dependentes_agrupados || [],
      pos: { top, left }
    });
  };

  const handleOpenValor = (e, a, valorTotal, itensValor) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const popoverWidth = 360;

    let left = rect.left;
    if (left + popoverWidth > window.innerWidth - 16) {
      left = window.innerWidth - popoverWidth - 16;
    }
    if (left < 16) left = 16;

    let top = rect.bottom + 6;
    if (top + 340 > window.innerHeight) {
      top = Math.max(16, rect.top - 340);
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
      pos: { top, left }
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
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Filhos</div>
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
              <div style={{
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
              </div>
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
            <div style={{ overflowX: 'auto' }}>
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
                    <th>Valor</th>
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
                            <span style={{ fontWeight: '600', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'help' }} title="Sim, vai para o Acampamento">
                              {a.apc_pessoa?.nome} <Check size={12} color="var(--success)" />
                            </span>
                            {a.apc_pessoa?.conjuge && (
                              <span style={{ fontWeight: '600', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'help' }} title={a.conjuge_inscricao ? "Sim, vai para o Acampamento" : "Não vai para o Acampamento"}>
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
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
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
                                {tipo === 'AFILHADO' && (
                                  <button
                                    type="button"
                                    onClick={(e) => handleOpenPadrinhos(e, a.apc_pessoa)}
                                    title="Clique para ver os padrinhos"
                                    style={{
                                      background: 'rgba(245, 158, 11, 0.12)',
                                      border: '1px solid rgba(245, 158, 11, 0.3)',
                                      borderRadius: '5px',
                                      color: '#d97706',
                                      cursor: 'pointer',
                                      padding: '0.15rem 0.35rem',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      transition: 'all 0.15s ease'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = 'rgba(245, 158, 11, 0.25)';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = 'rgba(245, 158, 11, 0.12)';
                                    }}
                                  >
                                    <Users size={12} />
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                        </td>

                        <td style={{ verticalAlign: 'middle' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                            <div
                              onClick={(e) => handleOpenValor(e, a, valorTotal, itensValor)}
                              title="Clique para detalhar valores e pagamentos"
                              style={{
                                cursor: 'pointer',
                                display: 'inline-flex',
                                flexDirection: 'column',
                                gap: '0.2rem'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <span style={{
                                  fontWeight: '700',
                                  fontSize: '0.9rem',
                                  color: valorTotal > 0 ? 'var(--text-primary)' : 'var(--text-secondary)'
                                }}>
                                  {formatCurrency(valorTotal)}
                                </span>
                                <span style={{ fontSize: '0.725rem', color: 'var(--text-secondary)' }}>
                                  ({itensValor.length === 0 ? 'Isento' : itensValor.length === 1 ? '1 pessoa' : `${itensValor.length} pessoas`})
                                </span>
                              </div>

                              {/* Badge de Pagamento Recebido */}
                              {valorTotal > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  {(a.totalPago || 0) >= valorTotal ? (
                                    <span style={{
                                      fontSize: '0.675rem',
                                      fontWeight: '700',
                                      padding: '0.1rem 0.45rem',
                                      borderRadius: '4px',
                                      background: 'rgba(16, 185, 129, 0.12)',
                                      color: '#10b981',
                                      border: '1px solid rgba(16, 185, 129, 0.3)'
                                    }}>
                                      Quitado ✓
                                    </span>
                                  ) : (a.totalPago || 0) > 0 ? (
                                    <span style={{
                                      fontSize: '0.675rem',
                                      fontWeight: '600',
                                      padding: '0.1rem 0.45rem',
                                      borderRadius: '4px',
                                      background: 'rgba(245, 158, 11, 0.12)',
                                      color: '#d97706',
                                      border: '1px solid rgba(245, 158, 11, 0.3)'
                                    }}>
                                      Pago: {formatCurrency(a.totalPago)} • Falta: {formatCurrency(Math.max(0, valorTotal - a.totalPago))}
                                    </span>
                                  ) : (
                                    <span style={{
                                      fontSize: '0.675rem',
                                      fontWeight: '600',
                                      padding: '0.1rem 0.45rem',
                                      borderRadius: '4px',
                                      background: 'var(--bg-secondary)',
                                      color: 'var(--text-secondary)',
                                      border: '1px solid var(--border-color)'
                                    }}>
                                      Pendente
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td style={{ textAlign: 'right', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                            <Link to={`/admin/pagamentos/${a.id}`} state={{ from: `/admin/acampamentos/${evento_id}` }} className="btn btn-secondary" style={{ padding: '0.4rem 0.5rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.25rem' }} title="Pagamentos da Família">
                              <DollarSign size={12} />
                            </Link>
                            <button onClick={() => handleEdit(a)} className="btn btn-primary" style={{ padding: '0.4rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }} title="Editar Família">
                              <Edit2 size={12} />
                            </button>
                            <button onClick={() => handleDelete(a)} className="btn btn-danger" style={{ padding: '0.4rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }} title="Excluir Inscrição da Família">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Caixinha suspensa / Popover de Padrinhos para Afilhados */}
      {caixaPadrinhos?.isOpen && (
        <>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9998,
              cursor: 'default'
            }}
            onClick={() => setCaixaPadrinhos(null)}
          />

          <div
            className="glass-panel"
            style={{
              position: 'fixed',
              top: `${caixaPadrinhos.pos.top}px`,
              left: `${caixaPadrinhos.pos.left}px`,
              // width: '280px',
              zIndex: 9999,
              background: 'var(--bg-primary, #0f172a)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              borderRadius: '12px',
              boxShadow: '0 15px 35px -5px rgba(0, 0, 0, 0.6), 0 0 15px rgba(245, 158, 11, 0.1)',
              padding: '0.85rem 1rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.65rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
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
        </>
      )}

      {/* Popover / Caixinha suspensa de Filhos / Dependentes */}
      {modalFilhos.isOpen && (
        <>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9998,
              cursor: 'default'
            }}
            onClick={() => setModalFilhos({ isOpen: false, titularNome: '', conjugeNome: '', dependentes: [], pos: null })}
          />

          <div
            className="glass-panel"
            style={{
              position: 'fixed',
              top: `${modalFilhos.pos?.top || 100}px`,
              left: `${modalFilhos.pos?.left || 100}px`,
              maxWidth: '390px',
              overflowY: 'auto',
              zIndex: 9999,
              background: 'var(--bg-primary, #0f172a)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              borderRadius: '14px',
              boxShadow: '0 20px 40px -8px rgba(0, 0, 0, 0.6), 0 0 15px rgba(16, 185, 129, 0.1)',
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
                onClick={() => setModalFilhos({ isOpen: false, titularNome: '', conjugeNome: '', dependentes: [], pos: null })}
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
        </>
      )}

      {/* Popover / Caixinha suspensa de Detalhamento do Valor e Pagamentos */}
      {caixaValor?.isOpen && (
        <>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9998,
              cursor: 'default'
            }}
            onClick={() => setCaixaValor(null)}
          />

          <div
            className="glass-panel"
            style={{
              position: 'fixed',
              top: `${caixaValor.pos?.top || 100}px`,
              left: `${caixaValor.pos?.left || 100}px`,
              width: '370px',
              maxWidth: 'calc(100vw - 32px)',
              overflowY: 'auto',
              maxHeight: '480px',
              zIndex: 9999,
              background: 'var(--bg-primary, #0f172a)',
              border: '1px solid rgba(59, 130, 246, 0.35)',
              borderRadius: '14px',
              boxShadow: '0 20px 40px -8px rgba(0, 0, 0, 0.6), 0 0 15px rgba(59, 130, 246, 0.1)',
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
        </>
      )}
    </div>
  );
};
