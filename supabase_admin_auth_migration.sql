-- ==============================================================================
-- MIGRAÇÃO: GERENCIAMENTO DE ACESSO, EXCLUSÃO E RESET DE SENHA POR ADMIN
-- Execute este script no SQL Editor do seu Dashboard Supabase
-- ==============================================================================

-- 1. Certificar que a extensão pgcrypto está habilitada (necessária para crypt/gen_salt)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Adicionar a coluna deve_alterar_senha na tabela apc_perfil
ALTER TABLE public.apc_perfil 
ADD COLUMN IF NOT EXISTS deve_alterar_senha BOOLEAN DEFAULT false;

-- 3. Função para Administrador Resetar a Senha de um Usuário
CREATE OR REPLACE FUNCTION public.admin_resetar_senha(target_user_id UUID, nova_senha TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- Verificar se quem está chamando a função é ADMIN
  SELECT (perfil = 'ADMIN') INTO v_is_admin
  FROM public.apc_perfil
  WHERE user_id = auth.uid();

  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem resetar senhas.';
  END IF;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'ID do usuário inválido.';
  END IF;

  IF length(nova_senha) < 6 THEN
    RAISE EXCEPTION 'A senha deve conter no mínimo 6 caracteres.';
  END IF;

  -- Atualizar a senha criptografada em auth.users
  UPDATE auth.users
  SET encrypted_password = crypt(nova_senha, gen_salt('bf')),
      updated_at = now()
  WHERE id = target_user_id;

  -- Marcar que o usuário deve alterar a senha no primeiro acesso
  UPDATE public.apc_perfil
  SET deve_alterar_senha = true
  WHERE user_id = target_user_id;

  RETURN true;
END;
$$;

-- 4. Função para Administrador Excluir um Usuário do Sistema
CREATE OR REPLACE FUNCTION public.admin_deletar_usuario(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- Verificar se quem está chamando a função é ADMIN
  SELECT (perfil = 'ADMIN') INTO v_is_admin
  FROM public.apc_perfil
  WHERE user_id = auth.uid();

  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem excluir usuários.';
  END IF;

  -- Impedir auto-exclusão
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode excluir sua própria conta de administrador.';
  END IF;

  -- Desvincular de apc_pessoa caso esteja vinculado
  UPDATE public.apc_pessoa
  SET user_id = NULL
  WHERE user_id = target_user_id;

  -- Excluir da tabela apc_perfil
  DELETE FROM public.apc_perfil
  WHERE user_id = target_user_id;

  -- Excluir da autenticação (auth.users)
  DELETE FROM auth.users
  WHERE id = target_user_id;

  RETURN true;
END;
$$;

-- 5. Função para o Usuário Concluir a Alteração Obrigatória de Senha
CREATE OR REPLACE FUNCTION public.concluir_alteracao_senha()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Desmarca a flag do usuário autenticado atual
  UPDATE public.apc_perfil
  SET deve_alterar_senha = false
  WHERE user_id = auth.uid();

  RETURN true;
END;
$$;

-- 6. Conceder permissão de execução para usuários autenticados
GRANT EXECUTE ON FUNCTION public.admin_resetar_senha(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_deletar_usuario(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.concluir_alteracao_senha() TO authenticated;
