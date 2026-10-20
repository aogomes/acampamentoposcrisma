-- ==============================================================================
-- CORREÇÃO DEFINITIVA DE ROW LEVEL SECURITY (RLS) - SEM RECURSÃO INFINITA
-- Tabelas: apc_pessoa, apc_acampamento, apc_vinculo, apc_dependente
-- Execute este script no SQL Editor do seu Dashboard Supabase
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. FUNÇÕES AUXILIARES COM SECURITY DEFINER
-- O uso de SECURITY DEFINER impede a avaliação recursiva de RLS pelo PostgreSQL,
-- eliminando 100% o erro "infinite recursion detected in policy for relation"
-- ------------------------------------------------------------------------------

-- Função 1: Verifica se o usuário autenticado pode gerenciar uma determinada pessoa
CREATE OR REPLACE FUNCTION public.pode_gerenciar_pessoa(target_pessoa_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_eh_admin BOOLEAN;
  v_minha_pessoa_id UUID;
BEGIN
  IF target_pessoa_id IS NULL THEN
    RETURN false;
  END IF;

  -- Se for ADMIN ou GESTOR, acesso liberado
  SELECT EXISTS (
    SELECT 1 FROM public.apc_perfil 
    WHERE user_id = auth.uid() AND perfil IN ('ADMIN', 'GESTOR')
  ) INTO v_eh_admin;

  IF v_eh_admin THEN
    RETURN true;
  END IF;

  -- Obter o ID da pessoa associada ao usuário autenticado atual
  SELECT id INTO v_minha_pessoa_id
  FROM public.apc_pessoa
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_minha_pessoa_id IS NULL THEN
    RETURN false;
  END IF;

  -- Se for a própria pessoa
  IF target_pessoa_id = v_minha_pessoa_id THEN
    RETURN true;
  END IF;

  -- Se for uma pessoa cuja inscrição neste acampamento foi criada por este usuário
  IF EXISTS (
    SELECT 1 FROM public.apc_acampamento
    WHERE pessoa_id = target_pessoa_id AND criador_id = v_minha_pessoa_id
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- Função 2: Verifica se o usuário autenticado pode gerenciar dependentes de uma pessoa
CREATE OR REPLACE FUNCTION public.pode_gerenciar_dependente(target_dependente_pessoa_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_eh_admin BOOLEAN;
  v_minha_pessoa_id UUID;
  v_conjuge_id UUID;
BEGIN
  IF target_dependente_pessoa_id IS NULL THEN
    RETURN false;
  END IF;

  -- Se for ADMIN ou GESTOR, acesso liberado
  SELECT EXISTS (
    SELECT 1 FROM public.apc_perfil 
    WHERE user_id = auth.uid() AND perfil IN ('ADMIN', 'GESTOR')
  ) INTO v_eh_admin;

  IF v_eh_admin THEN
    RETURN true;
  END IF;

  SELECT id, conjuge_id INTO v_minha_pessoa_id, v_conjuge_id
  FROM public.apc_pessoa
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_minha_pessoa_id IS NULL THEN
    RETURN false;
  END IF;

  -- O dependente pertence à própria pessoa ou ao seu cônjuge
  IF target_dependente_pessoa_id = v_minha_pessoa_id 
     OR (v_conjuge_id IS NOT NULL AND target_dependente_pessoa_id = v_conjuge_id) THEN
    RETURN true;
  END IF;

  -- Ou pertence a uma pessoa cuja inscrição foi criada por este usuário
  IF EXISTS (
    SELECT 1 FROM public.apc_acampamento
    WHERE pessoa_id = target_dependente_pessoa_id AND criador_id = v_minha_pessoa_id
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;


-- ------------------------------------------------------------------------------
-- 1. TABELA: public.apc_pessoa
-- ------------------------------------------------------------------------------
ALTER TABLE public.apc_pessoa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Qualquer autenticado pode ver pessoas" ON public.apc_pessoa;
DROP POLICY IF EXISTS "Usuários autenticados podem ver pessoas" ON public.apc_pessoa;
DROP POLICY IF EXISTS "Usuários autenticados podem cadastrar pessoas" ON public.apc_pessoa;
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios dados ou ADMIN/GESTOR" ON public.apc_pessoa;
DROP POLICY IF EXISTS "ADMIN e GESTOR podem excluir pessoas" ON public.apc_pessoa;
DROP POLICY IF EXISTS "ADMIN e GESTOR tem acesso total as pessoas" ON public.apc_pessoa;
DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.apc_pessoa;
DROP POLICY IF EXISTS "Permitir insert para autenticados" ON public.apc_pessoa;
DROP POLICY IF EXISTS "Permitir update para autenticados" ON public.apc_pessoa;
DROP POLICY IF EXISTS "Permitir delete para ADMIN" ON public.apc_pessoa;
DROP POLICY IF EXISTS "Pessoas podem ver seus dados" ON public.apc_pessoa;
DROP POLICY IF EXISTS "Pessoas podem cadastrar dados" ON public.apc_pessoa;

-- SELECT: Qualquer autenticado pode ler pessoas
CREATE POLICY "Permitir select para autenticados"
ON public.apc_pessoa FOR SELECT
TO authenticated
USING (true);

-- INSERT: Qualquer autenticado pode cadastrar pessoas
CREATE POLICY "Permitir insert para autenticados"
ON public.apc_pessoa FOR INSERT
TO authenticated
WITH CHECK (true);

-- UPDATE: O próprio usuário (user_id = auth.uid()) OU criador da inscrição OU ADMIN/GESTOR
CREATE POLICY "Permitir update para autenticados"
ON public.apc_pessoa FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  OR public.pode_gerenciar_pessoa(id)
);

-- DELETE: Apenas ADMIN e GESTOR
CREATE POLICY "Permitir delete para ADMIN"
ON public.apc_pessoa FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.apc_perfil 
    WHERE user_id = auth.uid() AND perfil IN ('ADMIN', 'GESTOR')
  )
);


-- ------------------------------------------------------------------------------
-- 2. TABELA: public.apc_acampamento
-- ------------------------------------------------------------------------------
ALTER TABLE public.apc_acampamento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir select acampamento para autenticados" ON public.apc_acampamento;
DROP POLICY IF EXISTS "Permitir insert acampamento para autenticados" ON public.apc_acampamento;
DROP POLICY IF EXISTS "Permitir update acampamento para autenticados" ON public.apc_acampamento;
DROP POLICY IF EXISTS "Permitir delete acampamento para autenticados" ON public.apc_acampamento;

CREATE POLICY "Permitir select acampamento para autenticados"
ON public.apc_acampamento FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Permitir insert acampamento para autenticados"
ON public.apc_acampamento FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Permitir update acampamento para autenticados"
ON public.apc_acampamento FOR UPDATE
TO authenticated
USING (
  public.pode_gerenciar_pessoa(pessoa_id)
);

CREATE POLICY "Permitir delete acampamento para autenticados"
ON public.apc_acampamento FOR DELETE
TO authenticated
USING (
  public.pode_gerenciar_pessoa(pessoa_id)
);


-- ------------------------------------------------------------------------------
-- 3. TABELA: public.apc_vinculo
-- ------------------------------------------------------------------------------
ALTER TABLE public.apc_vinculo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir select vinculo para autenticados" ON public.apc_vinculo;
DROP POLICY IF EXISTS "Permitir insert vinculo para autenticados" ON public.apc_vinculo;
DROP POLICY IF EXISTS "Permitir update vinculo para autenticados" ON public.apc_vinculo;

CREATE POLICY "Permitir select vinculo para autenticados"
ON public.apc_vinculo FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Permitir insert vinculo para autenticados"
ON public.apc_vinculo FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Permitir update vinculo para autenticados"
ON public.apc_vinculo FOR UPDATE
TO authenticated
USING (
  public.pode_gerenciar_pessoa(afilhado_id)
);


-- ------------------------------------------------------------------------------
-- 4. TABELA: public.apc_dependente
-- ------------------------------------------------------------------------------
ALTER TABLE public.apc_dependente ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir select dependente para autenticados" ON public.apc_dependente;
DROP POLICY IF EXISTS "Permitir insert dependente para autenticados" ON public.apc_dependente;
DROP POLICY IF EXISTS "Permitir update dependente para autenticados" ON public.apc_dependente;
DROP POLICY IF EXISTS "Permitir delete dependente para autenticados" ON public.apc_dependente;

CREATE POLICY "Permitir select dependente para autenticados"
ON public.apc_dependente FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Permitir insert dependente para autenticados"
ON public.apc_dependente FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Permitir update dependente para autenticados"
ON public.apc_dependente FOR UPDATE
TO authenticated
USING (
  public.pode_gerenciar_dependente(pessoa_id)
);

CREATE POLICY "Permitir delete dependente para autenticados"
ON public.apc_dependente FOR DELETE
TO authenticated
USING (
  public.pode_gerenciar_dependente(pessoa_id)
);
