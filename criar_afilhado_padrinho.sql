-- ==============================================================================
-- FUNÇÃO RPC: criar_afilhado_padrinho
-- Execute este script no SQL Editor do seu Dashboard Supabase
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.criar_afilhado_padrinho(
  p_nome TEXT,
  p_email TEXT DEFAULT NULL,
  p_telefone TEXT DEFAULT NULL,
  p_data_nascimento DATE DEFAULT NULL,
  p_evento_id UUID DEFAULT NULL,
  p_ano INTEGER DEFAULT 2026,
  p_sexo TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_padrinho_id UUID;
  v_tipo_pessoa TEXT;
  v_conjuge_id UUID;
  v_novo_afilhado_id UUID;
BEGIN
  IF p_nome IS NULL OR trim(p_nome) = '' THEN
    RAISE EXCEPTION 'O nome do afilhado é obrigatório.';
  END IF;

  -- 1. Localiza a pessoa correspondente ao usuário autenticado (Padrinho ou Madrinha)
  SELECT id, tipo_pessoa, conjuge_id 
  INTO v_padrinho_id, v_tipo_pessoa, v_conjuge_id
  FROM public.apc_pessoa
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_padrinho_id IS NULL THEN
    RAISE EXCEPTION 'Acesso negado: seu usuário autenticado não possui uma pessoa vinculada como Padrinho/Madrinha.';
  END IF;

  -- 2. Insere o afilhado em apc_pessoa
  INSERT INTO public.apc_pessoa (
    nome,
    email,
    telefone,
    data_nascimento,
    sexo,
    tipo_pessoa,
    ano
  ) VALUES (
    trim(p_nome),
    NULLIF(trim(p_email), ''),
    NULLIF(trim(p_telefone), ''),
    p_data_nascimento,
    NULLIF(trim(p_sexo), ''),
    'AFILHADO',
    COALESCE(p_ano, extract(year from now())::integer)
  )
  RETURNING id INTO v_novo_afilhado_id;

  -- 3. Cria o vínculo em apc_vinculo
  INSERT INTO public.apc_vinculo (
    afilhado_id,
    padrinho_id,
    madrinha_id,
    ano
  ) VALUES (
    v_novo_afilhado_id,
    CASE 
      WHEN UPPER(COALESCE(v_tipo_pessoa, '')) = 'PADRINHO' THEN v_padrinho_id 
      WHEN UPPER(COALESCE(v_tipo_pessoa, '')) = 'MADRINHA' THEN v_conjuge_id 
      ELSE v_padrinho_id 
    END,
    CASE 
      WHEN UPPER(COALESCE(v_tipo_pessoa, '')) = 'MADRINHA' THEN v_padrinho_id 
      WHEN UPPER(COALESCE(v_tipo_pessoa, '')) = 'PADRINHO' THEN v_conjuge_id 
      ELSE NULL 
    END,
    COALESCE(p_ano, extract(year from now())::integer)
  );

  -- 4. Se tiver evento ativo selecionado, inscreve em apc_acampamento
  IF p_evento_id IS NOT NULL THEN
    INSERT INTO public.apc_acampamento (
      evento_id,
      pessoa_id,
      equipe
    ) VALUES (
      p_evento_id,
      v_novo_afilhado_id,
      '{}'::text[]
    );
  END IF;

  RETURN jsonb_build_object(
    'sucesso', true,
    'afilhado_id', v_novo_afilhado_id,
    'mensagem', 'Afilhado cadastrado e vinculado com sucesso.'
  );
END;
$$;

-- Conceder permissão de execução
GRANT EXECUTE ON FUNCTION public.criar_afilhado_padrinho(TEXT, TEXT, TEXT, DATE, UUID, INTEGER, TEXT) TO authenticated;

-- Forçar recarregamento do cache do PostgREST
NOTIFY pgrst, 'reload schema';
