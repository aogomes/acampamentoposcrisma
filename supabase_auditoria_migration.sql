-- ==============================================================================
-- TABELA E POLÍTICAS DE AUDITORIA E MONITORAMENTO
-- Tabela: public.apc_auditoria
-- Execute este script no SQL Editor do seu Dashboard Supabase
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.apc_auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  
  -- Identificação do usuário (pode ser nulo para ações anônimas/deslogadas)
  user_id UUID,
  user_email TEXT,
  user_nome TEXT,
  
  -- Classificação do evento
  acao TEXT NOT NULL,               -- Ex: 'LOGIN', 'LOGOUT', 'RECUPERAR_SENHA_SOLICITADA', 'SALVAR_INSCRICAO_CLIQUE', 'ERRO_SISTEMA'
  categoria TEXT DEFAULT 'SISTEMA', -- 'AUTENTICACAO', 'INSCRICAO', 'ADMIN', 'ERRO', 'AFILHADOS', 'SISTEMA'
  nivel TEXT DEFAULT 'INFO',         -- 'INFO', 'WARNING', 'ERROR'
  
  -- Conteúdo e contexto
  descricao TEXT,
  detalhes JSONB DEFAULT '{}'::jsonb,
  
  -- Contexto do evento
  pagina TEXT
);

-- Garantir remoção da coluna user_agent caso a tabela já tenha sido criada anteriormente
ALTER TABLE public.apc_auditoria DROP COLUMN IF EXISTS user_agent;

-- Índices para consultas rápidas e ordenação
CREATE INDEX IF NOT EXISTS idx_apc_auditoria_created_at ON public.apc_auditoria (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_apc_auditoria_user_id ON public.apc_auditoria (user_id);
CREATE INDEX IF NOT EXISTS idx_apc_auditoria_acao ON public.apc_auditoria (acao);
CREATE INDEX IF NOT EXISTS idx_apc_auditoria_categoria ON public.apc_auditoria (categoria);
CREATE INDEX IF NOT EXISTS idx_apc_auditoria_nivel ON public.apc_auditoria (nivel);

-- Ativar Row Level Security
ALTER TABLE public.apc_auditoria ENABLE ROW LEVEL SECURITY;

-- Limpar políticas antigas se existirem
DROP POLICY IF EXISTS "Permitir insert de auditoria para todos" ON public.apc_auditoria;
DROP POLICY IF EXISTS "Permitir select de auditoria para ADMIN e GESTOR" ON public.apc_auditoria;
DROP POLICY IF EXISTS "Permitir delete de auditoria para ADMIN" ON public.apc_auditoria;

-- 1. Qualquer usuário (autenticado ou anônimo em login/recuperação) pode registrar logs
CREATE POLICY "Permitir insert de auditoria para todos"
ON public.apc_auditoria FOR INSERT
TO public
WITH CHECK (true);

-- 2. Apenas ADMIN e GESTOR podem visualizar a auditoria
CREATE POLICY "Permitir select de auditoria para ADMIN e GESTOR"
ON public.apc_auditoria FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.apc_perfil 
    WHERE user_id = auth.uid() AND perfil IN ('ADMIN', 'GESTOR')
  )
);

-- 3. Somente ADMIN pode limpar/excluir registros se necessário
CREATE POLICY "Permitir delete de auditoria para ADMIN"
ON public.apc_auditoria FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.apc_perfil 
    WHERE user_id = auth.uid() AND perfil = 'ADMIN'
  )
);

-- Notificar recarregamento do schema
NOTIFY pgrst, 'reload schema';
