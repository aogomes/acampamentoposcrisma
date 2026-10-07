-- ==============================================================================
-- CORREÇÃO DEFINITIVA DE ROW LEVEL SECURITY (RLS)
-- Tabelas: apc_pessoa, apc_acampamento, apc_vinculo, apc_dependente
-- Execute este script no SQL Editor do seu Dashboard Supabase
-- ==============================================================================

-- 1. TABELA: apc_pessoa
ALTER TABLE public.apc_pessoa ENABLE ROW LEVEL SECURITY;

-- Limpar políticas antigas/conflitantes
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

-- Políticas Novas e Claras para apc_pessoa:
-- SELECT: Qualquer usuário logado pode ler pessoas (necessário para buscar a si mesmo, listar padrinhos, madrinhas)
CREATE POLICY "Permitir select para autenticados"
ON public.apc_pessoa FOR SELECT
TO authenticated
USING (true);

-- INSERT: Qualquer usuário logado pode cadastrar sua ficha de inscrição
CREATE POLICY "Permitir insert para autenticados"
ON public.apc_pessoa FOR INSERT
TO authenticated
WITH CHECK (true);

-- UPDATE: O próprio usuário pode atualizar seu cadastro (user_id = auth.uid()) OU ADMIN/GESTOR podem atualizar qualquer pessoa
CREATE POLICY "Permitir update para autenticados"
ON public.apc_pessoa FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.apc_perfil 
    WHERE user_id = auth.uid() AND perfil IN ('ADMIN', 'GESTOR')
  )
);

-- DELETE: Somente ADMIN e GESTOR podem excluir pessoas
CREATE POLICY "Permitir delete para ADMIN"
ON public.apc_pessoa FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.apc_perfil 
    WHERE user_id = auth.uid() AND perfil IN ('ADMIN', 'GESTOR')
  )
);


-- 2. TABELA: apc_acampamento (Inscrições no evento)
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
  pessoa_id IN (SELECT id FROM public.apc_pessoa WHERE user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.apc_perfil 
    WHERE user_id = auth.uid() AND perfil IN ('ADMIN', 'GESTOR')
  )
);

CREATE POLICY "Permitir delete acampamento para autenticados"
ON public.apc_acampamento FOR DELETE
TO authenticated
USING (
  pessoa_id IN (SELECT id FROM public.apc_pessoa WHERE user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.apc_perfil 
    WHERE user_id = auth.uid() AND perfil IN ('ADMIN', 'GESTOR')
  )
);


-- 3. TABELA: apc_vinculo (Vínculos Afilhado - Padrinhos)
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
  afilhado_id IN (SELECT id FROM public.apc_pessoa WHERE user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.apc_perfil 
    WHERE user_id = auth.uid() AND perfil IN ('ADMIN', 'GESTOR')
  )
);


-- 4. TABELA: apc_dependente (Dependentes)
ALTER TABLE public.apc_dependente ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir select dependente para autenticados" ON public.apc_dependente;
DROP POLICY IF EXISTS "Permitir insert dependente para autenticados" ON public.apc_dependente;

CREATE POLICY "Permitir select dependente para autenticados"
ON public.apc_dependente FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Permitir insert dependente para autenticados"
ON public.apc_dependente FOR INSERT
TO authenticated
WITH CHECK (true);
