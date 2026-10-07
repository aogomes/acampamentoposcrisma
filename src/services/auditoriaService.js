import { supabase } from '../lib/supabase';

// Armazena contexto do usuário em memória para logs rápidos e captura de erros
let currentUserContext = {
  user_id: null,
  user_email: null,
  user_nome: null
};

/**
 * Atualiza o contexto do usuário autenticado no serviço de auditoria
 */
export const setUsuarioAuditoria = ({ id, email, nome }) => {
  currentUserContext = {
    user_id: id || null,
    user_email: email || null,
    user_nome: nome || null
  };
};

/**
 * Registra um evento de auditoria no Supabase
 * @param {Object} params
 * @param {string} params.acao - Ação executada (ex: 'LOGIN', 'LOGOUT', 'RECUPERAR_SENHA_SOLICITADA', 'SALVAR_INSCRICAO_CLIQUE', 'ERRO_SISTEMA')
 * @param {string} [params.categoria='SISTEMA'] - 'AUTENTICACAO', 'INSCRICAO', 'ADMIN', 'ERRO', 'AFILHADOS', 'SISTEMA'
 * @param {string} [params.nivel='INFO'] - 'INFO', 'WARNING', 'ERROR'
 * @param {string} [params.descricao] - Descrição resumida da ação
 * @param {Object} [params.detalhes={}] - Informações adicionais ou payload
 * @param {string} [params.userId] - ID do usuário (se omitido, usa o contexto ou sessão atual)
 * @param {string} [params.userEmail] - Email do usuário
 * @param {string} [params.userNome] - Nome do usuário
 * @param {string} [params.pagina] - Rota onde a ação ocorreu (padrão: window.location.pathname)
 */
export const registrarAuditoria = async ({
  acao,
  categoria = 'SISTEMA',
  nivel = 'INFO',
  descricao = '',
  detalhes = {},
  userId = null,
  userEmail = null,
  userNome = null,
  pagina = null
}) => {
  try {
    let finalUserId = userId || currentUserContext.user_id;
    let finalUserEmail = userEmail || currentUserContext.user_email;
    let finalUserNome = userNome || currentUserContext.user_nome;

    // Se ainda não temos os dados do usuário, tenta buscar da sessão ativa
    if (!finalUserId) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          finalUserId = session.user.id;
          finalUserEmail = finalUserEmail || session.user.email;
          finalUserNome = finalUserNome || session.user.user_metadata?.full_name || session.user.email?.split('@')[0];
        }
      } catch (_) {
        // Ignora falha de leitura de sessão
      }
    }

    const payload = {
      acao,
      categoria,
      nivel,
      descricao: descricao || acao,
      detalhes: detalhes || {},
      user_id: finalUserId || null,
      user_email: finalUserEmail || null,
      user_nome: finalUserNome || null,
      pagina: pagina || (typeof window !== 'undefined' ? window.location.pathname : null)
    };

    const { error } = await supabase.from('apc_auditoria').insert([payload]);
    if (error) {
      console.warn('Não foi possível gravar log de auditoria no Supabase:', error.message);
    }
  } catch (err) {
    // Auditoria nunca deve quebrar a execução da aplicação
    console.warn('Erro interno no serviço de auditoria:', err?.message || err);
  }
};

// Controle de de-duplicação de erros globais para evitar tempestade de logs
let lastErrorTimestamp = 0;
let lastErrorMessage = '';
let monitoramentoIniciado = false;

/**
 * Inicia os ouvintes globais de erros não tratados do navegador (window.onerror e unhandledrejection)
 */
export const iniciarMonitoramentoErrosGlobais = () => {
  if (monitoramentoIniciado || typeof window === 'undefined') return;
  monitoramentoIniciado = true;

  // 1. Captura de erros síncronos e exceções de runtime
  window.addEventListener('error', (event) => {
    try {
      const now = Date.now();
      const errorMsg = event.message || event.error?.message || 'Erro desconhecido';

      // Ignora repetição idêntica dentro de 5 segundos
      if (errorMsg === lastErrorMessage && now - lastErrorTimestamp < 5000) {
        return;
      }
      lastErrorMessage = errorMsg;
      lastErrorTimestamp = now;

      // Filtra ruídos conhecidos de extensões de navegador
      if (
        errorMsg.includes('ResizeObserver loop') ||
        errorMsg.includes('Extension context invalidated') ||
        event.filename?.includes('extension://')
      ) {
        return;
      }

      registrarAuditoria({
        acao: 'ERRO_INESPERADO',
        categoria: 'ERRO',
        nivel: 'ERROR',
        descricao: `Exceção não tratada: ${errorMsg}`,
        detalhes: {
          mensagem: errorMsg,
          arquivo: event.filename || null,
          linha: event.lineno || null,
          coluna: event.colno || null,
          stack: event.error?.stack || null
        }
      });
    } catch (_) {}
  });

  // 2. Captura de Promises rejeitadas sem catch
  window.addEventListener('unhandledrejection', (event) => {
    try {
      const now = Date.now();
      const reason = event.reason;
      const errorMsg = typeof reason === 'string' ? reason : (reason?.message || 'Promise rejeitada sem tratamento');

      if (errorMsg === lastErrorMessage && now - lastErrorTimestamp < 5000) {
        return;
      }
      lastErrorMessage = errorMsg;
      lastErrorTimestamp = now;

      registrarAuditoria({
        acao: 'ERRO_PROMISE',
        categoria: 'ERRO',
        nivel: 'ERROR',
        descricao: `Rejeição assíncrona: ${errorMsg}`,
        detalhes: {
          mensagem: errorMsg,
          stack: reason?.stack || null,
          status: reason?.status || null
        }
      });
    } catch (_) {}
  });
};
