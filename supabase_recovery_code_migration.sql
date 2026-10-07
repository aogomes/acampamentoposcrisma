-- ==============================================================================
-- MIGRAÇÃO: RECUPERAÇÃO DE SENHA POR CÓDIGO DE 6 DÍGITOS (VALIDADE 15 MINUTOS)
-- Execute este script no SQL Editor do seu Dashboard Supabase
-- ==============================================================================

-- 1. Certificar que a extensão pgcrypto está habilitada
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Garantir coluna deve_alterar_senha no apc_perfil
ALTER TABLE public.apc_perfil 
ADD COLUMN IF NOT EXISTS deve_alterar_senha BOOLEAN DEFAULT false;

-- 3. Tabela de Códigos de Recuperação
CREATE TABLE IF NOT EXISTS public.apc_recuperacao_codigo (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL,
    codigo TEXT NOT NULL,
    expira_em TIMESTAMP WITH TIME ZONE NOT NULL,
    usado BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.apc_recuperacao_codigo ENABLE ROW LEVEL SECURITY;

-- 4. Função para Gerar Código de 6 Dígitos com validade de 15 minutos
-- (Pode ser chamada de forma anônima/pública pela tela de Login)
CREATE OR REPLACE FUNCTION public.gerar_codigo_recuperacao(p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email_norm TEXT;
  v_user_id UUID;
  v_nome TEXT;
  v_codigo TEXT;
  v_expira_em TIMESTAMP WITH TIME ZONE;
BEGIN
  v_email_norm := lower(trim(p_email));

  -- Verificar se existe usuário com esse e-mail
  SELECT id INTO v_user_id 
  FROM auth.users 
  WHERE lower(email) = v_email_norm 
  LIMIT 1;

  IF v_user_id IS NULL THEN
    -- Também consulta na tabela de perfil
    SELECT user_id, nome INTO v_user_id, v_nome
    FROM public.apc_perfil
    WHERE lower(email) = v_email_norm
    LIMIT 1;
  ELSE
    SELECT nome INTO v_nome
    FROM public.apc_perfil
    WHERE user_id = v_user_id;
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Nenhuma conta encontrada com o e-mail informado.';
  END IF;

  -- Invalida códigos anteriores não usados deste e-mail
  UPDATE public.apc_recuperacao_codigo
  SET usado = true
  WHERE lower(email) = v_email_norm AND usado = false;

  -- Gera código aleatório de 6 dígitos numéricos (ex: 489215)
  v_codigo := lpad(floor(100000 + random() * 900000)::text, 6, '0');
  
  -- Define validade de 15 minutos a partir de agora
  v_expira_em := now() + interval '15 minutes';

  -- Salva o código
  INSERT INTO public.apc_recuperacao_codigo (email, codigo, expira_em, usado)
  VALUES (v_email_norm, v_codigo, v_expira_em, false);

  RETURN jsonb_build_object(
    'sucesso', true,
    'email', v_email_norm,
    'nome', coalesce(v_nome, 'Usuário'),
    'codigo', v_codigo,
    'expira_em', v_expira_em
  );
END;
$$;

-- 5. Função para Validar o Código de 6 dígitos e Alterar a Senha
CREATE OR REPLACE FUNCTION public.validar_codigo_e_alterar_senha(
  p_email TEXT, 
  p_codigo TEXT, 
  p_nova_senha TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_email_norm TEXT;
  v_codigo_reg RECORD;
  v_user_id UUID;
BEGIN
  v_email_norm := lower(trim(p_email));

  IF length(p_nova_senha) < 6 THEN
    RAISE EXCEPTION 'A nova senha deve ter no mínimo 6 caracteres.';
  END IF;

  -- Buscar o código mais recente válido para este e-mail
  SELECT * INTO v_codigo_reg
  FROM public.apc_recuperacao_codigo
  WHERE lower(email) = v_email_norm
    AND codigo = trim(p_codigo)
    AND usado = false
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_codigo_reg IS NULL THEN
    RAISE EXCEPTION 'Código inválido ou já utilizado. Verifique os 6 dígitos digitados.';
  END IF;

  -- Validar se já passaram mais de 15 minutos
  IF now() > v_codigo_reg.expira_em THEN
    UPDATE public.apc_recuperacao_codigo SET usado = true WHERE id = v_codigo_reg.id;
    RAISE EXCEPTION 'Este código expirou (validade de 15 minutos). Por favor, solicite um novo código.';
  END IF;

  -- Localizar o usuário em auth.users
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = v_email_norm
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado para atualizar a senha.';
  END IF;

  -- 1. Atualizar a senha em auth.users
  UPDATE auth.users
  SET encrypted_password = crypt(p_nova_senha, gen_salt('bf')),
      updated_at = now()
  WHERE id = v_user_id;

  -- 2. Marcar o código como utilizado
  UPDATE public.apc_recuperacao_codigo
  SET usado = true
  WHERE id = v_codigo_reg.id;

  -- 3. Remover flag de troca de senha obrigatória se houver
  UPDATE public.apc_perfil
  SET deve_alterar_senha = false
  WHERE user_id = v_user_id;

  RETURN true;
END;
$$;

-- 6. Função para Administrador Resetar a Senha Manualmente
CREATE OR REPLACE FUNCTION public.admin_resetar_senha(target_user_id UUID, nova_senha TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  SELECT (perfil = 'ADMIN') INTO v_is_admin
  FROM public.apc_perfil
  WHERE user_id = auth.uid();

  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem resetar senhas.';
  END IF;

  IF length(nova_senha) < 6 THEN
    RAISE EXCEPTION 'A senha deve conter no mínimo 6 caracteres.';
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(nova_senha, gen_salt('bf')),
      updated_at = now()
  WHERE id = target_user_id;

  UPDATE public.apc_perfil
  SET deve_alterar_senha = true
  WHERE user_id = target_user_id;

  RETURN true;
END;
$$;

-- 7. Função para Administrador Excluir um Usuário do Sistema
CREATE OR REPLACE FUNCTION public.admin_deletar_usuario(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  SELECT (perfil = 'ADMIN') INTO v_is_admin
  FROM public.apc_perfil
  WHERE user_id = auth.uid();

  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem excluir usuários.';
  END IF;

  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode excluir sua própria conta de administrador.';
  END IF;

  UPDATE public.apc_pessoa
  SET user_id = NULL
  WHERE user_id = target_user_id;

  DELETE FROM public.apc_perfil
  WHERE user_id = target_user_id;

  DELETE FROM auth.users
  WHERE id = target_user_id;

  RETURN true;
END;
$$;

-- 8. Função para o Usuário Concluir a Alteração Obrigatória de Senha
CREATE OR REPLACE FUNCTION public.concluir_alteracao_senha()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.apc_perfil
  SET deve_alterar_senha = false
  WHERE user_id = auth.uid();

  RETURN true;
END;
$$;

-- 9. Conceder permissões para anon e authenticated
GRANT EXECUTE ON FUNCTION public.gerar_codigo_recuperacao(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validar_codigo_e_alterar_senha(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resetar_senha(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_deletar_usuario(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.concluir_alteracao_senha() TO authenticated;

