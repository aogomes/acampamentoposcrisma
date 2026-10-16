-- ==============================================================================
-- OTIMIZAÇÃO DE PERFORMANCE: ÍNDICES PARA CONSULTAS DE INSCRIÇÕES E EVENTOS
-- Execute este script no SQL Editor do Dashboard Supabase
-- ==============================================================================

-- 1. Índices na tabela public.apc_acampamento
-- Essenciais para acelerar filtros por pessoa, criador, evento e ordenação por data
CREATE INDEX IF NOT EXISTS idx_apc_acampamento_pessoa_id 
  ON public.apc_acampamento (pessoa_id);

CREATE INDEX IF NOT EXISTS idx_apc_acampamento_criador_id 
  ON public.apc_acampamento (criador_id);

CREATE INDEX IF NOT EXISTS idx_apc_acampamento_evento_id 
  ON public.apc_acampamento (evento_id);

CREATE INDEX IF NOT EXISTS idx_apc_acampamento_created_at 
  ON public.apc_acampamento (created_at DESC);

-- 2. Índice na tabela public.apc_evento para acelerar ordenação por data de início
CREATE INDEX IF NOT EXISTS idx_apc_evento_data_inicio 
  ON public.apc_evento (data_inicio DESC);

-- 3. Índices na tabela public.apc_pessoa para buscas e joins rápidos
CREATE INDEX IF NOT EXISTS idx_apc_pessoa_user_id 
  ON public.apc_pessoa (user_id);

CREATE INDEX IF NOT EXISTS idx_apc_pessoa_conjuge_id 
  ON public.apc_pessoa (conjuge_id);

-- 4. Índices na tabela public.apc_vinculo para carregamento instantâneo de padrinhos/afilhados
CREATE INDEX IF NOT EXISTS idx_apc_vinculo_afilhado_id 
  ON public.apc_vinculo (afilhado_id);

CREATE INDEX IF NOT EXISTS idx_apc_vinculo_padrinho_id 
  ON public.apc_vinculo (padrinho_id);

CREATE INDEX IF NOT EXISTS idx_apc_vinculo_madrinha_id 
  ON public.apc_vinculo (madrinha_id);

-- 5. Índices na tabela public.apc_dependente para relacionamento com pessoa
CREATE INDEX IF NOT EXISTS idx_apc_dependente_pessoa_id 
  ON public.apc_dependente (pessoa_id);
