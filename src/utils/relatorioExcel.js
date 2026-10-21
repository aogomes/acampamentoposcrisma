import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';

const formatarData = (dataStr) => {
  if (!dataStr) return '';
  try {
    const [ano, mes, dia] = dataStr.split('T')[0].split('-');
    if (ano && mes && dia) {
      return `${dia}/${mes}/${ano}`;
    }
    const d = new Date(dataStr);
    return isNaN(d.getTime()) ? dataStr : d.toLocaleDateString('pt-BR');
  } catch {
    return dataStr;
  }
};

const formatarDataHora = (dataStr) => {
  if (!dataStr) return '';
  try {
    const d = new Date(dataStr);
    return isNaN(d.getTime()) ? dataStr : d.toLocaleString('pt-BR');
  } catch {
    return dataStr;
  }
};

const calcularIdade = (dataNasc) => {
  if (!dataNasc) return '';
  try {
    const partes = dataNasc.split('T')[0].split('-');
    if (partes.length === 3) {
      const hoje = new Date();
      const ano = parseInt(partes[0], 10);
      const mes = parseInt(partes[1], 10) - 1;
      const dia = parseInt(partes[2], 10);
      let idade = hoje.getFullYear() - ano;
      const m = hoje.getMonth() - mes;
      if (m < 0 || (m === 0 && hoje.getDate() < dia)) {
        idade--;
      }
      return idade >= 0 ? idade : '';
    }
    return '';
  } catch {
    return '';
  }
};

const formatarMoeda = (val) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
};

/**
 * Busca todas as informações das pessoas inscritas em um evento e gera um arquivo Excel (.xlsx)
 * @param {Object} evento - Objeto do evento selecionado (id, descricao, local, etc)
 */
export const exportarRelatorioExcelEvento = async (evento) => {
  if (!evento || !evento.id) {
    throw new Error('Evento inválido.');
  }

  // Busca dados completos do evento (garantindo valores e regras de faixa etária)
  let dadosEvento = evento;
  const { data: evData } = await supabase
    .from('apc_evento')
    .select('*')
    .eq('id', evento.id)
    .single();

  if (evData) {
    dadosEvento = { ...evento, ...evData };
  }

  // 1. Busca inscrições do evento juntamente com os dados completos de apc_pessoa
  let acampamentos = null;
  const { data: acampDataFk, error: acampErrorFk } = await supabase
    .from('apc_acampamento')
    .select(`
      id,
      equipe,
      created_at,
      pessoa_id,
      apc_pessoa!apc_acampamento_pessoa_id_fkey (
        *
      )
    `)
    .eq('evento_id', evento.id)
    .order('created_at', { ascending: true });

  if (acampErrorFk) {
    const { data: acampDataFb, error: acampErrorFb } = await supabase
      .from('apc_acampamento')
      .select(`
        id,
        equipe,
        created_at,
        pessoa_id,
        apc_pessoa!pessoa_id (
          *
        )
      `)
      .eq('evento_id', evento.id)
      .order('created_at', { ascending: true });

    if (acampErrorFb) throw acampErrorFb;
    acampamentos = acampDataFb;
  } else {
    acampamentos = acampDataFk;
  }

  if (!acampamentos || acampamentos.length === 0) {
    return { count: 0, message: `Nenhuma inscrição encontrada para o evento "${dadosEvento.descricao}".` };
  }

  const valorEvento = Number(dadosEvento.valor || 0);
  const valorDif = dadosEvento.valor_diferenciado !== null && dadosEvento.valor_diferenciado !== undefined && dadosEvento.valor_diferenciado !== ''
    ? Number(dadosEvento.valor_diferenciado)
    : null;
  const idadeMin = dadosEvento.idade_min_diferenciada !== null && dadosEvento.idade_min_diferenciada !== undefined && dadosEvento.idade_min_diferenciada !== ''
    ? parseInt(dadosEvento.idade_min_diferenciada, 10)
    : null;
  const idadeMax = dadosEvento.idade_max_diferenciada !== null && dadosEvento.idade_max_diferenciada !== undefined && dadosEvento.idade_max_diferenciada !== ''
    ? parseInt(dadosEvento.idade_max_diferenciada, 10)
    : null;

  // Coleta IDs das pessoas para buscar dados complementares
  const pessoaIds = acampamentos.map(a => a.pessoa_id).filter(Boolean);
  const acampamentoIds = acampamentos.map(a => a.id).filter(Boolean);

  // 2. Busca vínculos de afilhados (padrinho / madrinha)
  const afilhadoIds = acampamentos
    .map(a => a.apc_pessoa)
    .filter(p => p && p.tipo_pessoa === 'AFILHADO')
    .map(p => p.id);

  const vinculosMap = {};
  if (afilhadoIds.length > 0) {
    const { data: vinculos } = await supabase
      .from('apc_vinculo')
      .select('afilhado_id, padrinho_id, madrinha_id')
      .in('afilhado_id', afilhadoIds);

    if (vinculos && vinculos.length > 0) {
      const padrinhoIds = [...new Set(vinculos.flatMap(v => [v.padrinho_id, v.madrinha_id]).filter(Boolean))];
      let padrinhosMap = {};
      if (padrinhoIds.length > 0) {
        const { data: padrinhos } = await supabase
          .from('apc_pessoa')
          .select('id, nome, telefone')
          .in('id', padrinhoIds);
        if (padrinhos) {
          padrinhos.forEach(p => { padrinhosMap[p.id] = p; });
        }
      }

      vinculos.forEach(v => {
        vinculosMap[v.afilhado_id] = {
          padrinho: padrinhosMap[v.padrinho_id]?.nome || '',
          padrinho_tel: padrinhosMap[v.padrinho_id]?.telefone || '',
          madrinha: padrinhosMap[v.madrinha_id]?.nome || '',
          madrinha_tel: padrinhosMap[v.madrinha_id]?.telefone || ''
        };
      });
    }
  }

  // Mapa com todas as pessoas do evento para resolução de cônjuges e familiares
  const pessoasMap = {};
  acampamentos.forEach(a => {
    if (a.apc_pessoa?.id) {
      pessoasMap[a.apc_pessoa.id] = a.apc_pessoa;
    }
  });

  // Busca cônjuges que possam ter sido vinculados mas não estão inscritos no evento
  const conjugeIdsParaBuscar = new Set();
  acampamentos.forEach(a => {
    const cId = a.apc_pessoa?.conjuge_id;
    if (cId && !pessoasMap[cId]) {
      conjugeIdsParaBuscar.add(cId);
    }
  });

  if (conjugeIdsParaBuscar.size > 0) {
    const { data: conjugesExtras } = await supabase
      .from('apc_pessoa')
      .select('id, nome, telefone')
      .in('id', [...conjugeIdsParaBuscar]);

    if (conjugesExtras) {
      conjugesExtras.forEach(c => {
        pessoasMap[c.id] = c;
      });
    }
  }

  // Função para identificar o nome do cônjuge de forma bidirecional
  const obterNomeConjuge = (p) => {
    if (!p) return '';
    // 1. Pelo vínculo direto de conjuge_id
    if (p.conjuge_id && pessoasMap[p.conjuge_id]) {
      return pessoasMap[p.conjuge_id].nome || '';
    }
    // 2. Por reciprocidade (quando o outro cônjuge apontou para esta pessoa)
    const parceiroReciproco = Object.values(pessoasMap).find(outra => outra && outra.conjuge_id === p.id);
    if (parceiroReciproco) {
      return parceiroReciproco.nome || '';
    }
    return '';
  };

  // 3. Busca dependentes (filhos / mascotes)
  const dependentesMap = {};
  const todosDependentes = [];
  const dependenteIdsVistos = new Set();
  let totalCriancasPagantes = 0;
  let totalCriancasNaoPagantes = 0;
  let totalCriancasQueVao = 0;
  let totalMascotes = 0;
  let totalValorCriancas = 0;

  if (pessoaIds.length > 0) {
    const { data: dependentes } = await supabase
      .from('apc_dependente')
      .select('*')
      .in('pessoa_id', pessoaIds);

    if (dependentes) {
      dependentes.forEach(d => {
        if (!dependentesMap[d.pessoa_id]) dependentesMap[d.pessoa_id] = [];
        dependentesMap[d.pessoa_id].push(d);

        const jaProcessado = dependenteIdsVistos.has(d.id);
        if (!jaProcessado) {
          dependenteIdsVistos.add(d.id);
        }

        const resp = acampamentos.find(a => a.pessoa_id === d.pessoa_id)?.apc_pessoa;
        const idadeDep = calcularIdade(d.data_nascimento);
        const vaiAoAcampamento = Boolean(d.acampamento !== undefined ? d.acampamento : d.mascote);
        const ehMascote = vaiAoAcampamento && Boolean(d.mascote);

        let ehPagante = false;
        let valorDep = 0;
        let condicaoFaixa = 'Não vai ao acampamento';

        if (vaiAoAcampamento) {
          if (!jaProcessado) {
            totalCriancasQueVao++;
            if (ehMascote) {
              totalMascotes++;
            }
          }

          if (valorDif !== null && idadeMin !== null && idadeMax !== null) {
            if (idadeDep !== '' && idadeDep !== null && !isNaN(idadeDep)) {
              if (idadeDep >= idadeMin && idadeDep <= idadeMax) {
                ehPagante = true;
                valorDep = valorDif;
                condicaoFaixa = `Faixa diferenciada (${idadeMin} a ${idadeMax} anos)`;
              } else if (idadeDep < idadeMin) {
                ehPagante = false;
                valorDep = 0;
                condicaoFaixa = `Não pagante / Isento (< ${idadeMin} anos)`;
              } else {
                ehPagante = true;
                valorDep = valorEvento;
                condicaoFaixa = `Adulto (> ${idadeMax} anos)`;
              }
            } else {
              ehPagante = true;
              valorDep = valorDif;
              condicaoFaixa = 'Faixa diferenciada (sem data)';
            }
          } else {
            if (valorEvento > 0) {
              ehPagante = true;
              valorDep = valorEvento;
              condicaoFaixa = 'Valor integral';
            } else {
              ehPagante = false;
              valorDep = 0;
              condicaoFaixa = 'Gratuito';
            }
          }

          if (!jaProcessado) {
            if (ehPagante) {
              totalCriancasPagantes++;
            } else {
              totalCriancasNaoPagantes++;
            }
            totalValorCriancas += valorDep;
          }
        }

        todosDependentes.push({
          'Responsável (Titular)': resp?.nome || 'Não identificado',
          'Nome do Dependente': d.nome,
          'Data de Nascimento': formatarData(d.data_nascimento),
          'Idade': idadeDep,
          'Tipo': vaiAoAcampamento ? (ehMascote ? 'Mascote (Vai ao acampamento)' : 'Dependente (Vai ao acampamento)') : 'Dependente (Não vai)',
          'Vai ao Acampamento?': vaiAoAcampamento ? 'SIM' : 'NÃO',
          'É Mascote?': ehMascote ? 'SIM' : 'NÃO',
          'Condição de Pagamento': vaiAoAcampamento ? (ehPagante ? 'PAGANTE' : 'NÃO PAGANTE (ISENTO)') : 'NÃO SE APLICA',
          'Faixa / Detalhe': condicaoFaixa,
          'Valor Previsto (R$)': valorDep
        });
      });
    }
  }

  // 4. Busca pagamentos já realizados
  const pagamentosMap = {};
  const pagamentosItens = [];
  if (acampamentoIds.length > 0) {
    const { data: pagamentos, error: pagError } = await supabase
      .from('apc_pagamento')
      .select('id, acampamento_id, valor, data_recebimento, descricao')
      .in('acampamento_id', acampamentoIds)
      .order('data_recebimento', { ascending: false });

    if (pagError) {
      console.error('Erro ao buscar pagamentos para o relatório:', pagError);
    }

    if (pagamentos) {
      pagamentos.forEach(pg => {
        const val = Number(pg.valor || 0);
        if (!pagamentosMap[pg.acampamento_id]) pagamentosMap[pg.acampamento_id] = 0;
        pagamentosMap[pg.acampamento_id] += val;
        pagamentosItens.push(pg);
      });
    }
  }

  // 5. Monta as linhas da planilha de participantes
  const mapearLinhaParticipante = (acamp, index) => {
    const p = acamp.apc_pessoa || {};
    const vinc = vinculosMap[p.id] || {};
    const deps = dependentesMap[p.id] || [];
    const depsTexto = deps.map(d => `${d.nome} (${(d.acampamento ?? d.mascote) ? 'Mascote' : 'Dependente'})`).join('; ');

    const pagoProprio = pagamentosMap[acamp.id] || 0;
    const conjugeAcamp = acampamentos.find(a => a.pessoa_id && a.pessoa_id === p.conjuge_id);
    const pagoConjuge = conjugeAcamp ? (pagamentosMap[conjugeAcamp.id] || 0) : 0;
    const totalPago = pagoProprio > 0 ? pagoProprio : (pagoConjuge > 0 ? pagoConjuge : 0);
    const saldo = valorEvento > 0 ? Math.max(0, valorEvento - totalPago) : 0;

    let statusPagamento = 'Não se aplica';
    if (valorEvento > 0) {
      if (totalPago >= valorEvento) {
        statusPagamento = 'Pago Integral';
      } else if (totalPago > 0) {
        statusPagamento = 'Parcialmente Pago';
      } else {
        statusPagamento = 'Pendente';
      }
    }

    const dataNasc = p.data_nascimento ? p.data_nascimento.split('T')[0] : '';
    const idade = p.idade !== null && p.idade !== undefined && p.idade !== '' ? p.idade : calcularIdade(dataNasc);

    return {
      'Nº': index + 1,
      'Nome Completo': p.nome || '',
      'Como Irá Participar': p.tipo_pessoa || '',
      'Cônjuge': p.tipo_pessoa === 'PADRINHO' || p.tipo_pessoa === 'MADRINHA' ? obterNomeConjuge(p) : 'Não se aplica',
      // 'Equipe no Evento': acamp.equipe || 'Não definida',
      'Data de Nascimento': formatarData(dataNasc),
      'Idade': idade,
      'Sexo': p.sexo || '',
      'CPF': p.cpf || '',
      'RG': p.rg || '',
      'Telefone / WhatsApp': p.telefone || '',
      'E-mail': p.email || '',
      'Padrinhos / Catequistas (Ficha)': p.padrinhos_catequistas || '',
      'Padrinho (Sistema)': vinc.padrinho || '',
      'Telefone Padrinho': vinc.padrinho_tel || '',
      'Madrinha (Sistema)': vinc.madrinha || '',
      'Telefone Madrinha': vinc.madrinha_tel || '',
      'Contato de Emergência': p.contato_emergencia || '',
      'Nome do Responsável (Menores)': p.nome_responsavel || (p.nome_pai || p.nome_mae || ''),
      'Telefone do Responsável': p.fone_responsavel || '',
      'Nome do Pai': p.nome_pai || '',
      'Nome da Mãe': p.nome_mae || '',
      'Tipo Sanguíneo': p.tipo_sanguineo || '',
      'Problema de Saúde?': p.problema_saude ? 'SIM' : 'NÃO',
      'Qual Problema de Saúde': p.problema_saude_qual || '',
      'Histórico de Convulsão?': p.historico_convulsao ? 'SIM' : 'NÃO',
      'Tempo Última Convulsão': p.historico_convulsao_tempo || '',
      'Tratamento Médico?': p.tratamento_medico ? 'SIM' : 'NÃO',
      'Qual Tratamento Médico': p.tratamento_medico_qual || '',
      'Medicamento Contínuo?': p.medicamento_continuo ? 'SIM' : 'NÃO',
      'Qual Medicamento Contínuo': p.medicamento_continuo_qual || '',
      'Dosagem / Horários': p.medicamento_continuo_dosagem || '',
      'Lesão / Contusão Recente?': p.lesao_contusao ? 'SIM' : 'NÃO',
      'Qual Lesão / Contusão': p.lesao_contusao_qual || '',
      'Restrição Alimentar?': p.restricao_alimentar ? 'SIM' : 'NÃO',
      'Qual Restrição Alimentar': p.restricao_alimentar_qual || '',
      'Doença Respiratória?': p.doenca_respiratoria ? 'SIM' : 'NÃO',
      'Usa Bombinha?': p.usa_bombinha ? 'SIM' : 'NÃO',
      'Alergia a Medicamento?': p.alergia_medicamento ? 'SIM' : 'NÃO',
      'Qual Alergia Medicamento': p.alergia_medicamento_qual || '',
      'Alergia a Alimento?': p.alergia_alimento ? 'SIM' : 'NÃO',
      'Qual Alergia Alimento': p.alergia_alimento_qual || '',
      'Medicação Sintomas Habituais': p.medicacao_sintomas || '',
      'Cuidado Especial?': p.cuidado_especial ? 'SIM' : 'NÃO',
      'Qual Cuidado Especial': p.cuidado_especial_qual || '',
      'Tamanho Camiseta (Adulto)': p.camiseta || '',
      'Tamanho Camiseta Infantil': p.camiseta_infantil || '',
      'Dependentes / Filhos': depsTexto,
      'Outras Observações': p.outras_informacoes || (p.necessidade_medica || ''),
      'Termos LGPD Aceito': p.aceite_termos_dados ? 'SIM' : 'NÃO',
      'Uso de Imagem Autorizado': p.aceite_termo_imagem ? 'SIM' : 'NÃO',
      'Valor Inscrição (R$)': valorEvento,
      'Total Pago (R$)': totalPago,
      'Saldo a Pagar (R$)': saldo > 0 ? saldo : 0,
      'Status Pagamento': statusPagamento,
      'Data da Inscrição': formatarDataHora(acamp.created_at)
    };
  };

  // Separação em listas por tipo_pessoa
  const acampPadrinhos = [];
  const acampAfilhados = [];
  const acampOutros = [];

  acampamentos.forEach((acamp) => {
    const tipo = (acamp.apc_pessoa?.tipo_pessoa || '').toUpperCase();
    if (tipo === 'PADRINHO' || tipo === 'MADRINHA') {
      acampPadrinhos.push(acamp);
    } else if (tipo === 'AFILHADO') {
      acampAfilhados.push(acamp);
    } else {
      acampOutros.push(acamp);
    }
  });

  const padrinhosRows = acampPadrinhos.map((acamp, idx) => mapearLinhaParticipante(acamp, idx));
  const afilhadosRows = acampAfilhados.map((acamp, idx) => mapearLinhaParticipante(acamp, idx));
  const outrosRows = acampOutros.map((acamp, idx) => mapearLinhaParticipante(acamp, idx));

  // Função auxiliar para calcular larguras e criar Worksheet
  const criarPlanilhaComLarguras = (rows, mensagemVazia = 'Nenhum participante encontrado nesta categoria.') => {
    if (!rows || rows.length === 0) {
      const wsVazio = XLSX.utils.json_to_sheet([{ 'Aviso': mensagemVazia }]);
      wsVazio['!cols'] = [{ wch: 45 }];
      return wsVazio;
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const colWidths = Object.keys(rows[0] || {}).map(key => {
      let maxLen = key.length;
      rows.forEach(row => {
        const val = row[key] ? String(row[key]) : '';
        if (val.length > maxLen) maxLen = val.length;
      });
      return { wch: Math.min(Math.max(maxLen + 2, 10), 45) };
    });
    ws['!cols'] = colWidths;
    return ws;
  };

  // Cria o Workbook
  const workbook = XLSX.utils.book_new();

  // Aba 1: Padrinhos (somente PADRINHO e MADRINHA)
  const wsPadrinhos = criarPlanilhaComLarguras(padrinhosRows, 'Nenhum Padrinho ou Madrinha inscrito neste evento.');
  XLSX.utils.book_append_sheet(workbook, wsPadrinhos, 'Padrinhos');

  // Aba 2: Afilhados (somente AFILHADO)
  const wsAfilhados = criarPlanilhaComLarguras(afilhadosRows, 'Nenhum Afilhado inscrito neste evento.');
  XLSX.utils.book_append_sheet(workbook, wsAfilhados, 'Afilhados');

  // Aba 3: Outros Tipos
  const wsOutros = criarPlanilhaComLarguras(outrosRows, 'Nenhum participante de outros tipos inscrito neste evento.');
  XLSX.utils.book_append_sheet(workbook, wsOutros, 'Outros Tipos');

  // Aba 4: Dependentes (se houver)
  if (todosDependentes.length > 0) {
    const wsDependentes = XLSX.utils.json_to_sheet(todosDependentes);
    const depColWidths = Object.keys(todosDependentes[0] || {}).map(key => ({
      wch: Math.max(key.length + 3, 20)
    }));
    wsDependentes['!cols'] = depColWidths;
    XLSX.utils.book_append_sheet(workbook, wsDependentes, 'Dependentes');
  }

  // Aba 5: Resumo do Evento (com Resumo Financeiro Consolidado)
  const totalInscritos = acampamentos.length;
  const totalPadrinhos = padrinhosRows.length;
  const totalAfilhados = afilhadosRows.length;
  const totalOutros = outrosRows.length;
  const totalArrecadado = pagamentosItens.reduce((acc, pg) => acc + Number(pg.valor || 0), 0);

  const totalPessoas = totalInscritos + totalCriancasQueVao;
  const totalValorAdultos = totalInscritos * valorEvento;
  const valorTotalPrevisto = totalValorAdultos + totalValorCriancas;
  const saldoDevedor = Math.max(0, valorTotalPrevisto - totalArrecadado);
  const percentualArrecadado = valorTotalPrevisto > 0
    ? Math.min(100, Math.round((totalArrecadado / valorTotalPrevisto) * 100))
    : (totalArrecadado > 0 ? 100 : 0);

  const statusGeralFinanceiro = valorTotalPrevisto > 0
    ? (totalArrecadado >= valorTotalPrevisto ? 'Quitado Integralmente ✓' : `${percentualArrecadado}% Pago (Saldo Pendente)`)
    : 'Sem cobrança cadastrada';

  const resumoRows = [
    { 'Item': '=== DADOS GERAIS DO EVENTO ===', 'Informação': '========================================' },
    { 'Item': 'Nome do Evento', 'Informação': dadosEvento.descricao },
    { 'Item': 'Tema', 'Informação': dadosEvento.tema || 'Não informado' },
    { 'Item': 'Local', 'Informação': dadosEvento.local || 'Não informado' },
    { 'Item': 'Período', 'Informação': `${formatarData(dadosEvento.data_inicio)} a ${formatarData(dadosEvento.data_fim)}` },
    { 'Item': 'Valor da Inscrição (Padrão)', 'Informação': valorEvento > 0 ? formatarMoeda(valorEvento) : 'Gratuito / Não definido' },
    ...(valorDif !== null ? [
      { 'Item': 'Valor da Inscrição (Diferenciado)', 'Informação': `${formatarMoeda(valorDif)} (${dadosEvento.descricao_valor_diferenciado || `${idadeMin || 0} a ${idadeMax || 0} anos`})` }
    ] : []),
    { 'Item': 'Inclui Camiseta no Valor', 'Informação': dadosEvento.inclui_camiseta ? 'Sim' : 'Não' },
    { 'Item': '', 'Informação': '' },
    { 'Item': '=== QUANTITATIVO DE PARTICIPANTES ===', 'Informação': '========================================' },
    { 'Item': 'Total Geral de Participantes', 'Informação': totalPessoas },
    { 'Item': 'Total de Adultos Inscritos', 'Informação': totalInscritos },
    { 'Item': '• Padrinhos / Madrinhas', 'Informação': totalPadrinhos },
    { 'Item': '• Afilhados', 'Informação': totalAfilhados },
    { 'Item': '• Outros (Voluntários / Equipe)', 'Informação': totalOutros },
    { 'Item': 'Total de Crianças / Mascotes no Evento', 'Informação': totalCriancasQueVao },
    { 'Item': '• Crianças Pagantes', 'Informação': totalCriancasPagantes },
    { 'Item': '• Crianças Isentas', 'Informação': totalCriancasNaoPagantes },
    { 'Item': '• Mascotes Confirmados', 'Informação': totalMascotes },
    { 'Item': '', 'Informação': '' },
    { 'Item': '=== RESUMO FINANCEIRO DO EVENTO ===', 'Informação': '========================================' },
    { 'Item': 'Total Previsto', 'Informação': formatarMoeda(valorTotalPrevisto) },
    { 'Item': 'Total Pago (Recebido)', 'Informação': formatarMoeda(totalArrecadado) },
    { 'Item': 'Saldo Devedor (A Receber)', 'Informação': formatarMoeda(saldoDevedor) },
    { 'Item': 'Percentual Quitado (% Pago)', 'Informação': `${percentualArrecadado}%` },
    { 'Item': 'Status Geral de Arrecadação', 'Informação': statusGeralFinanceiro },
    { 'Item': 'Subtotal Previsto - Inscrições Adultos', 'Informação': formatarMoeda(totalValorAdultos) },
    { 'Item': 'Subtotal Previsto - Dependentes / Mascotes', 'Informação': formatarMoeda(totalValorCriancas) },
    { 'Item': 'Quantidade de Pagamentos Registrados', 'Informação': pagamentosItens.length },
    { 'Item': '', 'Informação': '' },
    { 'Item': 'Data e Hora da Emissão do Relatório', 'Informação': new Date().toLocaleString('pt-BR') }
  ];

  const wsResumo = XLSX.utils.json_to_sheet(resumoRows);
  wsResumo['!cols'] = [{ wch: 40 }, { wch: 45 }];
  XLSX.utils.book_append_sheet(workbook, wsResumo, 'Resumo do Evento');

  // Aba 6: Extrato de Pagamentos (se houver lançamentos)
  if (pagamentosItens.length > 0) {
    const acampPessoaMap = {};
    acampamentos.forEach(a => {
      acampPessoaMap[a.id] = a.apc_pessoa?.nome || `Inscrição #${a.id}`;
    });

    const pagamentosRows = pagamentosItens.map((pg, idx) => ({
      'Nº': idx + 1,
      'Data do Recebimento': formatarData(pg.data_recebimento),
      'Inscrito': acampPessoaMap[pg.acampamento_id] || 'Não identificado',
      'Descrição': pg.descricao || 'Recebimento de inscrição',
      'Valor (R$)': Number(pg.valor || 0)
    }));

    const wsPagamentos = criarPlanilhaComLarguras(pagamentosRows, 'Nenhum pagamento registrado.');
    XLSX.utils.book_append_sheet(workbook, wsPagamentos, 'Extrato de Pagamentos');
  }

  // Nome do arquivo limpo e padronizado
  const sanitizedNome = (evento.descricao || 'Evento')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_');
  const dataHoje = new Date().toISOString().split('T')[0];
  const fileName = `Relatorio_${sanitizedNome}_${dataHoje}.xlsx`;

  // Dispara o download
  XLSX.writeFile(workbook, fileName);

  return { count: totalInscritos, fileName };
};
