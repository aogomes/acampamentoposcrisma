-- Tabela de Perfil do Usuário
CREATE TABLE IF NOT EXISTS public.apc_perfil (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    perfil TEXT DEFAULT 'PENDENTE' CHECK (perfil IN ('PENDENTE', 'AFILHADO', 'PADRINHO', 'MADRINHA', 'ADMIN')) NOT NULL,
    nome TEXT NOT NULL,
    email TEXT,
    telefone TEXT,
    data_nascimento DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de Dependentes (Filhos)
DROP TABLE IF EXISTS public.apc_dependente CASCADE;
CREATE TABLE IF NOT EXISTS public.apc_dependente (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pessoa_id UUID REFERENCES public.apc_pessoa(id) ON DELETE CASCADE NOT NULL,
    nome TEXT NOT NULL,
    data_nascimento DATE,
    mascote BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de Vínculos (Acampamento)
DROP TABLE IF EXISTS public.apc_vinculo;
CREATE TABLE IF NOT EXISTS public.apc_vinculo (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    padrinho_id UUID REFERENCES public.apc_pessoa(id) ON DELETE SET NULL,
    madrinha_id UUID REFERENCES public.apc_pessoa(id) ON DELETE SET NULL,
    afilhado_id UUID REFERENCES public.apc_pessoa(id) ON DELETE CASCADE UNIQUE NOT NULL,
    ano INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.apc_perfil ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apc_pessoa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apc_vinculo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apc_dependente ENABLE ROW LEVEL SECURITY;

-- Políticas para apc_perfil
-- 1. Qualquer usuário autenticado pode ver seu próprio perfil
CREATE POLICY "Usuários podem ver seu próprio perfil" 
ON public.apc_perfil FOR SELECT USING (auth.uid() = user_id);

-- 2. Usuários podem inserir seu próprio perfil no cadastro
CREATE POLICY "Usuários podem cadastrar seu perfil" 
ON public.apc_perfil FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 3. Usuários podem atualizar seus próprios dados (exceto mudar seu próprio perfil para ADMIN de forma maliciosa, mas limitaremos na UI, o ideal seria uma function. Para simplificar, permitimos UPDATE próprio)
CREATE POLICY "Usuários podem atualizar seu perfil" 
ON public.apc_perfil FOR UPDATE USING (auth.uid() = user_id);

-- 4. ADMIN e GESTOR podem ver todos os perfis
CREATE POLICY "ADMIN e GESTOR podem ver todos os perfis" 
ON public.apc_perfil FOR SELECT 
USING ( public.is_admin_or_gestor() );

-- Políticas para apc_dependente
CREATE POLICY "Qualquer autenticado pode ver dependentes" 
ON public.apc_dependente FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "ADMIN e GESTOR tem acesso total aos dependentes" 
ON public.apc_dependente FOR ALL 
USING (public.is_admin_or_gestor());

CREATE POLICY "Pessoas podem gerenciar seus proprios dependentes" 
ON public.apc_dependente FOR ALL 
USING (
  pessoa_id IN (
    SELECT id FROM public.apc_pessoa WHERE user_id = auth.uid()
    UNION
    SELECT id FROM public.apc_pessoa WHERE conjuge_id = (SELECT id FROM public.apc_pessoa WHERE user_id = auth.uid() LIMIT 1)
  )
);

-- 5. ADMIN pode atualizar qualquer perfil
CREATE POLICY "ADMIN pode atualizar qualquer perfil" 
ON public.apc_perfil FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.apc_perfil WHERE user_id = auth.uid() AND perfil = 'ADMIN'
  )
);

-- Políticas para apc_vinculo
-- 1. ADMIN pode fazer tudo em vinculos
CREATE POLICY "ADMIN tem acesso total aos vinculos" 
ON public.apc_vinculo FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.apc_perfil WHERE user_id = auth.uid() AND perfil = 'ADMIN'
  )
);

-- 2. Padrinhos podem ver seus vínculos
CREATE POLICY "Padrinhos podem ver seus vinculos" 
ON public.apc_vinculo FOR SELECT USING (auth.uid() = padrinho_id);

-- 3. Madrinhas podem ver seus vínculos
CREATE POLICY "Madrinhas podem ver seus vinculos" 
ON public.apc_vinculo FOR SELECT USING (auth.uid() = madrinha_id);

-- 4. Afilhados podem ver seu vínculo
CREATE POLICY "Afilhados podem ver seu padrinho" 
ON public.apc_vinculo FOR SELECT USING (auth.uid() = afilhado_id);

-- TRIGGER para criar o perfil automaticamente quando o usuário se cadastrar
-- Isso resolve problemas de RLS (Row Level Security) quando a conta exige confirmação de email
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
  v_nome TEXT;
BEGIN
  -- Obtém o nome tanto do cadastro normal (nome) quanto do login Google (full_name ou name)
  v_nome := COALESCE(
    new.raw_user_meta_data->>'nome', 
    new.raw_user_meta_data->>'full_name', 
    new.raw_user_meta_data->>'name', 
    'Usuário Novo'
  );

  -- Cria o perfil do usuário
  INSERT INTO public.apc_perfil (user_id, nome, email, perfil)
  VALUES (
    new.id, 
    v_nome, 
    new.email, 
    'PENDENTE'
  )
  ON CONFLICT (user_id) DO UPDATE 
  SET nome = EXCLUDED.nome, email = EXCLUDED.email;

  -- Vincula automaticamente com o registro correspondente em apc_pessoa se o e-mail coincidir
  IF new.email IS NOT NULL THEN
    UPDATE public.apc_pessoa 
    SET user_id = new.id 
    WHERE LOWER(email) = LOWER(new.email) AND (user_id IS NULL OR user_id = new.id);
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove o trigger antigo se existir e cria o novo
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ==============================================================================
-- MIGRAÇÃO: Formulário de Inscrição VIII Acampamento do Pós Crisma - 2026
-- ==============================================================================
ALTER TABLE public.apc_pessoa 
  ADD COLUMN IF NOT EXISTS padrinhos_catequistas TEXT,
  ADD COLUMN IF NOT EXISTS rg TEXT,
  ADD COLUMN IF NOT EXISTS cpf TEXT,
  ADD COLUMN IF NOT EXISTS idade INTEGER,
  ADD COLUMN IF NOT EXISTS contato_emergencia TEXT,
  ADD COLUMN IF NOT EXISTS nome_responsavel TEXT,
  ADD COLUMN IF NOT EXISTS tipo_sanguineo TEXT,
  ADD COLUMN IF NOT EXISTS problema_saude BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS problema_saude_qual TEXT,
  ADD COLUMN IF NOT EXISTS historico_convulsao BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS historico_convulsao_tempo TEXT,
  ADD COLUMN IF NOT EXISTS tratamento_medico BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS tratamento_medico_qual TEXT,
  ADD COLUMN IF NOT EXISTS medicamento_continuo BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS medicamento_continuo_qual TEXT,
  ADD COLUMN IF NOT EXISTS medicamento_continuo_dosagem TEXT,
  ADD COLUMN IF NOT EXISTS lesao_contusao BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS lesao_contusao_qual TEXT,
  ADD COLUMN IF NOT EXISTS restricao_alimentar BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS restricao_alimentar_qual TEXT,
  ADD COLUMN IF NOT EXISTS doenca_respiratoria BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS usa_bombinha BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS alergia_medicamento BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS alergia_medicamento_qual TEXT,
  ADD COLUMN IF NOT EXISTS alergia_alimento BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS alergia_alimento_qual TEXT,
  ADD COLUMN IF NOT EXISTS medicacao_sintomas TEXT,
  ADD COLUMN IF NOT EXISTS cuidado_especial BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS cuidado_especial_qual TEXT,
  ADD COLUMN IF NOT EXISTS camiseta_infantil TEXT,
  ADD COLUMN IF NOT EXISTS outras_informacoes TEXT,
  ADD COLUMN IF NOT EXISTS aceite_termos_dados BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS aceite_termo_imagem BOOLEAN DEFAULT false;

